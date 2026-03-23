import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import BabylonScene from './game/BabylonScene';
import CommandInput from './ui/CommandInput';
import UnitPanel from './ui/UnitPanel';
import SystemClock from './ui/SystemClock';
import PlayerStatusPanel from './ui/PlayerStatusPanel';
import { connectWebSocket, sendCommand, worldState } from './network/WebSocketClient';

export default function App() {
  const [selectedUnit, setSelectedUnit] = createSignal<any>(null);

  onMount(() => {
    connectWebSocket();
  });

  const handleCommand = (cmd: string) => {
    const myUnit = worldState()?.units.find(u => u.id === localStorage.getItem('myUnitId'));
    if (myUnit) {
      sendCommand(cmd, myUnit.id);
    }
  };

  const handleUnitClick = (unit: any) => {
    // Don't open modal for own unit (it's already in fixed panel)
    const myUnitId = localStorage.getItem('myUnitId');
    if (unit.id !== myUnitId) {
      setSelectedUnit(unit);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <BabylonScene onUnitClick={handleUnitClick} />
      <PlayerStatusPanel />
      <SystemClock />
      <CommandInput onSubmit={handleCommand} />
      <Show when={selectedUnit()}>
        <UnitPanel unit={selectedUnit()!} onClose={() => setSelectedUnit(null)} />
      </Show>
    </div>
  );
}
