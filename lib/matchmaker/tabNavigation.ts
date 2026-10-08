type PulseListener = () => void;

const pulseListeners = new Set<PulseListener>();
let focusedMatchMakerRoute: string | null = null;

export function setMatchMakerFocusedRoute(route: string | null) {
  focusedMatchMakerRoute = route;
}

export function getMatchMakerFocusedRoute(): string | null {
  return focusedMatchMakerRoute;
}

export function subscribeMatchMakerTabPulse(listener: PulseListener): () => void {
  pulseListeners.add(listener);
  return () => {
    pulseListeners.delete(listener);
  };
}

export function triggerMatchMakerTabPulse() {
  pulseListeners.forEach((fn) => fn());
}
