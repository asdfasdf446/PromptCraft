# WebSocket Protocol Specification

Complete specification of the PromptCraft WebSocket protocol.

---

## Endpoint

```
ws://[host]:8080/ws
```

- **Protocol**: WebSocket (RFC 6455)
- **Encoding**: JSON (UTF-8)
- **Port**: 8080

---

## Connection Lifecycle

```
Client                          Server
  │                               │
  ├─── WebSocket Handshake ──────►│
  │◄── 101 Switching Protocols ───┤
  │                               ├─ Spawn unit at random position
  │                               ├─ Assign random animal model
  │◄── Initial World State ───────┤
  │    (includes new unit)        │
  │                               │
  ├─── Command ──────────────────►│
  │◄── Updated World State ───────┤
  │                               │
  │         [every 5 seconds]     │
  │◄── Tick World State ──────────┤
  │    (with actions array)       │
  │                               │
  ├─── WebSocket Close ──────────►│
  │                               ├─ Remove unit from world
  │                               └─ Broadcast updated state
```

---

## Message Types

### Client → Server: Command

Sent when player issues a command.

```json
{
  "command": "move_up",
  "unit_id": "9f43e268-677d-4d22-9bf3-124acf9531b7"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | yes | Command to execute |
| `unit_id` | string | yes | UUID of the unit to command |

**Valid commands**: `move_up`, `move_down`, `move_left`, `move_right`, `attack_up`, `attack_down`, `attack_left`, `attack_right`

**Invalid command behavior**: Silently ignored, no qi consumed, no error response.

---

### Server → Client: World State

Sent after every command received and after every tick.

```json
{
  "units": [
    {
      "id": "9f43e268-677d-4d22-9bf3-124acf9531b7",
      "x": 15,
      "y": 20,
      "hp": 10,
      "qi": 7,
      "name": "Player-9f43e268",
      "model": "animals/animal-fish.glb",
      "action_queue": ["move_up", "attack_right"]
    }
  ],
  "tick": 42,
  "actions": [
    {
      "unit_id": "9f43e268-677d-4d22-9bf3-124acf9531b7",
      "action": "move_up",
      "x": 15,
      "y": 19
    }
  ]
}
```

#### `units` Array

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID (stable for unit lifetime) |
| `x` | int | X coordinate (0–29, west to east) |
| `y` | int | Y coordinate (0–29, north to south) |
| `hp` | int | Health points (0–10) |
| `qi` | int | Qi resource (0–10) |
| `name` | string | Display name (`Player-<id-prefix>`) |
| `model` | string | Relative path to .glb model |
| `action_queue` | string[] | Pending commands (FIFO, max 10) |

#### `actions` Array (optional)

Present only when actions occurred in the last tick.

| Field | Type | Description |
|-------|------|-------------|
| `unit_id` | string | UUID of unit that acted |
| `action` | string | Command that was executed |
| `x` | int | X position after action |
| `y` | int | Y position after action |

---

## Timing

| Event | Interval |
|-------|----------|
| Tick processing | Every 5 seconds |
| Qi regeneration | Every 10 seconds |
| World state broadcast | After each tick + after each command |

---

## Error Handling

The server does not send explicit error messages. Errors are handled implicitly:

| Scenario | Behavior |
|----------|----------|
| Invalid command string | Silently ignored |
| Wrong unit_id | Silently ignored |
| Insufficient qi | Command stays queued until qi available |
| Move to occupied cell | Move fails, qi consumed |
| Move out of bounds | Move fails, qi consumed |
| Attack with no target | Qi consumed, no effect |

---

## Identifying Your Unit

The server does not explicitly tell you which unit is yours. The convention used by the official client:

1. On first world state after connection, the **last unit in the array** is assumed to be the newly spawned player
2. Store this unit's `id` in `localStorage.myUnitId`
3. Clear on disconnect/reconnect

This is a heuristic — for scripting, you may want to track the unit that appears in the first world state you receive after connecting.

---

## Limits

| Limit | Value |
|-------|-------|
| Max players | 10 |
| Grid size | 30×30 |
| Max action queue | 10 commands |
| Max HP | 10 |
| Max Qi | 10 |

---

## Example Session

```python
import websocket, json

my_unit_id = None

def on_message(ws, msg):
    global my_unit_id
    state = json.loads(msg)

    # Identify my unit on first message
    if not my_unit_id and state['units']:
        my_unit_id = state['units'][-1]['id']

    # Find my unit
    me = next((u for u in state['units'] if u['id'] == my_unit_id), None)
    if not me:
        return  # Unit destroyed

    # Send a command if queue is empty and qi available
    if me['qi'] >= 1 and not me['action_queue']:
        ws.send(json.dumps({'command': 'move_up', 'unit_id': my_unit_id}))

ws = websocket.WebSocketApp('ws://localhost:8080/ws', on_message=on_message)
ws.run_forever()
```

---

## See Also

- [../../API.md](../../API.md) - Full API documentation with more examples
- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture
