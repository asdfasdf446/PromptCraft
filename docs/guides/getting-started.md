# Getting Started with PromptCraft

Welcome to PromptCraft — a text-controlled multiplayer combat game on a 30×30 3D grid.

---

## What is PromptCraft?

You control an animal character entirely through typed commands. No mouse clicks, no keyboard shortcuts — just text. Every 5 seconds, the world processes all queued commands simultaneously.

---

## Joining the Game

1. Open the game URL in your browser (e.g., `http://192.168.80.190:8080`)
2. Your animal character spawns automatically at a random location
3. A yellow arrow hovers above your character to identify it
4. The status panel (top-left) shows your HP, Qi, position, and queued commands

---

## Your First Commands

Type commands in the input field at the bottom of the screen.

**Move your character**:
```
move_up
```

**Queue multiple commands at once** (separated by semicolons):
```
move_up;move_right;move_up
```

**Attack an adjacent unit**:
```
attack_right
```

Commands are queued and execute on the next tick (every 5 seconds). Watch the countdown timer in the top-right corner.

---

## Understanding Qi (气)

Qi is your action resource:

- **Maximum**: 10 qi
- **Regeneration**: +1 every 10 seconds
- **Move cost**: 1 qi
- **Attack cost**: 2 qi

If you don't have enough qi, commands stay queued until you regenerate enough.

**Strategy tip**: Don't queue more commands than you have qi for — they'll execute over multiple ticks as qi regenerates.

---

## The Grid

The world is a 30×30 grid. Use the colored compass markers outside the grid for orientation:

| Color | Direction | Command |
|-------|-----------|---------|
| Blue | North | `move_up` |
| Red | South | `move_down` |
| Green | West | `move_left` |
| Yellow | East | `move_right` |

Your position is shown in the status panel as `(X, Y)`.

---

## Combat

- Attack an adjacent unit with `attack_up/down/left/right`
- Each attack deals 1 damage
- Units have 10 HP
- When HP reaches 0, the unit is removed
- Refresh the page to respawn

**Priority rule**: Move commands execute before attack commands. If you move away from a cell before someone attacks it, the attack misses.

---

## Multiplayer

- Up to 10 players can be in the world simultaneously
- Each player gets a unique animal character
- Click on any unit to see its HP, Qi, and action queue
- PvP is enabled — attack other players to eliminate them

---

## Tips for New Players

1. **Watch the countdown**: Commands execute every 5 seconds — plan ahead
2. **Manage your qi**: Don't waste qi on failed moves (occupied cells)
3. **Use batch commands**: `move_up;move_up;move_up` moves 3 cells north over 3 ticks
4. **Check the status panel**: Always know your current HP and Qi
5. **Automate with scripts**: See [scripting-guide.md](scripting-guide.md) for automation

---

## Keyboard Shortcuts

There are no keyboard shortcuts — all input is through the command text field. This is by design: the game is meant to be scriptable and text-driven.

---

## Next Steps

- [scripting-guide.md](scripting-guide.md) — Automate your unit with scripts
- [../../API.md](../../API.md) — Full WebSocket API reference
- [../../README.md](../../README.md) — Project overview
