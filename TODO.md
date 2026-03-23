# TODO — Open Design Questions

These are unresolved questions that will block development if not answered before implementation begins. Each item needs a decision before the relevant system can be built.

---

Game Design
Q: What happens when a soldier's HP reaches 0? Is it removed from the grid permanently?
A: Yes, it is permanently removed from the grid.

Q: Is there a respawn mechanic? If so, where and after how long?
A: There is no formal respawn mechanic for now. As a temporary workaround, players can simply refresh the browser page to "respawn".

Q: What is the win condition? Last unit standing? Score-based? Territory control?
A: There is no win condition temporarily. The immediate goal is to get the core gameplay loop playable.

Q: Is this PvP only, PvE, or both?
A: PvP.

Map
Q: What is the grid size? Fixed (e.g. 20×20) or dynamic?
A: Fixed at 30 x 30 for now.

Q: How is the map initialized? Random unit placement? Designated spawn zones?
A: Random unit placement.

Q: Are there terrain types (walls, obstacles, impassable cells)?
A: No terrain types temporarily.

Qi Edge Cases
Q: If a player queues a command but doesn't have enough qi when the tick fires, does the command fail silently, get skipped, or get cancelled?
A: The unit cannot act and will wait until it has enough Qi. Because the game triggers all actions globally at set intervals (to avoid race conditions), any unit lacking an action command or sufficient Qi will simply skip that specific tick/cycle.

Q: Can qi go negative?
A: No.

Move Collision
Q: If two units try to move into the same cell in the same tick (same priority), what happens? Both fail? One wins randomly?
A: If two or more units attempt to move to the same cell in the current tick, or if a unit tries to move into a cell where the previous occupant failed to move away, all movement attempts fail. The units will remain in their original positions, but the Qi cost will still be consumed.

Attack with No Target
Q: Attack commands consume 2 qi even with no target. Is this intentional and final?
A: Yes. A miss is still considered an attack, and the Qi must be consumed.

Network / Transport
Q: What transport protocol will be used?
A: WebSocket + Protocol Buffers.

Q: What protobuf messages are needed at minimum?
A: This is left to the developer's discretion based on implementation needs. Just ensure the logic is designed with future expansion in mind.

Auth / Session
Q: How are players identified? Anonymous session tokens? Account registration?
A: No authentication or session management for now. Players simply enter the URL and drop directly into the world.

Q: Is there a lobby / matchmaking system, or do players join a shared persistent world?
A: All players join a single, shared, persistent world.

Q: How many players per world instance?
A: Designed for 10 players per world instance initially.

Scripting API
Q: What interface does the scripting API expose?
A: Left to the developer's discretion. The key requirement is that it shouldn't need frequent requests, given the world tick is only once every 5 seconds. Providing a batch of queued commands and updating state within that timeframe is sufficient.

Q: Are there rate limits on scripted commands?
A: No rate limits temporarily.

Q: How is a scripted player authenticated differently (or not) from a human player?
A: There is no difference.

Frontend / Rendering
Q: What is the visible grid size in pixels? Is the camera fixed or scrollable/zoomable?
A: Pixel size is left to the developer's discretion (optimize for aesthetics and clarity). The camera must maintain a fixed top-down perspective, but it supports panning (up/down/left/right) and zooming.

Q: How is a unit's state panel displayed?
A: Click to open the panel.

Q: What geometric shape represents a Soldier in the placeholder art?
A: A colored cube with a name label.

Q: How is the command input field positioned in the UI? Which unit does it target if multiple units are owned?
A: The command UI is positioned at the bottom center. Note: The game is explicitly designed so players cannot own multiple units. Every player controls exactly one unit at all times.

Backend
Q: Is each world instance a separate Nano server process, or does one process handle multiple worlds?
A: Just one world and one separate process for now. However, the architecture should allow multiple worlds to share Redis in the future.

Q: What is the Redis key schema for unit state and action queues?
A: Left to the developer's discretion.

Q: How are ticks synchronized across clients? Server-authoritative broadcast on each tick?
A: Server-authoritative broadcast.
