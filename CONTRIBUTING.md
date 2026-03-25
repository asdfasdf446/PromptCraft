# Contributing to PromptCraft

Thank you for your interest in contributing! This guide will help you set up your development environment and understand the codebase.

---

## Development Setup

### Prerequisites

- **Go**: 1.21 or higher
- **Node.js**: 18 or higher
- **npm**: 9 or higher
- **Git**: For version control

### Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd PromptCraft

# Install backend dependencies
cd backend
go mod download

# Install frontend dependencies
cd ../frontend
npm install
```

### Running Locally

**Backend** (Terminal 1):
```bash
cd backend
go run main.go
```
Server starts on `http://localhost:8080`

**Frontend** (Terminal 2):
```bash
cd frontend
npm run dev
```
Dev server starts on `http://localhost:5173`

**Access**: Open `http://localhost:5173` in your browser

---

## Project Structure

```
PromptCraft/
├── backend/
│   ├── main.go              # WebSocket server, HTTP handler
│   └── game/
│       ├── world.go         # World state, tick processing
│       └── unit.go          # Unit struct, command validation
├── frontend/
│   ├── src/
│   │   ├── main.tsx         # Entry point
│   │   ├── App.tsx          # Root component
│   │   ├── game/
│   │   │   └── BabylonScene.tsx  # 3D rendering
│   │   ├── ui/              # UI components
│   │   └── network/
│   │       └── WebSocketClient.ts  # WebSocket client
│   └── public/
│       └── assets/models/   # 3D models (.glb files)
└── docs/                    # Documentation
```

---

## Code Style Guidelines

### Go (Backend)

- **Formatting**: Use `gofmt` (run automatically with `go fmt`)
- **Naming**: CamelCase for exported, camelCase for unexported
- **Comments**: Document all exported functions and types
- **Error Handling**: Always check errors, don't ignore

```go
// Good
func (w *World) SpawnUnit(id, name string) (*Unit, error) {
    w.mu.Lock()
    defer w.mu.Unlock()

    if len(w.Units) >= MaxPlayers {
        return nil, fmt.Errorf("world full")
    }
    // ...
}

// Bad
func (w *World) spawnunit(id string) *Unit {
    // No error handling, unexported but should be exported
}
```

### TypeScript (Frontend)

- **Formatting**: Use Prettier (configured in `frontend/.prettierrc`)
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Types**: Always use TypeScript types, avoid `any`
- **Components**: Use functional components with SolidJS

```typescript
// Good
export interface UnitState {
  id: string;
  x: number;
  y: number;
}

export function CommandInput(props: Props) {
  const [input, setInput] = createSignal('');
  // ...
}

// Bad
export function commandinput(props: any) {
  let input = '';  // Not reactive
}
```

---

## Git Workflow

### Branching

- `main`: Stable, production-ready code
- `feature/<name>`: New features
- `fix/<name>`: Bug fixes
- `docs/<name>`: Documentation updates

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(backend): add model duplication minimization

Implement selectLeastUsedModel() to ensure visual variety
by assigning least-used animal models to new players.

feat(frontend): add grid cell borders

Add visible dark gray borders between cells for debugging.
Borders are thin planes (0.05 units) elevated to prevent
z-fighting with terrain.

fix(frontend): resolve texture path for animal models

Extract directory from model path to fix colormap.png 404.
Babylon.js now correctly resolves textures relative to
/assets/models/animals/ instead of /assets/models/.
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes, commit with clear messages
3. Test locally (backend + frontend)
4. Push branch and open PR
5. Wait for review and address feedback
6. Merge after approval

---

## Adding New Features

### Adding a New Command

**1. Backend** (`backend/game/world.go`):

```go
// Add command validation
func isNewCommand(cmd string) bool {
    return cmd == "new_command"
}

// Add to ProcessTick()
func (w *World) ProcessTick() {
    // ... existing phases ...

    // Phase 3: New command type
    for _, unit := range w.Units {
        if len(unit.ActionQueue) == 0 {
            continue
        }

        cmd := unit.ActionQueue[0]
        if !isNewCommand(cmd) {
            continue
        }

        // Implement command logic
        // ...
    }
}
```

**2. Frontend** (`frontend/src/ui/CommandInput.tsx`):

```typescript
// Add to validation
const validCommands = [
  'move_up', 'move_down', 'move_left', 'move_right',
  'attack_up', 'attack_down', 'attack_left', 'attack_right',
  'new_command'  // Add here
];
```

**3. Documentation**:
- Update `API.md` with new command
- Update `README.md` command table
- Update `CLAUDE.md` if relevant

### Adding a New Unit Type

**1. Backend** (`backend/game/unit.go`):

```go
// Add unit type constant
const (
    UnitTypeSoldier = "soldier"
    UnitTypeArcher  = "archer"  // New type
)

// Modify Unit struct
type Unit struct {
    // ... existing fields ...
    Type   string  // Add type field
    Range  int     // Add type-specific fields
}

// Update NewUnit constructor
func NewUnit(id, name, model, unitType string, x, y int) *Unit {
    unit := &Unit{
        ID:     id,
        Name:   name,
        Model:  model,
        Type:   unitType,
        X:      x,
        Y:      y,
        HP:     10,
        Qi:     10,
        Attack: 1,
    }

    // Type-specific initialization
    if unitType == UnitTypeArcher {
        unit.Range = 2
    }

    return unit
}
```

**2. Backend** (`backend/game/world.go`):

```go
// Update availableModels to include new unit models
var archerModels = []string{
    "archers/archer-elf.glb",
    "archers/archer-human.glb",
}
```

**3. Frontend**: Update UI to display unit type

### Adding New Terrain/Character Models

**1. Prepare Model**:
- Format: `.glb` (GLTF binary)
- Low-poly (< 5000 triangles recommended)
- Textures: Embed or place in `Textures/` subdirectory
- Scale: ~1 unit = 1 grid cell

**2. Add to Assets**:

```bash
# For character models
cp new-animal.glb frontend/public/assets/models/animals/

# For terrain models
cp new-terrain.glb frontend/public/assets/models/nature/
```

**3. Update Backend** (`backend/game/world.go`):

```go
var availableModels = []string{
    "animals/animal-bunny.glb",
    // ... existing models ...
    "animals/new-animal.glb",  // Add here
}
```

**4. Update Frontend** (if terrain):

```typescript
// In BabylonScene.tsx
const tileModels = [
  { model: "ground_grass.glb", weight: 70 },
  // ... existing tiles ...
  { model: "new-terrain.glb", weight: 5 },  // Add here
];
```

**5. Update Documentation**:
- Add to `frontend/ASSETS.md` model catalog
- Update count in `README.md` if applicable

---

## Testing

### Manual Testing

**Backend**:
```bash
cd backend
go run main.go

# In another terminal, test WebSocket
wscat -c ws://localhost:8080/ws
```

**Frontend**:
```bash
cd frontend
npm run dev

# Open http://localhost:5173
# Test commands, multiplayer (multiple tabs)
```

### Testing Checklist

- [ ] Backend compiles without errors
- [ ] Frontend builds without errors
- [ ] WebSocket connection establishes
- [ ] Unit spawns correctly
- [ ] Commands execute as expected
- [ ] Multiplayer works (open multiple tabs)
- [ ] Models load correctly
- [ ] No console errors

### Common Issues

**Models not loading**:
- Check file paths match exactly (case-sensitive)
- Verify .glb files exist in `frontend/public/assets/models/`
- Check browser console for 404 errors
- Ensure textures are in correct subdirectory

**Commands not executing**:
- Check qi level (must be ≥ cost)
- Verify command string matches exactly
- Check backend logs for validation errors

**Port conflicts**:
```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9
```

---

## Code Review Guidelines

### For Reviewers

- **Functionality**: Does it work as intended?
- **Code Quality**: Is it readable and maintainable?
- **Performance**: Any obvious bottlenecks?
- **Security**: Any vulnerabilities introduced?
- **Documentation**: Are changes documented?
- **Tests**: Are there tests (if applicable)?

### For Contributors

- **Self-Review**: Review your own code before submitting
- **Small PRs**: Keep changes focused and manageable
- **Documentation**: Update docs for user-facing changes
- **Backwards Compatibility**: Don't break existing functionality
- **Clean History**: Squash fixup commits before merging

---

## Architecture Decisions

### Why In-Memory State?

- **Simplicity**: No database setup required
- **Performance**: Zero I/O latency
- **Demo-Friendly**: Easy to run and test
- **Trade-off**: State lost on restart (acceptable for demo)

### Why WebSocket over HTTP?

- **Real-Time**: Instant updates without polling
- **Bidirectional**: Server can push updates
- **Efficient**: Single persistent connection
- **Trade-off**: More complex than REST

### Why SolidJS over React?

- **Performance**: Fine-grained reactivity, no virtual DOM
- **Simplicity**: Less boilerplate than React
- **Size**: Smaller bundle size
- **Trade-off**: Smaller ecosystem than React

### Why Babylon.js over Three.js?

- **Features**: Built-in scene loader, materials, lighting
- **Documentation**: Comprehensive official docs
- **Performance**: Optimized for games
- **Trade-off**: Larger bundle size

---

## Getting Help

### Documentation

- [README.md](README.md) - Project overview
- [API.md](API.md) - WebSocket API reference
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical deep-dive
- [CLAUDE.md](CLAUDE.md) - AI assistant guidance

### Community

- **Issues**: Open GitHub issue for bugs/features
- **Discussions**: Use GitHub Discussions for questions
- **Pull Requests**: Submit PRs for contributions

### Debugging Tips

1. **Enable Verbose Logging**: Check `WebSocketClient.ts` console logs
2. **Backend Logs**: Watch `go run main.go` output
3. **Browser DevTools**: Network tab for WebSocket messages
4. **Babylon Inspector**: Press F12 in-game for 3D scene inspector

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help newcomers learn and grow

---

Thank you for contributing to PromptCraft!
