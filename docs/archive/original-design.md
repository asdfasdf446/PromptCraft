# Original Design Document

> **Archive Note**: This is the original agent prompt used to bootstrap PromptCraft development. It represents the initial design vision before implementation. Some details differ from the final implementation (e.g., Redis was not implemented, Protobuf was replaced with JSON, WebGPU was not implemented). See [README.md](../../README.md) for the current state.

---

# Agent Prompt — PromptCraft Game Dev

## Role
You are a full-stack game developer building a text-controlled sandbox survival/combat game as a web application. This document is your authoritative working spec. Follow it strictly and update the checklist as you complete each step.

---

## Tech Stack

### Frontend
- **Graphics engine**: Babylon.js (WebGPU mode — NOT WebGL)
- **Physics engine**: Rapier.js (WASM) — visual only, does NOT affect game logic or hit detection
- **UI framework**: SolidJS

### Network
- **Serialization**: Protocol Buffers
- **Transport**: TBD — choose a lightweight, high-performance option compatible with Go/Nano (e.g. WebSocket + protobuf framing)

### Backend
- **Server framework**: Nano (Go) — chosen for high-concurrency game server workloads
- **Database**: Redis — all game state persisted here

### Version Control
- git

---

## World Model

- The world is a **2D grid** (like a Go board). Each cell holds at most one unit.
- **Qi (气)** is the action resource:
  - Max: 10
  - Regenerates: +1 every 10 seconds (stops accumulating at max)
  - Commands consume qi; invalid commands consume nothing and return `"指令错误"`
- **World tick**: every 5 seconds, all queued commands execute in priority order
- Players may queue multiple commands ahead of time. Unexecuted commands can be edited or deleted before they run.

---

## Command System

### Input
- Text-only. No mouse or keyboard game input — all commands entered via UI text field.
- Invalid commands return `"指令错误"` and consume no qi.

### Scripting API
- All commands must be exposed as a clean API so players can write scripts to automate gameplay.

### Conflict Resolution (Priority)
Commands are assigned a priority tier. On each tick:
1. **Higher-priority commands execute first**, resolving their outcomes before lower-priority commands run.
2. **Same-priority commands execute simultaneously** — no race conditions within a tier.

Example: if unit A moves and unit B attacks unit A in the same tick, movement (higher priority) resolves first — A escapes, B's attack misses.

---

## Unit: Soldier

| Attribute | Value |
|-----------|-------|
| HP | 10 |
| Attack | 1 (damage per hit) |

### Commands

| Command | Cost | Priority | Notes |
|---------|------|----------|-------|
| `move_up` | 1 qi | **Highest** | Fails (no qi consumed) if target cell is occupied |
| `move_down` | 1 qi | Highest | Same |
| `move_left` | 1 qi | Highest | Same |
| `move_right` | 1 qi | Highest | Same |
| `attack_up` | 2 qi | **Lowest** | Consumes qi even if no target in that direction |
| `attack_down` | 2 qi | Lowest | Same |
| `attack_left` | 2 qi | Lowest | Same |
| `attack_right` | 2 qi | Lowest | Same |

### State Storage
Each soldier maintains **two JSON documents**, synced to Redis and viewable in-game by clicking the unit:
1. **State panel** — current HP, position, qi, owner, etc.
2. **Action queue** — pending commands with their priority and status

---

## Art Style (Early Development)
- Replace all units with simple geometric shapes + text labels
- State machines per unit must be implemented even if not visually expressed yet
- Leave clean interfaces for importing 3D models later

---

## Development Checklist
Execute steps strictly in order. Do not proceed to the next step until the current one is reviewed and approved.

- [x] **Step 1**: Rewrite this document as a clean, structured agent prompt
- [x] **Step 2**: Write `README.md` — game overview for human review
- [x] **Step 3**: Write `TODO.md` — open design questions that block development
- [ ] **Step 4**: *(future steps TBD)*
