import type { HandlerResult } from '@/cmp/types';
import {
  clickElement,
  findByTextPatterns,
  findFirstVisible,
  getElementTextVariants,
  isInConsentUi,
  isVisible,
  queryAllIncludingShadow,
  wait,
} from '@/utils/dom';
import {
  LEGITIMATE_INTEREST_CONTEXT_PATTERN,
  LEGITIMATE_INTEREST_PATTERNS,
  NESTED_PREFERENCE_PATTERNS,
  PREFERENCES_BUTTON_PATTERNS,
  REJECT_BANNER_PATTERNS,
  REJECT_NON_ESSENTIAL_PATTERNS,
  REJECT_PARTIAL_PATTERNS,
  SAVE_CHOICES_PATTERNS,
} from '@/utils/patterns';

const CONSENT_ROOT_SELECTORS = [
  '#onetrust-banner-sdk',
  '#onetrust-consent-sdk',
  '#onetrust-pc-sdk',
  '#didomi-popup',
  '#CybotCookiebotDialog',
  '#usercentrics-root',
  '.qc-cmp2-container',
  '.osano-cm-window',
  '[class*="cookie-banner" i]',
  '[class*="consent-banner" i]',
  '[class*="cookie-notice" i]',
  '[aria-modal="true"]',
];

const BANNER_SELECTORS = [
  '#onetrust-banner-sdk',
  '#didomi-notice',
  '.qc-cmp2-summary',
  '.osano-cm-dialog',
  '[class*="cookie-banner" i]',
  '[class*="consent-banner" i]',
  '[class*="cookie-notice" i]',
];

const PREFERENCES_PANEL_SELECTORS = [
  '#onetrust-pc-sdk',
  '#didomi-popup',
  '.ot-pc-scrollbar',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinCustomize',
  '[class*="preference-center" i]',
  '[class*="preferences-modal" i]',
  '[class*="cookie-preferences" i]',
  '[class*="data-preferences" i]',
];

const PREFERENCES_BUTTON_SELECTORS = [
  '#onetrust-pc-btn-handler',
  '.ot-sdk-show-settings',
  'button[data-action="preferences"]',
  '#didomi-notice-learn-more-button',
  'button[data-testid="notice-learn-more-button"]',
  '.didomi-components-button--configuration',
  '#CybotCookiebotDialogBodyLevelButtonCustomize',
  'button[data-testid="uc-customize-button"]',
  '.qc-cmp2-summary-buttons button[mode="primary"]:not([mode="secondary"])',
  '.osano-cm-link',
  '.cc-customize',
];

const REJECT_IN_PANEL_SELECTORS = [
  '#onetrust-reject-all-handler',
  '.ot-pc-refuse-all-handler',
  '#reject-all-handler',
  'button[data-action="reject-all"]',
  'button[data-action="reject_all"]',
  '#CybotCookiebotDialogBodyButtonDecline',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
  '.iubenda-cs-reject-btn',
  '.cky-btn-reject',
  'button[data-testid="uc-deny-all-button"]',
];

const REJECT_ON_BANNER_SELECTORS = [
  '#onetrust-reject-all-handler',
  '#onetrust-banner-sdk #onetrust-reject-all-handler',
  '#didomi-notice-disagree-button',
  'button[data-testid="notice-disagree-button"]',
  '#CybotCookiebotDialogBodyButtonDecline',
  '#uc-btn-deny-banner',
  '.cky-btn-reject',
  '.cc-deny',
  '.osano-cm-button--type_deny',
  '[data-action="decline"]',
  '[data-action="reject-all"]',
  '[data-action="reject_all"]',
  '[data-action="decline-all"]',
  '[data-action="decline_all"]',
];

export function findConsentRoot(root: Document | Element | ShadowRoot): Element | null {
  return findFirstVisible(root, CONSENT_ROOT_SELECTORS, { lenient: true });
}

export function isPreferencesPanelOpen(root: Document | Element | ShadowRoot): boolean {
  return !!findFirstVisible(root, PREFERENCES_PANEL_SELECTORS, { lenient: true });
}

function isInBannerScope(element: Element): boolean {
  if (element.closest(BANNER_SELECTORS.join(', '))) {
    return true;
  }

  const consentRoot = findConsentRoot(document);
  if (!consentRoot) {
    return isInConsentUi(element);
  }

  return consentRoot.contains(element) && !isInPanelScope(element);
}

function isInPanelScope(element: Element): boolean {
  return !!element.closest(PREFERENCES_PANEL_SELECTORS.join(', '));
}

function matchesScope(
  element: Element,
  scope: 'panel' | 'banner' | 'any',
): boolean {
  if (scope === 'any') {
    return isInConsentUi(element) || !!findConsentRoot(document)?.contains(element);
  }

  if (scope === 'panel') {
    return isInPanelScope(element);
  }

  return isInBannerScope(element);
}

export function hasConsentUi(root: Document | Element | ShadowRoot): boolean {
  if (findConsentRoot(root)) {
    return true;
  }

  return !!findByTextPatterns(
    root,
    [...REJECT_BANNER_PATTERNS, ...REJECT_NON_ESSENTIAL_PATTERNS],
    undefined,
    { lenient: true },
  );
}

export async function openPreferencesPanel(
  root: Document | Element | ShadowRoot,
): Promise<boolean> {
  if (isPreferencesPanelOpen(root)) {
    return true;
  }

  for (const selector of PREFERENCES_BUTTON_SELECTORS) {
    for (const element of queryAllIncludingShadow(root, selector)) {
      if (!isVisible(element, { lenient: true }) || !isSafePreferenceTrigger(element)) {
        continue;
      }

      if (clickElement(element)) {
        return true;
      }
    }
  }

  const textButton = findByTextPatterns(root, PREFERENCES_BUTTON_PATTERNS, undefined, {
    lenient: true,
  });

  if (textButton && isSafePreferenceTrigger(textButton) && clickElement(textButton)) {
    return true;
  }

  return false;
}

function isSafePreferenceTrigger(element: Element): boolean {
  if (element instanceof HTMLAnchorElement) {
    const href = element.getAttribute('href')?.trim();
    if (!href || href === '#') {
      return true;
    }

    if (href.startsWith('javascript:')) {
      return true;
    }

    return false;
  }

  return true;
}

export async function tryOpenOneTrustPreferenceCenter(): Promise<boolean> {
  const oneTrust = (window as Window & {
    OneTrust?: { ToggleInfoDisplay?: () => void };
  }).OneTrust;

  if (typeof oneTrust?.ToggleInfoDisplay !== 'function') {
    return false;
  }

  if (isPreferencesPanelOpen(document)) {
    return true;
  }

  try {
    oneTrust.ToggleInfoDisplay();
    await wait(450);
    return isPreferencesPanelOpen(document);
  } catch {
    return false;
  }
}

export async function openNestedPreferenceSections(
  root: Document | Element | ShadowRoot,
): Promise<number> {
  let opened = 0;

  for (const element of queryAllIncludingShadow(
    root,
    ['button', '[role="button"]', 'summary', '[aria-expanded="false"]'].join(', '),
  )) {
    if (!isInConsentUi(element) || !isVisible(element, { lenient: true })) {
      continue;
    }

    if (!elementMatchesNestedPreference(element)) {
      continue;
    }

    if (clickElement(element)) {
      opened += 1;
      await wait(250);
    }
  }

  return opened;
}

function elementMatchesNestedPreference(element: Element): boolean {
  const texts = getElementTextVariants(element);
  return texts.some((text) =>
    NESTED_PREFERENCE_PATTERNS.some((pattern) => pattern.test(text)),
  );
}

function isAccordionContentHidden(header: Element): boolean {
  const group = header.closest('.ot-acc-group, .ot-accordion-layout, [class*="accordion" i]');
  if (!group) {
    return header.getAttribute('aria-expanded') === 'false';
  }

  const content = group.querySelector(
    '.ot-acc-grpcntr, .ot-acc-txt, .accordion-collapse, .panel-collapse, [class*="accordion-content" i], [class*="accordion-body" i]',
  );

  if (!content) {
    return header.getAttribute('aria-expanded') === 'false';
  }

  const style = window.getComputedStyle(content);
  return style.display === 'none' || style.visibility === 'hidden' || style.height === '0px';
}

async function expandAllAccordions(
  root: Document | Element | ShadowRoot,
  maxRounds = 2,
): Promise<number> {
  let totalExpanded = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    let roundExpanded = 0;

    for (const details of queryAllIncludingShadow(root, 'details:not([open])')) {
      if (!isInConsentUi(details) || !isVisible(details, { lenient: true })) {
        continue;
      }

      (details as HTMLDetailsElement).open = true;
      roundExpanded += 1;
    }

    for (const trigger of queryAllIncludingShadow(
      root,
      '[aria-expanded="false"], .accordion-button.collapsed, .collapsed[data-bs-toggle], .ot-acc-hdr, .ot-acc-grp-hdr1',
    )) {
      if (!isInConsentUi(trigger) || !isVisible(trigger, { lenient: true })) {
        continue;
      }

      if (!isAccordionContentHidden(trigger)) {
        continue;
      }

      if (clickElement(trigger)) {
        roundExpanded += 1;
      }
    }

    totalExpanded += roundExpanded;
    if (roundExpanded === 0) {
      break;
    }

    await wait(200);
  }

  return totalExpanded;
}

function isLegitimateInterestContext(element: Element): boolean {
  const candidates = [
    element,
    element.closest(
      'section, li, tr, td, fieldset, label, div, .ot-acc-grpdesc, .purpose-item, .vendor-item, .ot-leg-btn-container, .ot-host-item, .ot-accordion-layout, .ot-tgl-cntr',
    ),
    element.parentElement,
  ].filter(Boolean) as Element[];

  return candidates.some((candidate) =>
    LEGITIMATE_INTEREST_CONTEXT_PATTERN.test(getElementTextVariants(candidate).join(' ')),
  );
}

export async function disableLegitimateInterestToggles(
  root: Document | Element | ShadowRoot,
): Promise<number> {
  let disabled = 0;

  const bulkOff = findByTextPatterns(root, LEGITIMATE_INTEREST_PATTERNS, undefined, {
    lenient: true,
  });
  if (bulkOff && clickElement(bulkOff)) {
    disabled += 1;
  }

  const toggleSelectors = [
    'input[type="checkbox"]:checked',
    'button[aria-checked="true"]',
    '[role="switch"][aria-checked="true"]',
    '.ot-tgl input:checked',
    '.ot-leg-tgl input:checked',
    '.ot-leg-btn-container input:checked',
    '.purpose-item input:checked',
    '.vendor-item input:checked',
    'input[type="radio"]:checked',
  ];

  for (const selector of toggleSelectors) {
    for (const element of queryAllIncludingShadow(root, selector)) {
      if (!isVisible(element, { lenient: isInConsentUi(element) })) {
        continue;
      }

      if (!isLegitimateInterestContext(element)) {
        continue;
      }

      if (clickElement(element)) {
        disabled += 1;
      }
    }
  }

  return disabled;
}

export async function clickSaveChoices(root: Document | Element | ShadowRoot): Promise<boolean> {
  const saveButton = findByTextPatterns(root, SAVE_CHOICES_PATTERNS, undefined, {
    lenient: true,
  });
  if (saveButton && clickElement(saveButton)) {
    return true;
  }

  const saveSelectors = [
    '.save-preference-btn-handler',
    '#save-preference-btn-handler',
    '.didomi-components-button--color',
    'button[data-testid="uc-save-button"]',
    '.osano-cm-save',
    '#onetrust-pc-btn-handler + button',
    '.ot-pc-refuse-all-handler',
  ];

  const saveElement = findFirstVisible(root, saveSelectors, { lenient: true });
  return saveElement ? clickElement(saveElement) : false;
}

function clickRejectBySelector(
  root: Document | Element | ShadowRoot,
  selectors: string[],
  scope: 'panel' | 'banner' | 'any',
): boolean {
  for (const selector of selectors) {
    for (const element of queryAllIncludingShadow(root, selector)) {
      if (!isVisible(element, { lenient: true }) || !matchesScope(element, scope)) {
        continue;
      }

      if (clickElement(element)) {
        return true;
      }
    }
  }

  return false;
}

function clickRejectByText(
  root: Document | Element | ShadowRoot,
  patterns: RegExp[],
  scope: 'panel' | 'banner' | 'any',
): boolean {
  const button = findByTextPatterns(root, patterns, undefined, { lenient: true });
  if (!button || !matchesScope(button, scope)) {
    return false;
  }

  return clickElement(button);
}

export function rejectAllIfVisible(root: Document | Element | ShadowRoot): boolean {
  return (
    rejectNonEssential(root, 'any') ||
    rejectNonEssential(root, 'panel') ||
    rejectBanner(root) ||
    rejectInScope(root, 'any')
  );
}

export function rejectNonEssential(
  root: Document | Element | ShadowRoot,
  scope: 'panel' | 'banner' | 'any' = 'any',
): boolean {
  if (clickRejectBySelector(root, REJECT_IN_PANEL_SELECTORS, scope)) {
    return true;
  }

  return clickRejectByText(root, REJECT_NON_ESSENTIAL_PATTERNS, scope);
}

export function rejectBanner(
  root: Document | Element | ShadowRoot,
): boolean {
  if (clickRejectBySelector(root, REJECT_ON_BANNER_SELECTORS, 'banner')) {
    return true;
  }

  if (clickRejectByText(root, [...REJECT_BANNER_PATTERNS, ...REJECT_PARTIAL_PATTERNS], 'banner')) {
    return true;
  }

  return clickRejectByText(root, [...REJECT_BANNER_PATTERNS, ...REJECT_PARTIAL_PATTERNS], 'any');
}

export function rejectInScope(
  root: Document | Element | ShadowRoot,
  scope: 'panel' | 'banner' | 'any',
): boolean {
  if (scope === 'panel' || scope === 'any') {
    if (clickRejectBySelector(root, REJECT_IN_PANEL_SELECTORS, scope)) {
      return true;
    }

    if (clickRejectByText(root, REJECT_NON_ESSENTIAL_PATTERNS, scope)) {
      return true;
    }
  }

  if (scope === 'banner' || scope === 'any') {
    if (clickRejectBySelector(root, REJECT_ON_BANNER_SELECTORS, scope)) {
      return true;
    }

    if (clickRejectByText(root, [...REJECT_BANNER_PATTERNS, ...REJECT_PARTIAL_PATTERNS], scope)) {
      return true;
    }
  }

  return false;
}

export async function expandConsentAccordions(
  root: Document | Element | ShadowRoot,
): Promise<number> {
  return expandAllAccordions(root);
}

/** @deprecated Use runOrderedConsentFlow from consent-flow.ts */
export async function processPreferencesBeforeReject(
  root: Document | Element | ShadowRoot = document,
): Promise<HandlerResult> {
  const { runOrderedConsentFlow } = await import('@/cmp/consent-flow');
  return runOrderedConsentFlow(root);
}
