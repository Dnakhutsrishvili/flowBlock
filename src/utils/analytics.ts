import { FocusSession, BlockedSite } from "./types";
import { getFocusSessions, getBlockedSites, getStats } from "./storage";

export async function getWeeklyFocusSessions(): Promise<FocusSession[]> {
  const sessions = await getFocusSessions();
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const filteredSessions = sessions.filter(
    (session) =>
      session.startTime > oneWeekAgo &&
      session.type === "focus" &&
      session.completed,
  );

  return filteredSessions;
}

export async function getDailyFocusTime(): Promise<
  { day: string; minutes: number }[]
> {
  const sessions = await getWeeklyFocusSessions();

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dailyTotals: { [key: number]: number } = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };

  sessions.forEach((session) => {
    let dayOfWeek = new Date(session.startTime).getDay();
    dailyTotals[dayOfWeek] += session.duration;
  });

  return dayNames.map((name, index) => ({
    day: name,
    minutes: dailyTotals[index],
  }));
}

export async function getTopBlockedSites(
  limit: number = 5,
): Promise<BlockedSite[]> {
  const sites = await getBlockedSites();

  return sites.sort((a, b) => b.blockCount - a.blockCount).slice(0, limit);
}
export async function getWeeklyTotalFocus(): Promise<number> {
  const sessions = await getWeeklyFocusSessions();
  return sessions.reduce((total, session) => total + session.duration, 0);
}
