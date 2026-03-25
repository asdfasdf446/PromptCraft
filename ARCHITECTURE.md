# PromptCraft Architecture

Technical deep-dive into system architecture, data flow, and implementation details.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                       │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  SolidJS UI    │  │ Babylon.js   │  │  WebSocket      │ │
│  │  Components    │◄─┤ 3D Scene     │◄─┤  Client         │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└──────────────────────────────────────────┬──────────────────┘
                                           │ WebSocket
                                           │ (JSON messages)
┌──────────────────────────────────────────▼──────────────────┐
│                      Go Backend Server                       │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐│
│  │  WebSocket      │  │  World       │  │  Tick System    ││
│  │  Handler        │─►│  State       │◄─┤  (Goroutines)   ││
│  └─────────────────┘  └──────────────┘  └─────────────────┘│
│                         In-Memory Grid                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Connection & Spawn

```
Client                    Server
  │                         │
  ├──── WebSocket Open ────►│
  │                         ├─ Spawn Unit
  │                         ├─ Assign Random Model
  │                         ├─ Place on Grid
  │◄─── World State ────────┤
  │    (with unit ID)       │
```

### 2. Command Execution

```
Client                    Server                    World
  │                         │                         │
  ├──── Command ───────────►│                         │
  │    {cmd, unit_id}       ├─ Validate              │
  │                         ├─ Enqueue ──────────────►│
  │                         │                    [Queue]
  │                         │                         │
  │                    [5s Tick Timer]                │
  │                         │                         │
  │                         │◄─── Process Tick ───────┤
  │                         │    - Move Phase         │
  │                         │    - Attack Phase       │
  │                         │    - Update Grid        │
  │◄─── World State ────────┤                         │
  │    (updated positions)  │                         │
```

### 3. Broadcast Loop

```
┌─────────────────────────────────────────┐
│  Tick Goroutine (every 5 seconds)       │
│  1. Lock world state                    │
│  2. Process all queued commands         │
│  3. Update grid positions               │
│  4. Apply damage/remove dead units      │
│  5. Unlock world state                  │
│  6. Broadcast to all clients            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Qi Regen Goroutine (every 10 seconds)  │
│  1. Lock world state                    │
│  2. Increment qi for all units (max 10) │
│  3. Unlock world state                  │
└─────────────────────────────────────────┘
```

---

## Backend Architecture

### Package Structure

```
backend/
├── main.go              # Entry point, WebSocket server
└── game/
    ├── world.go         # World state, tick processing
    └── unit.go          # Unit struct, command validation
```

### Core Components

#### 1. World (`game/world.go`)

**State**:
```go
type World struct {
    mu            sync.RWMutex              // Thread-safe access
    Grid          [30][30]*Unit             // Spatial grid
    Units         map[string]*Unit          // UUID → Unit
    Tick          int64                     // Current tick number
    rng           *rand.Rand                // Random number generator
    LastActions   []ActionEvent             // Actions from last tick
}
```

**Key Methods**:
- `SpawnUnit(id, name string)`: Find empty cell, assign model, place unit
- `ProcessTick()`: Two-phase command execution (moves, then attacks)
- `RegenerateQi()`: Increment qi for all units
- `selectLeastUsedModel()`: Minimize model duplication

#### 2. Unit (`game/unit.go`)

**State**:
```go
type Unit struct {
    ID          string
    Name        string
    Model       string      // Path to .glb file
    X, Y        int         // Grid position
    HP          int         // Health (0-10)
    Qi          int         // Resource (0-10)
    Attack      int         // Damage per hit
    ActionQueue []string    // Pending commands
    mu          sync.Mutex  // Thread-safe queue access
}
```

**Key Methods**:
- `EnqueueCommand(cmd string)`: Validate and add to queue (max 10)
- Command validation ensures only valid strings accepted

#### 3. WebSocket Handler (`main.go`)

**Connection Lifecycle**:
1. Client connects → `handleWebSocket()`
2. Spawn unit → add to world
3. Send initial world state
4. Listen for commands → enqueue in unit
5. Disconnect → remove unit from world

**Message Types**:
- **Incoming**: `{"command": "move_up", "unit_id": "uuid"}`
- **Outgoing**: `{"units": [...], "tick": 42, "actions": [...]}`

### Concurrency Model

**Goroutines**:
1. **Main**: HTTP server, WebSocket accept loop
2. **Tick Loop**: `time.Ticker` every 5s → `ProcessTick()` → broadcast
3. **Qi Regen Loop**: `time.Ticker` every 10s → `RegenerateQi()`
4. **Per-Client**: One goroutine per WebSocket connection

**Synchronization**:
- `sync.RWMutex` on World for read/write access
- `sync.Mutex` on Unit for action queue access
- Broadcast uses read lock (multiple clients can read simultaneously)

---

## Frontend Architecture

### Component Structure

```
frontend/src/
├── main.tsx                    # Entry point
├── App.tsx                     # Root component, WebSocket init
├── game/
│   └── BabylonScene.tsx        # 3D rendering engine
├── ui/
│   ├── CommandInput.tsx        # Command input with batch support
│   ├── PlayerStatusPanel.tsx   # Fixed panel (HP, Qi, queue)
│   ├── UnitPanel.tsx           # Modal for other units
│   └── SystemClock.tsx         # Tick counter, countdown, log
└── network/
    └── WebSocketClient.ts      # WebSocket client, reactive state
```

### State Management

**SolidJS Signals**:
```typescript
const [worldState, setWorldState] = createSignal<WorldState | null>(null);
```

**Reactive Updates**:
- WebSocket message → `setWorldState()` → triggers `createEffect()`
- `createEffect()` in BabylonScene → update 3D meshes
- UI components read `worldState()` → auto-update

### 3D Rendering (Babylon.js)

#### Scene Setup

```typescript
// Engine initialization
engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
scene = new Scene(engine);

// Camera (top-down view)
camera = new ArcRotateCamera('camera', -Math.PI/2, Math.PI/4, 50,
                              new Vector3(15, 0, 15), scene);
camera.attachControl(canvas, true);

// Lighting
light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
```

#### Model Loading

**Terrain Tiles**:
```typescript
const tileModel = selectTileModel(x, z);  // Weighted random selection
SceneLoader.ImportMesh("", "/assets/models/nature/", tileModel, scene,
  (meshes) => {
    const tile = meshes[0];
    tile.position = new Vector3(x, 0, z);
  }
);
```

**Character Models**:
```typescript
// Extract directory for texture resolution
const modelPath = unit.model.split('/');
const modelFile = modelPath.pop();
const basePath = `/assets/models/${modelPath.join('/')}/`;

SceneLoader.ImportMesh("", basePath, modelFile, scene,
  (meshes) => {
    const rootMesh = meshes[0];
    rootMesh.position = new Vector3(unit.x, 0.5, unit.y);
    unitMeshes.set(unit.id, rootMesh);
  },
  undefined,
  (scene, message, exception) => {
    // Fallback to colored box
    const fallbackMesh = MeshBuilder.CreateBox(`unit_${unit.id}`, {size: 0.8}, scene);
    // ... apply color based on unit ID hash
  }
);
```

**Texture Path Resolution**:
- .glb files reference textures with relative paths (e.g., `Textures/colormap.png`)
- Babylon.js resolves relative to `basePath`
- Must split model path to get correct directory: `animals/animal-fish.glb` → basePath = `/assets/models/animals/`

#### Grid Borders

```typescript
// Vertical border (right edge of cell)
const vBorder = MeshBuilder.CreatePlane(`vborder_${x}_${z}`,
  { width: 0.05, height: 1 }, scene);
vBorder.position = new Vector3(x + 0.5, 0.01, z);  // Elevated to prevent z-fighting
vBorder.rotation.x = Math.PI / 2;  // Lay flat
vBorder.material = borderMat;
```

#### Player Indicator

```typescript
// Yellow arrow above player's unit
playerArrow.mesh = MeshBuilder.CreateCylinder('playerArrow', {
  diameterTop: 0,
  diameterBottom: 0.4,
  height: 0.6,
  tessellation: 8
}, scene);

// Bobbing animation
const time = Date.now() / 1000;
const bobOffset = Math.sin(time * 2) * 0.2;
playerArrow.mesh.position = new Vector3(myUnit.x, 2.5 + bobOffset, myUnit.y);
```

---

## Tick System

### Command Priority

**Phase 1: Move Commands** (Priority 1)
1. Collect all move intents from units with sufficient qi
2. Detect collisions (multiple units → same cell)
3. Detect occupied cells
4. Execute valid moves, consume qi, dequeue command
5. Failed moves consume qi but don't update position

**Phase 2: Attack Commands** (Priority 2)
1. Process all attack commands from units with sufficient qi
2. Apply damage to target (if exists)
3. Remove dead units (HP ≤ 0)
4. Consume qi, dequeue command

### Conflict Resolution

**Move Collisions**:
```go
// Build intent map
moveIntents := make(map[string][2]int)  // unit_id → [newX, newY]
cellTargets := make(map[[2]int][]string)  // [x,y] → []unit_ids

// Check conflicts
for id, target := range moveIntents {
    occupied := w.Grid[newX][newY] != nil
    collision := len(cellTargets[key]) > 1

    if occupied || collision {
        // Move fails, consume qi
        unit.Qi--
        unit.ActionQueue = unit.ActionQueue[1:]
    } else {
        // Move succeeds
        w.Grid[unit.X][unit.Y] = nil
        unit.X, unit.Y = newX, newY
        w.Grid[newX][newY] = unit
        unit.Qi--
        unit.ActionQueue = unit.ActionQueue[1:]
    }
}
```

**Attack Resolution**:
- No conflicts (attacks are independent)
- Damage applied immediately
- Dead units removed from grid and Units map

---

## Coordinate System

### Backend (Go)

- **Grid**: `[X][Y]` where X=0 is west, Y=0 is north
- **Range**: 0-29 on both axes
- **Commands**:
  - `move_up`: Y--
  - `move_down`: Y++
  - `move_left`: X--
  - `move_right`: X++

### Frontend (Babylon.js)

- **3D Space**: `Vector3(x, y, z)` where y is vertical
- **Mapping**: Backend (X, Y) → Babylon (X, 0.5, Y)
  - Backend X → Babylon X
  - Backend Y → Babylon Z
  - Babylon Y = elevation (0.5 for units, 0 for terrain)

### Compass Markers

- **North (Up)**: Negative Z, Blue marker at (15, 0.3, -3)
- **South (Down)**: Positive Z, Red marker at (15, 0.3, 33)
- **West (Left)**: Negative X, Green marker at (-3, 0.3, 15)
- **East (Right)**: Positive X, Yellow marker at (33, 0.3, 15)

---

## Model Assignment Algorithm

### Goal
Minimize duplicate animal models across players while maintaining randomness.

### Implementation

```go
func (w *World) selectLeastUsedModel() string {
    // Count usage of each model
    modelCounts := make(map[string]int)
    for _, model := range availableModels {
        modelCounts[model] = 0
    }
    for _, unit := range w.Units {
        modelCounts[unit.Model]++
    }

    // Find minimum usage count
    minCount := len(w.Units) + 1
    var leastUsed []string

    for _, model := range availableModels {
        count := modelCounts[model]
        if count < minCount {
            minCount = count
            leastUsed = []string{model}
        } else if count == minCount {
            leastUsed = append(leastUsed, model)
        }
    }

    // Random selection from least-used models
    return leastUsed[w.rng.Intn(len(leastUsed))]
}
```

**Behavior**:
- First 15 players get unique animals
- After 15, algorithm cycles through least-used models
- Maintains visual variety even with many players

---

## Performance Considerations

### Backend

- **In-Memory State**: No database I/O, all operations in RAM
- **Read Locks**: Multiple clients can read world state simultaneously
- **Write Locks**: Only tick processing and qi regen hold write locks
- **Broadcast**: O(n) where n = number of connected clients

### Frontend

- **Model Caching**: Babylon.js caches loaded .glb files
- **Mesh Reuse**: Units keep same mesh, only position updates
- **Render Loop**: 60 FPS target, scene.render() called every frame
- **State Updates**: Only trigger on WebSocket messages (every 5s)

### Scalability Limits

- **Max Players**: 10 (hardcoded in `world.go`)
- **Grid Size**: 30×30 = 900 cells (fixed)
- **Tick Rate**: 5 seconds (not configurable)
- **Memory**: ~1 MB per world (negligible)

---

## Security Considerations

### Current Implementation

- **No Authentication**: Anyone can connect and spawn
- **No Authorization**: Any client can send commands for any unit ID
- **No Rate Limiting**: Clients can spam commands
- **No Input Validation**: Minimal validation on command strings

### Recommendations for Production

1. **Authentication**: Require login, assign unit ID server-side
2. **Authorization**: Validate unit_id matches authenticated user
3. **Rate Limiting**: Limit commands per second per client
4. **Input Sanitization**: Strict validation of all client inputs
5. **HTTPS/WSS**: Encrypt WebSocket connections
6. **CORS**: Restrict origins that can connect

---

## Deployment Architecture

### Current Setup

```
┌─────────────────────────────────────────┐
│  Single Go Process                      │
│  ┌────────────────┐  ┌────────────────┐│
│  │  HTTP Server   │  │  WebSocket     ││
│  │  (Static Files)│  │  Handler       ││
│  └────────────────┘  └────────────────┘│
│  ┌────────────────────────────────────┐│
│  │  In-Memory World State             ││
│  └────────────────────────────────────┘│
└─────────────────────────────────────────┘
         Listens on 0.0.0.0:8080
```

### Scaling Options

**Horizontal Scaling** (Multiple Worlds):
```
Load Balancer
    ├─► World Server 1 (10 players)
    ├─► World Server 2 (10 players)
    └─► World Server 3 (10 players)
```

**Vertical Scaling** (Larger Grid):
- Increase GridSize constant
- More memory required (O(n²) for grid)
- Longer tick processing time

**Persistence Layer**:
```
Go Server ◄──► Redis/PostgreSQL
    │              │
    └─ Save state on shutdown
    └─ Load state on startup
```

---

## Future Enhancements

### Planned Features

1. **Persistence**: Save world state to database
2. **Multiple Worlds**: Support multiple independent game instances
3. **Spectator Mode**: Watch without spawning a unit
4. **Replay System**: Record and playback game sessions
5. **Leaderboard**: Track kills, survival time, etc.

### Technical Improvements

1. **WebGPU**: Upgrade from WebGL2 for better performance
2. **Spatial Indexing**: Optimize collision detection with quadtree
3. **Delta Compression**: Send only changed state, not full world
4. **Predictive Client**: Client-side prediction for smoother movement
5. **Server Authoritative**: Validate all moves server-side

---

## Debugging

### Backend Logs

```bash
# View server logs
cd backend
go run main.go

# Look for:
# - "Unit X spawned with model Y at (x, y)"
# - "Unit X executed move_up to (x, y)"
# - "Unit X executed attack_right, hit Y for 1 damage"
```

### Frontend Console

```javascript
// Enable verbose logging in WebSocketClient.ts
console.log('[WebSocket] 📨 Received message:', event.data);
console.log('[WebSocket] 📊 World state update:', data);
console.log('[WebSocket] 👤 My unit status:', myUnit);
```

### Common Issues

1. **Models not loading**: Check texture path resolution, verify .glb files exist
2. **Commands not executing**: Check qi level, verify unit ID
3. **Desync**: Refresh browser to get latest world state
4. **Port conflict**: Kill existing process on 8080

---

## See Also

- [API.md](API.md) - WebSocket API documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to modify the codebase
- [CLAUDE.md](CLAUDE.md) - AI assistant guidance
- [backend/README.md](backend/README.md) - Backend-specific docs
- [frontend/README.md](frontend/README.md) - Frontend-specific docs
