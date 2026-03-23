import { createSignal, createEffect } from 'solid-js';

export interface UnitState {
  id: string;
  x: number;
  y: number;
  hp: number;
  qi: number;
  name: string;
  action_queue: string[];
}

export interface WorldState {
  units: UnitState[];
  tick: number;
}

const [worldState, setWorldState] = createSignal<WorldState | null>(null);
let ws: WebSocket | null = null;

export { worldState };

export function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = '8080';
  const wsUrl = `${protocol}//${host}:${port}/ws`;

  console.log('[WebSocket] Attempting to connect to:', wsUrl);

  // Clear old unit ID on new connection
  localStorage.removeItem('myUnitId');
  console.log('[WebSocket] 🗑️ Cleared old unit ID from localStorage');

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WebSocket] ✅ Connected successfully');
  };

  ws.onmessage = (event) => {
    console.log('[WebSocket] 📨 Received message:', event.data);

    try {
      const data = JSON.parse(event.data);

      if (data.error) {
        console.error('[WebSocket] ❌ Server error:', data.error);
        return;
      }

      console.log('[WebSocket] 📊 World state update:', {
        tick: data.tick,
        unitCount: data.units?.length || 0,
        units: data.units
      });

      setWorldState(data);

      // Store my unit ID on first world state after connection
      const currentMyUnitId = localStorage.getItem('myUnitId');

      if (!currentMyUnitId && data.units && data.units.length > 0) {
        // Find the newest unit (last in array, just spawned)
        const lastUnit = data.units[data.units.length - 1];
        localStorage.setItem('myUnitId', lastUnit.id);
        console.log('[WebSocket] 🎮 My unit ID set to:', lastUnit.id, 'Name:', lastUnit.name);
      } else if (currentMyUnitId) {
        const myUnit = data.units?.find((u: UnitState) => u.id === currentMyUnitId);
        if (myUnit) {
          console.log('[WebSocket] 👤 My unit status:', {
            id: myUnit.id,
            name: myUnit.name,
            position: `(${myUnit.x}, ${myUnit.y})`,
            hp: myUnit.hp,
            qi: myUnit.qi,
            queueLength: myUnit.action_queue.length,
            queue: myUnit.action_queue
          });
        } else {
          console.warn('[WebSocket] ⚠️ My unit not found in world state! ID:', currentMyUnitId);
        }
      }
    } catch (error) {
      console.error('[WebSocket] ❌ Failed to parse message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('[WebSocket] ❌ Connection error:', error);
  };

  ws.onclose = (event) => {
    console.log('[WebSocket] 🔌 Disconnected. Code:', event.code, 'Reason:', event.reason);
    localStorage.removeItem('myUnitId');
    console.log('[WebSocket] 🔄 Reconnecting in 3 seconds...');
    setTimeout(connectWebSocket, 3000);
  };
}

export function sendCommand(command: string, unitId: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = { command, unit_id: unitId };
    console.log('[WebSocket] 📤 Sending command:', payload);
    ws.send(JSON.stringify(payload));
  } else {
    console.error('[WebSocket] ❌ Cannot send command - WebSocket not connected. State:', ws?.readyState);
  }
}
