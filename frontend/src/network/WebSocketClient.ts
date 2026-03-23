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

  ws = new WebSocket(`${protocol}//${host}:${port}/ws`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.error) {
      console.error('Server error:', data.error);
      return;
    }

    setWorldState(data);

    // Store my unit ID on first connection
    if (!localStorage.getItem('myUnitId') && data.units.length > 0) {
      const lastUnit = data.units[data.units.length - 1];
      localStorage.setItem('myUnitId', lastUnit.id);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    localStorage.removeItem('myUnitId');
    setTimeout(connectWebSocket, 3000); // Reconnect after 3s
  };
}

export function sendCommand(command: string, unitId: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ command, unit_id: unitId }));
  }
}
