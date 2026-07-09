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
  PREFERENCES_BUTTON_PATTERNS,
  REJECT_ALL_PATTERNS,
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

const PREFERENCES_PANEL_SELECTORS = [
  '#onetrust-pc-sdk',
  '#didomi-popup',
  '.ot-pc-scrollbar',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinCustomize',
  '[class*="preference-center" i]',
  '[class*="preferences-modal" i]',
  '[class*="cookie-preferences" i]',
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

function findConsentRoot(root: Document | Element | ShadowRoot): Element | null {
  return findFirstVisible(root, CONSENT_ROOT_SELECTORS, { lenient: true });
}

function isPreferencesPanelOpen(root: Document | Element | ShadowRoot): boolean {
  return !!findFirstVisible(root, PREFERENCES_PANEL_SELECTORS, { lenient: true });
}

function hasPreferenceEntryPoint(root: Document | Element | ShadowRoot): boolean {
  if (findFirstVisible(root, PREFERENCES_BUTTON_SELECTORS, { lenient: true })) {
    return true;
  }

  return !!findByTextPatterns(root, PREFERENCES_BUTTON_PATTERNS, undefined, {
    lenient: true,
  });
}

function hasAccordionMenus(root: Document | Element | ShadowRoot): boolean {
  const accordionSelectors = [
    '.ot-acc-hdr',
    '.ot-acc-grp-hdr1',
    '[aria-expanded="false"]',
    'details:not([open])',
    '.accordion-button.collapsed',
    '[class*="accordion" i][class*="collapsed" i]',
  ];

  return accordionSelectors.some((selector) =>
    queryAllIncludingShadow(root, selector).some(
      (element) => isInConsentUi(element) && isVisible(element, { lenient: true }),
    ),
  );
}

async function tryOpenOneTrustPreferenceCenter(): Promise<boolean> {
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

function shouldRunPreferencesFlow(root: Document | Element | ShadowRoot): boolean {
  const consentRoot = findConsentRoot(root);
  if (!consentRoot) {
    return false;
  }

  if (
    isPreferencesPanelOpen(root) ||
    hasPreferenceEntryPoint(root) ||
    hasAccordionMenus(root)
  ) {
    return true;
  }

  const oneTrustBanner = findFirstVisible(
    root,
    ['#onetrust-banner-sdk', '#onetrust-consent-sdk'],
    { lenient: true },
  );

  return !!oneTrustBanner && typeof (window as Window & { OneTrust?: unknown }).OneTrust !== 'undefined';
}

async function openPreferencesPanel(
  root: Document | Element | ShadowRoot,
): Promise<boolean> {
  if (isPreferencesPanelOpen(root)) {
    return true;
  }

  const button = findFirstVisible(root, PREFERENCES_BUTTON_SELECTORS, { lenient: true });
  if (button && clickElement(button)) {
    return true;
  }

  const textButton = findByTextPatterns(root, PREFERENCES_BUTTON_PATTERNS, undefined, {
    lenient: true,
  });

  return textButton ? clickElement(textButton) : false;
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
  maxRounds = 10,
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

function clickRejectAll(root: Document | Element | ShadowRoot): boolean {
  const rejectBySelector = findFirstVisible(root, REJECT_IN_PANEL_SELECTORS, {
    lenient: true,
  });
  if (rejectBySelector && clickElement(rejectBySelector)) {
    return true;
  }

  const rejectByText = findByTextPatterns(
    root,
    [
      ...REJECT_ALL_PATTERNS,
      ...REJECT_PARTIAL_PATTERNS,
    ],
    undefined,
    { lenient: true },
  );

  return rejectByText ? clickElement(rejectByText) : false;
}

export async function processPreferencesBeforeReject(
  root: Document | Element | ShadowRoot = document,
): Promise<HandlerResult> {
  if (!shouldRunPreferencesFlow(root)) {
    return { handled: false };
  }

  const consentRoot = findConsentRoot(root) ?? root;

  // Prefer direct decline on the banner before opening "Manage cookies" / settings.
  if (!isPreferencesPanelOpen(root) && !hasAccordionMenus(consentRoot)) {
    if (clickRejectAll(consentRoot)) {
      await wait(300);
      return { handled: true, action: 'banner-direct-reject' };
    }
  }

  if (!isPreferencesPanelOpen(root)) {
    const opened = await openPreferencesPanel(root);
    if (opened) {
      await wait(450);
    } else {
      await tryOpenOneTrustPreferenceCenter();
    }
  }

  if (!isPreferencesPanelOpen(root) && !hasAccordionMenus(consentRoot)) {
    return { handled: false };
  }

  const expanded = await expandAllAccordions(consentRoot);
  if (expanded > 0) {
    await wait(250);
  }

  const liDisabled = await disableLegitimateInterestToggles(consentRoot);

  if (clickRejectAll(consentRoot)) {
    await wait(300);
    await clickSaveChoices(consentRoot);
    return {
      handled: true,
      action: `preferences-reject-all${liDisabled > 0 ? '-li-cleared' : ''}`,
    };
  }

  if (liDisabled > 0 && (await clickSaveChoices(consentRoot))) {
    return { handled: true, action: 'preferences-li-disabled-save' };
  }

  return { handled: false };
}

export async function expandConsentAccordions(
  root: Document | Element | ShadowRoot,
): Promise<number> {
  return expandAllAccordions(root);
}
