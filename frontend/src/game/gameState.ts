import { createSignal } from 'solid-js';

// Debug toggles
export const [wireframeMode, setWireframeMode] = createSignal(false);
export const [gridVisible, setGridVisible] = createSignal(true);
export const [perfMonitorVisible, setPerfMonitorVisible] = createSignal(false);

// Day/Night cycle state
export type DayPhase = 'morning' | 'afternoon' | 'evening' | 'midnight';
export const [currentDayPhase, setCurrentDayPhase] = createSignal<DayPhase>('morning');
export const [cycleProgress, setCycleProgress] = createSignal(0); // 0-1
