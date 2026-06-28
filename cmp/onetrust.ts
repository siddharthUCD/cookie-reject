import {
  clickElement,
  findByTextPatterns,
  findFirstVisible,
  isInConsentUi,
} from '@/utils/dom';
import { ACCEPT_PATTERNS, REJECT_ALL_PATTERNS, REJECT_PARTIAL_PATTERNS } from '@/utils/patterns';
import type { HandlerResult } from '@/cmp/types';

type OneTrustWindow = Window & {
  OneTrust?: {
    RejectAll?: () => void;
    IsAlertBoxClosed?: () => boolean;
  };
  Optanon?: {
    RejectAll?: () => void;
  };
};

const ONETRUST_BANNER_SELECTORS = [
  '#onetrust-banner-sdk',
  '#onetrust-consent-sdk',
  '#onetrust-pc-sdk',
  '.onetrust-pc-dark-filter',
];

const ONETRUST_REJECT_SELECTORS = [
  '#onetrust-reject-all-handler',
  '.ot-pc-refuse-all-handler',
  '#reject-all-handler',
  'button[data-action="reject-all"]',
  'button[data-action="reject_all"]',
];

function isOneTrustBannerOpen(root: Document | Element | ShadowRoot): boolean {
  const banner = findFirstVisible(root, ONETRUST_BANNER_SELECTORS, { lenient: true });
  if (banner) {
    return true;
  }

  const oneTrust = (window as OneTrustWindow).OneTrust;
  if (oneTrust?.IsAlertBoxClosed) {
    return !oneTrust.IsAlertBoxClosed();
  }

  return false;
}

export function tryOneTrustApi(): HandlerResult {
  if (!isOneTrustBannerOpen(document)) {
    return { handled: false };
  }

  const oneTrust = (window as OneTrustWindow).OneTrust;
  const optanon = (window as OneTrustWindow).Optanon;
  const rejectAll = oneTrust?.RejectAll ?? optanon?.RejectAll;

  if (typeof rejectAll !== 'function') {
    return { handled: false };
  }

  try {
    rejectAll();
    return { handled: true, action: 'onetrust-api-reject-all' };
  } catch {
    return { handled: false };
  }
}

export function tryOneTrustBannerReject(
  root: Document | Element | ShadowRoot,
): HandlerResult {
  const banner = findFirstVisible(root, ONETRUST_BANNER_SELECTORS, { lenient: true });
  if (!banner) {
    return { handled: false };
  }

  const rejectBySelector = findFirstVisible(banner, ONETRUST_REJECT_SELECTORS, {
    lenient: true,
  });
  if (rejectBySelector && clickElement(rejectBySelector)) {
    return { handled: true, action: 'onetrust-banner-reject' };
  }

  const rejectByText = findByTextPatterns(
    banner,
    [/^reject all$/i, /^reject all cookies$/i, ...REJECT_ALL_PATTERNS, ...REJECT_PARTIAL_PATTERNS],
    undefined,
    { exclude: ACCEPT_PATTERNS, lenient: true },
  );
  if (rejectByText && clickElement(rejectByText)) {
    return { handled: true, action: 'onetrust-banner-reject-text' };
  }

  // OneTrust sometimes renders the clickable surface on a parent wrapper.
  for (const selector of ONETRUST_REJECT_SELECTORS) {
    for (const element of banner.querySelectorAll(selector)) {
      if (isInConsentUi(element) && clickElement(element)) {
        return { handled: true, action: 'onetrust-banner-reject-direct' };
      }
    }
  }

  return { handled: false };
}
