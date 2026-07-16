import {
  tryOneTrustApi,
  tryOneTrustBannerReject,
} from '@/cmp/onetrust';
import { runOrderedConsentFlow } from '@/cmp/consent-flow';
import { tryGoogleFundingChoices, isGfcFlowActive } from '@/cmp/google-funding-choices';
import {
  clickSaveChoices,
  rejectBanner,
  rejectInScope,
} from '@/cmp/preferences-flow';
import type { CmpHandler, HandlerResult } from '@/cmp/types';
import {
  clickElement,
  elementMatchesPatterns,
  findByTextPatterns,
  findFirstVisible,
  getElementTextVariants,
  isInConsentUi,
  isVisible,
  queryAllIncludingShadow,
  wait,
} from '@/utils/dom';
import {
  ACCEPT_PATTERNS,
  LEGITIMATE_INTEREST_PATTERNS,
  REJECT_ALL_PATTERNS,
  REJECT_PARTIAL_PATTERNS,
} from '@/utils/patterns';

function clickSelector(
  root: Document | Element | ShadowRoot,
  selectors: string[],
  action: string,
): HandlerResult {
  const element = findFirstVisible(root, selectors, { lenient: true });
  if (element && clickElement(element)) {
    return { handled: true, action };
  }

  return { handled: false };
}

const cmpHandlers: CmpHandler[] = [
  // Google Funding Choices only (bosshunting-style). Isolated submodule —
  // when active, blocks the generic ordered consent flow below.
  (root) => tryGoogleFundingChoices(root),

  // Generic reject / preferences flow for all other CMPs
  (root) => {
    if (isGfcFlowActive()) {
      return { handled: true, action: 'gfc-flow-active' };
    }

    return runOrderedConsentFlow(root);
  },

  // OneTrust quick reject (when no preference panel to process)
  () => tryOneTrustApi(),
  (root) => tryOneTrustBannerReject(root),

  // Attribute / class based decline/reject buttons
  (root) =>
    clickSelector(root, [
      '[data-action="reject-all"]',
      '[data-action="reject_all"]',
      '[data-action="decline-all"]',
      '[data-action="decline_all"]',
      '[data-action="decline"]',
      '[data-testid*="decline-all" i]',
      '[data-testid*="decline_all" i]',
      '[data-testid*="deny-all" i]',
      '#declineAll',
      '#decline-all',
      '#onetrust-reject-all-handler',
      '.decline-all',
      '.decline-all-button',
      '.declineAll',
      'button[class*="decline-all" i]',
      'button[class*="decline_all" i]',
      'a[class*="decline-all" i]',
    ], 'decline-attribute'),

  // Visible reject/decline text
  (root) => {
    const button = findByTextPatterns(
      root,
      [
        /^reject all$/i,
        /^reject all cookies$/i,
        /^decline all$/i,
        /^decline all cookies$/i,
        ...REJECT_PARTIAL_PATTERNS,
      ],
      undefined,
      { exclude: ACCEPT_PATTERNS, lenient: true },
    );

    if (button && clickElement(button)) {
      return { handled: true, action: 'reject-all-text' };
    }

    return { handled: false };
  },

  // OneTrust banner reject selectors
  (root) =>
    clickSelector(root, [
      '#onetrust-reject-all-handler',
      '#onetrust-banner-sdk #onetrust-reject-all-handler',
      '.ot-pc-refuse-all-handler',
      '#reject-all-handler',
      'button[data-action="reject-all"]',
    ], 'onetrust-reject-all'),

  // Cookiebot
  (root) =>
    clickSelector(root, [
      '#CybotCookiebotDialogBodyButtonDecline',
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
      '#CybotCookiebotDialogBodyLevelButtonCustomize .CybotCookiebotDialogBodyButtonDecline',
      'button[data-action="decline"]',
    ], 'cookiebot-decline'),

  // Didomi
  (root) =>
    clickSelector(root, [
      '#didomi-notice-disagree-button',
      'button[data-testid="notice-disagree-button"]',
      '.didomi-components-button.didomi-button-deny',
      '#didomi-popup .didomi-dismiss-button',
    ], 'didomi-disagree'),

  // Usercentrics
  (root) =>
    clickSelector(root, [
      'button[data-testid="uc-deny-all-button"]',
      '#uc-btn-deny-banner',
      'button[data-action="deny"]',
    ], 'usercentrics-deny-all'),

  // Quantcast Choice
  (root) =>
    clickSelector(root, [
      '.qc-cmp2-summary-buttons button[mode="secondary"]',
      'button[data-action="reject"]',
      '.qc-cmp-button[data-action="reject"]',
    ], 'quantcast-reject'),

  // Sourcepoint
  (root) =>
    clickSelector(root, [
      'button[title="REJECT ALL"]',
      'button[title="Reject All"]',
      'button[title="DECLINE ALL"]',
      'button[title="Decline All"]',
      '.message-button.no-accept',
      'button.sp_choice_type_REJECT_ALL',
      'button.sp_choice_type_DECLINE_ALL',
    ], 'sourcepoint-reject-all'),

  // iubenda
  (root) =>
    clickSelector(root, [
      '.iubenda-cs-reject-btn',
      'button.iubenda-cs-reject-btn',
    ], 'iubenda-reject'),

  // Osano
  (root) =>
    clickSelector(root, [
      '.osano-cm-button--type_deny',
      '.osano-cm-denyAll',
      'button.osano-cm-deny',
    ], 'osano-deny'),

  // CookieYes
  (root) =>
    clickSelector(root, [
      '.cky-btn-reject',
      'button[data-cky-tag="reject-button"]',
    ], 'cookieyes-reject'),

  // Termly
  (root) =>
    clickSelector(root, [
      'button[data-tid="banner-decline"]',
      'button[data-tid="preferences-decline-all"]',
    ], 'termly-decline'),

  // Axeptio
  (root) =>
    clickSelector(root, [
      '.axeptio_btn_deny',
      'button.axeptio_btn_denyAll',
    ], 'axeptio-deny'),

  // Cookie Consent libraries
  (root) =>
    clickSelector(root, [
      '.cc-deny',
      '.cc-reject-all',
      '#cookiescript_reject',
      '.cmptxt_btn_refuse',
      '.cookie-declaration-dialog .reject-all',
      '.js-cookie-consent-reject',
    ], 'generic-library-reject'),

  // Ketch / Transcend-style
  (root) =>
    clickSelector(root, [
      'button[data-ketch-action="reject"]',
      'button[data-tcmp-action="reject"]',
    ], 'ketch-reject'),

  // TrustArc
  (root) =>
    clickSelector(root, [
      '#truste-consent-required',
      '.truste-button2',
      'a.truste-button2',
      'button#declineAll',
    ], 'trustarc-decline'),

  // Generic legitimate-interest bulk buttons
  async (root) => {
    const rejectLegitimateInterest = findByTextPatterns(
      root,
      LEGITIMATE_INTEREST_PATTERNS,
      undefined,
      { lenient: true },
    );
    if (rejectLegitimateInterest && clickElement(rejectLegitimateInterest)) {
      await wait(300);
      await clickSaveChoices(root);
      return { handled: true, action: 'legitimate-interest-reject' };
    }

    return { handled: false };
  },

  // Generic fallback: reject main banner only (LI/non-essential handled by ordered flow)
  async (root) => {
    if (rejectBanner(root) || rejectInScope(root, 'any')) {
      await wait(350);
      await clickSaveChoices(root);
      return { handled: true, action: 'generic-banner-reject' };
    }

    const rejectButton = findRejectButton(root);
    if (!rejectButton || !clickElement(rejectButton)) {
      return { handled: false };
    }

    await wait(350);
    await clickSaveChoices(root);

    return { handled: true, action: 'generic-reject-all' };
  },
];

function findRejectButton(
  root: Document | Element | ShadowRoot,
): Element | null {
  const selectors = [
    'button',
    'a',
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
    'label',
    'div[tabindex="0"]',
    'span[tabindex="0"]',
    '[class*="decline" i]',
    '[id*="decline" i]',
    '[data-action*="decline" i]',
    '[data-testid*="decline" i]',
    '[aria-label*="decline" i]',
    '[class*="reject" i]',
    '[id*="reject" i]',
    '[data-action*="reject" i]',
    '[data-testid*="reject" i]',
    '[aria-label*="reject" i]',
  ].join(', ');

  let partialMatch: Element | null = null;

  for (const element of queryAllIncludingShadow(root, selectors)) {
    if (!isVisible(element, { lenient: isInConsentUi(element) })) {
      continue;
    }

    if (elementMatchesPatterns(element, ACCEPT_PATTERNS)) {
      continue;
    }

    if (elementMatchesPatterns(element, REJECT_ALL_PATTERNS)) {
      return element;
    }

    if (!partialMatch && elementMatchesPatterns(element, REJECT_PARTIAL_PATTERNS)) {
      const text = getElementTextVariants(element).join(' ');
      if (text.length <= 80) {
        partialMatch = element;
      }
    }
  }

  return partialMatch;
}

async function handleSameOriginIframes(): Promise<HandlerResult> {
  for (const iframe of document.querySelectorAll('iframe')) {
    try {
      const frameDocument = iframe.contentDocument;
      if (!frameDocument) {
        continue;
      }

      const result = await runHandlers(frameDocument);
      if (result.handled) {
        return result;
      }
    } catch {
      // Cross-origin iframe; ignore.
    }
  }

  return { handled: false };
}

export type { HandlerResult } from '@/cmp/types';

export async function runHandlers(
  root: Document | Element | ShadowRoot = document,
): Promise<HandlerResult> {
  for (const handler of cmpHandlers) {
    const result = await handler(root);
    if (result.handled) {
      return result;
    }
  }

  return handleSameOriginIframes();
}
