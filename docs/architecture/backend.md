# Backend Architecture

Detailed technical documentation for the PromptCraft Go backend.

---

## Package Overview

```
backend/
├── main.go          # HTTP server, WebSocket handler, goroutine management
└── game/
    ├── world.go     # World state, grid, tick processing, model assignment
    └── unit.go      # Unit struct, action queue, command validation
```

---

## main.go

### Responsibilities

- Initialize HTTP server on `0.0.0.0:8080`
- Serve frontend static files from `../frontend/dist/`
- Accept WebSocket connections at `/ws`
- Manage connected clients (thread-safe map)
- Run tick loop (every 5s) and qi regen loop (every 10s)
- Broadcast world state to all clients

### Client Management

```go
var (
    clients   = make(map[*websocket.Conn]string)  // conn → unit_id
    clientsMu sync.RWMutex
)
```

### Goroutine Architecture

```
main()
├── go tickLoop()          // Every 5s: ProcessTick() + broadcast
├── go qiRegenLoop()       // Every 10s: RegenerateQi()
└── http.ListenAndServe()  // Accept connections
    └── go handleWebSocket(conn)  // Per-client goroutine
```

### Message Types

**Incoming** (client → server):
```go
type ClientMessage struct {
    Command string `json:"command"`
    UnitID  string `json:"unit_id"`
}
```

**Outgoing** (server → client):
```go
type ServerWorldState struct {
    Units   []UnitState    `json:"units"`
    Tick    int64          `json:"tick"`
    Actions []ActionEvent  `json:"actions,omitempty"`
}
```

---

## game/world.go

### World Struct

```go
type World struct {
    mu          sync.RWMutex
    Grid        [GridSize][GridSize]*Unit
    Units       map[string]*Unit
    Tick        int64
    rng         *rand.Rand
    LastActions []ActionEvent
}
```

### Grid Design

- 2D array `[30][30]*Unit` for O(1) spatial lookup
- `nil` = empty cell, `*Unit` = occupied
- Updated atomically during tick processing

### Tick Processing (`ProcessTick`)

Two-phase execution under write lock:

**Phase 1 — Moves**:
1. Collect move intents: `map[unit_id][2]int`
2. Build cell targets: `map[[2]int][]unit_id`
3. For each intent: check `Grid[x][y] != nil` (occupied) or `len(targets) > 1` (collision)
4. Execute or fail, always consume qi and dequeue

**Phase 2 — Attacks**:
1. Process attack commands from units with qi ≥ 2
2. Apply damage to `Grid[targetX][targetY]`
3. Remove dead units from both `Grid` and `Units`

### Model Assignment

```go
var availableModels = []string{
    "animals/animal-bunny.glb",
    // ... 15 total
}

func (w *World) selectLeastUsedModel() string {
    // Count usage → find minimum → random select from minimums
}
```

---

## game/unit.go

### Unit Struct

```go
type Unit struct {
    ID          string
    Name        string
    Model       string
    X, Y        int
    HP          int      // Default: 10
    Qi          int      // Default: 10, max: 10
    Attack      int      // Default: 1
    ActionQueue []string // Max: 10 commands
    mu          sync.Mutex
}
```

### Command Validation

`EnqueueCommand()` validates against allowed command set before appending. Invalid commands are silently rejected (no qi cost).

Valid commands: `move_up`, `move_down`, `move_left`, `move_right`, `attack_up`, `attack_down`, `attack_left`, `attack_right`

---

## Concurrency Safety

| Resource | Lock Type | Held By |
|----------|-----------|---------|
| `World.Grid` | `sync.RWMutex` | Tick loop (write), broadcast (read) |
| `World.Units` | `sync.RWMutex` | Tick loop (write), broadcast (read) |
| `Unit.ActionQueue` | `sync.Mutex` | WebSocket handler (write), tick (write) |
| `clients` map | `sync.RWMutex` | Connect/disconnect (write), broadcast (read) |

---

## See Also

- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) - Full system architecture
- [../../API.md](../../API.md) - WebSocket protocol
- [../../CONTRIBUTING.md](../../CONTRIBUTING.md) - How to add commands/unit types
