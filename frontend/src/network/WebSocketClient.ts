import { createSignal } from 'solid-js';

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

export interface CommandResult {
  type: 'command_result';
  request_id?: string;
  unit_id?: string;
  command?: string;
  status: 'accepted' | 'rejected';
  code: string;
  message: string;
  queue_length?: number;
  queue_limit?: number;
  tick: number;
}

const [worldState, setWorldState] = createSignal<WorldState | null>(null);
const [lastCommandResult, setLastCommandResult] = createSignal<CommandResult | null>(null);
let ws: WebSocket | null = null;
let currentToken: string | null = null;
let nextRequestId = 1;

export { worldState, lastCommandResult };

export function connectWebSocket(token: string, onAuthFailed?: () => void) {
  currentToken = token;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = '8080';
  const wsUrl = `${protocol}//${host}:${port}/ws`;

  console.log('[WebSocket] Attempting to connect to:', wsUrl);

  // Clear old unit ID on new connection (sessionStorage is per-tab, not shared)
  sessionStorage.removeItem('myUnitId');
  console.log('[WebSocket] 🗑️ Cleared old unit ID from sessionStorage (tab-local)');

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WebSocket] ✅ Connected successfully');
    ws!.send(JSON.stringify({ type: 'auth', token: currentToken }));
    console.log('[WebSocket] 🔐 Auth message sent');
  };

  ws.onmessage = (event) => {
    console.log('[WebSocket] 📨 Received message:', event.data);

    try {
      const data = JSON.parse(event.data);

      // Handle auth responses
      if (data.type === 'auth_ok') {
        console.log('[WebSocket] 🎮 Auth OK! Unit ID:', data.unit_id);
        console.log('[WebSocket] 💾 Storing unit ID in sessionStorage (tab-local, not shared with other tabs)');
        sessionStorage.setItem('myUnitId', data.unit_id);
        return;
      }

      if (data.type === 'error') {
        console.error('[WebSocket] ❌ Server error:', data.code, data.message);
        if (data.code === 'auth_failed') {
          console.warn('[WebSocket] 🔒 Auth failed — stopping reconnect, notifying app');
          currentToken = null; // prevent reconnect loop
          onAuthFailed?.();
        }
        return;
      }

      if (data.type === 'command_result') {
        console.log('[WebSocket] ✅ Command result:', data);
        setLastCommandResult(data as CommandResult);
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
      const myUnitId = sessionStorage.getItem('myUnitId');
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
    sessionStorage.removeItem('myUnitId');
    console.log('[WebSocket] 🗑️ Cleared myUnitId from sessionStorage on disconnect');
    if (currentToken) {
      console.log('[WebSocket] 🔄 Reconnecting in 3 seconds...');
      setTimeout(() => connectWebSocket(currentToken!), 3000);
    }
  };
}

export function sendCommand(command: string, unitId: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = { type: 'command', request_id: `cmd-${nextRequestId++}`, command, unit_id: unitId };
    console.log('[WebSocket] 📤 Sending command:', payload);
    ws.send(JSON.stringify(payload));
  } else {
    console.error('[WebSocket] ❌ Cannot send command - WebSocket not connected. State:', ws?.readyState);
  }
}
