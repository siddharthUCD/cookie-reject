import { getLocalStorage, getSyncStorage } from '@/utils/extension-api';

export interface Settings {
  enabled: boolean;
}

export const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
};

export async function getSettings(): Promise<Settings> {
  const result = await getLocalStorage().get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Settings | undefined;

  if (stored && typeof stored.enabled === 'boolean') {
    return stored;
  }

  const legacy = await getSyncStorage().get(['enabled']);
  if (typeof legacy.enabled === 'boolean') {
    const settings = { enabled: legacy.enabled };
    await getLocalStorage().set({ [SETTINGS_KEY]: settings });
    return settings;
  }

  return DEFAULT_SETTINGS;
}

export async function setSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...settings };
  await getLocalStorage().set({ [SETTINGS_KEY]: next });
  return next;
}

export async function ensureDefaultSettings(): Promise<void> {
  const result = await getLocalStorage().get(SETTINGS_KEY);
  if (result[SETTINGS_KEY] === undefined) {
    await getLocalStorage().set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
}
