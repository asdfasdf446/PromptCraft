import { createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { worldState } from '../network/WebSocketClient';
import { currentDayPhase, cycleProgress } from '../game/gameState';

export default function SystemClock() {
  const [currentTime, setCurrentTime] = createSignal(0);
  const [logs, setLogs] = createSignal<string[]>([]);
  const [nextTick, setNextTick] = createSignal(5);

  let tickInterval: number;
  let countdownInterval: number;

  onMount(() => {
    // Countdown to next tick
    countdownInterval = setInterval(() => {
      setNextTick(prev => {
        if (prev <= 1) return 5;
        return prev - 1;
      });
    }, 1000);
  });

  createEffect(() => {
    const state = worldState();
    if (state) {
      const newTick = state.tick;
      const prevTick = currentTime();

      if (newTick > prevTick) {
        setCurrentTime(newTick);
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] Tick ${newTick} executed - ${state.units.length} units active`;
        setLogs(prev => [...prev.slice(-4), logMessage]); // Keep last 5 logs
        setNextTick(5); // Reset countdown
      }
    }
  });

  onCleanup(() => {
    clearInterval(tickInterval);
    clearInterval(countdownInterval);
  });

  const phaseEmoji = () => {
    switch (currentDayPhase()) {
      case 'morning': return '🌅';
      case 'afternoon': return '☀️';
      case 'evening': return '🌇';
      case 'midnight': return '🌙';
    }
  };

  const phaseColor = () => {
    switch (currentDayPhase()) {
      case 'morning': return '#fbbf24';
      case 'afternoon': return '#fde047';
      case 'evening': return '#fb923c';
      case 'midnight': return '#60a5fa';
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      background: 'rgba(42, 42, 42, 0.9)',
      border: '2px solid #4a4a4a',
      'border-radius': '8px',
      padding: '15px',
      'font-family': 'Courier New, monospace',
      'font-size': '12px',
      color: '#fff',
      'min-width': '280px',
      'z-index': '1000'
    }}>
      <div style={{ 'margin-bottom': '10px', 'font-size': '14px', 'font-weight': 'bold' }}>
        System Clock
      </div>
      <div style={{ 'margin-bottom': '5px' }}>
        <span style={{ color: '#4a9eff' }}>Current Tick:</span> {currentTime()}
      </div>
      <div style={{ 'margin-bottom': '5px' }}>
        <span style={{ color: '#4a9eff' }}>Time Elapsed:</span> {currentTime() * 5}s
      </div>
      <div style={{ 'margin-bottom': '10px' }}>
        <span style={{ color: '#4a9eff' }}>Next Tick In:</span> {nextTick()}s
      </div>

      {/* Day/Night Cycle */}
      <div style={{ 'margin-bottom': '10px', 'padding-bottom': '10px', 'border-bottom': '1px solid #4a4a4a' }}>
        <span style={{ color: '#4a9eff' }}>Time of Day:</span>{' '}
        <span style={{ color: phaseColor() }}>
          {phaseEmoji()} {currentDayPhase().charAt(0).toUpperCase() + currentDayPhase().slice(1)}
        </span>
        <div style={{ 'margin-top': '5px', background: '#2a2a2a', height: '6px', 'border-radius': '3px', overflow: 'hidden' }}>
          <div style={{
            width: `${cycleProgress() * 100}%`,
            height: '100%',
            background: phaseColor(),
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      <div style={{ 'border-top': '1px solid #4a4a4a', 'padding-top': '10px' }}>
        <div style={{ 'margin-bottom': '5px', 'font-weight': 'bold', color: '#888' }}>
          Event Log:
        </div>
        <div style={{ 'font-size': '11px', 'line-height': '1.4', color: '#aaa' }}>
          {logs().length === 0 ? (
            <div style={{ 'font-style': 'italic' }}>Waiting for first tick...</div>
          ) : (
            logs().map((log, i) => (
              <div key={i}>{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
