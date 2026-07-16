import {
  DATA_PREFERENCES_PATTERNS,
  LEGITIMATE_INTEREST_LABEL,
  MANAGE_OPTIONS_PATTERNS,
  TEXT_SELECTORS,
  VENDOR_PREFERENCES_PATTERNS,
  WELCOME_PATTERNS,
} from '@/cmp/google-funding-choices/constants';
import { getElementTextVariants, isVisible, queryAllIncludingShadow } from '@/utils/dom';
import { SAVE_CHOICES_PATTERNS } from '@/utils/patterns';

function documentHasText(
  root: Document | Element | ShadowRoot,
  patterns: RegExp[],
): boolean {
  for (const element of queryAllIncludingShadow(root, TEXT_SELECTORS)) {
    if (!isVisible(element, { lenient: true })) {
      continue;
    }

    const texts = getElementTextVariants(element);
    if (texts.some((text) => patterns.some((pattern) => pattern.test(text)))) {
      return true;
    }
  }

  return false;
}

/** True when Google Funding Choices / Privacy & Messaging UI is present. */
export function isGoogleFundingChoicesUi(root: Document | Element | ShadowRoot): boolean {
  if (queryAllIncludingShadow(root, '.fc-dialog, .fc-consent-root, [class*="fc-consent"]').length > 0) {
    return true;
  }

  if (documentHasText(root, MANAGE_OPTIONS_PATTERNS)) {
    return true;
  }

  if (documentHasText(root, DATA_PREFERENCES_PATTERNS)) {
    return true;
  }

  if (documentHasText(root, VENDOR_PREFERENCES_PATTERNS)) {
    return true;
  }

  return documentHasText(root, WELCOME_PATTERNS);
}

export function isDataPreferencesView(root: Document | Element | ShadowRoot): boolean {
  return documentHasText(root, DATA_PREFERENCES_PATTERNS);
}

/**
 * True only on the Vendor preferences panel itself.
 * The Data preferences screen also contains a "Vendor preferences" link —
 * that must not count as being on the vendor panel.
 */
export function isVendorPreferencesView(root: Document | Element | ShadowRoot): boolean {
  if (isDataPreferencesView(root)) {
    return false;
  }

  return documentHasText(root, VENDOR_PREFERENCES_PATTERNS);
}

export function isWelcomeScreen(
  root: Document | Element | ShadowRoot,
  manageOptionsClicked: boolean,
): boolean {
  if (isDataPreferencesView(root) || isVendorPreferencesView(root) || manageOptionsClicked) {
    return false;
  }

  return documentHasText(root, MANAGE_OPTIONS_PATTERNS);
}

export function isPreferencesView(
  root: Document | Element | ShadowRoot,
  manageOptionsClicked: boolean,
): boolean {
  return (
    isDataPreferencesView(root) ||
    isVendorPreferencesView(root) ||
    manageOptionsClicked
  );
}

export function hasConfirmChoices(root: Document | Element | ShadowRoot): boolean {
  return documentHasText(root, SAVE_CHOICES_PATTERNS);
}
