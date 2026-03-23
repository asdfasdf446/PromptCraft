# PromptCraft

A text-controlled multiplayer survival and combat game with 3D graphics, played entirely through typed commands — no mouse, no keyboard shortcuts, just text.

---

## Overview

PromptCraft is a functional multiplayer web game set on a 30×30 grid world rendered in 3D. Every action — moving, attacking — is issued as a text command. A resource called **qi (气)** gates how many actions you can queue. The world ticks every 5 seconds, executing all queued commands in priority order.

The game is designed to be scriptable: all commands are exposed via WebSocket API, so players can write programs to automate their units.

**Current Status**: Fully functional multiplayer game with 3D graphics, terrain variety, and real-time WebSocket synchronization.

---

## Features

- **3D Graphics**: Low-poly 3D models rendered with Babylon.js (WebGL2)
- **15 Animal Characters**: Bunny, cat, dog, elephant, fish, giraffe, lion, monkey, pig, tiger, and more
- **Procedural Terrain**: Varied terrain with grass, paths, rocks, bushes, and flowers
- **Multiplayer**: Real-time synchronization via WebSocket (up to 10 players)
- **Command Queue System**: Queue multiple actions, edit before execution
- **Qi Resource System**: 10 qi max, regenerates 1 per 10 seconds
- **Tick-Based Execution**: World processes all commands every 5 seconds
- **Scriptable API**: Full WebSocket API for automation (see [API.md](API.md))

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Graphics | Babylon.js (WebGL2) |
| 3D Models | Low-poly .glb models with textures |
| UI | SolidJS (reactive framework) |
| Serialization | JSON over WebSocket |
| Backend | Go with Gorilla WebSocket |
| State | In-memory (no database) |

---

## Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+
- npm or yarn

### Running the Backend

```bash
cd backend
go run main.go
```

Backend starts on `http://localhost:8080`

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on `http://localhost:5173`

### Playing the Game

1. Open `http://localhost:5173` in your browser
2. Your unit spawns automatically with a random animal model
3. Type commands into the input field (e.g., `move_up`, `attack_right`)
4. Commands queue and execute every 5 seconds
5. Watch your unit move on the 3D grid

---

## How to Play

### Commands

| Command | Cost | Effect |
|---------|------|--------|
| `move_up` | 1 qi | Move one cell north (negative Z) |
| `move_down` | 1 qi | Move one cell south (positive Z) |
| `move_left` | 1 qi | Move one cell west (negative X) |
| `move_right` | 1 qi | Move one cell east (positive X) |
| `attack_up` | 2 qi | Attack the cell north |
| `attack_down` | 2 qi | Attack the cell south |
| `attack_left` | 2 qi | Attack the cell west |
| `attack_right` | 2 qi | Attack the cell east |

### Game Mechanics

- **Qi System**: You have up to 10 qi, regenerating 1 every 10 seconds
- **Command Queue**: Queue multiple commands; they execute in order
- **Tick System**: World processes all commands every 5 seconds
- **Conflict Resolution**: Move commands have priority over attack commands
- **Collision**: Multiple units cannot move to the same cell in one tick
- **Combat**: Attack deals 1 damage, units have 10 HP

### Coordinate System

- **North (Up)**: Negative Z direction (blue marker)
- **South (Down)**: Positive Z direction (red marker)
- **West (Left)**: Negative X direction (green marker)
- **East (Right)**: Positive X direction (yellow marker)

---

## Scripting

All game commands are available via WebSocket API. Write scripts in any language to automate your units.

See [API.md](API.md) for full WebSocket protocol documentation and example scripts.

---

## Documentation

- [API.md](API.md) - WebSocket API and scripting guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture deep-dive
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment instructions
- [UPDATE_LOG.md](UPDATE_LOG.md) - Version history
- [CLAUDE.md](CLAUDE.md) - AI assistant guidance
- [backend/README.md](backend/README.md) - Backend documentation
- [frontend/README.md](frontend/README.md) - Frontend documentation
- [frontend/ASSETS.md](frontend/ASSETS.md) - 3D model catalog

---

## Project Structure

```
PromptCraft/
├── backend/          # Go backend server
│   ├── game/         # Game logic (world, units, tick system)
│   └── main.go       # WebSocket server entry point
├── frontend/         # SolidJS frontend
│   ├── src/
│   │   ├── game/     # 3D scene (Babylon.js)
│   │   ├── ui/       # UI components
│   │   └── network/  # WebSocket client
│   └── public/
│       └── assets/   # 3D models and textures
└── docs/             # Additional documentation
```

---

## License

MIT License - see LICENSE file for details

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Support

For issues or questions, please open an issue on GitHub.
