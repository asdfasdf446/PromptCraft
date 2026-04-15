import { createSignal } from 'solid-js';

export type GraphicsTier = 'low' | 'medium' | 'high';

const detectDefaultGraphicsTier = (): GraphicsTier => {
  if (typeof window === 'undefined') return 'medium';
  const touchPoints = navigator.maxTouchPoints || 0;
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 768;
  const mobileUserAgent = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

  if (mobileUserAgent || touchPoints > 1 || smallViewport) {
    return hardwareConcurrency >= 6 ? 'medium' : 'low';
  }

  return hardwareConcurrency >= 12 ? 'high' : 'medium';
};

// Debug toggles
export const [wireframeMode, setWireframeMode] = createSignal(false);
export const [gridVisible, setGridVisible] = createSignal(true);
export const [perfMonitorVisible, setPerfMonitorVisible] = createSignal(false);
export const [graphicsTier, setGraphicsTier] = createSignal<GraphicsTier>(detectDefaultGraphicsTier());

// Day/Night cycle state
export type DayPhase = 'morning' | 'afternoon' | 'evening' | 'midnight';
export const [currentDayPhase, setCurrentDayPhase] = createSignal<DayPhase>('morning');
export const [cycleProgress, setCycleProgress] = createSignal(0); // 0-1
