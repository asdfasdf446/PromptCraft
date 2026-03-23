import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import BabylonScene from './game/BabylonScene';
import CommandInput from './ui/CommandInput';
import UnitPanel from './ui/UnitPanel';
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

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <BabylonScene onUnitClick={setSelectedUnit} />
      <CommandInput onSubmit={handleCommand} />
      <Show when={selectedUnit()}>
        <UnitPanel unit={selectedUnit()!} onClose={() => setSelectedUnit(null)} />
      </Show>
    </div>
  );
}
