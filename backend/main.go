package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
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

	world     = game.NewWorld()
	clients   = make(map[*websocket.Conn]*ClientSession)
	mu        sync.Mutex
	sqliteDB  *sql.DB
	rdb       *redis.Client
	jwtSecret []byte
)

type ClientCommand struct {
	Command string `json:"command"`
	UnitID  string `json:"unit_id"`
}

type UnitState struct {
	ID          string   `json:"id"`
	X           int      `json:"x"`
	Y           int      `json:"y"`
	HP          int      `json:"hp"`
	Qi          int      `json:"qi"`
	Name        string   `json:"name"`
	Model       string   `json:"model"`
	ActionQueue []string `json:"action_queue"`
}

type ActionEvent struct {
	UnitID string `json:"unit_id"`
	Action string `json:"action"`
	X      int    `json:"x"`
	Y      int    `json:"y"`
}

type ServerWorldState struct {
	Units   []UnitState   `json:"units"`
	Tick    int64         `json:"tick"`
	Actions []ActionEvent `json:"actions,omitempty"`
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

	log.Printf("Player %s (%s) spawned at (%d, %d)\n", playerName, claims.Role, unit.X, unit.Y)

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

		// Validate unit ownership
		if cmd.UnitID != unitID {
			continue
		}

		// Enqueue command
		if world.EnqueueCommandForUnit(unitID, cmd.Command) {
			log.Printf("Player %s queued command: %s\n", playerName, cmd.Command)
			// Broadcast updated state immediately so UI reflects the queue
			broadcastWorldState()
		} else {
			conn.WriteJSON(map[string]string{"error": "指令错误"})
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
		Units: []UnitState{},
		Tick:  world.Tick,
	}

	// Add actions from last tick
	for _, action := range world.LastActions {
		state.Actions = append(state.Actions, ActionEvent{
			UnitID: action.UnitID,
			Action: action.Action,
			X:      action.X,
			Y:      action.Y,
		})
	}

	for _, unit := range world.Units {
		state.Units = append(state.Units, UnitState{
			ID:          unit.ID,
			X:           unit.X,
			Y:           unit.Y,
			HP:          unit.HP,
			Qi:          unit.Qi,
			Name:        unit.Name,
			Model:       unit.Model,
			ActionQueue: unit.ActionQueue,
		})
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

	log.Println("Server starting on 0.0.0.0:8080")
	log.Fatal(http.ListenAndServe("0.0.0.0:8080", nil))
}
