import { useState, useEffect, useCallback } from "react";
import { BlockedSite, FocusSession, Stats, UserSettings } from "../utils/types";
import { getPremiumStatus, FREE_LIMITS } from "../utils/premium";

interface PomodoroState {
  enabled: boolean;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  currentCycle: number;
  isOnBreak: boolean;
  totalCyclesCompleted: number;
}

interface StatusResponse {
  enabled: boolean;
  currentSession: FocusSession | null;
  stats: Stats;
  blockedSites: BlockedSite[];
  settings: UserSettings;
}

function App() {
  const [enabled, setEnabled] = useState(true);
  const [currentSession, setCurrentSession] = useState<FocusSession | null>(
    null,
  );
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [stats, setStats] = useState<Stats>({
    totalFocusTime: 0,
    totalBlocks: 0,
    currentStreak: 0,
    longestStreak: 0,
    sessionsCompleted: 0,
  });
  const [blockedSites, setBlockedSites] = useState<BlockedSite[]>([]);
  const [newSite, setNewSite] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [pomodoroState, setPomodoroState] = useState<PomodoroState | null>(
    null,
  );
  const [showPomodoroSettings, setShowPomodoroSettings] = useState(false);
  const [pomodoroWorkDuration, setPomodoroWorkDuration] = useState(25);
  const [pomodoroBreakDuration, setPomodoroBreakDuration] = useState(5);
  const [userIsPremium, setUserIsPremium] = useState(true); // default true to avoid flash

  // Load initial data
  useEffect(() => {
    loadStatus();
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!currentSession || isPaused) return;

    const interval = setInterval(async () => {
      const response = await chrome.runtime.sendMessage({
        type: "getTimeRemaining",
      });
      if (response.remaining <= 0) {
        loadStatus();
      } else {
        setTimeRemaining(response.remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSession, isPaused]);

  const loadStatus = async () => {
    try {
      const response: StatusResponse = await chrome.runtime.sendMessage({
        type: "getStatus",
      });
      setEnabled(response.enabled);
      setCurrentSession(response.currentSession);
      setStats(response.stats);
      setBlockedSites(response.blockedSites);

      // Load premium status
      const premiumInfo = await getPremiumStatus();
      setUserIsPremium(premiumInfo.isPremium);

      // Load Pomodoro state
      const pomodoroResponse = await chrome.runtime.sendMessage({
        type: "getPomodoroState",
      });
      setPomodoroState(pomodoroResponse.pomodoroState);

      if (response.currentSession) {
        const timeResponse = await chrome.runtime.sendMessage({
          type: "getTimeRemaining",
        });
        setTimeRemaining(timeResponse.remaining);
      }
    } catch (error) {
      console.error("Failed to load status:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBlocking = async () => {
    const response = await chrome.runtime.sendMessage({
      type: "toggleBlocking",
    });
    setEnabled(response.enabled);
  };

  const startSession = async (duration: number) => {
    const response = await chrome.runtime.sendMessage({
      type: "startSession",
      payload: { duration },
    });
    setCurrentSession(response.session);
    setTimeRemaining(duration * 60);
  };

  const endSession = async (completed: boolean) => {
    if (!currentSession) return;

    // Check if Pomodoro mode is active
    if (pomodoroState?.enabled && !completed) {
      await chrome.runtime.sendMessage({ type: "stopPomodoro" });
      setPomodoroState((prev) => (prev ? { ...prev, enabled: false } : null));
    } else {
      await chrome.runtime.sendMessage({
        type: "endSession",
        payload: { sessionId: currentSession.id, completed },
      });
    }

    setCurrentSession(null);
    setTimeRemaining(0);
    setIsPaused(false);
    loadStatus();
  };

  const startPomodoro = async () => {
    const response = await chrome.runtime.sendMessage({
      type: "startPomodoro",
      payload: {
        workDuration: pomodoroWorkDuration,
        breakDuration: pomodoroBreakDuration,
        longBreakDuration: 15,
      },
    });
    setCurrentSession(response.session);
    setPomodoroState(response.pomodoroState);
    setTimeRemaining(pomodoroWorkDuration * 60);
    setShowPomodoroSettings(false);
  };

  const skipToNext = async () => {
    const response = await chrome.runtime.sendMessage({ type: "skipToNext" });
    if (response.nextSession) {
      setCurrentSession(response.nextSession);
      setPomodoroState(response.pomodoroState);
      setTimeRemaining(response.nextSession.duration * 60);
    }
  };

  const addSite = async () => {
    if (!newSite.trim()) return;
    const response = await chrome.runtime.sendMessage({
      type: "addSite",
      payload: { domain: newSite.trim() },
    });
    setBlockedSites((prev) => [...prev, response.site]);
    setNewSite("");
  };

  const removeSite = async (id: string) => {
    await chrome.runtime.sendMessage({
      type: "removeSite",
      payload: { id },
    });
    setBlockedSites((prev) => prev.filter((site) => site.id !== id));
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const getProgress = () => {
    if (!currentSession) return 0;
    const total = currentSession.duration * 60;
    return ((total - timeRemaining) / total) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[500px] bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <span className="font-bold text-gray-900">FlowBlock</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openOptions}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <button
            onClick={toggleBlocking}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              enabled ? "bg-success" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                enabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Focus Session Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          {!currentSession ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Start Focus Session
                </h2>
                <button
                  onClick={() => setShowPomodoroSettings(!showPomodoroSettings)}
                  className={`text-xs px-2 py-1 rounded-full transition-colors ${
                    showPomodoroSettings
                      ? "bg-secondary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  🍅 Pomodoro
                  {!userIsPremium && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-primary to-secondary text-white rounded">
                      PRO
                    </span>
                  )}
                </button>
              </div>

              {showPomodoroSettings ? (
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🍅</span>
                      <span className="text-sm font-medium text-gray-700">
                        Pomodoro Timer
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Work in focused cycles with automatic breaks
                    </p>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Work
                        </label>
                        <select
                          value={pomodoroWorkDuration}
                          onChange={(e) =>
                            setPomodoroWorkDuration(Number(e.target.value))
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value={15}>15 min</option>
                          <option value={20}>20 min</option>
                          <option value={25}>25 min</option>
                          <option value={30}>30 min</option>
                          <option value={45}>45 min</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Break
                        </label>
                        <select
                          value={pomodoroBreakDuration}
                          onChange={(e) =>
                            setPomodoroBreakDuration(Number(e.target.value))
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value={3}>3 min</option>
                          <option value={5}>5 min</option>
                          <option value={10}>10 min</option>
                          <option value={15}>15 min</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={startPomodoro}
                      className="w-full py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <span>🍅</span>
                      Start Pomodoro
                    </button>
                  </div>

                  <button
                    onClick={() => setShowPomodoroSettings(false)}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    ← Back to regular timer
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => startSession(25)}
                    className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-lg hover:opacity-90 transition-opacity mb-3"
                  >
                    Start Focusing
                  </button>
                  <div className="flex gap-2">
                    {[25, 45, 90].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => startSession(mins)}
                        className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        {mins}min
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center">
              {/* Pomodoro mode indicator */}
              {pomodoroState?.enabled && (
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-3 ${
                    currentSession.type === "break"
                      ? "bg-success/10 text-success"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <span>🍅</span>
                  {currentSession.type === "break"
                    ? "Break"
                    : `Session ${pomodoroState.currentCycle}`}
                  <span className="text-gray-400">•</span>
                  <span>{pomodoroState.totalCyclesCompleted} completed</span>
                </div>
              )}

              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#E5E7EB"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke={
                      currentSession.type === "break"
                        ? "url(#gradientBreak)"
                        : "url(#gradient)"
                    }
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - getProgress() / 100)}`}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient
                      id="gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#4F46E5" />
                      <stop offset="100%" stopColor="#7C3AED" />
                    </linearGradient>
                    <linearGradient
                      id="gradientBreak"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#34D399" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                {isPaused
                  ? "Paused"
                  : currentSession.type === "break"
                    ? "Enjoy your break! ☕"
                    : "Stay focused! 🎯"}
              </p>
              <div className="flex gap-2">
                {pomodoroState?.enabled && (
                  <button
                    onClick={skipToNext}
                    className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Skip →
                  </button>
                )}
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={() => endSession(false)}
                  className="flex-1 py-2 text-sm font-medium text-white bg-danger rounded-lg hover:opacity-90 transition-opacity"
                >
                  Stop
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Today's Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
            <div className="w-8 h-8 mx-auto mb-1 bg-primary/10 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {stats.totalFocusTime}m
            </p>
            <p className="text-xs text-gray-500">Focus Time</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
            <div className="w-8 h-8 mx-auto mb-1 bg-secondary/10 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {stats.totalBlocks}
            </p>
            <p className="text-xs text-gray-500">Blocked</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
            <div className="w-8 h-8 mx-auto mb-1 bg-warning/10 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-warning"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                />
              </svg>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {stats.currentStreak}
            </p>
            <p className="text-xs text-gray-500">Day Streak</p>
          </div>
        </div>

        {/* Quick Add Site */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Quick Add Site
            </h2>
            {!userIsPremium && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  blockedSites.length >= FREE_LIMITS.maxBlockedSites
                    ? "bg-danger/10 text-danger"
                    : blockedSites.length >= FREE_LIMITS.maxBlockedSites - 1
                      ? "bg-warning/10 text-warning"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {blockedSites.length}/{FREE_LIMITS.maxBlockedSites} sites
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSite}
              onChange={(e) => setNewSite(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSite()}
              placeholder="twitter.com"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              onClick={addSite}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Add
            </button>
          </div>
        </div>

        {/* Blocked Sites List */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Blocked Sites
            </h2>
            <button
              onClick={openOptions}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          {blockedSites.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No sites blocked yet
            </p>
          ) : (
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {blockedSites.slice(0, 5).map((site) => (
                <li
                  key={site.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm text-gray-700 truncate">
                    {site.domain}
                  </span>
                  <button
                    onClick={() => removeSite(site.id)}
                    className="p-1 text-gray-400 hover:text-danger transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Premium Upgrade Banner */}
      {!userIsPremium && (
        <div className="border-t border-gray-200 bg-gradient-to-r from-primary/5 to-secondary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-900">
                Upgrade to Premium
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Unlimited sites, schedules & 30-day analytics
              </p>
            </div>
            <button
              onClick={() => {
                chrome.tabs.create({
                  url: chrome.runtime.getURL(
                    "src/options/index.html?upgrade=true",
                  ),
                });
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-primary to-secondary rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
