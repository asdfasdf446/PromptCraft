import { createSignal, Show } from 'solid-js';
import type { CommandResult } from '../network/WebSocketClient';

interface Props {
  onSubmit: (command: string) => boolean;
  commandResult: CommandResult | null;
}

export default function CommandInput(props: Props) {
  const [input, setInput] = createSignal('');
  const [feedback, setFeedback] = createSignal<{ message: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const cmd = input().trim();

    console.log('[CommandInput] 📥 Form submitted:', { input: cmd });

    if (cmd) {
      const commands = cmd.split(';').map(c => c.trim()).filter(c => c.length > 0);

      console.log('[CommandInput] 🔍 Parsed commands:', commands);

      if (commands.length === 0) {
        console.warn('[CommandInput] ⚠️ No valid commands after parsing');
        showFeedback('No valid commands entered', 'error');
        return;
      }

      const submittedCommands: string[] = [];
      commands.forEach(command => {
        console.log('[CommandInput] 📤 Submitting command:', command);
        if (props.onSubmit(command)) {
          submittedCommands.push(command);
        }
      });

      if (submittedCommands.length === 0) {
        showFeedback('Could not submit commands', 'error');
        return;
      }

      if (submittedCommands.length === 1) {
        showFeedback(`Submitted ${submittedCommands[0]}; waiting for server confirmation`, 'success');
      } else {
        showFeedback(`Submitted ${submittedCommands.length} commands; waiting for per-command server confirmation`, 'success');
      }
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
      <Show when={feedback()}>
        <div style={{
          position: 'absolute',
          bottom: '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          'border-radius': '4px',
          background: feedback()!.type === 'success' ? '#2d5f2d' : '#5f2d2d',
          border: `2px solid ${feedback()!.type === 'success' ? '#4a9e4a' : '#9e4a4a'}`,
          color: '#fff',
          'font-family': 'Courier New, monospace',
          'font-size': '12px',
          'white-space': 'nowrap'
        }}>
          {feedback()!.message}
        </div>
      </Show>

      <Show when={props.commandResult}>
        <div style={{
          position: 'absolute',
          bottom: '110px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          'border-radius': '4px',
          background: props.commandResult!.status === 'accepted' ? '#2d5f2d' : '#5f2d2d',
          border: `2px solid ${props.commandResult!.status === 'accepted' ? '#4a9e4a' : '#9e4a4a'}`,
          color: '#fff',
          'font-family': 'Courier New, monospace',
          'font-size': '12px',
          'white-space': 'nowrap'
        }}>
          {props.commandResult!.status === 'accepted' ? 'Queued' : 'Rejected'}: {props.commandResult!.command} ({props.commandResult!.message})
        </div>
      </Show>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', 'flex-direction': 'column', 'align-items': 'center' }}>
        <input
          type="text"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          placeholder="Enter commands (use ; for batch, e.g., move_up;attack_down)"
          style={{
            padding: '10px 20px',
            'font-size': '14px',
            'font-family': 'Courier New, monospace',
            background: '#2a2a2a',
            border: '2px solid #4a4a4a',
            color: '#fff',
            'border-radius': '4px',
            width: '500px',
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
