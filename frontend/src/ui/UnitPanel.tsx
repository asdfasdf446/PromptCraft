import { UnitState } from '../network/WebSocketClient';

interface Props {
  unit: UnitState;
  onClose: () => void;
}

export default function UnitPanel(props: Props) {
  const isMyUnit = () => props.unit.id === sessionStorage.getItem('myUnitId');
  const isPlayer = () => props.unit.kind === 'player';

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#2a2a2a',
      border: '2px solid #4a4a4a',
      'border-radius': '8px',
      padding: '20px',
      'min-width': '300px',
      'z-index': '2000'
    }}>
      <div style={{ display: 'flex', 'justify-content': 'space-between', 'margin-bottom': '15px' }}>
        <h2 style={{ 'font-size': '18px' }}>{props.unit.name}</h2>
        <button
          onClick={props.onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            'font-size': '20px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>

      <div style={{ 'font-family': 'Courier New, monospace', 'font-size': '14px', 'line-height': '1.6' }}>
        <div><strong>ID:</strong> {props.unit.id.slice(0, 8)}</div>
        <div><strong>Kind:</strong> {props.unit.kind}</div>
        <div><strong>Position:</strong> ({props.unit.grid_x}, {props.unit.grid_y}, level {props.unit.stack_level})</div>
        <div><strong>HP:</strong> {props.unit.hp}</div>
        {isPlayer() && <div><strong>Qi:</strong> {props.unit.qi ?? 0} / 10</div>}

        {isMyUnit() && isPlayer() && (
          <div style={{ 'margin-top': '10px' }}>
            <strong>Action Queue:</strong>
            {props.unit.action_queue.length === 0 ? (
              <div style={{ color: '#888', 'font-style': 'italic' }}>Empty</div>
            ) : (
              <ul style={{ 'margin-left': '20px', 'margin-top': '5px' }}>
                {props.unit.action_queue.map((cmd, i) => (
                  <li key={i}>{cmd}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!isMyUnit() && isPlayer() && (
          <div style={{ 'margin-top': '10px', color: '#888', 'font-style': 'italic' }}>
            Action queue hidden for other players
          </div>
        )}
      </div>
    </div>
  );
}
