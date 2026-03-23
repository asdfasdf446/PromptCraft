package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"promptcraft/backend/game"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for LAN access
		},
	}

	world   = game.NewWorld()
	clients = make(map[*websocket.Conn]string) // conn -> unit_id
	mu      sync.Mutex
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

	// Spawn unit for this player
	unitID := uuid.New().String()
	playerName := "Player-" + unitID[:8]
	unit, err := world.SpawnUnit(unitID, playerName)
	if err != nil {
		log.Println("Spawn error:", err)
		conn.WriteJSON(map[string]string{"error": err.Error()})
		return
	}

	mu.Lock()
	clients[conn] = unitID
	mu.Unlock()

	log.Printf("Player %s spawned at (%d, %d)\n", playerName, unit.X, unit.Y)

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
	world.RemoveUnit(unitID)
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
	// Start game loops
	go tickLoop()
	go qiRegenLoop()

	// Serve static files (frontend)
	fs := http.FileServer(http.Dir("../frontend/dist"))
	http.Handle("/", fs)

	// WebSocket endpoint
	http.HandleFunc("/ws", handleWebSocket)

	log.Println("Server starting on 0.0.0.0:8080")
	log.Fatal(http.ListenAndServe("0.0.0.0:8080", nil))
}
