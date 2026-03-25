# Scripting Guide

How to write scripts to automate your PromptCraft unit.

---

## Overview

PromptCraft is designed to be scriptable. All game actions are available via WebSocket API, so you can write programs in any language to control your unit automatically.

See [../../API.md](../../API.md) for the complete protocol reference.

---

## Quick Start

### Python (Recommended)

Install the websocket library:
```bash
pip install websocket-client
```

Basic bot that moves randomly:
```python
import websocket
import json
import random

my_unit_id = None

def on_message(ws, message):
    global my_unit_id
    state = json.loads(message)

    # Identify your unit on first message
    if not my_unit_id and state['units']:
        my_unit_id = state['units'][-1]['id']
        print(f'Playing as: {my_unit_id[:8]}...')

    # Find your unit
    me = next((u for u in state['units'] if u['id'] == my_unit_id), None)
    if not me:
        print('Unit destroyed — reconnect to respawn')
        return

    print(f"Tick {state['tick']}: ({me['x']},{me['y']}) HP:{me['hp']} Qi:{me['qi']}")

    # Act when queue is empty and qi available
    if me['qi'] >= 1 and not me['action_queue']:
        cmd = random.choice(['move_up', 'move_down', 'move_left', 'move_right'])
        ws.send(json.dumps({'command': cmd, 'unit_id': my_unit_id}))

ws = websocket.WebSocketApp(
    'ws://192.168.80.190:8080/ws',
    on_message=on_message,
    on_open=lambda ws: print('Connected!'),
    on_close=lambda ws, c, m: print('Disconnected')
)
ws.run_forever()
```

### Node.js

Install the ws library:
```bash
npm install ws
```

Basic bot:
```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://192.168.80.190:8080/ws');
let myUnitId = null;

ws.on('message', (data) => {
  const state = JSON.parse(data);

  if (!myUnitId && state.units.length > 0) {
    myUnitId = state.units[state.units.length - 1].id;
  }

  const me = state.units.find(u => u.id === myUnitId);
  if (!me || me.qi < 1 || me.action_queue.length > 0) return;

  const moves = ['move_up', 'move_down', 'move_left', 'move_right'];
  ws.send(JSON.stringify({
    command: moves[Math.floor(Math.random() * moves.length)],
    unit_id: myUnitId
  }));
});
```

---

## Common Patterns

### Pattern 1: Queue Draining

Only send commands when the queue is empty to avoid overflow:

```python
if not me['action_queue'] and me['qi'] >= cost:
    ws.send(json.dumps({'command': cmd, 'unit_id': my_unit_id}))
```

### Pattern 2: Batch Queuing

Queue multiple commands at once for efficiency:

```python
def queue_path(ws, unit_id, commands):
    """Queue a sequence of commands"""
    for cmd in commands:
        ws.send(json.dumps({'command': cmd, 'unit_id': unit_id}))
```

### Pattern 3: Enemy Detection

Find the nearest enemy and move toward it:

```python
def nearest_enemy(me, units):
    enemies = [u for u in units if u['id'] != me['id']]
    if not enemies:
        return None
    return min(enemies, key=lambda u: abs(u['x'] - me['x']) + abs(u['y'] - me['y']))

def direction_toward(me, target):
    dx = target['x'] - me['x']
    dy = target['y'] - me['y']
    if abs(dx) > abs(dy):
        return 'move_right' if dx > 0 else 'move_left'
    else:
        return 'move_down' if dy > 0 else 'move_up'
```

### Pattern 4: Attack When Adjacent

Attack if an enemy is in an adjacent cell:

```python
def adjacent_attack(me, units):
    for unit in units:
        if unit['id'] == me['id']:
            continue
        dx = unit['x'] - me['x']
        dy = unit['y'] - me['y']
        if dx == 1 and dy == 0:
            return 'attack_right'
        if dx == -1 and dy == 0:
            return 'attack_left'
        if dx == 0 and dy == 1:
            return 'attack_down'
        if dx == 0 and dy == -1:
            return 'attack_up'
    return None
```

### Pattern 5: BFS Pathfinding

Navigate around other units:

```python
from collections import deque

def find_path(start, goal, occupied):
    """BFS pathfinding, returns list of commands"""
    if start == goal:
        return []

    queue = deque([(start, [])])
    visited = {start}

    moves = [(0, -1, 'move_up'), (0, 1, 'move_down'),
             (-1, 0, 'move_left'), (1, 0, 'move_right')]

    while queue:
        (x, y), path = queue.popleft()
        for dx, dy, cmd in moves:
            nx, ny = x + dx, y + dy
            if (nx, ny) == goal:
                return path + [cmd]
            if 0 <= nx < 30 and 0 <= ny < 30 and (nx, ny) not in visited and (nx, ny) not in occupied:
                visited.add((nx, ny))
                queue.append(((nx, ny), path + [cmd]))
    return []  # No path found
```

---

## Full Combat Bot

A complete bot that hunts enemies:

```python
import websocket
import json
from collections import deque

SERVER = 'ws://192.168.80.190:8080/ws'
my_unit_id = None

def find_path(start, goal, occupied):
    if start == goal:
        return []
    queue = deque([(start, [])])
    visited = {start}
    for dx, dy, cmd in [(0,-1,'move_up'),(0,1,'move_down'),(-1,0,'move_left'),(1,0,'move_right')]:
        pass
    moves = [(0,-1,'move_up'),(0,1,'move_down'),(-1,0,'move_left'),(1,0,'move_right')]
    while queue:
        (x, y), path = queue.popleft()
        for dx, dy, cmd in moves:
            nx, ny = x+dx, y+dy
            if (nx, ny) == goal:
                return path + [cmd]
            if 0<=nx<30 and 0<=ny<30 and (nx,ny) not in visited and (nx,ny) not in occupied:
                visited.add((nx, ny))
                queue.append(((nx, ny), path + [cmd]))
    return []

def on_message(ws, message):
    global my_unit_id
    state = json.loads(message)

    if not my_unit_id and state['units']:
        my_unit_id = state['units'][-1]['id']
        print(f'Spawned as {my_unit_id[:8]}')

    me = next((u for u in state['units'] if u['id'] == my_unit_id), None)
    if not me or me['action_queue']:
        return

    enemies = [u for u in state['units'] if u['id'] != my_unit_id]
    if not enemies:
        return

    # Find nearest enemy
    target = min(enemies, key=lambda u: abs(u['x']-me['x']) + abs(u['y']-me['y']))
    tx, ty = target['x'], target['y']
    mx, my = me['x'], me['y']

    # Check if adjacent — attack
    if me['qi'] >= 2:
        if tx == mx+1 and ty == my:
            ws.send(json.dumps({'command': 'attack_right', 'unit_id': my_unit_id}))
            return
        if tx == mx-1 and ty == my:
            ws.send(json.dumps({'command': 'attack_left', 'unit_id': my_unit_id}))
            return
        if tx == mx and ty == my+1:
            ws.send(json.dumps({'command': 'attack_down', 'unit_id': my_unit_id}))
            return
        if tx == mx and ty == my-1:
            ws.send(json.dumps({'command': 'attack_up', 'unit_id': my_unit_id}))
            return

    # Move toward enemy
    if me['qi'] >= 1:
        occupied = {(u['x'], u['y']) for u in state['units'] if u['id'] != my_unit_id}
        # Target adjacent cell
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            adj = (tx+dx, ty+dy)
            if 0<=adj[0]<30 and 0<=adj[1]<30 and adj not in occupied:
                path = find_path((mx, my), adj, occupied)
                if path:
                    ws.send(json.dumps({'command': path[0], 'unit_id': my_unit_id}))
                    return

ws = websocket.WebSocketApp(SERVER, on_message=on_message)
ws.run_forever()
```

---

## Tips

- **Don't spam commands**: Check `action_queue` is empty before sending
- **Watch qi**: Commands stay queued if qi is insufficient — they'll execute when qi regenerates
- **Handle disconnects**: Implement reconnection logic for long-running bots
- **Respect tick rate**: The world only updates every 5 seconds — no need to send commands faster

---

## See Also

- [../../API.md](../../API.md) - Complete WebSocket API reference
- [getting-started.md](getting-started.md) - Game basics
