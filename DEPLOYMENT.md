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

1. Open the URL in your browser — you'll automatically spawn as a soldier on the 30×30 grid
2. Type commands in the input field at the bottom:
   - `move_up`, `move_down`, `move_left`, `move_right` (1 qi each)
   - `attack_up`, `attack_down`, `attack_left`, `attack_right` (2 qi each)
3. Commands queue up and execute every 5 seconds (world tick)
4. Qi regenerates +1 every 10 seconds (max 10)
5. Click any unit to see its state panel (HP, qi, action queue)

## Multiplayer

- Open the URL from multiple devices/browsers
- Each player gets one soldier spawned at a random location
- Max 10 players per world
- PvP combat: attack adjacent units to reduce their HP
- When HP reaches 0, the unit is removed (refresh to respawn)

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

- **Backend**: Go server with WebSocket (port 8080)
- **Frontend**: SolidJS + Babylon.js (WebGPU), served as static files
- **State**: In-memory (no Redis yet — simplified for demo)
- **Network**: WebSocket with JSON messages (protobuf deferred for simplicity)

## Next Steps

- Add Redis persistence
- Implement protobuf serialization
- Add unit name labels in 3D scene
- Add scripting API endpoint
- Improve camera controls
- Add sound effects
