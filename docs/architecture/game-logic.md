# Game Logic

Detailed documentation of PromptCraft's tick system, command processing, and conflict resolution.

---

## Tick System

### Overview

The world advances in discrete ticks every 5 seconds. All queued commands execute simultaneously within a tick, in priority order.

```
Time:  0s    5s    10s   15s   20s
       │     │     │     │     │
Tick:  0     1     2     3     4
       │     │     │     │     │
Qi:    10    10    9     9     8    (regen every 10s)
```

### Tick Processing Order

```
ProcessTick()
├── Phase 1: Move Commands
│   ├── Collect all move intents
│   ├── Detect collisions
│   └── Execute valid moves
└── Phase 2: Attack Commands
    ├── Apply damage
    └── Remove dead units
```

---

## Commands

### Move Commands

| Command | Direction | Delta |
|---------|-----------|-------|
| `move_up` | North | Y - 1 |
| `move_down` | South | Y + 1 |
| `move_left` | West | X - 1 |
| `move_right` | East | X + 1 |

**Cost**: 1 qi
**Condition**: qi ≥ 1

### Attack Commands

| Command | Direction | Target |
|---------|-----------|--------|
| `attack_up` | North | (X, Y-1) |
| `attack_down` | South | (X, Y+1) |
| `attack_left` | West | (X-1, Y) |
| `attack_right` | East | (X+1, Y) |

**Cost**: 2 qi
**Damage**: 1 HP
**Condition**: qi ≥ 2

---

## Conflict Resolution

### Move Conflicts

Two types of move failures:

**1. Occupied Cell**: Target cell already has a unit that is not moving away.

```
Before:     After:
[A][ ][B]   [A][ ][B]   ← A tries move_right, fails (B is there)
```

**2. Collision**: Multiple units try to move to the same empty cell.

```
Before:     After:
[A][ ][B]   [A][ ][B]   ← Both A and B try to move to center, both fail
```

**Resolution algorithm**:
```go
// Build intent map
for each unit with move command and qi >= 1:
    record intent: unit → target cell
    record cell target: cell → [units trying to move there]

// Resolve
for each intent:
    if target cell occupied OR multiple units targeting same cell:
        fail: consume qi, dequeue command
    else:
        succeed: update grid, consume qi, dequeue command
```

**Key property**: All moves are resolved simultaneously. A unit moving away from a cell does NOT free that cell for another unit in the same tick.

### Attack Conflicts

Attacks have no conflicts — they are independent. Multiple units can attack the same target in one tick, each dealing 1 damage.

### Priority

Moves execute before attacks. If unit A moves away from cell (5,5) and unit B attacks cell (5,5) in the same tick, B's attack misses (A is no longer there when attacks resolve).

---

## Qi System

### Regeneration

```
RegenerateQi()  ← runs every 10 seconds
for each unit:
    if unit.Qi < 10:
        unit.Qi++
```

### Consumption

| Scenario | Qi Cost |
|----------|---------|
| Move succeeds | 1 |
| Move fails (occupied/collision) | 1 |
| Attack (any outcome) | 2 |
| Insufficient qi | 0 (command stays queued) |

### Insufficient Qi

If a unit's qi is below the command cost, the command stays at the front of the queue and is retried next tick. This means a unit with 0 qi will not execute any commands until qi regenerates.

---

## Action Queue

### Properties

- **FIFO**: Commands execute in order they were queued
- **Max size**: 10 commands
- **Persistence**: Queue survives between ticks
- **Dequeue**: One command dequeued per tick (when executed or failed)

### Queue Behavior

```
Queue: [move_up, move_right, attack_down]
Tick 1: move_up executes → Queue: [move_right, attack_down]
Tick 2: move_right executes → Queue: [attack_down]
Tick 3: attack_down executes → Queue: []
```

### Qi Blocking

```
Queue: [attack_up, move_left]
Qi: 1

Tick 1: attack_up needs 2 qi, only 1 available → nothing executes
Tick 2: qi regenerates to 2 → attack_up executes → Queue: [move_left]
```

---

## Unit Lifecycle

```
Spawn
  │
  ├─ Random empty cell
  ├─ Random animal model (least-used)
  ├─ HP=10, Qi=10
  │
  ▼
Active
  │
  ├─ Receives commands
  ├─ Executes on tick
  ├─ Takes damage from attacks
  │
  ▼ (HP ≤ 0)
Destroyed
  │
  ├─ Removed from Grid
  ├─ Removed from Units map
  └─ Client disconnects or refreshes to respawn
```

---

## Coordinate System

```
(0,0) ──────────────► X (East)
  │
  │    N (move_up)
  │         │
  │  W ─────┼───── E
  │  (left) │ (right)
  │         │
  │    S (move_down)
  │
  ▼
  Y (South)
```

- **X**: 0 = west edge, 29 = east edge
- **Y**: 0 = north edge, 29 = south edge
- **Out of bounds**: Move fails (qi consumed), no position change

---

## See Also

- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture
- [../../API.md](../../API.md) - Command reference
- [backend.md](backend.md) - Implementation details
