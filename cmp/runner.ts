import { runHandlers } from '@/cmp/handlers';
import { isGfcFlowActive } from '@/cmp/google-funding-choices';
import { getSettings, SETTINGS_KEY, type Settings } from '@/utils/storage';
import { getStorageApi } from '@/utils/extension-api';

const SCAN_DEBOUNCE_MS = 250;
const SCAN_DEBOUNCE_GFC_MS = 0;
const MAX_ATTEMPTS = 40;
const MAX_ATTEMPTS_GFC = 200;
const RETRY_INTERVAL_MS = 1000;
const RETRY_INTERVAL_GFC_MS = 16;

let scanTimer: number | undefined;
let attempts = 0;
let observer: MutationObserver | undefined;
let retryTimer: number | undefined;
let running = false;
let active = false;
let settingsEnabled = true;

function currentDebounceMs(): number {
  return isGfcFlowActive() ? SCAN_DEBOUNCE_GFC_MS : SCAN_DEBOUNCE_MS;
}

function currentRetryMs(): number {
  return isGfcFlowActive() ? RETRY_INTERVAL_GFC_MS : RETRY_INTERVAL_MS;
}

function currentMaxAttempts(): number {
  return isGfcFlowActive() ? MAX_ATTEMPTS_GFC : MAX_ATTEMPTS;
}

async function scan(reason: string): Promise<void> {
  if (running) {
    return;
  }

  // Skip storage round-trips while GFC is mid-flow — they added visible lag
  // before Confirm choices.
  if (!isGfcFlowActive()) {
    const settings = await getSettings();
    settingsEnabled = settings.enabled;
    if (!settingsEnabled) {
      return;
    }
  } else if (!settingsEnabled) {
    return;
  }

  if (attempts >= currentMaxAttempts()) {
    stopScanning();
    return;
  }

  running = true;
  attempts += 1;

  try {
    const result = await runHandlers(document);
    if (result.handled) {
      console.info('[Cookie Reject] Dismissed banner:', result.action, reason);
      // Chain the next GFC step immediately so long vendor lists don't wait on the retry timer.
      if (isGfcFlowActive()) {
        scheduleScan('gfc-continue');
      }
    }
  } finally {
    running = false;
  }
}

function scheduleScan(reason: string): void {
  if (!active) {
    return;
  }

  if (scanTimer) {
    window.clearTimeout(scanTimer);
  }

  scanTimer = window.setTimeout(() => {
    void scan(reason);
  }, currentDebounceMs());
}

function startObserver(): void {
  if (observer || !document.body) {
    return;
  }

  observer = new MutationObserver(() => {
    scheduleScan('dom-change');
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
}

function stopScanning(): void {
  active = false;

  if (scanTimer) {
    window.clearTimeout(scanTimer);
    scanTimer = undefined;
  }

  observer?.disconnect();
  observer = undefined;

  if (retryTimer) {
    window.clearTimeout(retryTimer);
    retryTimer = undefined;
  }
}

function scheduleRetryLoop(): void {
  if (!active) {
    return;
  }

  retryTimer = window.setTimeout(() => {
    if (!active) {
      return;
    }

    if (attempts >= currentMaxAttempts()) {
      stopScanning();
      return;
    }

    void scan('retry');
    scheduleRetryLoop();
  }, currentRetryMs());
}

async function startScanning(reason: string): Promise<void> {
  const settings = await getSettings();
  settingsEnabled = settings.enabled;
  if (!settings.enabled) {
    stopScanning();
    return;
  }

  active = true;
  attempts = 0;
  startObserver();

  if (retryTimer) {
    window.clearTimeout(retryTimer);
    retryTimer = undefined;
  }

  scheduleRetryLoop();
  await scan(reason);
}

export async function startCookieRejector(): Promise<void> {
  await startScanning('initial');

  getStorageApi().onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[SETTINGS_KEY]) {
      return;
    }

    const nextSettings = changes[SETTINGS_KEY].newValue as Settings | undefined;

    if (nextSettings?.enabled) {
      settingsEnabled = true;
      void startScanning('enabled');
      return;
    }

    settingsEnabled = false;
    stopScanning();
  });
}
