import { createSignal, onMount, Show } from 'solid-js';
import BabylonScene from './game/BabylonScene';
import CommandInput from './ui/CommandInput';
import UnitPanel from './ui/UnitPanel';
import SystemClock from './ui/SystemClock';
import PlayerStatusPanel from './ui/PlayerStatusPanel';
import DebugBar from './ui/DebugBar';
import LoginScreen from './ui/LoginScreen';
import { connectWebSocket, sendCommand, worldState } from './network/WebSocketClient';

export default function App() {
  const [selectedUnit, setSelectedUnit] = createSignal<any>(null);
  const [authenticated, setAuthenticated] = createSignal(false);

  const handleAuthFailed = () => {
    console.warn('[App] 🔒 Auth failed (token likely expired) — returning to login screen');
    localStorage.removeItem('userToken');
    setAuthenticated(false);
  };

  const handleAuth = (token: string) => {
    setAuthenticated(true);
    connectWebSocket(token, handleAuthFailed);
  };

  onMount(() => {
    const storedToken = localStorage.getItem('userToken');
    if (storedToken) {
      console.log('[App] 🔑 Found stored user token, auto-connecting...');
      handleAuth(storedToken);
    }
  });

  const handleCommand = (cmd: string) => {
    const myUnitId = sessionStorage.getItem('myUnitId');
    const myUnit = worldState()?.units.find(u => u.id === myUnitId);

    console.log('[App] 📝 Command submitted:', {
      command: cmd,
      myUnitId: myUnitId,
      foundUnit: !!myUnit
    });

    if (myUnit) {
      sendCommand(cmd, myUnit.id);
    } else {
      console.error('[App] ❌ Cannot send command - my unit not found');
    }
  };

  const handleUnitClick = (unit: any) => {
    const myUnitId = sessionStorage.getItem('myUnitId');

    console.log('[App] 🖱️ Unit clicked:', {
      clickedUnitId: unit.id,
      clickedUnitName: unit.name,
      myUnitId: myUnitId,
      isMyUnit: unit.id === myUnitId
    });

    // Don't open modal for own unit (it's already in fixed panel)
    if (unit.id !== myUnitId) {
      console.log('[App] 📋 Opening modal for other player');
      setSelectedUnit(unit);
    } else {
      console.log('[App] ⏭️ Skipping modal for own unit');
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <BabylonScene onUnitClick={handleUnitClick} />
      <PlayerStatusPanel />
      <SystemClock />
      <DebugBar />
      <CommandInput onSubmit={handleCommand} />
      <Show when={selectedUnit()}>
        <UnitPanel unit={selectedUnit()!} onClose={() => setSelectedUnit(null)} />
      </Show>
      <Show when={!authenticated()}>
        <LoginScreen onAuth={handleAuth} />
      </Show>
    </div>
  );
}
