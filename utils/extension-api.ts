type StorageChangedListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string,
) => void;

type ExtensionApi = {
  storage: {
    local: {
      get: (keys: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
    };
    sync: {
      get: (keys: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
    };
    onChanged: {
      addListener: (callback: StorageChangedListener) => void;
    };
  };
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>;
    onMessage: typeof browser.runtime.onMessage;
    id?: string;
  };
};

function getExtensionApi(): ExtensionApi {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ExtensionApi }).chrome;
  const browserApi = (globalThis as typeof globalThis & { browser?: ExtensionApi }).browser;

  if (import.meta.env.CHROME && chromeApi?.storage) {
    return chromeApi;
  }

  if (browserApi?.storage) {
    return browserApi;
  }

  if (chromeApi?.storage) {
    return chromeApi;
  }

  throw new Error(
    'Extension APIs are unavailable. Open the popup from the Cookie Reject toolbar icon, not localhost:3000.',
  );
}

export function getLocalStorage() {
  return getExtensionApi().storage.local;
}

export function getSyncStorage() {
  return getExtensionApi().storage.sync;
}

export function getRuntime() {
  return getExtensionApi().runtime;
}

export function getStorageApi() {
  return getExtensionApi().storage;
}
