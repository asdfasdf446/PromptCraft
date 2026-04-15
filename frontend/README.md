# Frontend — PromptCraft

SolidJS + Babylon.js frontend for PromptCraft. Renders the authoritative tile-aware world state from the backend and provides the command interface.

---

## Quick Start

```bash
cd frontend
npm install
npm run dev       # Dev server on http://localhost:5173
npm run build     # Build to dist/ for production
```

---

## Component Structure

```
frontend/src/
├── main.tsx                    # Entry point, mounts App
├── App.tsx                     # Root component, WebSocket init
├── game/
│   └── BabylonScene.tsx        # 3D rendering (Babylon.js)
├── ui/
│   ├── CommandInput.tsx        # Command input with batch support
│   ├── PlayerStatusPanel.tsx   # Fixed panel (HP, Qi, position, queue)
│   ├── UnitPanel.tsx           # Modal for inspecting units
│   └── SystemClock.tsx         # Tick counter, countdown, event log
└── network/
    └── WebSocketClient.ts      # WebSocket client, reactive state
```

---

## State Management

Uses SolidJS reactive signals for authoritative world state:

```typescript
const [worldState, setWorldState] = createSignal<WorldState | null>(null);
export { worldState };
```

**Data flow**:
1. WebSocket message → `setWorldState(data)`
2. `createEffect()` in `BabylonScene.tsx` → create/update/remove tile and unit meshes
3. UI components read `worldState()` → auto-render

---

## World Schema

The frontend consumes server-authored terrain and stacked unit data:

```typescript
interface TileState {
  grid_x: number;
  grid_y: number;
  kind: 'normal' | 'fertile' | 'obstacle';
}

interface UnitState {
  id: string;
  kind: 'player' | 'food' | 'obstacle';
  grid_x: number;
  grid_y: number;
  stack_level: number;
  hp: number;
  qi?: number;
  name: string;
  model: string;
  action_queue: string[];
}
```

Babylon coordinate mapping:
- `grid_x` → Babylon X
- `grid_y` → Babylon Z
- `stack_level` → Babylon Y offset

---

## 3D Scene (`BabylonScene.tsx`)

### Engine Setup

- **Engine**: Babylon.js WebGL2 with `adaptToDeviceRatio`
- **Camera**: `ArcRotateCamera` — top-down view, pan/zoom enabled
  - Radius: 20–80 units, Beta: 0.1–π/2.5
- **Lighting**: hemispheric light plus a directional sun/day-night cycle

### Terrain Rendering

Terrain is driven entirely by backend tile kinds:

- `normal` → dirt/path ground model
- `fertile` → grass ground model with food stacks growing over time
- `obstacle` → blocked terrain whose obstacle occupants stay hidden unless wireframe mode is enabled

Tiles are keyed by `grid_x/grid_y` and diffed against the latest world state.

### Unit Rendering

Units render by kind:

- **player** → animal `.glb` models
- **food** → plant/nature models
- **obstacle** → wireframe box meshes

Stacked units are vertically separated with a constant stack height so both layers remain visible.

### Interaction

- Clicking a unit mesh opens `UnitPanel`
- The local player gets a yellow hovering arrow indicator
- Tick action icons are placed using target coordinates plus `target_stack_level`

---

## UI Components

### `CommandInput.tsx`

- Text input for commands
- Batch support: `move_up;move_right;attack_down`
- Waits for backend `command_result` feedback before treating submissions as accepted/rejected

### `PlayerStatusPanel.tsx`

- Tracks only the authenticated local **player** unit
- Shows HP, qi, stacked position, and current action queue

### `UnitPanel.tsx`

- Modal dialog for inspecting any unit kind
- Shows ID, kind, stacked position, HP, and player-only qi details
- Hides action queues for other players

### `SystemClock.tsx`

- Tick counter and elapsed time
- Countdown to next tick (5s)
- Event log for recent tick actions

---

## WebSocket Client (`WebSocketClient.ts`)

- Auto-connects on load, auto-reconnects on disconnect (3s delay)
- Sends auth handshake first after opening the socket
- Stores the local player unit ID in session storage
- Handles `auth_ok`, `command_result`, and shared world-state payloads

**Exported API**:
```typescript
export { worldState }
export function connectWebSocket(): void
export function sendCommand(command: string, unitId: string): void
```

---

## Asset Loading

### Model Paths

- Player models: `/assets/models/animals/<name>.glb`
- Terrain/food models: `/assets/models/nature/<name>.glb`
- Animal textures: `/assets/models/animals/Textures/colormap.png`

### Adding New Models

1. Place the `.glb` file under `public/assets/models/`
2. Update backend model assignment/spawn logic if it affects player or food units
3. Update `BabylonScene.tsx` if a new tile or unit kind needs custom rendering
4. Document it in `ASSETS.md`

---

## Development Notes

- **Dev server** (`npm run dev`): Hot reload for frontend work
- **Production build** (`npm run build`): Outputs to `dist/`, then served by Go backend
- **Command feedback**: UI uses backend `command_result` acknowledgements
- **Authoritative terrain**: The frontend no longer invents terrain locally
- **Stacked world**: UI and scene logic must tolerate non-player units and two-layer occupancy

---

## Troubleshooting

**Models not loading (404)**:
- Verify files exist in `public/assets/models/`
- Check browser Network tab for the failing URL
- Ensure `Textures/colormap.png` exists for animal models

**Wrong unit highlighted as local player**:
- Ensure the latest `auth_ok.unit_id` reached the client
- Clear stale session storage if testing with old tabs

**UI not updating**:
- Check the WebSocket connection in the browser console
- Verify the incoming payload has both `tiles` and `units`
