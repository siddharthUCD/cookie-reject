/**
 * Google Funding Choices / Privacy & Messaging submodule.
 *
 * Handles the consent UI used on sites like bosshunting.com.au
 * (Manage options → scroll LI toggles → Vendor preferences → Confirm).
 * Kept separate so scroll/unselect logic does not affect other CMPs.
 */

export { isGfcFlowActive, tryGoogleFundingChoices } from '@/cmp/google-funding-choices/flow';
export { isGoogleFundingChoicesUi } from '@/cmp/google-funding-choices/detect';
