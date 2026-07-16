import { runHandlers } from '@/cmp/handlers';
import { isGfcFlowActive } from '@/cmp/google-funding-choices';
import { getSettings, SETTINGS_KEY, type Settings } from '@/utils/storage';
import { getStorageApi } from '@/utils/extension-api';

const SCAN_DEBOUNCE_MS = 250;
const MAX_ATTEMPTS = 40;
const MAX_ATTEMPTS_GFC = 150;
const RETRY_INTERVAL_MS = 1000;

let scanTimer: number | undefined;
let attempts = 0;
let observer: MutationObserver | undefined;
let retryTimer: number | undefined;
let running = false;
let active = false;

async function scan(reason: string): Promise<void> {
  if (running) {
    return;
  }

  const settings = await getSettings();
  if (!settings.enabled) {
    return;
  }

  if (attempts >= (isGfcFlowActive() ? MAX_ATTEMPTS_GFC : MAX_ATTEMPTS)) {
    stopScanning();
    return;
  }

  running = true;
  attempts += 1;

  try {
    const result = await runHandlers(document);
    if (result.handled) {
      console.info('[Cookie Reject] Dismissed banner:', result.action, reason);
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
  }, SCAN_DEBOUNCE_MS);
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
    window.clearInterval(retryTimer);
    retryTimer = undefined;
  }
}

async function startScanning(reason: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.enabled) {
    stopScanning();
    return;
  }

  active = true;
  attempts = 0;
  startObserver();

  if (!retryTimer) {
    retryTimer = window.setInterval(() => {
      if (attempts >= (isGfcFlowActive() ? MAX_ATTEMPTS_GFC : MAX_ATTEMPTS)) {
        stopScanning();
        return;
      }

      void scan('retry');
    }, RETRY_INTERVAL_MS);
  }

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
      void startScanning('enabled');
      return;
    }

    stopScanning();
  });
}
