# Backend — PromptCraft

Go backend server for PromptCraft. Handles WebSocket connections, game logic, and serves the frontend.

---

## Quick Start

```bash
cd backend
go run main.go
```

Server starts on `0.0.0.0:8080`. Serves both WebSocket (`/ws`) and static frontend files (`/`).

---

## Package Structure

```
backend/
├── main.go          # Entry point: HTTP server, WebSocket handler, tick loops
└── game/
    ├── world.go     # World state, tick processing, model assignment
    └── unit.go      # Unit struct, command validation, action queue
```

---

## Core Components

### `main.go`

- **HTTP Server**: Serves frontend static files from `../frontend/dist/`
- **WebSocket Handler**: `handleWebSocket()` — one goroutine per client
- **Tick Loop**: `time.Ticker` every 5s → `world.ProcessTick()` → broadcast
- **Qi Regen Loop**: `time.Ticker` every 10s → `world.RegenerateQi()`
- **Broadcast**: Sends JSON world state to all connected clients

**Key types**:
```go
type UnitState struct {
    ID          string   `json:"id"`
    X, Y        int      `json:"x,y"`
    HP, Qi      int      `json:"hp,qi"`
    Name        string   `json:"name"`
    Model       string   `json:"model"`
    ActionQueue []string `json:"action_queue"`
}

type ServerWorldState struct {
    Units   []UnitState    `json:"units"`
    Tick    int64          `json:"tick"`
    Actions []ActionEvent  `json:"actions,omitempty"`
}
```

### `game/world.go`

- **Grid**: `[30][30]*Unit` — spatial lookup for collision detection
- **Units**: `map[string]*Unit` — UUID-indexed unit registry
- **ProcessTick()**: Two-phase execution (moves first, then attacks)
- **selectLeastUsedModel()**: Assigns animal models with minimal duplication

**Constants**:
```go
const (
    GridSize   = 30
    MaxPlayers = 10
)
```

### `game/unit.go`

- **Unit struct**: HP, Qi, position, action queue, model path
- **EnqueueCommand()**: Validates command string, appends to queue (max 10)
- **Command results**: Every submission returns an explicit accepted/rejected result code to the originating client
- **NewUnit()**: Constructor with default HP=10, Qi=10, Attack=1

---

## Tick Processing

### Phase 1: Move Commands

1. Collect all move intents from units with qi ≥ 1
2. Build `cellTargets` map to detect collisions
3. For each intent: check if cell occupied or contested
4. Execute valid moves, consume qi, dequeue command
5. Failed moves still consume qi

### Phase 2: Attack Commands

1. Process all attack commands from units with qi ≥ 2
2. Apply 1 damage to target unit (if present)
3. Remove units with HP ≤ 0
4. Consume qi, dequeue command

### Conflict Resolution

- Multiple units targeting same cell → all moves fail
- Occupied cell → move fails
- Attack with no target → qi consumed, no effect

---

## WebSocket Protocol

### Client → Server

```json
{"command": "move_up", "unit_id": "uuid-here"}
```

Valid commands: `move_up`, `move_down`, `move_left`, `move_right`, `attack_up`, `attack_down`, `attack_left`, `attack_right`

### Server → Client

```json
{
  "type": "command_result",
  "request_id": "cmd-1",
  "status": "accepted",
  "code": "queued",
  "message": "command queued",
  "queue_length": 1,
  "queue_limit": 10,
  "tick": 42
}
```

Command acknowledgements are sent to the submitting client for every command. Shared world state is still broadcast after accepted queue updates and on every tick.

```json
{
  "units": [{"id": "...", "x": 5, "y": 10, "hp": 10, "qi": 7, "name": "...", "model": "animals/animal-cat.glb", "action_queue": ["move_up"]}],
  "tick": 42,
  "actions": [{"unit_id": "...", "action": "move_up", "x": 5, "y": 9}]
}
```

Broadcast happens after every tick (5s) and after every command received.

---

## Concurrency

- `sync.RWMutex` on `World` — multiple readers, exclusive writer
- `sync.Mutex` on `Unit.ActionQueue` — safe concurrent enqueue
- Tick and qi-regen goroutines hold write lock during processing
- Broadcast holds read lock (all clients receive simultaneously)

---

## Logging

Server logs to stdout, and protocol/debug details are additionally written to `backend/logs/debug.log`.

```
Unit Player-abc spawned with model animals/animal-cat.glb at (12, 7)
Unit Player-abc executed move_up to (12, 6)
Unit Player-abc executed attack_right, hit Player-xyz for 1 damage (HP: 10 -> 9)
Unit Player-xyz was destroyed
Unit Player-abc move failed (occupied=true, collision=false)
```

Clear local debug logs with:

```bash
../scripts/clear_logs.sh
```

---

## Adding New Commands

1. Add validation in `unit.go` `EnqueueCommand()` or create a new `isXCommand()` helper in `world.go`
2. Add processing logic in `ProcessTick()` as a new phase
3. Update `API.md` and `README.md` with new command documentation

## Adding New Unit Types

1. Add type-specific fields to `Unit` struct in `unit.go`
2. Update `NewUnit()` constructor
3. Add type-specific logic in `ProcessTick()`
4. Add models to `availableModels` or create a separate model list

---

## Troubleshooting

**Port already in use**:
```bash
lsof -ti:8080 | xargs kill -9
```

**Frontend not served**:
- Build frontend first: `cd ../frontend && npm run build`
- Backend serves from `../frontend/dist/`

**Unit not spawning**:
- Check `MaxPlayers` limit (default 10)
- Check grid is not full (30×30 = 900 cells)
