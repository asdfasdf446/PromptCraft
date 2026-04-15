import { createSignal } from 'solid-js';

export interface TileState {
  grid_x: number;
  grid_y: number;
  kind: 'normal' | 'fertile' | 'obstacle';
}

export interface UnitState {
  id: string;
  kind: 'player' | 'food' | 'obstacle';
  grid_x: number;
  grid_y: number;
  stack_level: number;
  hp: number;
  qi?: number;
  name: string;
  model: string;
  action_queue: string[];
}

export interface ActionEvent {
  unit_id: string;
  action: string;
  x: number;
  y: number;
  stack_level: number;
  target_x: number;
  target_y: number;
  target_stack_level: number;
}

export interface DeathEvent {
  unit_id: string;
  kind: 'player' | 'food' | 'obstacle';
  grid_x: number;
  grid_y: number;
  stack_level: number;
  model: string;
}

export interface WorldState {
  tiles: TileState[];
  units: UnitState[];
  tick: number;
  actions?: ActionEvent[];
  deaths?: DeathEvent[];
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

function isWorldStatePayload(data: unknown): data is WorldState {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Partial<WorldState>;
  return Array.isArray(candidate.tiles) && Array.isArray(candidate.units) && typeof candidate.tick === 'number';
}

export function connectWebSocket(token: string, onAuthFailed?: () => void) {
  currentToken = token;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = '8081';
  const wsUrl = `${protocol}//${host}:${port}/ws`;

  sessionStorage.removeItem('myUnitId');
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws!.send(JSON.stringify({ type: 'auth', token: currentToken }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'auth_ok') {
        sessionStorage.setItem('myUnitId', data.unit_id);
        return;
      }

      if (data.type === 'error') {
        if (data.code === 'auth_failed') {
          currentToken = null;
          onAuthFailed?.();
        }
        return;
      }

      if (data.type === 'command_result') {
        setLastCommandResult(data as CommandResult);
        return;
      }

      if (isWorldStatePayload(data)) {
        setWorldState(data);
        return;
      }

      console.warn('[WebSocket] Ignoring unexpected message shape:', data);
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  };

  ws.onclose = () => {
    sessionStorage.removeItem('myUnitId');
    if (currentToken) {
      setTimeout(() => connectWebSocket(currentToken!, onAuthFailed), 3000);
    }
  };
}

export function sendCommand(command: string, unitId: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = { type: 'command', request_id: `cmd-${nextRequestId++}`, command, unit_id: unitId };
    ws.send(JSON.stringify(payload));
  }
}
