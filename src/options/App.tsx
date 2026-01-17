import { useState, useEffect } from "react";
import { BlockedSite, UserSettings, Stats } from "../utils/types";
import {
  getDailyFocusTime,
  getTopBlockedSites,
  getWeeklyTotalFocus,
} from "../utils/analytics";

type Section =
  | "general"
  | "blocked-sites"
  | "schedules"
  | "focus-sessions"
  | "appearance"
  | "analytics"
  | "about";

function App() {
  const [activeSection, setActiveSection] = useState<Section>("general");
  const [dailyFocusData, setDailyFocusData] = useState<
    { day: string; minutes: number }[]
  >([]);
  const [topBlockedSites, setTopBlockedSites] = useState<BlockedSite[]>([]);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [settings, setSettings] = useState<UserSettings>({
    enabled: true,
    strictMode: false,
    defaultSessionLength: 25,
    breakLength: 5,
    notificationsEnabled: true,
    theme: "auto",
    blockedPageStyle: "motivational",
  });
  const [blockedSites, setBlockedSites] = useState<BlockedSite[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalFocusTime: 0,
    totalBlocks: 0,
    currentStreak: 0,
    longestStreak: 0,
    sessionsCompleted: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [newSite, setNewSite] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Saved!");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(120);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeSection === "analytics") {
      loadAnalytics();
    }
  }, [activeSection]);
  const loadAnalytics = async () => {
    const daily = await getDailyFocusTime();
    const topSites = await getTopBlockedSites(5);
    const weekly = await getWeeklyTotalFocus();

    setDailyFocusData(daily);
    setTopBlockedSites(topSites);
    setWeeklyTotal(weekly);
  };

  const loadData = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "getStatus" });
      setSettings(response.settings);
      setBlockedSites(response.blockedSites);
      setStats(response.stats);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const showSavedToast = (message = "Saved!") => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await chrome.runtime.sendMessage({
      type: "updateSettings",
      payload: { [key]: value },
    });
    showSavedToast();
  };

  const addSite = async () => {
    if (!newSite.trim()) return;
    const response = await chrome.runtime.sendMessage({
      type: "addSite",
      payload: {
        domain: newSite.trim(),
        category: newCategory.trim() || undefined,
      },
    });
    setBlockedSites((prev) => [...prev, response.site]);
    setNewSite("");
    setNewCategory("");
    showSavedToast("Site added!");
  };

  const removeSite = async (id: string) => {
    await chrome.runtime.sendMessage({
      type: "removeSite",
      payload: { id },
    });
    setBlockedSites((prev) => prev.filter((site) => site.id !== id));
    showSavedToast("Site removed!");
  };

  const resetAllData = async () => {
    await chrome.storage.local.clear();
    setShowResetConfirm(false);
    showSavedToast("All data reset!");
    setTimeout(() => window.location.reload(), 1000);
  };

  const filteredSites = blockedSites.filter(
    (site) =>
      site.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.category?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const navItems: { id: Section; label: string; icon: JSX.Element }[] = [
    {
      id: "general",
      label: "General",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      ),
    },
    {
      id: "blocked-sites",
      label: "Blocked Sites",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      ),
    },
    {
      id: "schedules",
      label: "Schedules",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      id: "focus-sessions",
      label: "Focus Sessions",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      ),
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      id: "about",
      label: "About",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  const exportSites = () => {
    chrome.storage.local.get("blockedSites", (result) => {
      const data = JSON.stringify(result.blockedSites, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "flowblock-sites.json";
      link.click();
    });
  };
  const importSites = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const sites = JSON.parse(text);

      for (const site of blockedSites) {
        await chrome.runtime.sendMessage({
          type: "removeSite",
          payload: { id: site.id },
        });
      }
      for (const site of sites) {
        await chrome.runtime.sendMessage({
          type: "addSite",
          payload: { domain: site.domain, category: site.category },
        });
      }

      await loadData();
      showSavedToast("Sites imported!");
    };

    reader.readAsText(file);
  };

  return (
    <div className="settings-container">
      {/* Header */}
      <header className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
          <svg
            className="w-6 h-6 text-white"
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
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            FlowBlock Settings
          </h1>
          <p className="text-sm text-gray-500">
            Customize your focus experience
          </p>
        </div>
      </header>

      <div className="settings-layout">
        {/* Sidebar */}
        <aside className="sidebar-nav">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`nav-item w-full ${
                  activeSection === item.id ? "active" : ""
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="animate-fade-in">
          {/* General Section */}
          {activeSection === "general" && (
            <div>
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">General Settings</h2>
                  <p className="settings-card-description">
                    Configure how FlowBlock works
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="toggle-wrapper">
                    <div className="toggle-info">
                      <div className="toggle-label">Enable FlowBlock</div>
                      <div className="toggle-description">
                        Turn site blocking on or off globally
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSetting("enabled", !settings.enabled)
                      }
                      className={`toggle-switch ${
                        settings.enabled ? "active" : ""
                      }`}
                    />
                  </div>

                  <div className="toggle-wrapper">
                    <div className="toggle-info">
                      <div className="toggle-label">Strict Mode</div>
                      <div className="toggle-description">
                        Prevent disabling blocking during focus sessions
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSetting("strictMode", !settings.strictMode)
                      }
                      className={`toggle-switch ${
                        settings.strictMode ? "active" : ""
                      }`}
                    />
                  </div>

                  <div className="toggle-wrapper">
                    <div className="toggle-info">
                      <div className="toggle-label">Notifications</div>
                      <div className="toggle-description">
                        Show alerts when sessions end or sites are blocked
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSetting(
                          "notificationsEnabled",
                          !settings.notificationsEnabled,
                        )
                      }
                      className={`toggle-switch ${
                        settings.notificationsEnabled ? "active" : ""
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Your Progress</h2>
                  <p className="settings-card-description">
                    All-time statistics
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon bg-primary/10">
                        <svg
                          className="w-5 h-5 text-primary"
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
                      <div className="stat-value">{stats.totalFocusTime}m</div>
                      <div className="stat-label">Total Focus Time</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon bg-secondary/10">
                        <svg
                          className="w-5 h-5 text-secondary"
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
                      <div className="stat-value">{stats.totalBlocks}</div>
                      <div className="stat-label">Sites Blocked</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon bg-success/10">
                        <svg
                          className="w-5 h-5 text-success"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                          />
                        </svg>
                      </div>
                      <div className="stat-value">
                        {stats.sessionsCompleted}
                      </div>
                      <div className="stat-label">Sessions Done</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon bg-warning/10">
                        <svg
                          className="w-5 h-5 text-warning"
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
                      <div className="stat-value">{stats.longestStreak}</div>
                      <div className="stat-label">Best Streak</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Blocked Sites Section */}
          {activeSection === "blocked-sites" && (
            <div>
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Add New Site</h2>
                  <p className="settings-card-description">
                    Block a website from distracting you
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={newSite}
                        onChange={(e) => setNewSite(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addSite()}
                        placeholder="facebook.com"
                        className="form-input"
                      />
                      <p className="form-hint">
                        Enter domain without https:// (e.g., twitter.com)
                      </p>
                    </div>
                    <div className="w-40">
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Category"
                        className="form-input"
                      />
                    </div>
                    <button
                      onClick={addSite}
                      className="btn btn-primary h-[42px]"
                    >
                      Add Site
                    </button>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="settings-card-title">
                        Blocked Sites ({blockedSites.length})
                      </h2>
                      <p className="settings-card-description">
                        Manage your blocked websites
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary text-sm"
                      onClick={exportSites}
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
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      Export
                    </button>
                    <label className="btn btn-secondary text-sm cursor-pointer">
                      <input
                        type="file"
                        accept=".json"
                        onChange={importSites}
                        className="hidden"
                      />
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
                          d="M4 8v1a3 3 0 003 3h10a3 3 0 003-3V8m-4 4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Import
                    </label>
                  </div>
                  <div className="mt-4">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search sites..."
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="settings-card-body p-0">
                  {filteredSites.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      <svg
                        className="w-12 h-12 mx-auto mb-3 opacity-50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                        />
                      </svg>
                      <p>No blocked sites yet</p>
                    </div>
                  ) : (
                    <div className="site-list border-0 rounded-none">
                      {filteredSites.map((site) => (
                        <div key={site.id} className="site-item">
                          <div>
                            <div className="site-domain">{site.domain}</div>
                            {site.category && (
                              <div className="site-category">
                                {site.category}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="site-stats">
                              {site.blockCount} blocks
                            </span>
                            <button
                              onClick={() => removeSite(site.id)}
                              className="icon-btn danger"
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Schedules Section */}
          {activeSection === "schedules" && (
            <div className="settings-card">
              <div className="settings-card-header">
                <h2 className="settings-card-title">Blocking Schedules</h2>
                <p className="settings-card-description">
                  Set up automatic blocking times
                </p>
              </div>
              <div className="settings-card-body">
                <div className="text-center py-8 text-gray-400">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mb-4">Schedule feature coming soon!</p>
                  <p className="text-sm">
                    Set automatic blocking times for work hours, study sessions,
                    and more.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Focus Sessions Section */}
          {activeSection === "focus-sessions" && (
            <div>
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Session Settings</h2>
                  <p className="settings-card-description">
                    Customize your focus and break durations
                  </p>
                </div>
                <div className="settings-card-body space-y-6">
                  <div className="form-group">
                    <div className="flex items-center justify-between mb-2">
                      <label className="form-label mb-0">
                        Default Focus Duration
                      </label>
                      <span className="text-sm font-semibold text-primary">
                        {settings.defaultSessionLength} minutes
                      </span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="120"
                      step="5"
                      value={settings.defaultSessionLength}
                      onChange={(e) =>
                        updateSetting(
                          "defaultSessionLength",
                          parseInt(e.target.value),
                        )
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>15 min</span>
                      <span>120 min</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="flex items-center justify-between mb-2">
                      <label className="form-label mb-0">Break Duration</label>
                      <span className="text-sm font-semibold text-secondary">
                        {settings.breakLength} minutes
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={settings.breakLength}
                      onChange={(e) =>
                        updateSetting("breakLength", parseInt(e.target.value))
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-secondary"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>5 min</span>
                      <span>30 min</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Daily Focus Goal</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="30"
                        max="480"
                        step="30"
                        value={dailyGoal}
                        onChange={(e) => setDailyGoal(parseInt(e.target.value))}
                        className="form-input w-32"
                      />
                      <span className="text-sm text-gray-500">
                        minutes per day
                      </span>
                    </div>
                    <p className="form-hint">
                      Recommended: 120-240 minutes for productive work
                    </p>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Pomodoro Presets</h2>
                  <p className="settings-card-description">
                    Quick session templates
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => {
                        updateSetting("defaultSessionLength", 25);
                        updateSetting("breakLength", 5);
                      }}
                      className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
                    >
                      <div className="font-semibold text-gray-900">Classic</div>
                      <div className="text-sm text-gray-500">25/5 min</div>
                    </button>
                    <button
                      onClick={() => {
                        updateSetting("defaultSessionLength", 45);
                        updateSetting("breakLength", 15);
                      }}
                      className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
                    >
                      <div className="font-semibold text-gray-900">
                        Extended
                      </div>
                      <div className="text-sm text-gray-500">45/15 min</div>
                    </button>
                    <button
                      onClick={() => {
                        updateSetting("defaultSessionLength", 90);
                        updateSetting("breakLength", 20);
                      }}
                      className="p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
                    >
                      <div className="font-semibold text-gray-900">
                        Deep Work
                      </div>
                      <div className="text-sm text-gray-500">90/20 min</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Section */}
          {activeSection === "appearance" && (
            <div>
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Theme</h2>
                  <p className="settings-card-description">
                    Choose your preferred color scheme
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="grid grid-cols-3 gap-3">
                    {(["light", "dark", "auto"] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => updateSetting("theme", theme)}
                        className={`p-4 border-2 rounded-lg transition-colors ${
                          settings.theme === theme
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 mx-auto mb-2 rounded-lg ${
                            theme === "light"
                              ? "bg-white border border-gray-200"
                              : theme === "dark"
                                ? "bg-gray-800"
                                : "bg-gradient-to-br from-white to-gray-800"
                          }`}
                        />
                        <div className="text-sm font-medium capitalize">
                          {theme}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Blocked Page Style</h2>
                  <p className="settings-card-description">
                    How blocked sites appear when visited
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        {
                          id: "minimal",
                          label: "Minimal",
                          desc: "Simple, clean design",
                        },
                        {
                          id: "motivational",
                          label: "Motivational",
                          desc: "Inspiring quotes",
                        },
                        {
                          id: "serene",
                          label: "Serene",
                          desc: "Calming visuals",
                        },
                      ] as const
                    ).map((style) => (
                      <button
                        key={style.id}
                        onClick={() =>
                          updateSetting("blockedPageStyle", style.id)
                        }
                        className={`p-4 border-2 rounded-lg transition-colors text-left ${
                          settings.blockedPageStyle === style.id
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="font-medium text-gray-900">
                          {style.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {style.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Analytics Section */}
          {activeSection === "analytics" && (
            <div>
              {/* Weekly Overview Cards */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Weekly Overview</h2>
                  <p className="settings-card-description">
                    Your focus stats for the past 7 days
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-primary/10 rounded-lg">
                      <div className="text-3xl font-bold text-primary">
                        {weeklyTotal}
                      </div>
                      <div className="text-sm text-gray-500">
                        Minutes Focused
                      </div>
                    </div>
                    <div className="text-center p-4 bg-secondary/10 rounded-lg">
                      <div className="text-3xl font-bold text-secondary">
                        {stats.sessionsCompleted}
                      </div>
                      <div className="text-sm text-gray-500">
                        Sessions Completed
                      </div>
                    </div>
                    <div className="text-center p-4 bg-success/10 rounded-lg">
                      <div className="text-3xl font-bold text-success">
                        {stats.currentStreak}
                      </div>
                      <div className="text-sm text-gray-500">Day Streak 🔥</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Focus Chart */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Daily Focus Time</h2>
                  <p className="settings-card-description">
                    Minutes focused each day this week
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="flex items-end justify-between gap-2 h-48">
                    {dailyFocusData.map((data) => {
                      const maxMinutes = Math.max(
                        ...dailyFocusData.map((d) => d.minutes),
                        1,
                      );
                      const height = (data.minutes / maxMinutes) * 100;

                      return (
                        <div
                          key={data.day}
                          className="flex-1 flex flex-col items-center gap-2"
                        >
                          <div className="text-xs text-gray-500">
                            {data.minutes}m
                          </div>
                          <div
                            className="w-full bg-gradient-to-t from-primary to-secondary rounded-t-lg transition-all duration-500"
                            style={{ height: `${Math.max(height, 4)}%` }}
                          />
                          <div className="text-xs font-medium text-gray-600">
                            {data.day}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Top Blocked Sites */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">Most Blocked Sites</h2>
                  <p className="settings-card-description">
                    Sites you've been protected from the most
                  </p>
                </div>
                <div className="settings-card-body">
                  {topBlockedSites.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>No blocked sites yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topBlockedSites.map((site, index) => {
                        const maxBlocks = topBlockedSites[0]?.blockCount || 1;
                        const width = (site.blockCount / maxBlocks) * 100;

                        return (
                          <div
                            key={site.id}
                            className="flex items-center gap-3"
                          >
                            <div className="w-6 text-sm font-bold text-gray-400">
                              #{index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700">
                                  {site.domain}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {site.blockCount} blocks
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-danger to-warning rounded-full transition-all duration-500"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* About Section */}
          {activeSection === "about" && (
            <div>
              <div className="settings-card">
                <div className="settings-card-header">
                  <h2 className="settings-card-title">About FlowBlock</h2>
                </div>
                <div className="settings-card-body">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center">
                      <svg
                        className="w-10 h-10 text-white"
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
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        FlowBlock
                      </h3>
                      <p className="text-gray-500">Focus & Productivity</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Version 1.0.0
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <a
                      href="https://chrome.google.com/webstore"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className="w-5 h-5 text-warning"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        <span className="font-medium text-gray-700">
                          Rate on Chrome Web Store
                        </span>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>

                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className="w-5 h-5 text-gray-700"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                        <span className="font-medium text-gray-700">
                          View on GitHub
                        </span>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              <div className="settings-card border-danger/20">
                <div className="settings-card-header">
                  <h2 className="settings-card-title text-danger">
                    Danger Zone
                  </h2>
                  <p className="settings-card-description">
                    Irreversible actions
                  </p>
                </div>
                <div className="settings-card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        Reset All Data
                      </div>
                      <div className="text-sm text-gray-500">
                        Delete all settings, blocked sites, and statistics
                      </div>
                    </div>
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="btn btn-danger"
                    >
                      Reset Everything
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <svg
            className="w-5 h-5 text-success"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Reset All Data?
            </h3>
            <p className="text-gray-500 mb-6">
              This will permanently delete all your settings, blocked sites,
              focus sessions, and statistics. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button onClick={resetAllData} className="btn btn-danger">
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
