import { createEffect, createSignal } from 'solid-js';
import { worldState } from '../network/WebSocketClient';

export default function PlayerStatusPanel() {
  const [myUnit, setMyUnit] = createSignal<any>(null);

  createEffect(() => {
    const state = worldState();
    const myUnitId = sessionStorage.getItem('myUnitId');

    if (state && myUnitId) {
      const unit = state.units.find(u => u.id === myUnitId && u.kind === 'player');
      setMyUnit(unit ?? null);
    } else {
      setMyUnit(null);
    }
  });

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      background: 'rgba(42, 42, 42, 0.95)',
      border: '2px solid #4a9eff',
      'border-radius': '8px',
      padding: '15px',
      'font-family': 'Courier New, monospace',
      'font-size': '13px',
      color: '#fff',
      'min-width': '250px',
      'z-index': '1000'
    }}>
      {myUnit() ? (
        <>
          <div style={{ 'margin-bottom': '10px', 'font-size': '16px', 'font-weight': 'bold', color: '#4a9eff' }}>
            {myUnit().name}
          </div>
          <div style={{ 'line-height': '1.6' }}>
            <div><strong>Kind:</strong> {myUnit().kind}</div>
            <div><strong>Position:</strong> ({myUnit().grid_x}, {myUnit().grid_y}, level {myUnit().stack_level})</div>
            <div><strong>HP:</strong> <span style={{ color: myUnit().hp > 5 ? '#4ade80' : '#ef4444' }}>{myUnit().hp}</span> / 10</div>
            <div><strong>Qi:</strong> <span style={{ color: (myUnit().qi ?? 0) >= 2 ? '#4ade80' : '#fbbf24' }}>{myUnit().qi ?? 0}</span> / 10</div>
            <div style={{ 'margin-top': '10px', 'padding-top': '10px', 'border-top': '1px solid #4a4a4a' }}>
              <strong>Action Queue:</strong>
              {myUnit().action_queue.length === 0 ? (
                <div style={{ color: '#888', 'font-style': 'italic', 'margin-top': '5px' }}>Empty</div>
              ) : (
                <ul style={{ 'margin': '5px 0 0 20px', 'padding': '0' }}>
                  {myUnit().action_queue.map((cmd: string, i: number) => (
                    <li key={i} style={{ color: '#4a9eff' }}>{cmd}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ color: '#888', 'font-style': 'italic' }}>
          Connecting...
        </div>
      )}
    </div>
  );
}
