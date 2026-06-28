# Cookie Reject

Browser extension that automatically rejects optional cookies and legitimate interest options on European consent popups.

Built with [WXT](https://wxt.dev) and TypeScript. Targets Chrome, Edge, Firefox, Brave, and Opera.

## What it does

When you visit a site with a GDPR cookie banner, the extension tries to:

1. Click **Reject all** / **Decline all** (and equivalent text in major EU languages)
2. Handle common consent platforms (OneTrust, Cookiebot, Didomi, Usercentrics, Quantcast, Sourcepoint, and others)
3. Disable **legitimate interest** toggles when a site opens a preferences panel
4. Save your choices when a banner requires confirmation

Use the toolbar popup to turn auto-reject on or off.

## Development

```bash
npm install
npm run dev          # Chrome with hot reload
npm run dev:firefox  # Firefox with hot reload
npm run build:all    # Production builds for both targets
```

### Load locally

**Chrome / Edge / Brave / Opera**

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable Developer mode
4. Load unpacked → `.output/chrome-mv3/`

**Firefox**

1. Run `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Load Temporary Add-on → any file in `.output/firefox-mv2/`

## Project structure

```
entrypoints/
  background.ts   # Default settings
  content.ts      # Runs on all pages/frames
  popup/          # Enable/disable toggle
cmp/
  handlers.ts     # CMP-specific and generic reject logic
  runner.ts       # MutationObserver + retry loop
utils/
  dom.ts          # Shadow DOM traversal and click helpers
  patterns.ts     # Multilingual button text patterns
  storage.ts      # Extension settings
```

## Limitations

- Some banners use custom UI or anti-bot click handling and may not be dismissed automatically
- Cross-origin consent iframes are handled when the browser injects into those frames; deeply nested or delayed banners may need a page refresh
- This rejects optional tracking cookies; it does not block trackers at the network level

## Privacy

Settings are stored locally with `browser.storage.local`. The extension does not collect or send browsing data.

## Preferences flow

Before rejecting all cookies, the extension opens preference panels when available, expands accordion sections, and disables legitimate interest toggles.


## Troubleshooting

Reload the extension in your browser after code changes. In dev mode, reload from chrome://extensions if settings or background scripts stop responding.

