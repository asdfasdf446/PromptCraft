import { createSignal } from 'solid-js';
import { getAuthToken } from './auth';

export interface UnitState {
  id: string;
  x: number;
  y: number;
  hp: number;
  qi: number;
  name: string;
  model: string;
  action_queue: string[];
}

export interface ActionEvent {
  unit_id: string;
  action: string;
  x: number;
  y: number;
}

export interface WorldState {
  units: UnitState[];
  tick: number;
  actions?: ActionEvent[];
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

  ws.onopen = async () => {
    console.log('[WebSocket] ✅ Connected successfully');
    try {
      const token = await getAuthToken();
      ws!.send(JSON.stringify({ type: 'auth', token }));
      console.log('[WebSocket] 🔐 Auth message sent');
    } catch (err) {
      console.error('[WebSocket] ❌ Failed to get auth token:', err);
      ws!.close();
    }
  };

  ws.onmessage = (event) => {
    console.log('[WebSocket] 📨 Received message:', event.data);

    try {
      const data = JSON.parse(event.data);

      // Handle auth responses
      if (data.type === 'auth_ok') {
        console.log('[WebSocket] 🎮 Auth OK! Unit ID:', data.unit_id);
        localStorage.setItem('myUnitId', data.unit_id);
        return;
      }

      if (data.type === 'error') {
        console.error('[WebSocket] ❌ Server error:', data.code, data.message);
        return;
      }

      if (data.error) {
        console.error('[WebSocket] ❌ Server error:', data.error);
        return;
      }

      console.log('[WebSocket] 📊 World state update:', {
        tick: data.tick,
        unitCount: data.units?.length || 0,
        actionCount: data.actions?.length || 0
      });

      // Log action events
      if (data.actions && data.actions.length > 0) {
        console.log('[WebSocket] ⚡ Action events:', data.actions);
        data.actions.forEach((action: ActionEvent) => {
          const unit = data.units?.find((u: UnitState) => u.id === action.unit_id);
          console.log(`[Action] ${unit?.name || action.unit_id} executed ${action.action} at (${action.x}, ${action.y})`);
        });
      }

      setWorldState(data);

      // Log my unit status
      const myUnitId = localStorage.getItem('myUnitId');
      if (myUnitId) {
        const myUnit = data.units?.find((u: UnitState) => u.id === myUnitId);
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
          console.warn('[WebSocket] ⚠️ My unit not found in world state! ID:', myUnitId);
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
