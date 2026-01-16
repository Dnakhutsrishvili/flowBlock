export interface BlockedSite {
  id: string;
  domain: string;
  category?: string;
  createdAt: number;
  blockCount: number;
}

export interface FocusSession {
  id: string;
  startTime: number;
  endTime?: number;
  duration: number;
  completed: boolean;
  type: 'focus' | 'break';
}

export interface Schedule {
  id: string;
  name: string;
  days: number[];
  startTime: string;
  endTime: string;
  enabled: boolean;
}

export interface WeeklySchedule {
  enabled: boolean;
  slots: ScheduleSlot[];
}

export interface ScheduleSlot {
  id: string;
  day: number; // 0-6 (Sun-Sat)
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  enabled: boolean;
}

export interface UserSettings {
  enabled: boolean;
  strictMode: boolean;
  defaultSessionLength: number;
  breakLength: number;
  notificationsEnabled: boolean;
  theme: 'light' | 'dark' | 'auto';
  blockedPageStyle: 'minimal' | 'motivational' | 'serene';
}

export interface Stats {
  totalFocusTime: number;
  totalBlocks: number;
  currentStreak: number;
  longestStreak: number;
  sessionsCompleted: number;
}
