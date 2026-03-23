# PromptCraft

A text-controlled sandbox survival and combat game played entirely through typed commands — no mouse, no keyboard shortcuts, just text.

---

## Concept

PromptCraft is a multiplayer web game set on a 2D grid world. Every action — moving, attacking, building — is issued as a text command. A resource called **qi (气)** gates how many actions you can queue. The world ticks every 5 seconds, executing all queued commands in priority order.

The game is designed to be scriptable: all commands are exposed as an API, so players can write programs to automate their units.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Graphics | Babylon.js (WebGPU) |
| Physics (visual) | Rapier.js (WASM) |
| UI | SolidJS |
| Serialization | Protocol Buffers |
| Backend | Nano (Go) |
| Database | Redis |

---

## How to Play

1. Your unit starts on the grid. You have up to 10 qi, regenerating 1 every 10 seconds.
2. Type commands into the input field to queue actions.
3. Every 5 seconds, the world executes all queued commands.
4. You can edit or delete queued commands before they execute.

### Commands (v0.1 — Soldier only)

| Command | Cost | Effect |
|---------|------|--------|
| `move_up` | 1 qi | Move one cell up |
| `move_down` | 1 qi | Move one cell down |
| `move_left` | 1 qi | Move one cell left |
| `move_right` | 1 qi | Move one cell right |
| `attack_up` | 2 qi | Attack the cell above |
| `attack_down` | 2 qi | Attack the cell below |
| `attack_left` | 2 qi | Attack the cell to the left |
| `attack_right` | 2 qi | Attack the cell to the right |

Invalid commands return `"指令错误"` and cost no qi.

### Conflict Resolution

When two commands conflict in the same tick (e.g. one unit moves while another attacks it), **higher-priority commands resolve first**. Move commands have the highest priority; attack commands have the lowest. Same-priority commands resolve simultaneously with no race conditions.

---

## Units

### Soldier
- HP: 10
- Attack: 1 damage per hit
- Each soldier has a viewable **state panel** (HP, position, qi) and **action queue** (pending commands), both stored as JSON in Redis.

---

## Scripting API

All game commands are available via a scripting API. Players can write scripts (in any language) to automate their units programmatically. API spec TBD — see `TODO.md`.

---

## Development Status

Early development. Current milestone: documentation and design review before any code is written.

See `TODO.md` for open design questions.
