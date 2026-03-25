import { createSignal, onMount, onCleanup } from 'solid-js';
import {
  wireframeMode, setWireframeMode,
  gridVisible, setGridVisible,
  perfMonitorVisible, setPerfMonitorVisible
} from '../game/gameState';

export default function DebugBar() {
  const [fps, setFps] = createSignal(0);
  const [memory, setMemory] = createSignal('N/A');
  const [latency, setLatency] = createSignal('N/A');

  let perfInterval: number;

  onMount(() => {
    // Update performance stats every second
    perfInterval = setInterval(() => {
      // FPS is updated from BabylonScene
      // Memory (Chrome only)
      if ((performance as any).memory) {
        const used = ((performance as any).memory.usedJSHeapSize / 1048576).toFixed(1);
        setMemory(`${used} MB`);
      }
    }, 1000);
  });

  onCleanup(() => {
    clearInterval(perfInterval);
  });

  // Expose setFps for BabylonScene to call
  (window as any).__setDebugFps = setFps;
  (window as any).__setDebugLatency = setLatency;

  return (
    <div style={{
      position: 'absolute',
      bottom: '80px',
      left: '20px',
      background: 'rgba(42, 42, 42, 0.95)',
      border: '2px solid #666',
      'border-radius': '8px',
      padding: '15px',
      'font-family': 'Courier New, monospace',
      'font-size': '13px',
      color: '#fff',
      'min-width': '250px',
      'z-index': '1000'
    }}>
      <div style={{ 'margin-bottom': '12px', 'font-size': '14px', 'font-weight': 'bold', color: '#fbbf24' }}>
        🛠️ Debug Tools
      </div>

      {/* Wireframe Mode */}
      <label style={{ display: 'block', 'margin-bottom': '8px', cursor: 'pointer', 'user-select': 'none' }}>
        <input
          type="checkbox"
          checked={wireframeMode()}
          onChange={(e) => setWireframeMode(e.currentTarget.checked)}
          style={{ 'margin-right': '8px' }}
        />
        <span>Wireframe Mode</span>
      </label>

      {/* Grid Helper */}
      <label style={{ display: 'block', 'margin-bottom': '8px', cursor: 'pointer', 'user-select': 'none' }}>
        <input
          type="checkbox"
          checked={gridVisible()}
          onChange={(e) => setGridVisible(e.currentTarget.checked)}
          style={{ 'margin-right': '8px' }}
        />
        <span>Grid Borders</span>
      </label>

      {/* Performance Monitor */}
      <label style={{ display: 'block', 'margin-bottom': '12px', cursor: 'pointer', 'user-select': 'none' }}>
        <input
          type="checkbox"
          checked={perfMonitorVisible()}
          onChange={(e) => setPerfMonitorVisible(e.currentTarget.checked)}
          style={{ 'margin-right': '8px' }}
        />
        <span>Performance Monitor</span>
      </label>

      {/* Performance Stats */}
      {perfMonitorVisible() && (
        <div style={{
          'border-top': '1px solid #666',
          'padding-top': '10px',
          'font-size': '12px',
          color: '#aaa'
        }}>
          <div style={{ 'margin-bottom': '4px' }}>
            <span style={{ color: '#4a9eff' }}>FPS:</span> {fps()}
          </div>
          <div style={{ 'margin-bottom': '4px' }}>
            <span style={{ color: '#4a9eff' }}>Memory:</span> {memory()}
          </div>
          <div>
            <span style={{ color: '#4a9eff' }}>Latency:</span> {latency()}
          </div>
        </div>
      )}
    </div>
  );
}
