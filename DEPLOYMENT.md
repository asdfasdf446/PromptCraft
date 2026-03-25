# PromptCraft — Deployment Guide

## Current Status
✅ Backend server running on `0.0.0.0:8080`
✅ Frontend built and served by backend
✅ Accessible on LAN

## Access the Game

From any device on your local network, open:

```
http://192.168.80.190:8080
```

## How to Play

1. Open the URL in your browser — you'll automatically spawn as a random animal character on the 30×30 grid
2. Your character is marked with a yellow arrow indicator above it
3. Type commands in the input field at the bottom:
   - `move_up`, `move_down`, `move_left`, `move_right` (1 qi each)
   - `attack_up`, `attack_down`, `attack_left`, `attack_right` (2 qi each)
   - Batch commands with semicolons: `move_up;move_right;attack_down`
4. Commands queue up and execute every 5 seconds (world tick)
5. Qi regenerates +1 every 10 seconds (max 10)
6. Click any unit to see its state panel (HP, qi, action queue)
7. Use compass markers (North=Blue, South=Red, West=Green, East=Yellow) for orientation

## Multiplayer

- Open the URL from multiple devices/browsers
- Each player gets one animal character spawned at a random location
- 15 different animal models: bunny, cat, dog, elephant, fish, giraffe, lion, monkey, pig, tiger, and more
- Max 10 players per world
- PvP combat: attack adjacent units to reduce their HP
- When HP reaches 0, the unit is removed (refresh to respawn)

## 3D Models and Assets

### Character Models
- 15 low-poly animal .glb models in `/assets/models/animals/`
- Shared texture file: `animals/Textures/colormap.png`
- Random assignment with duplication minimization
- Fallback to colored box if model fails to load

### Terrain Models
- 300+ nature models in `/assets/models/nature/`
- Procedurally generated terrain with weighted distribution:
  - Ground grass (70%) - base terrain
  - Open paths (10%) - walkways
  - Small rocks (4%) - obstacles
  - Bushes and flowers (16%) - decoration
- Deterministic generation ensures consistent world

### Grid Borders
- Visible dark gray borders between all cells
- Essential for precise positioning and debugging
- Thin planes (0.05 units) elevated to prevent z-fighting

## Server Management

### Stop the server
```bash
# Find the process
ps aux | grep "go run main.go"

# Kill it
kill <PID>
```

### Restart the server
```bash
cd /home/fengfanliu/web_test/PromptCraft/backend
go run main.go &
```

### View logs
The server logs tick events, player connections, and commands to stdout.

## Architecture

- **Backend**: Go server with Gorilla WebSocket (port 8080)
- **Frontend**: SolidJS + Babylon.js (WebGL2), served as static files
- **3D Graphics**: Low-poly .glb models with texture mapping
- **State**: In-memory (no database - simplified for demo)
- **Network**: WebSocket with JSON messages
- **Tick System**: 5-second world updates, 10-second qi regeneration

## Troubleshooting

### Models Not Loading
- Ensure `frontend/public/assets/models/animals/Textures/colormap.png` exists
- Check browser console for 404 errors
- Verify .glb files are in correct directories
- Fallback colored boxes appear if models fail

### Port Already in Use
```bash
# Kill existing process on port 8080
lsof -ti:8080 | xargs kill -9
```

### Frontend Not Updating
- Frontend must be rebuilt after changes: `cd frontend && npm run build`
- Backend serves from `frontend/dist/` directory
- Clear browser cache if changes don't appear

### WebSocket Connection Issues
- Check firewall allows port 8080
- Verify server IP address is correct
- Check browser console for connection errors

## Next Steps

- Add persistence layer (optional)
- Add unit name labels in 3D scene
- Expand scripting API documentation
- Add sound effects
- Implement more unit types
