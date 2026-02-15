type PendingTerminalLaunch = {
  cwd: string;
  startupCommand: string;
};

const pendingLaunchesBySessionId = new Map<string, PendingTerminalLaunch>();
const pendingLaunchTimersBySessionId = new Map<string, ReturnType<typeof setTimeout>>();
const PENDING_LAUNCH_TTL_MS = 2 * 60 * 1000;

export function registerPendingTerminalLaunch(sessionId: string, launch: PendingTerminalLaunch): void {
  pendingLaunchesBySessionId.set(sessionId, launch);

  const existingTimer = pendingLaunchTimersBySessionId.get(sessionId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    pendingLaunchesBySessionId.delete(sessionId);
    pendingLaunchTimersBySessionId.delete(sessionId);
  }, PENDING_LAUNCH_TTL_MS);

  pendingLaunchTimersBySessionId.set(sessionId, timer);
}

export function consumePendingTerminalLaunch(sessionId: string): PendingTerminalLaunch | null {
  const pendingLaunch = pendingLaunchesBySessionId.get(sessionId);
  if (!pendingLaunch) {
    return null;
  }

  pendingLaunchesBySessionId.delete(sessionId);

  const timer = pendingLaunchTimersBySessionId.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    pendingLaunchTimersBySessionId.delete(sessionId);
  }

  return pendingLaunch;
}
