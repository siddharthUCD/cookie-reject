/** Google Funding Choices / Privacy & Messaging (e.g. bosshunting.com.au) */

export const GFC_BUTTON_SELECTORS =
  'button, [role="button"], .fc-button, .fc-cta-manage-options, .fc-cta-consent';

/**
 * Vendor preferences is usually a bottom-of-list text link (often a plain
 * span/div), not a primary CTA button — include broad text containers.
 */
export const GFC_VENDOR_LINK_SELECTORS = [
  'button',
  '[role="button"]',
  '[role="link"]',
  'a',
  '.fc-button',
  '[class*="vendor" i]',
  '[class*="fc-navigation" i]',
  '[class*="fc-secondary" i]',
  'span[tabindex]',
  'div[tabindex]',
  'span',
  'div',
  'p',
  'li',
].join(', ');

export const TEXT_SELECTORS = 'h1,h2,h3,h4,span,div,p,label,button,a,li';

export const GFC_LI_TOGGLE_SELECTORS = [
  'input[type="checkbox"].fc-preference-legitimate-interest',
  '.fc-legitimate-interest-preference-container input[type="checkbox"]',
  'label.fc-legitimate-interest-preference-container input[type="checkbox"]',
  'input[type="checkbox"][class*="fc-preference-legitimate-interest"]',
];

export const GFC_LI_LABEL_SELECTORS =
  '.fc-preference-slider-label, .fc-legitimate-interest-preference-container, label.fc-legitimate-interest-preference-container';

export const FALLBACK_TOGGLE_SELECTOR =
  '[role="checkbox"], [role="switch"], input[type="checkbox"], button[aria-checked], button[aria-pressed]';

export const MANAGE_OPTIONS_PATTERNS = [/^manage options$/i, /^manage preferences$/i];
export const VENDOR_PREFERENCES_PATTERNS = [
  /^vendor preferences$/i,
  /^vendors preferences$/i,
  /^vendor preference$/i,
];
export const DATA_PREFERENCES_PATTERNS = [/^data preferences$/i];
export const LEGITIMATE_INTEREST_LABEL = /\blegitimate interest\b/i;
export const LI_ROW_PATTERN = /legitimate interest\s*\(\s*\d+\s*vendors?\s*\)/i;
export const CONSENT_ROW_PATTERN = /consent\s*\(\s*\d+\s*vendors?\s*\)/i;
export const WELCOME_PATTERNS = [
  /this site asks for consent to use your data/i,
  /asks for consent to use your data/i,
];
