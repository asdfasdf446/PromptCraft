# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PromptCraft is a text-controlled multiplayer combat game on a 30×30 grid. Players control units entirely through typed commands (move_up, attack_left, etc.). The game uses a tick-based system where commands execute every 5 seconds in priority order, gated by a qi (气) resource that regenerates over time.

## Architecture

### Backend (Go)
- **Entry point**: `backend/main.go`
- **WebSocket server**: Gorilla WebSocket on port 8080, serves both WebSocket (`/ws`) and static frontend files (`/`)
- **Game logic**: `backend/game/` package
  - `world.go`: 30×30 grid state, tick processing (5s interval), qi regeneration (10s interval), collision detection
  - `unit.go`: Unit struct (HP, Qi, position, action queue), command validation
- **Concurrency**: Uses `sync.Mutex` for thread-safe world state access across WebSocket connections
- **Command execution**: Two-phase tick processing:
  1. Move commands (priority 1): resolve collisions, update grid
  2. Attack commands (priority 2): apply damage, remove dead units
- **Model assignment**: Random animal model selection with duplication minimization algorithm

### Frontend (SolidJS + Babylon.js)
- **Entry point**: `frontend/src/main.tsx` → `App.tsx`
- **3D rendering**: `frontend/src/game/BabylonScene.tsx`
  - Babylon.js WebGL2 engine (not WebGPU despite README - WebGPU support was planned but not implemented)
  - Top-down ArcRotateCamera with pan/zoom
  - SceneLoader for .glb models from `/assets/models/`
  - Grid tiles, compass markers, player arrow indicator, action icons
- **UI components**: `frontend/src/ui/`
  - `CommandInput.tsx`: Batch command input with semicolon separation, client-side validation
  - `PlayerStatusPanel.tsx`: Fixed panel showing player's HP, Qi, position, action queue
  - `UnitPanel.tsx`: Modal for inspecting other players' units
  - `SystemClock.tsx`: Tick counter, elapsed time, countdown, action log
- **Networking**: `frontend/src/network/WebSocketClient.ts`
  - SolidJS reactive signal for world state
  - Auto-reconnect on disconnect (3s delay)
  - localStorage for player unit ID persistence (cleared on new connection)
  - Comprehensive debug logging with emoji prefixes

### Data Flow
1. Client connects → backend spawns unit at random empty cell → broadcasts world state
2. Client sends command → backend validates and enqueues → broadcasts updated queue
3. Every 5s tick → backend processes commands → broadcasts new positions/HP + action events
4. Frontend receives world state → updates 3D scene (move/create/remove meshes)

## Development Commands

### Backend
```bash
cd backend
go run main.go              # Start server on 0.0.0.0:8080
```

### Frontend
```bash
cd frontend
npm install                 # Install dependencies
npm run dev                 # Dev server on localhost:5173
npm run build               # Build to dist/
```

### Full Stack
Backend serves frontend from `frontend/dist/`, so after building frontend, just run backend:
```bash
cd frontend && npm run build && cd ../backend && go run main.go
```
Access at `http://[server-ip]:8080` (LAN accessible)

## Key Implementation Details

### Model Loading
- Animal models are .glb files in `frontend/public/assets/models/animals/`
- Nature/terrain models are in `frontend/public/assets/models/nature/`
- Require `animals/Textures/colormap.png` texture file for animal models
- Backend assigns random animal model on spawn from `animals/` subdirectory
- Frontend loads via SceneLoader.ImportMesh
- Grid floor uses `ground_grass.glb` tiles from nature assets
- Fallback to colored box if model fails to load

### Command System
- Valid commands: `move_up`, `move_down`, `move_left`, `move_right`, `attack_up`, `attack_down`, `attack_left`, `attack_right`
- Move costs 1 qi, attack costs 2 qi
- Commands queue in unit's ActionQueue, execute FIFO on each tick
- Failed moves (collision/out-of-bounds) still consume qi

### Player Identification
- localStorage stores `myUnitId` (cleared on reconnect to fix stale ID bugs)
- Yellow arrow indicator hovers above player's unit with bobbing animation
- Player's own unit shows in fixed status panel, other units open modal on click

### Coordinate System
- Backend: (x, y) where x=0 is west, y=0 is north
- Frontend: Babylon.js Vector3(x, 0.5, y) - note y becomes z-axis
- Grid is 30×30, indexed 0-29

### WebSocket Protocol
- Client → Server: `{"command": "move_up", "unit_id": "uuid"}`
- Server → Client: `{"units": [...], "tick": 123, "actions": [...]}`
- Actions array contains events from last tick (for visual feedback)

## Common Pitfalls

- **Invisible units**: Missing `Textures/colormap.png` causes model load failure - ensure texture file exists
- **Commands not executing**: Check qi level (max 10, regenerates 1/10s), verify unit ID matches localStorage
- **Stale unit ID**: localStorage persists across sessions - backend clears it on new connection
- **Port conflicts**: Backend binds to 8080 - kill existing process with `lsof -ti:8080 | xargs kill -9`
- **Frontend not updating**: Backend serves `dist/` - must rebuild frontend after changes

## Project Structure
```
PromptCraft/
├── backend/
│   ├── main.go              # WebSocket server, tick loops
│   └── game/
│       ├── world.go         # Grid, tick processing, model assignment
│       └── unit.go          # Unit state, command validation
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Root component, WebSocket connection
│   │   ├── game/
│   │   │   └── BabylonScene.tsx  # 3D rendering, model loading
│   │   ├── ui/              # UI components
│   │   └── network/
│   │       └── WebSocketClient.ts  # WebSocket client, state management
│   └── public/assets/models/
│       ├── animals/         # Animal character models + Textures/
│       └── nature/          # Terrain, vegetation, structures
└── README.md, TODO.md
```
