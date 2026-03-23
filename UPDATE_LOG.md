# Update Log — New Features

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
