import {
  getBlockedSites,
  addBlockedSite,
  removeBlockedSite,
  getSettings,
  updateSettings,
  getStats,
  updateStats,
  getWeeklySchedule,
  updateWeeklySchedule,
  addScheduleSlot,
  removeScheduleSlot,
  isWithinSchedule,
} from "../utils/storage";
import {
  startFocusSession,
  endFocusSession,
  getCurrentSession,
  getPomodoroState,
  updatePomodoroState,
  startPomodoroMode,
  stopPomodoroMode,
  handlePomodoroSessionEnd,
  PomodoroState,
} from "../utils/timer";

const BLOCKED_PAGE_URL = chrome.runtime.getURL("blocked.html");

// ============================================
// URL Blocking Logic
// ============================================

/**
 * Extracts the domain from a URL string
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Checks if a domain matches a pattern (supports wildcards)
 * Examples:
 *   - "facebook.com" matches "facebook.com"
 *   - "*.facebook.com" matches "m.facebook.com", "www.facebook.com"
 */
function domainMatchesPattern(domain: string, pattern: string): boolean {
  const normalizedPattern = pattern.toLowerCase().replace(/^www\./, "");

  // Handle wildcard patterns (*.example.com)
  if (normalizedPattern.startsWith("*.")) {
    const baseDomain = normalizedPattern.slice(2);
    return domain === baseDomain || domain.endsWith("." + baseDomain);
  }

  // Exact match or subdomain match
  return (
    domain === normalizedPattern || domain.endsWith("." + normalizedPattern)
  );
}

/**
 * Checks if a URL should be blocked based on blocked sites list and schedule
 */
async function isUrlBlocked(url: string): Promise<boolean> {
  const domain = extractDomain(url);
  if (!domain) return false;

  // Don't block extension pages
  if (url.startsWith(chrome.runtime.getURL(""))) return false;

  // Batch all storage reads in parallel
  const [settings, weeklySchedule, breakResult, blockedSites] =
    await Promise.all([
      getSettings(),
      getWeeklySchedule(),
      chrome.storage.local.get("temporaryBreaks"),
      getBlockedSites(),
    ]);

  if (!settings.enabled) return false;

  if (weeklySchedule.enabled && !isWithinSchedule(weeklySchedule)) {
    return false;
  }

  // Check for temporary break
  const breaks = breakResult.temporaryBreaks || {};
  const breakUntil = breaks[domain];

  if (breakUntil && Date.now() < breakUntil) {
    return false;
  }

  // Clean up expired breaks (fire and forget)
  if (breakUntil && Date.now() >= breakUntil) {
    delete breaks[domain];
    chrome.storage.local.set({ temporaryBreaks: breaks });
  }

  return blockedSites.some((site) => domainMatchesPattern(domain, site.domain));
}

/**
 * Increments the block count for a matched site
 */
async function incrementBlockCount(url: string): Promise<void> {
  const domain = extractDomain(url);
  const [blockedSites, stats] = await Promise.all([
    getBlockedSites(),
    getStats(),
  ]);

  for (const site of blockedSites) {
    if (domainMatchesPattern(domain, site.domain)) {
      site.blockCount++;
      await Promise.all([
        chrome.storage.local.set({ blockedSites }),
        updateStats({ totalBlocks: stats.totalBlocks + 1 }),
      ]);
      break;
    }
  }
}

// ============================================
// Navigation Listener - Block Sites
// ============================================

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only handle main frame navigation
  if (details.frameId !== 0) {
    return;
  }

  try {
    const shouldBlock = await isUrlBlocked(details.url);

    if (shouldBlock) {
      // Increment block counter
      await incrementBlockCount(details.url);

      // Redirect to blocked page with original URL as parameter
      const blockedPageWithParams = `${BLOCKED_PAGE_URL}?url=${encodeURIComponent(details.url)}`;

      await chrome.tabs.update(details.tabId, {
        url: blockedPageWithParams,
      });
    }
  } catch (error) {
    console.error("FlowBlock: Error checking URL:", error);
  }
});

// ============================================
// Alarm Handlers - Focus Session Timer
// ============================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "flowblock-session-end") {
    try {
      const session = await getCurrentSession();
      const pomodoroState = await getPomodoroState();

      if (session) {
        // End the current session as completed
        await endFocusSession(session.id, true);

        const settings = await getSettings();

        // Check if Pomodoro mode is enabled
        if (pomodoroState.enabled) {
          const result = await handlePomodoroSessionEnd();

          if (result && settings.notificationsEnabled) {
            const isBreak = result.pomodoroState.isOnBreak;
            await chrome.notifications.create({
              type: "basic",
              iconUrl: chrome.runtime.getURL("/icons/icon128.png"),
              title: isBreak ? "Break Time! ☕" : "Focus Time! 🎯",
              message: result.message,
              priority: 2,
            });
          }
        } else {
          // Regular session end notification
          if (settings.notificationsEnabled) {
            await chrome.notifications.create({
              type: "basic",
              iconUrl: chrome.runtime.getURL("/icons/icon128.png"),
              title: "Focus Session Complete! 🎉",
              message: `Great work! You stayed focused for ${session.duration} minutes. Time for a break!`,
              priority: 2,
            });
          }
        }
      }
    } catch (error) {
      console.error("FlowBlock: Error handling alarm:", error);
    }
  }
});

// ============================================
// Message Handlers - Communication with UI
// ============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error("FlowBlock: Message handler error:", error);
      sendResponse({ error: error.message });
    });

  // Return true to indicate async response
  return true;
});

async function handleMessage(message: {
  type: string;
  payload?: unknown;
}): Promise<unknown> {
  switch (message.type) {
    case "getStatus": {
      const [settings, currentSession, stats, blockedSites] = await Promise.all(
        [getSettings(), getCurrentSession(), getStats(), getBlockedSites()],
      );

      return {
        enabled: settings.enabled,
        currentSession,
        stats,
        blockedSites,
        settings,
      };
    }

    case "toggleBlocking": {
      const settings = await getSettings();
      await updateSettings({ enabled: !settings.enabled });
      return { enabled: !settings.enabled };
    }

    case "startSession": {
      const { duration } = message.payload as { duration: number };
      const session = await startFocusSession(duration);
      return { session };
    }

    case "endSession": {
      const { sessionId, completed } = message.payload as {
        sessionId: string;
        completed: boolean;
      };
      await endFocusSession(sessionId, completed);
      return { success: true };
    }

    case "addSite": {
      const { domain, category } = message.payload as {
        domain: string;
        category?: string;
      };
      const site = await addBlockedSite(domain, category);
      return { site };
    }

    case "removeSite": {
      const { id } = message.payload as { id: string };
      await removeBlockedSite(id);
      return { success: true };
    }

    case "updateSettings": {
      const settings = message.payload as Partial<
        Parameters<typeof updateSettings>[0]
      >;
      await updateSettings(settings);
      return { success: true };
    }

    case "getTimeRemaining": {
      const session = await getCurrentSession();
      if (!session) {
        return { remaining: 0 };
      }
      const elapsed = Date.now() - session.startTime;
      const totalMs = session.duration * 60 * 1000;
      const remainingMs = Math.max(0, totalMs - elapsed);
      return { remaining: Math.round(remainingMs / 1000) };
    }

    case "startPomodoro": {
      const { workDuration, breakDuration, longBreakDuration } =
        message.payload as {
          workDuration?: number;
          breakDuration?: number;
          longBreakDuration?: number;
        };
      const result = await startPomodoroMode(
        workDuration,
        breakDuration,
        longBreakDuration,
      );
      return result;
    }

    case "stopPomodoro": {
      await stopPomodoroMode();
      return { success: true };
    }

    case "getPomodoroState": {
      const pomodoroState = await getPomodoroState();
      return { pomodoroState };
    }

    case "updatePomodoroSettings": {
      const pomodoroSettings = message.payload as Partial<PomodoroState>;
      const updated = await updatePomodoroState(pomodoroSettings);
      return { pomodoroState: updated };
    }

    case "skipToNext": {
      const session = await getCurrentSession();
      const pomodoroState = await getPomodoroState();

      if (session && pomodoroState.enabled) {
        await endFocusSession(session.id, false);
        const result = await handlePomodoroSessionEnd();
        return result;
      }
      return { error: "No active Pomodoro session" };
    }

    case "getWeeklySchedule": {
      const weeklySchedule = await getWeeklySchedule();
      return { weeklySchedule };
    }

    case "updateWeeklySchedule": {
      const scheduleUpdate = message.payload as { enabled?: boolean };
      const updated = await updateWeeklySchedule(scheduleUpdate);
      return { weeklySchedule: updated };
    }

    case "addScheduleSlot": {
      const slotData = message.payload as {
        day: number;
        startTime: string;
        endTime: string;
      };
      const newSlot = await addScheduleSlot({ ...slotData, enabled: true });
      return { slot: newSlot };
    }

    case "removeScheduleSlot": {
      const { slotId } = message.payload as { slotId: string };
      await removeScheduleSlot(slotId);
      return { success: true };
    }

    case "isScheduleActive": {
      const schedule = await getWeeklySchedule();
      const active = isWithinSchedule(schedule);
      return { active, scheduleEnabled: schedule.enabled };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// ============================================
// Initialization
// ============================================

// On extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("FlowBlock: Extension installed, setting defaults");

    // Default settings are already set by getSettings() if not present
    await getSettings();
    await getStats();

    // Add some default blocked sites as examples
    const defaultSites = [
      { domain: "facebook.com", category: "Social Media" },
      { domain: "twitter.com", category: "Social Media" },
      { domain: "instagram.com", category: "Social Media" },
      { domain: "reddit.com", category: "Social Media" },
      { domain: "youtube.com", category: "Entertainment" },
      { domain: "tiktok.com", category: "Entertainment" },
    ];

    for (const site of defaultSites) {
      await addBlockedSite(site.domain, site.category);
    }

    // Open options page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/options/index.html"),
    });
  }
});

// On browser startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("FlowBlock: Browser started, checking session state");

  try {
    const session = await getCurrentSession();

    if (session) {
      // Check if session should have ended while browser was closed
      const elapsed = Date.now() - session.startTime;
      const totalMs = session.duration * 60 * 1000;

      if (elapsed >= totalMs) {
        // Session ended while browser was closed
        await endFocusSession(session.id, true);

        const settings = await getSettings();
        if (settings.notificationsEnabled) {
          await chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon128.png"),
            title: "Focus Session Completed",
            message:
              "Your focus session completed while you were away. Great work!",
            priority: 1,
          });
        }
      }
    }
  } catch (error) {
    console.error("FlowBlock: Error on startup:", error);
  }
});

console.log("FlowBlock: Background service worker initialized");
