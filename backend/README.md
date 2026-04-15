# Backend — PromptCraft

Go backend server for PromptCraft. Handles HTTP auth endpoints, JWT-authenticated WebSocket sessions, stacked world simulation, persistence snapshots, and serving the built frontend.

---

## Quick Start

```bash
cd backend
go run main.go
```

Server starts on `0.0.0.0:8081`. Serves HTTP endpoints, WebSocket (`/ws`), and static frontend files (`/`).

---

## Package Structure

```
backend/
├── main.go          # Entry point: HTTP server, auth endpoints, WebSocket handler, tick loops
├── game/
│   ├── world.go     # Tile data, stacked occupancy, tick processing, spawning
│   └── unit.go      # Shared unit model, kind-specific rules, command validation
├── db/              # SQLite snapshot persistence
├── store/           # Redis snapshot sync (best effort)
└── proto/           # Protocol schema references
```

---

## Core Components

### `main.go`

- **HTTP Auth API**: `POST /guest`, `POST /register`, `POST /login`
- **WebSocket Handler**: `/ws` with auth handshake as the first client message
- **Tick Loop**: `time.Ticker` every 5s → `world.ProcessTick()` → broadcast
- **Qi Regen Loop**: `time.Ticker` every 10s → `world.RegenerateQi()`
- **Broadcast**: Sends authoritative tile + unit world state to all connected clients

**Key wire types**:
```go
type TileState struct {
    GridX int    `json:"grid_x"`
    GridY int    `json:"grid_y"`
    Kind  string `json:"kind"`
}

type UnitState struct {
    ID         string   `json:"id"`
    Kind       string   `json:"kind"`
    GridX      int      `json:"grid_x"`
    GridY      int      `json:"grid_y"`
    StackLevel int      `json:"stack_level"`
    HP         int      `json:"hp"`
    Qi         int      `json:"qi,omitempty"`
    Name       string   `json:"name"`
    Model      string   `json:"model"`
    ActionQueue []string `json:"action_queue"`
}

type ServerWorldState struct {
    Tiles   []TileState   `json:"tiles"`
    Units   []UnitState   `json:"units"`
    Tick    int64         `json:"tick"`
    Actions []ActionEvent `json:"actions,omitempty"`
}
```

### `game/world.go`

- **Tiles**: backend-authored `normal`, `fertile`, and `obstacle` terrain
- **Stacks**: `[30][30][2]*Unit` two-layer occupancy per tile
- **Units**: UUID-indexed registry across players, food, and obstacles
- **ProcessTick()**: stack-aware movement, gravity, attacks, and fertile spawning
- **selectLeastUsedModel()**: assigns player animal models with minimal duplication

**Constants**:
```go
const (
    GridSize          = 30
    MaxPlayers        = 10
    MaxStackLevels    = 2
    ObstacleHP        = 1000
    FoodGrowthInterval = 10
)
```

### `game/unit.go`

- **Unit kinds**: `player`, `food`, `obstacle`
- **Shared fields**: ID, kind, `grid_x`, `grid_y`, `stack_level`, HP, name, model
- **Player-only state**: qi, action queue, controllable command flow
- **EnqueueCommand()**: validates command string, queue length, and unit kind
- **Constructors**: specialized constructors for player, food, and obstacle units

---

## World Rules

### Tiles

- **Normal**: passable terrain, dirt visual on the frontend
- **Fertile**: periodically spawns food until the tile reaches two occupants
- **Obstacle**: starts with two obstacle units, permanently blocking movement

### Unit Kinds

- **Player**: 10 HP, qi, action queue, movement and attack commands
- **Food**: HP only, no qi, no mobility, spawned on fertile tiles
- **Obstacle**: 1000 HP, no qi, no mobility, HP restored to full each tick

### Stacking

- Maximum two occupants per tile: `stack_level` 0 (bottom) and 1 (top)
- A tile may never remain with only a top occupant; gravity compacts it back to level 0
- Only a bottom-layer player can initiate movement
- If a bottom-layer player moves while carrying a top occupant, the top occupant moves with it
- Movement fails if the destination would exceed two total occupants

---

## Tick Processing

`ProcessTick()` runs stack-aware phases:

1. Clear last actions and restore obstacle HP
2. Resolve player movement intents
3. Normalize stacks with gravity
4. Resolve attacks against the topmost target on each destination tile
5. Normalize stacks again after deaths
6. Spawn food on fertile tiles when capacity allows

### Conflict Resolution

- Multiple players targeting the same destination tile → moves fail
- A full destination stack (2 occupants) blocks incoming movement
- Out-of-bounds movement is dropped without action execution
- Attacks target the topmost occupant first
- Destroyed units are removed, then the tile compacts downward

---

## WebSocket Protocol

### Connection handshake

First client message must be auth:

```json
{"type":"auth","token":"jwt-here"}
```

Successful auth returns:

```json
{"type":"auth_ok","unit_id":"uuid-here"}
```

### Client → Server commands

```json
{
  "type": "command",
  "request_id": "cmd-1",
  "command": "move_up",
  "unit_id": "uuid-here"
}
```

Valid commands: `move_up`, `move_down`, `move_left`, `move_right`, `attack_up`, `attack_down`, `attack_left`, `attack_right`

### Server → Client acknowledgement

```json
{
  "type": "command_result",
  "request_id": "cmd-1",
  "unit_id": "uuid-here",
  "command": "move_up",
  "status": "accepted",
  "code": "queued",
  "message": "command queued",
  "queue_length": 1,
  "queue_limit": 10,
  "tick": 42
}
```

Shared world state remains authoritative for later execution results.

### Server → Client world state

```json
{
  "tiles": [{"grid_x": 15, "grid_y": 20, "kind": "fertile"}],
  "units": [{"id": "...", "kind": "player", "grid_x": 15, "grid_y": 20, "stack_level": 0, "hp": 10, "qi": 7, "name": "Player-123", "model": "animals/animal-cat.glb", "action_queue": ["move_up"]}],
  "tick": 42,
  "actions": [{"unit_id": "...", "action": "move_up", "x": 15, "y": 20, "stack_level": 0, "target_x": 15, "target_y": 19, "target_stack_level": 0}]
}
```

---

## Persistence

- SQLite stores user/player snapshots including `kind`, `grid_x`, `grid_y`, and `stack_level`
- Redis mirrors snapshots best-effort for external consumers
- Guest sessions are transient and removed on disconnect

---

## Logging

Server logs to stdout, and protocol/debug details are additionally written to `backend/logs/debug.log`.

```
Guest token issued for uid 550e8400-e29b-41d4-a716-446655440000
Authenticated websocket client for unit 9f43e268-677d-4d22-9bf3-124acf9531b7
Unit Player-abc executed move_up from (12, 7, level 0) to (12, 6, level 0)
Unit Player-abc attacked tile (13, 6) and hit obstacle obstacle-xyz
```

Clear local debug logs with:

```bash
../scripts/clear_logs.sh
```

---

## Troubleshooting

**Port already in use**:
```bash
ss -ltnp | grep 8080
```

**Frontend not served**:
- Build frontend first: `cd ../frontend && npm run build`
- Backend serves from `../frontend/dist/`

**Auth failures**:
- Ensure the first WebSocket message is `{"type":"auth","token":"..."}`
- Verify `JWT_SECRET` is configured consistently

**Commands rejected**:
- Check the returned `command_result.code`
- Confirm the unit belongs to the authenticated client
- Confirm the unit is a player, not food or obstacle
