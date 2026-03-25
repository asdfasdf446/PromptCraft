# Modding Guide

How to add custom content to PromptCraft — new models, terrain, commands, and unit types.

---

## Adding Character Models

### 1. Prepare Your Model

- **Format**: `.glb` (GLTF binary)
- **Textures**: Place in a `Textures/` subdirectory alongside the model, or embed in the .glb
- **Scale**: ~1 unit = 1 grid cell (models are scaled to 0.5x in-game)
- **Poly count**: Keep under 5000 triangles for performance
- **Test**: Use [Babylon.js Sandbox](https://sandbox.babylonjs.com/) to verify the model loads

### 2. Add the File

```bash
cp my-animal.glb frontend/public/assets/models/animals/
# If using external textures:
mkdir -p frontend/public/assets/models/animals/Textures/
cp colormap.png frontend/public/assets/models/animals/Textures/
```

### 3. Register in Backend

Edit `backend/game/world.go`:

```go
var availableModels = []string{
    "animals/animal-bunny.glb",
    // ... existing models ...
    "animals/my-animal.glb",  // Add your model
}
```

### 4. Rebuild and Test

```bash
cd frontend && npm run build
cd ../backend && go run main.go
```

---

## Adding Terrain Tiles

### 1. Prepare Your Model

- **Format**: `.glb`
- **Scale**: 1 unit = 1 grid cell (used at 1x scale)
- **Poly count**: Under 1000 triangles recommended
- **Orientation**: Flat on the XZ plane, Y-up

### 2. Add the File

```bash
cp my-terrain.glb frontend/public/assets/models/nature/
```

### 3. Register in Frontend

Edit `frontend/src/game/BabylonScene.tsx`:

```typescript
const tileModels = [
  { model: "ground_grass.glb", weight: 70 },
  { model: "ground_pathOpen.glb", weight: 10 },
  // ... existing tiles ...
  { model: "my-terrain.glb", weight: 5 },  // Add your tile
];
```

**Weight guidelines**: Weights are relative. Total doesn't need to equal 100 — the code uses cumulative comparison. Higher weight = more frequent.

### 4. Rebuild and Test

```bash
cd frontend && npm run build
```

---

## Adding New Commands

### 1. Backend: Add Processing Logic

Edit `backend/game/world.go`:

```go
// Add helper function
func isMyCommand(cmd string) bool {
    return cmd == "my_command"
}

// Add processing in ProcessTick()
func (w *World) ProcessTick() {
    // ... existing phases ...

    // Phase 3: My new command
    for _, unit := range w.Units {
        if len(unit.ActionQueue) == 0 {
            continue
        }
        cmd := unit.ActionQueue[0]
        if !isMyCommand(cmd) {
            continue
        }
        if unit.Qi < 1 {  // Set appropriate qi cost
            continue
        }

        // Implement command effect
        unit.Qi -= 1
        unit.ActionQueue = unit.ActionQueue[1:]

        // Record action event
        w.LastActions = append(w.LastActions, ActionEvent{
            UnitID: unit.ID,
            Action: cmd,
            X:      unit.X,
            Y:      unit.Y,
        })
    }
}
```

### 2. Backend: Allow in Queue

Edit `backend/game/unit.go` — add to the valid commands check in `EnqueueCommand()`:

```go
func (u *Unit) EnqueueCommand(cmd string) bool {
    validCommands := map[string]bool{
        "move_up": true, "move_down": true, "move_left": true, "move_right": true,
        "attack_up": true, "attack_down": true, "attack_left": true, "attack_right": true,
        "my_command": true,  // Add here
    }
    // ...
}
```

### 3. Frontend: Add to Validation

Edit `frontend/src/ui/CommandInput.tsx` — add to the valid commands list used for client-side validation.

### 4. Document

- Add to command table in `API.md`
- Add to command table in `README.md`

---

## Adding New Unit Types

### 1. Define the Type

Edit `backend/game/unit.go`:

```go
type Unit struct {
    // ... existing fields ...
    Type   string  // "soldier", "archer", etc.
    Range  int     // For ranged attacks
}

func NewUnit(id, name, model, unitType string, x, y int) *Unit {
    unit := &Unit{
        ID:     id,
        Name:   name,
        Model:  model,
        Type:   unitType,
        X:      x, Y: y,
        HP:     10, Qi: 10, Attack: 1,
    }
    switch unitType {
    case "archer":
        unit.Range = 3
        unit.Attack = 1
    }
    return unit
}
```

### 2. Update World State Serialization

Edit `backend/main.go` — add `Type` to `UnitState`:

```go
type UnitState struct {
    // ... existing fields ...
    Type string `json:"type"`
}
```

### 3. Update Frontend

Edit `frontend/src/network/WebSocketClient.ts`:

```typescript
export interface UnitState {
  // ... existing fields ...
  type: string;
}
```

Update `BabylonScene.tsx` to render different models or effects based on unit type.

---

## Modifying Game Constants

Edit `backend/game/world.go`:

```go
const (
    GridSize   = 30   // Change grid dimensions
    MaxPlayers = 10   // Change player limit
)
```

Edit `backend/main.go` for timing:

```go
tickTicker := time.NewTicker(5 * time.Second)   // Tick interval
qiTicker   := time.NewTicker(10 * time.Second)  // Qi regen interval
```

---

## See Also

- [../../CONTRIBUTING.md](../../CONTRIBUTING.md) - Development guidelines
- [../../frontend/ASSETS.md](../../frontend/ASSETS.md) - Asset catalog
- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) - Technical architecture
