import {
  BANNER_REPORT_ENDPOINT,
  isBannerReportEndpointConfigured,
} from '@/utils/report-config';

const REPORT_REPO = 'https://github.com/siddharthUCD/cookie-reject';

export type ActiveTabInfo = {
  url: string;
  title: string;
};

export type BannerReportResult =
  | { ok: true }
  | { ok: false; error: string };

type TabLike = {
  url?: string;
  title?: string;
};

type TabsApi = {
  query: (queryInfo: { active?: boolean; currentWindow?: boolean }) => Promise<TabLike[]>;
};

type RuntimeApi = {
  getManifest?: () => { version?: string };
};

function getTabsApi(): TabsApi | undefined {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: { tabs?: TabsApi } }).chrome;
  const browserApi = (globalThis as typeof globalThis & { browser?: { tabs?: TabsApi } }).browser;
  return chromeApi?.tabs ?? browserApi?.tabs;
}

export function getExtensionVersion(): string {
  try {
    const chromeApi = (globalThis as typeof globalThis & { chrome?: { runtime?: RuntimeApi } })
      .chrome;
    const browserApi = (globalThis as typeof globalThis & { browser?: { runtime?: RuntimeApi } })
      .browser;
    return (
      chromeApi?.runtime?.getManifest?.().version ??
      browserApi?.runtime?.getManifest?.().version ??
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

/** Read the active tab after the user opens the toolbar popup (needs activeTab). */
export async function getActiveTabInfo(): Promise<ActiveTabInfo | null> {
  const tabsApi = getTabsApi();
  if (!tabsApi?.query) {
    return null;
  }

  const tabs = await tabsApi.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const url = tab?.url?.trim();
  if (!url || url.startsWith('chrome:') || url.startsWith('chrome-extension:')) {
    return null;
  }

  return {
    url,
    title: (tab.title ?? '').trim(),
  };
}

/**
 * Submit a banner report to Formspree (or compatible JSON endpoint).
 * No GitHub account required — one click from the popup.
 */
export async function submitBannerReport(
  tab: ActiveTabInfo | null,
  notes = '',
): Promise<BannerReportResult> {
  if (!isBannerReportEndpointConfigured()) {
    return {
      ok: false,
      error:
        'Reporting is not configured yet. Use “Prefer GitHub?” or ask the developer to set VITE_BANNER_REPORT_ENDPOINT.',
    };
  }

  const pageUrl = tab?.url ?? '';
  if (!pageUrl) {
    return {
      ok: false,
      error: 'Could not read this page URL. Open the popup from the toolbar on the site, then try again.',
    };
  }

  const payload = {
    url: pageUrl,
    title: tab?.title || '(unknown)',
    notes:
      notes.trim() ||
      'The cookie / consent banner was still visible after Cookie Monster ran (or no reject control was clicked).',
    version: getExtensionVersion(),
    userAgent: navigator.userAgent,
    _subject: `Cookie Monster banner report: ${tab?.title || pageUrl}`.slice(0, 120),
  };

  try {
    const response = await fetch(BANNER_REPORT_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Report failed (${response.status}). Try again or use Prefer GitHub?.`,
      };
    }

    return { ok: true };
  } catch (error) {
    console.error('[Cookie Monster] Banner report failed:', error);
    return {
      ok: false,
      error: 'Network error while sending the report. Check your connection or use Prefer GitHub?.',
    };
  }
}

/** Build a GitHub new-issue URL for contributors who prefer issues. */
export function buildBannerReportUrl(tab: ActiveTabInfo | null, notes = ''): string {
  const pageUrl = tab?.url ?? '(could not read page URL — please paste it)';
  const pageTitle = tab?.title || '(unknown)';

  const title = `Banner not rejected: ${pageTitle}`.slice(0, 120);
  const body = [
    '## Site',
    '',
    `- **URL:** ${pageUrl}`,
    `- **Page title:** ${pageTitle}`,
    `- **Extension version:** ${getExtensionVersion()}`,
    '',
    '## What happened',
    '',
    notes.trim() ||
      'The cookie / consent banner was still visible after Cookie Monster ran (or no reject control was clicked).',
    '',
    '## Extra details (optional)',
    '',
    '- Browser:',
    '- Did Manage options / preferences open?',
    '- Screenshot or CMP name (OneTrust, Cookiebot, Google Funding Choices, NHS, etc.):',
    '',
  ].join('\n');

  const params = new URLSearchParams({
    title,
    body,
  });

  return `${REPORT_REPO}/issues/new?${params.toString()}`;
}
