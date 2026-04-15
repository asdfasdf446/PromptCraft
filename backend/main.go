package main

import (
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"promptcraft/backend/auth"
	dbpkg "promptcraft/backend/db"
	"promptcraft/backend/game"
	"promptcraft/backend/handlers"
	"promptcraft/backend/store"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

type ClientSession struct {
	UnitID string
	UID    string // JWT uid claim
	Role   string // "guest" | "user"
}

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for LAN access
		},
	}

	world       = game.NewWorld()
	clients     = make(map[*websocket.Conn]*ClientSession)
	mu          sync.Mutex
	sqliteDB    *sql.DB
	rdb         *redis.Client
	jwtSecret   []byte
	debugLogger *log.Logger
)

type ClientCommand struct {
	Type      string `json:"type,omitempty"`
	RequestID string `json:"request_id,omitempty"`
	Command   string `json:"command"`
	UnitID    string `json:"unit_id"`
}

type CommandResult struct {
	Type        string `json:"type"`
	RequestID   string `json:"request_id,omitempty"`
	UnitID      string `json:"unit_id,omitempty"`
	Command     string `json:"command,omitempty"`
	Status      string `json:"status"`
	Code        string `json:"code"`
	Message     string `json:"message"`
	QueueLength int    `json:"queue_length,omitempty"`
	QueueLimit  int    `json:"queue_limit,omitempty"`
	Tick        int64  `json:"tick"`
}

type TileState struct {
	GridX int    `json:"grid_x"`
	GridY int    `json:"grid_y"`
	Kind  string `json:"kind"`
}

type UnitState struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	GridX       int      `json:"grid_x"`
	GridY       int      `json:"grid_y"`
	StackLevel  int      `json:"stack_level"`
	HP          int      `json:"hp"`
	Qi          int      `json:"qi,omitempty"`
	Name        string   `json:"name"`
	Model       string   `json:"model"`
	ActionQueue []string `json:"action_queue"`
}

type ActionEvent struct {
	UnitID           string `json:"unit_id"`
	Action           string `json:"action"`
	X                int    `json:"x"`
	Y                int    `json:"y"`
	StackLevel       int    `json:"stack_level"`
	TargetX          int    `json:"target_x"`
	TargetY          int    `json:"target_y"`
	TargetStackLevel int    `json:"target_stack_level"`
}

type DeathEvent struct {
	UnitID     string `json:"unit_id"`
	Kind       string `json:"kind"`
	GridX      int    `json:"grid_x"`
	GridY      int    `json:"grid_y"`
	StackLevel int    `json:"stack_level"`
	Model      string `json:"model"`
}

type ServerWorldState struct {
	Tiles   []TileState   `json:"tiles"`
	Units   []UnitState   `json:"units"`
	Tick    int64         `json:"tick"`
	Actions []ActionEvent `json:"actions,omitempty"`
	Deaths  []DeathEvent  `json:"deaths,omitempty"`
}

func writeCommandResult(conn *websocket.Conn, result CommandResult) {
	if err := conn.WriteJSON(result); err != nil {
		log.Println("Command result write error:", err)
	}
}

func debugLog(format string, args ...any) {
	if debugLogger != nil {
		debugLogger.Printf(format, args...)
	}
}

func initDebugLogger() {
	if err := os.MkdirAll("./logs", 0755); err != nil {
		log.Printf("Debug log directory init failed: %v\n", err)
		return
	}

	logFile, err := os.OpenFile(filepath.Join("./logs", "debug.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("Debug log init failed: %v\n", err)
		return
	}

	debugLogger = log.New(io.MultiWriter(logFile), "[debug] ", log.LstdFlags)
}

func buildCommandResult(cmd ClientCommand, unitID string, status string, code string, message string, queueLength int, queueLimit int) CommandResult {
	return CommandResult{
		Type:        "command_result",
		RequestID:   cmd.RequestID,
		UnitID:      unitID,
		Command:     cmd.Command,
		Status:      status,
		Code:        code,
		Message:     message,
		QueueLength: queueLength,
		QueueLimit:  queueLimit,
		Tick:        world.Tick,
	}
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	// Auth handshake: first message must be {"type":"auth","token":"..."}
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	var authMsg map[string]string
	if err := conn.ReadJSON(&authMsg); err != nil {
		log.Println("Auth read error:", err)
		conn.WriteJSON(map[string]string{"type": "error", "code": "auth_failed", "message": "auth timeout or invalid message"})
		return
	}
	conn.SetReadDeadline(time.Time{}) // clear deadline

	if authMsg["type"] != "auth" || authMsg["token"] == "" {
		conn.WriteJSON(map[string]string{"type": "error", "code": "auth_failed", "message": "first message must be auth"})
		return
	}

	claims, err := auth.ValidateClaims(authMsg["token"], jwtSecret)
	if err != nil {
		conn.WriteJSON(map[string]string{"type": "error", "code": "auth_failed", "message": "invalid token"})
		return
	}

	// Spawn unit for this player
	unitID := uuid.New().String()
	playerName := "Player-" + unitID[:8]
	unit, err := world.SpawnUnit(unitID, playerName)
	if err != nil {
		log.Println("Spawn error:", err)
		conn.WriteJSON(map[string]string{"error": err.Error()})
		return
	}

	session := &ClientSession{UnitID: unitID, UID: claims.UID, Role: claims.Role}
	mu.Lock()
	clients[conn] = session
	mu.Unlock()

	// Sync initial state to Redis
	if err := store.WriteUnit(rdb, unit, claims.UID, claims.Role); err != nil {
		log.Printf("Redis sync failed for unit %s: %v\n", unit.ID, err)
	}

	log.Printf("Player %s (%s) spawned at (%d, %d, %d)\n", playerName, claims.Role, unit.GridX, unit.GridY, unit.StackLevel)

	// Notify client of their unit ID
	conn.WriteJSON(map[string]string{"type": "auth_ok", "unit_id": unitID})

	// Send initial state
	broadcastWorldState()

	// Handle incoming commands
	for {
		var cmd ClientCommand
		err := conn.ReadJSON(&cmd)
		if err != nil {
			log.Println("Read error:", err)
			break
		}

		if cmd.Type != "" && cmd.Type != "command" {
			debugLog("command rejected request_id=%s code=malformed_message reason=unsupported_message_type player=%s", cmd.RequestID, playerName)
			writeCommandResult(conn, buildCommandResult(cmd, unitID, "rejected", "malformed_message", "unsupported message type", 0, game.MaxActionQueueLength))
			continue
		}

		if cmd.Command == "" || cmd.UnitID == "" {
			debugLog("command rejected request_id=%s code=malformed_message reason=missing_fields player=%s", cmd.RequestID, playerName)
			writeCommandResult(conn, buildCommandResult(cmd, unitID, "rejected", "malformed_message", "command and unit_id are required", 0, game.MaxActionQueueLength))
			continue
		}

		// Validate unit ownership
		if cmd.UnitID != unitID {
			debugLog("command rejected request_id=%s code=unit_mismatch player=%s unit_id=%s session_unit_id=%s", cmd.RequestID, playerName, cmd.UnitID, unitID)
			writeCommandResult(conn, buildCommandResult(cmd, unitID, "rejected", "unit_mismatch", "unit_id does not belong to this connection", 0, game.MaxActionQueueLength))
			continue
		}

		// Enqueue command
		result := world.EnqueueCommandForUnit(unitID, cmd.Command)
		if result.Accepted {
			log.Printf("Player %s queued command: %s\n", playerName, cmd.Command)
			debugLog("command accepted request_id=%s player=%s unit_id=%s command=%s queue_length=%d queue_limit=%d", cmd.RequestID, playerName, unitID, cmd.Command, result.QueueLength, result.QueueLimit)
			writeCommandResult(conn, buildCommandResult(cmd, unitID, "accepted", string(result.Code), "command queued", result.QueueLength, result.QueueLimit))
			// Broadcast updated state immediately so UI reflects the queue
			broadcastWorldState()
		} else {
			message := "command rejected"
			switch result.Code {
			case game.EnqueueCommandResultInvalidCommand:
				message = "invalid command"
			case game.EnqueueCommandResultQueueFull:
				message = "action queue is full"
			case game.EnqueueCommandResultUnitNotFound:
				message = "unit not found"
			}
			debugLog("command rejected request_id=%s player=%s unit_id=%s command=%s code=%s queue_length=%d queue_limit=%d", cmd.RequestID, playerName, unitID, cmd.Command, result.Code, result.QueueLength, result.QueueLimit)
			writeCommandResult(conn, buildCommandResult(cmd, unitID, "rejected", string(result.Code), message, result.QueueLength, result.QueueLimit))
		}
	}

	// Cleanup
	mu.Lock()
	delete(clients, conn)
	mu.Unlock()

	// Capture snapshot before removing from world
	snapshot := world.Units[unitID]

	world.RemoveUnit(unitID)

	// Role-based cleanup
	switch session.Role {
	case "guest":
		store.DeleteUnit(rdb, unitID)
	case "user":
		go func() {
			if err := dbpkg.UpsertSnapshot(sqliteDB, session.UID, snapshot); err != nil {
				log.Printf("Snapshot save failed for user %s: %v\n", session.UID, err)
			}
			store.DeleteUnit(rdb, unitID)
		}()
	}

	broadcastWorldState()
	log.Printf("Player %s disconnected\n", playerName)
}

func broadcastWorldState() {
	mu.Lock()
	defer mu.Unlock()

	state := ServerWorldState{
		Tiles: []TileState{},
		Units: []UnitState{},
		Tick:  world.Tick,
	}

	for x := 0; x < game.GridSize; x++ {
		for y := 0; y < game.GridSize; y++ {
			state.Tiles = append(state.Tiles, TileState{GridX: x, GridY: y, Kind: string(world.Tiles[x][y].Kind)})
		}
	}

	// Add actions from last tick
	for _, action := range world.LastActions {
		state.Actions = append(state.Actions, ActionEvent{
			UnitID:           action.UnitID,
			Action:           action.Action,
			X:                action.X,
			Y:                action.Y,
			StackLevel:       action.StackLevel,
			TargetX:          action.TargetX,
			TargetY:          action.TargetY,
			TargetStackLevel: action.TargetStackLevel,
		})
	}

	for _, death := range world.LastDeaths {
		state.Deaths = append(state.Deaths, DeathEvent{
			UnitID:     death.UnitID,
			Kind:       string(death.Kind),
			GridX:      death.GridX,
			GridY:      death.GridY,
			StackLevel: death.StackLevel,
			Model:      death.Model,
		})
	}

	for _, unit := range world.Units {
		unitState := UnitState{
			ID:          unit.ID,
			Kind:        string(unit.Kind),
			GridX:       unit.GridX,
			GridY:       unit.GridY,
			StackLevel:  unit.StackLevel,
			HP:          unit.HP,
			Name:        unit.Name,
			Model:       unit.Model,
			ActionQueue: unit.ActionQueue,
		}
		if unit.Kind == game.UnitKindPlayer {
			unitState.Qi = unit.Qi
		}
		state.Units = append(state.Units, unitState)
	}

	data, _ := json.Marshal(state)

	for conn := range clients {
		err := conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			log.Println("Broadcast error:", err)
			conn.Close()
			delete(clients, conn)
		}
	}
}

func tickLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		world.ProcessTick()
		broadcastWorldState()
		log.Printf("Tick %d processed\n", world.Tick)
	}
}

func qiRegenLoop() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		world.RegenerateQi()
		log.Println("Qi regenerated")
	}
}

func main() {
	// Load JWT secret
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET environment variable not set")
	}
	jwtSecret = []byte(secret)

	// Init debug logger
	initDebugLogger()
	debugLog("debug logger initialized")

	// Init SQLite
	sqliteDB = dbpkg.Open("./promptcraft.db")
	defer sqliteDB.Close()

	// Init Redis
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	rdb = store.NewClient(redisAddr)

	// Start game loops
	go tickLoop()
	go qiRegenLoop()

	// Serve static files (frontend)
	fs := http.FileServer(http.Dir("../frontend/dist"))
	http.Handle("/", fs)

	// Auth endpoints
	http.HandleFunc("/register", handlers.RegisterHandler(sqliteDB))
	http.HandleFunc("/login", handlers.LoginHandler(sqliteDB, jwtSecret))
	http.HandleFunc("/guest", handlers.GuestHandler(rdb, jwtSecret))

	// WebSocket endpoint
	http.HandleFunc("/ws", handleWebSocket)

	serverAddr := os.Getenv("SERVER_ADDR")
	if serverAddr == "" {
		serverAddr = "0.0.0.0:8081"
	}

	log.Printf("Server starting on %s", serverAddr)
	log.Fatal(http.ListenAndServe(serverAddr, nil))
}
