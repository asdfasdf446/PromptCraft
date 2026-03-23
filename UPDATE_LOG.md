# Update Log — New Features

## Version 0.3.0 (2026-03-23)

### 1. 3D Model System ✅
- Replaced colored boxes with low-poly 3D animal models
- **15 animal models**: bunny, caterpillar, cat, chick, cow, dog, elephant, fish, giraffe, hog, lion, monkey, parrot, pig, tiger
- Models loaded from `/assets/models/animals/` directory as .glb files
- Fixed texture path resolution for proper colormap.png loading
- Fallback to colored box if model fails to load
- Random model assignment with duplication minimization algorithm
- Each player gets a unique animal model when possible

### 2. Procedural Terrain Variety ✅
- Replaced uniform grass tiles with varied terrain generation
- **Weighted tile selection**:
  - Ground grass (70% - base terrain)
  - Open paths (10% - walkways)
  - Small rocks A/B (2% each - obstacles)
  - Small bushes (5% - vegetation)
  - Yellow/red/purple flowers (3% each - decoration)
- Deterministic generation using position-based seeding
- Consistent world appearance across sessions
- All terrain models loaded from `/assets/models/nature/` directory

### 3. Grid Cell Borders ✅
- Added visible dark gray borders between all grid cells
- Thin border planes (0.05 units) at cell edges
- Elevated slightly (y=0.01) to prevent z-fighting with terrain
- Essential for debugging and precise positioning
- Shared material for performance optimization

### 4. Model Assignment Algorithm ✅
- Backend tracks model usage across all units
- `selectLeastUsedModel()` minimizes duplicate animals
- Counts current usage of each model
- Selects from least-used models randomly
- Ensures visual variety in multiplayer sessions

## Technical Changes

### Backend Files Modified
- `backend/game/world.go` — Added availableModels array, selectLeastUsedModel(), LastActions field
- `backend/game/unit.go` — Added Model field to Unit struct
- `backend/main.go` — Added Model to UnitState, Actions to ServerWorldState

### Frontend Files Modified
- `frontend/src/game/BabylonScene.tsx` — Fixed texture path resolution, added terrain variety, grid borders
- `frontend/src/network/WebSocketClient.ts` — Added model field to UnitState interface

### Assets Added
- 15 animal .glb models in `frontend/public/assets/models/animals/`
- Shared `Textures/colormap.png` for animal models
- 300+ nature models in `frontend/public/assets/models/nature/`

## Version 0.2.0 (2026-03-23)

### 1. Compass / Direction Markers ✅
- Added colored direction markers outside the 30×30 grid
- **North (up)**: Blue marker at negative Z
- **South (down)**: Red marker at positive Z
- **West (left)**: Green marker at negative X
- **East (right)**: Yellow marker at positive X
- Markers are always visible regardless of camera position
- Helps players maintain orientation when panning/zooming

### 2. Batch Command Input ✅
- Command input now supports multiple commands separated by semicolons (`;`)
- Example: `move_up;move_up;attack_down` queues 3 commands at once
- Visual feedback system:
  - **Success**: Green notification showing "X command(s) queued"
  - **Error**: Red notification for invalid input
  - Feedback auto-dismisses after 3 seconds
- Input field expanded to 500px width to accommodate longer batch commands

### 3. System Clock & Event Logging ✅
- New system clock UI in top-right corner showing:
  - **Current Tick**: World tick number
  - **Time Elapsed**: Total seconds since game start (tick × 5)
  - **Next Tick In**: Countdown timer (5s → 1s)
  - **Event Log**: Last 5 tick execution events with timestamps
- Log format: `[HH:MM:SS] Tick N executed - X units active`
- Updates in real-time as world state changes

## How to Use

### Batch Commands
```
move_up;move_right;attack_down
```
This queues 3 commands that will execute over the next 3 ticks (assuming sufficient qi).

### Reading the Compass
- Look for colored rectangular markers outside the grid
- Blue = North (move_up direction)
- Red = South (move_down direction)
- Green = West (move_left direction)
- Yellow = East (move_right direction)

### System Clock
- Watch the countdown to know when your queued commands will execute
- Check the event log to see tick history
- Time elapsed helps track game duration

## Technical Changes

### Frontend Files Modified
- `frontend/src/ui/CommandInput.tsx` — Added batch parsing and feedback system
- `frontend/src/game/BabylonScene.tsx` — Added compass markers
- `frontend/src/App.tsx` — Integrated SystemClock component

### Frontend Files Added
- `frontend/src/ui/SystemClock.tsx` — New clock and logging component

### Backend
- No backend changes required (all features are client-side)

## Access the Updated Game

```
http://192.168.80.190:8080
```

The server is still running with the updated frontend automatically served.
