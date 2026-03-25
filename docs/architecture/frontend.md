# Frontend Architecture

Detailed technical documentation for the PromptCraft SolidJS + Babylon.js frontend.

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| SolidJS | ~1.8 | Reactive UI framework |
| Babylon.js | ~7.x | 3D rendering engine (WebGL2) |
| TypeScript | ~5.x | Type safety |
| Vite | ~5.x | Build tool and dev server |

---

## Component Tree

```
App.tsx
├── BabylonScene.tsx        # Full-screen 3D canvas
├── CommandInput.tsx        # Bottom command bar
├── PlayerStatusPanel.tsx   # Fixed status panel (top-left)
├── SystemClock.tsx         # Tick info (top-right)
└── UnitPanel.tsx           # Modal (on unit click)
```

---

## State Architecture

### Reactive Signal

```typescript
// WebSocketClient.ts
const [worldState, setWorldState] = createSignal<WorldState | null>(null);
```

All components subscribe to `worldState()` — SolidJS automatically re-renders when it changes.

### Player Identity

```typescript
// Stored in localStorage
localStorage.getItem('myUnitId')  // UUID of player's unit
```

Cleared on new WebSocket connection to prevent stale ID bugs.

---

## BabylonScene.tsx

### Lifecycle

```
onMount()
├── Create Engine + Scene
├── Setup Camera (ArcRotateCamera)
├── Setup Light (HemisphericLight)
├── Load terrain tiles (900 tiles, async)
├── Create grid borders (1740 planes)
├── Create compass markers (4 markers)
├── Register pointer events
└── Start render loop

createEffect()  ← runs on every worldState() change
├── Remove dead unit meshes
├── Load new unit models (async)
├── Update existing unit positions
├── Update player arrow indicator
└── Create action icons

onCleanup()
└── engine.dispose()
```

### Terrain Generation

Position-based seeding ensures deterministic terrain:
```typescript
const seed = x * 31 + z * 17;
const random = (Math.abs(Math.sin(seed)) * 10000) % 100;
```

### Model Loading Pattern

```typescript
SceneLoader.ImportMesh("", basePath, modelFile, scene,
  (meshes) => { /* success */ },
  undefined,
  (scene, message) => { /* fallback to box */ }
);
```

Critical: `basePath` must include model subdirectory for texture resolution.

### Mesh Lifecycle

- **New unit**: `SceneLoader.ImportMesh()` → store in `unitMeshes` Map
- **Existing unit**: Update `mesh.position` directly
- **Dead unit**: `mesh.dispose()` → remove from `unitMeshes`

---

## WebSocketClient.ts

### Connection Management

```typescript
ws.onclose = () => {
  localStorage.removeItem('myUnitId');
  setTimeout(connectWebSocket, 3000);  // Auto-reconnect
};
```

### Unit ID Assignment

On first world state received after connection, the last unit in the array is assumed to be the newly spawned player unit. This is a heuristic — works because units are appended to the array on spawn.

---

## UI Components

### CommandInput.tsx

Batch parsing:
```typescript
const commands = input.split(';').map(c => c.trim()).filter(Boolean);
for (const cmd of commands) {
  sendCommand(cmd, unitId);
}
```

### PlayerStatusPanel.tsx

Reads both `worldState()` and `localStorage.myUnitId` to find and display the player's own unit.

### SystemClock.tsx

Derives countdown from `worldState().tick`:
```typescript
const elapsed = (Date.now() / 1000) % 5;
const countdown = Math.ceil(5 - elapsed);
```

---

## Asset Loading

### Path Resolution

```
/assets/models/
├── animals/
│   ├── animal-*.glb      (15 files)
│   └── Textures/
│       └── colormap.png  (shared texture)
└── nature/
    └── *.glb             (329 files)
```

### Vite Configuration

Static assets in `public/` are served as-is. No import needed — reference by URL path.

---

## Build

```bash
npm run build   # Outputs to dist/
```

Backend serves `dist/` as static files. No separate web server needed in production.

---

## See Also

- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) - Full system architecture
- [../../frontend/ASSETS.md](../../frontend/ASSETS.md) - Model catalog
- [../../CONTRIBUTING.md](../../CONTRIBUTING.md) - How to add UI components
