# Frontend — PromptCraft

SolidJS + Babylon.js frontend for PromptCraft. Renders the 3D game world and provides the command interface.

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
│   ├── UnitPanel.tsx           # Modal for inspecting other units
│   └── SystemClock.tsx         # Tick counter, countdown, event log
└── network/
    └── WebSocketClient.ts      # WebSocket client, reactive state
```

---

## State Management

Uses SolidJS reactive signals for world state:

```typescript
// WebSocketClient.ts
const [worldState, setWorldState] = createSignal<WorldState | null>(null);
export { worldState };

// Components subscribe reactively
const state = worldState();  // Auto-updates when state changes
```

**Data flow**:
1. WebSocket message → `setWorldState(data)`
2. `createEffect()` in `BabylonScene.tsx` → update 3D meshes
3. UI components read `worldState()` → auto-render

---

## 3D Scene (`BabylonScene.tsx`)

### Engine Setup

- **Engine**: Babylon.js WebGL2 with `adaptToDeviceRatio`
- **Camera**: `ArcRotateCamera` — top-down view, pan/zoom enabled
  - Radius: 20–80 units, Beta: 0.1–π/2.5
- **Light**: `HemisphericLight` at intensity 0.8

### Terrain Generation

Weighted procedural tile selection using position-based seeding:

```typescript
const selectTileModel = (x: number, z: number): string => {
  const seed = x * 31 + z * 17;
  const random = (Math.abs(Math.sin(seed)) * 10000) % 100;
  // Weighted selection from tileModels array
};
```

Tiles loaded via `SceneLoader.ImportMesh` from `/assets/models/nature/`.

### Character Models

Models loaded from `/assets/models/animals/`. Critical: base path must include the subdirectory for texture resolution:

```typescript
const modelPath = unit.model.split('/');
const modelFile = modelPath.pop();
const basePath = `/assets/models/${modelPath.join('/')}/`;
// basePath = "/assets/models/animals/" — textures resolve correctly
```

Fallback to colored box if model fails to load.

### Grid Borders

Thin planes (0.05 units wide) at cell edges, elevated to y=0.01 to prevent z-fighting.

### Player Indicator

Yellow cone arrow above player's unit with bobbing animation (`Math.sin(time * 2) * 0.2`).

### Action Icons

Floating emoji icons appear at action locations, fade out over 3 seconds.

---

## UI Components

### `CommandInput.tsx`

- Text input for commands
- Batch support: `move_up;move_right;attack_down` queues 3 commands
- Client-side validation against valid command list
- Visual feedback: green (success) / red (error) notification, auto-dismisses after 3s

### `PlayerStatusPanel.tsx`

- Fixed panel showing player's HP, Qi, position, action queue
- Reads `worldState()` and `localStorage.getItem('myUnitId')`
- Updates reactively on every world state change

### `UnitPanel.tsx`

- Modal dialog for inspecting other units
- Opens on click of any unit mesh in 3D scene
- Shows HP, Qi, position, action queue

### `SystemClock.tsx`

- Tick counter and elapsed time
- Countdown to next tick (5s)
- Event log: last 5 tick events with timestamps

---

## WebSocket Client (`WebSocketClient.ts`)

- Auto-connects on load, auto-reconnects on disconnect (3s delay)
- Clears `myUnitId` from localStorage on new connection (prevents stale ID)
- Stores player's unit ID in `localStorage.myUnitId`
- Comprehensive debug logging with emoji prefixes

**Exported API**:
```typescript
export { worldState }           // SolidJS signal
export function connectWebSocket(): void
export function sendCommand(command: string, unitId: string): void
```

---

## Asset Loading

### Model Paths

- Character models: `/assets/models/animals/<name>.glb`
- Terrain models: `/assets/models/nature/<name>.glb`
- Textures: `/assets/models/animals/Textures/colormap.png`

### Adding New Models

1. Place `.glb` file in appropriate directory under `public/assets/models/`
2. For character models: update `availableModels` in `backend/game/world.go`
3. For terrain tiles: update `tileModels` array in `BabylonScene.tsx`
4. Document in `ASSETS.md`

---

## Development Notes

- **Dev server** (`npm run dev`): Hot reload, proxies WebSocket to backend
- **Production build** (`npm run build`): Outputs to `dist/`, served by Go backend
- **Command feedback**: The UI now waits for backend `command_result` acknowledgements before presenting queue success/failure
- **TypeScript**: Strict mode enabled
- **Vite**: Build tool and dev server

---

## Troubleshooting

**Models not loading (404)**:
- Verify files exist in `public/assets/models/`
- Check browser Network tab for exact failing URL
- Ensure `Textures/colormap.png` exists for animal models

**UI not updating**:
- Check WebSocket connection in browser console
- Verify `worldState` signal is being read reactively (not stored in variable)

**Build errors**:
```bash
npm run build 2>&1 | head -50
```
