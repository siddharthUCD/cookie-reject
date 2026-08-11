# Privacy Policy for Cookie Monster

**Last updated:** 10 August 2026

Cookie Monster (“the Extension”) is a browser extension that helps dismiss optional cookie consent banners and related preference controls on websites you visit.

## Data we collect

The Extension does **not** collect, sell, or transmit your browsing history, personal information, or website content to any external server unless you choose to send an optional banner report.

## Data stored locally

The Extension stores the following only on your device using the browser’s local storage API (`chrome.storage.local`):

- Whether auto-reject is enabled or disabled (your toggle preference)

This setting never leaves your browser unless you back up or sync your browser profile yourself.

## Optional banner reports

If a consent banner is not handled correctly, you can choose **Report this site** in the Extension popup. That sends a user-initiated report containing:

- The current page URL and title
- Optional notes you typed
- Extension version and browser user-agent

Reports are delivered through [Formspree](https://formspree.io) to the Extension developer’s inbox. **Nothing is sent until you click Report this site.**  

Alternatively, **Prefer GitHub?** opens a GitHub issue draft in your browser. That path is only submitted if you are signed into GitHub and choose to create the issue yourself.

## Permissions

- **storage** — Saves your on/off preference locally.
- **activeTab** — Reads the URL of the tab you are viewing when you open the popup to prepare an optional banner report.
- **Host access (`<all_urls>`)** — Lets the Extension run on pages you visit so it can find and interact with cookie consent banners and preference panels. The Extension does not send page content off your device except when you explicitly submit a banner report as described above.
- Access to `https://formspree.io/*` — Used only to deliver optional banner reports you choose to send.

## Contact

For privacy questions about Cookie Monster, open an issue on the project repository:  
https://github.com/siddharthUCD/cookie-reject

## Changes

If this policy changes, the “Last updated” date above will be revised and the updated text will be published at this URL.
