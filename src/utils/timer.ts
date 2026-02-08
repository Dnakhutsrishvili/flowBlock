import { FocusSession } from './types';
import { saveFocusSession, getStats, updateStats } from './storage';
import { generateId } from './helpers';

const ALARM_NAME = 'flowblock-session-end';
const CURRENT_SESSION_KEY = 'currentSession';
const PAUSED_SESSION_KEY = 'pausedSession';
const POMODORO_STATE_KEY = 'pomodoroState';

export interface PomodoroState {
  enabled: boolean;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  currentCycle: number;
  isOnBreak: boolean;
  totalCyclesCompleted: number;
}

const DEFAULT_POMODORO_STATE: PomodoroState = {
  enabled: false,
  workDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  currentCycle: 1,
  isOnBreak: false,
  totalCyclesCompleted: 0
};

export async function getPomodoroState(): Promise<PomodoroState> {
  const result = await chrome.storage.local.get(POMODORO_STATE_KEY);
  return { ...DEFAULT_POMODORO_STATE, ...result[POMODORO_STATE_KEY] };
}

export async function updatePomodoroState(state: Partial<PomodoroState>): Promise<PomodoroState> {
  const current = await getPomodoroState();
  const updated = { ...current, ...state };
  await chrome.storage.local.set({ [POMODORO_STATE_KEY]: updated });
  return updated;
}

export async function startPomodoroMode(
  workDuration = 25,
  breakDuration = 5,
  longBreakDuration = 15
): Promise<{ session: FocusSession; pomodoroState: PomodoroState }> {
  // Reset pomodoro state
  const pomodoroState = await updatePomodoroState({
    enabled: true,
    workDuration,
    breakDuration,
    longBreakDuration,
    currentCycle: 1,
    isOnBreak: false,
    totalCyclesCompleted: 0
  });

  // Start first work session
  const session = await startFocusSession(workDuration, 'focus');
  
  return { session, pomodoroState };
}

export async function stopPomodoroMode(): Promise<void> {
  const session = await getCurrentSession();
  if (session) {
    await endFocusSession(session.id, false);
  }
  await updatePomodoroState({ enabled: false });
}

export async function handlePomodoroSessionEnd(): Promise<{ 
  nextSession: FocusSession; 
  pomodoroState: PomodoroState;
  message: string;
} | null> {
  const pomodoroState = await getPomodoroState();
  
  if (!pomodoroState.enabled) {
    return null;
  }

  let nextDuration: number;
  let nextType: 'focus' | 'break';
  let message: string;
  let newState: Partial<PomodoroState>;

  if (pomodoroState.isOnBreak) {
    // Break ended, start work session
    nextDuration = pomodoroState.workDuration;
    nextType = 'focus';
    message = `Break over! Starting work session ${pomodoroState.currentCycle}`;
    newState = { isOnBreak: false };
  } else {
    // Work session ended
    const cyclesCompleted = pomodoroState.totalCyclesCompleted + 1;
    const isLongBreak = cyclesCompleted % pomodoroState.sessionsUntilLongBreak === 0;
    
    nextDuration = isLongBreak ? pomodoroState.longBreakDuration : pomodoroState.breakDuration;
    nextType = 'break';
    message = isLongBreak 
      ? `Great work! You've completed ${cyclesCompleted} sessions. Enjoy a ${pomodoroState.longBreakDuration} minute break!`
      : `Session ${pomodoroState.currentCycle} complete! Take a ${pomodoroState.breakDuration} minute break.`;
    
    newState = {
      isOnBreak: true,
      currentCycle: pomodoroState.currentCycle + 1,
      totalCyclesCompleted: cyclesCompleted
    };
  }

  const updatedState = await updatePomodoroState(newState);
  const nextSession = await startFocusSession(nextDuration, nextType);

  return { nextSession, pomodoroState: updatedState, message };
}

export async function startFocusSession(
  durationMinutes: number,
  type: 'focus' | 'break' = 'focus'
): Promise<FocusSession> {
  const existingSession = await getCurrentSession();
  if (existingSession) {
    // Clear existing session first
    await chrome.storage.local.remove([CURRENT_SESSION_KEY, PAUSED_SESSION_KEY]);
    await chrome.alarms.clear(ALARM_NAME);
  }

  const session: FocusSession = {
    id: generateId(),
    startTime: Date.now(),
    duration: durationMinutes,
    completed: false,
    type
  };

  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: durationMinutes
  });

  await chrome.storage.local.set({ [CURRENT_SESSION_KEY]: session });
  await saveFocusSession(session);

  return session;
}

export async function endFocusSession(sessionId: string, completed: boolean): Promise<void> {
  const session = await getCurrentSession();
  if (!session || session.id !== sessionId) {
    throw new Error('Session not found or not active');
  }

  const endTime = Date.now();
  const actualDurationMinutes = Math.round((endTime - session.startTime) / 60000);

  const updatedSession: FocusSession = {
    ...session,
    endTime,
    completed
  };

  await saveFocusSession(updatedSession);
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.remove([CURRENT_SESSION_KEY, PAUSED_SESSION_KEY]);

  if (completed) {
    const stats = await getStats();
    const today = new Date().toDateString();
    const lastSessionDate = stats.sessionsCompleted > 0 
      ? new Date(session.startTime).toDateString() 
      : null;

    let newStreak = stats.currentStreak;
    if (lastSessionDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      newStreak = lastSessionDate === yesterday ? stats.currentStreak + 1 : 1;
    }

    await updateStats({
      totalFocusTime: stats.totalFocusTime + actualDurationMinutes,
      sessionsCompleted: stats.sessionsCompleted + 1,
      currentStreak: newStreak,
      longestStreak: Math.max(stats.longestStreak, newStreak)
    });
  }
}

export async function getCurrentSession(): Promise<FocusSession | null> {
  const result = await chrome.storage.local.get(CURRENT_SESSION_KEY);
  return result[CURRENT_SESSION_KEY] || null;
}

export async function getTimeRemaining(): Promise<number> {
  const session = await getCurrentSession();
  if (!session) {
    return 0;
  }

  const pausedData = await chrome.storage.local.get(PAUSED_SESSION_KEY);
  if (pausedData[PAUSED_SESSION_KEY]) {
    return pausedData[PAUSED_SESSION_KEY].remainingSeconds;
  }

  const elapsed = Date.now() - session.startTime;
  const totalMs = session.duration * 60 * 1000;
  const remainingMs = totalMs - elapsed;

  return Math.max(0, Math.round(remainingMs / 1000));
}

export async function pauseSession(): Promise<void> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error('No active session to pause');
  }

  const remainingSeconds = await getTimeRemaining();
  if (remainingSeconds <= 0) {
    throw new Error('Session has already ended');
  }

  await chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.set({
    [PAUSED_SESSION_KEY]: {
      pausedAt: Date.now(),
      remainingSeconds
    }
  });
}

export async function resumeSession(): Promise<void> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error('No active session to resume');
  }

  const pausedData = await chrome.storage.local.get(PAUSED_SESSION_KEY);
  const paused = pausedData[PAUSED_SESSION_KEY];
  if (!paused) {
    throw new Error('Session is not paused');
  }

  const remainingMinutes = paused.remainingSeconds / 60;

  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: remainingMinutes
  });

  const pauseDuration = Date.now() - paused.pausedAt;
  const updatedSession: FocusSession = {
    ...session,
    startTime: session.startTime + pauseDuration
  };

  await chrome.storage.local.set({ [CURRENT_SESSION_KEY]: updatedSession });
  await chrome.storage.local.remove(PAUSED_SESSION_KEY);
}
