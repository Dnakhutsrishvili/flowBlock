import {
  BlockedSite,
  FocusSession,
  Schedule,
  UserSettings,
  Stats,
  WeeklySchedule,
  ScheduleSlot,
} from "./types";

const STORAGE_KEYS = {
  BLOCKED_SITES: "blockedSites",
  SETTINGS: "settings",
  STATS: "stats",
  FOCUS_SESSIONS: "focusSessions",
  SCHEDULES: "schedules",
  WEEKLY_SCHEDULE: "weeklySchedule",
} as const;

const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  strictMode: false,
  defaultSessionLength: 25,
  breakLength: 5,
  notificationsEnabled: true,
  theme: "auto",
  blockedPageStyle: "motivational",
  premium: {
    isPremium: false,
    licenseKey: undefined,
    activatedAt: undefined,
  },
};

const DEFAULT_STATS: Stats = {
  totalFocusTime: 0,
  totalBlocks: 0,
  currentStreak: 0,
  longestStreak: 0,
  sessionsCompleted: 0,
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function getBlockedSites(): Promise<BlockedSite[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
  return result[STORAGE_KEYS.BLOCKED_SITES] || [];
}

export async function addBlockedSite(
  domain: string,
  category?: string,
): Promise<BlockedSite> {
  const sites = await getBlockedSites();
  const newSite: BlockedSite = {
    id: generateId(),
    domain: domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, ""),
    category,
    createdAt: Date.now(),
    blockCount: 0,
  };
  sites.push(newSite);
  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: sites });
  return newSite;
}

export async function removeBlockedSite(id: string): Promise<void> {
  const sites = await getBlockedSites();
  const filtered = sites.filter((site) => site.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: filtered });
}

export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
}

export async function updateSettings(
  settings: Partial<UserSettings>,
): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
}

export async function getStats(): Promise<Stats> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
  return { ...DEFAULT_STATS, ...result[STORAGE_KEYS.STATS] };
}

export async function updateStats(stats: Partial<Stats>): Promise<void> {
  const current = await getStats();
  const updated = { ...current, ...stats };
  await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: updated });
}

export async function getFocusSessions(): Promise<FocusSession[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.FOCUS_SESSIONS);
  return result[STORAGE_KEYS.FOCUS_SESSIONS] || [];
}

export async function saveFocusSession(session: FocusSession): Promise<void> {
  const sessions = await getFocusSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.FOCUS_SESSIONS]: sessions });
}

export async function getSchedules(): Promise<Schedule[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SCHEDULES);
  return result[STORAGE_KEYS.SCHEDULES] || [];
}

export async function saveSchedule(schedule: Schedule): Promise<void> {
  const schedules = await getSchedules();
  const index = schedules.findIndex((s) => s.id === schedule.id);
  if (index >= 0) {
    schedules[index] = schedule;
  } else {
    schedules.push(schedule);
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.SCHEDULES]: schedules });
}

// Weekly Schedule Functions
const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  enabled: false,
  slots: [],
};

export async function getWeeklySchedule(): Promise<WeeklySchedule> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WEEKLY_SCHEDULE);
  return {
    ...DEFAULT_WEEKLY_SCHEDULE,
    ...result[STORAGE_KEYS.WEEKLY_SCHEDULE],
  };
}

export async function updateWeeklySchedule(
  schedule: Partial<WeeklySchedule>,
): Promise<WeeklySchedule> {
  const current = await getWeeklySchedule();
  const updated = { ...current, ...schedule };
  await chrome.storage.local.set({ [STORAGE_KEYS.WEEKLY_SCHEDULE]: updated });
  return updated;
}

export async function addScheduleSlot(
  slot: Omit<ScheduleSlot, "id">,
): Promise<ScheduleSlot> {
  const schedule = await getWeeklySchedule();
  const newSlot: ScheduleSlot = {
    ...slot,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
  schedule.slots.push(newSlot);
  await chrome.storage.local.set({ [STORAGE_KEYS.WEEKLY_SCHEDULE]: schedule });
  return newSlot;
}

export async function removeScheduleSlot(slotId: string): Promise<void> {
  const schedule = await getWeeklySchedule();
  schedule.slots = schedule.slots.filter((s) => s.id !== slotId);
  await chrome.storage.local.set({ [STORAGE_KEYS.WEEKLY_SCHEDULE]: schedule });
}

export async function toggleScheduleSlot(slotId: string): Promise<void> {
  const schedule = await getWeeklySchedule();
  const slot = schedule.slots.find((s) => s.id === slotId);
  if (slot) {
    slot.enabled = !slot.enabled;
    await chrome.storage.local.set({
      [STORAGE_KEYS.WEEKLY_SCHEDULE]: schedule,
    });
  }
}

export function isWithinSchedule(schedule: WeeklySchedule): boolean {
  if (!schedule.enabled || schedule.slots.length === 0) {
    return true; // No schedule means always active
  }

  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return schedule.slots.some((slot) => {
    if (!slot.enabled || slot.day !== currentDay) {
      return false;
    }
    return currentTime >= slot.startTime && currentTime <= slot.endTime;
  });
}
