import { createEffect, createSignal } from 'solid-js';
import { worldState } from '../network/WebSocketClient';

export default function PlayerStatusPanel() {
  const [myUnit, setMyUnit] = createSignal<any>(null);

  createEffect(() => {
    const state = worldState();
    const myUnitId = localStorage.getItem('myUnitId');

    console.log('[PlayerStatusPanel] Update triggered:', {
      hasState: !!state,
      myUnitId: myUnitId,
      unitCount: state?.units.length || 0
    });

    if (state && myUnitId) {
      const unit = state.units.find(u => u.id === myUnitId);

      if (unit) {
        console.log('[PlayerStatusPanel] ✅ Found my unit:', unit);
        setMyUnit(unit);
      } else {
        console.warn('[PlayerStatusPanel] ⚠️ My unit not found in state. Available units:',
          state.units.map(u => ({ id: u.id, name: u.name }))
        );
        setMyUnit(null);
      }
    } else {
      console.log('[PlayerStatusPanel] ⏳ Waiting for state or unit ID');
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
            <div><strong>Position:</strong> ({myUnit().x}, {myUnit().y})</div>
            <div><strong>HP:</strong> <span style={{ color: myUnit().hp > 5 ? '#4ade80' : '#ef4444' }}>{myUnit().hp}</span> / 10</div>
            <div><strong>Qi:</strong> <span style={{ color: myUnit().qi >= 2 ? '#4ade80' : '#fbbf24' }}>{myUnit().qi}</span> / 10</div>
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
