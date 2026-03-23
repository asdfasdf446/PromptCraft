import { createSignal } from 'solid-js';

interface Props {
  onSubmit: (command: string) => void;
}

export default function CommandInput(props: Props) {
  const [input, setInput] = createSignal('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const cmd = input().trim();
    if (cmd) {
      props.onSubmit(cmd);
      setInput('');
    }
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '1000'
    }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          placeholder="Enter command (e.g., move_up, attack_down)"
          style={{
            padding: '10px 20px',
            'font-size': '14px',
            'font-family': 'Courier New, monospace',
            background: '#2a2a2a',
            border: '2px solid #4a4a4a',
            color: '#fff',
            'border-radius': '4px',
            width: '400px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          style={{
            padding: '10px 20px',
            'font-size': '14px',
            'font-family': 'Courier New, monospace',
            background: '#4a9eff',
            border: 'none',
            color: '#fff',
            'border-radius': '4px',
            cursor: 'pointer'
          }}
        >
          Submit
        </button>
      </form>
    </div>
  );
}
