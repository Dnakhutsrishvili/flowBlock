import { getSettings, updateSettings, getBlockedSites } from "./storage";

export const FREE_LIMITS = {
  maxBlockedSites: 5,
  maxAnalyticsDays: 7,
  pomodoroEnabled: false,
  scheduleEnabled: false,
};

export async function isPremium(): Promise<boolean> {
  const settings = await getSettings();
  return settings.premium?.isPremium || false;
}

export async function canAddMoreSites(): Promise<boolean> {
  const premium = await isPremium();
  if (premium) return true;

  const blockedSites = await getBlockedSites();
  return blockedSites.length < FREE_LIMITS.maxBlockedSites;
}

export interface PremiumStatusInfo {
  isPremium: boolean;
  siteCount: number;
  maxSites: number;
}

export async function getPremiumStatus(): Promise<PremiumStatusInfo> {
  const [settings, blockedSites] = await Promise.all([
    getSettings(),
    getBlockedSites(),
  ]);
  const premium = settings.premium?.isPremium || false;
  return {
    isPremium: premium,
    siteCount: blockedSites.length,
    maxSites: premium ? Infinity : FREE_LIMITS.maxBlockedSites,
  };
}

export async function activatePremium(licenseKey: string): Promise<boolean> {
  if (!licenseKey.startsWith("FLOW-")) {
    return false;
  }

  await updateSettings({
    premium: {
      isPremium: true,
      licenseKey: licenseKey,
      activatedAt: Date.now(),
    },
  });

  return true;
}
