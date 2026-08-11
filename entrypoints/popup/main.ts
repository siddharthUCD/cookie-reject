import './style.css';
import { getSettings, setSettings } from '@/utils/storage';
import {
  buildBannerReportUrl,
  getActiveTabInfo,
  submitBannerReport,
} from '@/utils/report';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <main class="popup">
    <header class="popup__header">
      <h1>Cookie Monster</h1>
      <p>Reject optional cookies and legitimate interest on EU consent popups.</p>
    </header>

    <label class="toggle">
      <input id="enabled-toggle" type="checkbox" disabled />
      <span class="toggle__slider"></span>
      <span class="toggle__label">Auto-reject enabled</span>
    </label>

    <p id="status" class="status">Loading settings...</p>

    <section class="report">
      <h2>Banner still showing?</h2>
      <p class="report__hint">
        Send a one-click report with this page’s URL. No GitHub account needed.
      </p>
      <label class="report__notes-label" for="report-notes">What went wrong? (optional)</label>
      <textarea
        id="report-notes"
        class="report__notes"
        rows="3"
        placeholder="e.g. Reject button ignored, preferences opened but Confirm never clicked…"
      ></textarea>
      <button id="report-button" type="button" class="report__button">
        Report this site
      </button>
      <p class="report__secondary">
        <button id="report-github" type="button" class="report__link">
          Prefer GitHub?
        </button>
      </p>
      <p id="report-status" class="report__status" aria-live="polite"></p>
    </section>

    <section class="info">
      <h2>What it does</h2>
      <ul>
        <li>Clicks "Reject all" on common consent platforms</li>
        <li>Turns off legitimate interest toggles when needed</li>
        <li>Works across major EU cookie banner providers</li>
      </ul>
    </section>
  </main>
`;

const toggle = app.querySelector<HTMLInputElement>('#enabled-toggle')!;
const status = app.querySelector<HTMLParagraphElement>('#status')!;
const reportButton = app.querySelector<HTMLButtonElement>('#report-button')!;
const reportGithub = app.querySelector<HTMLButtonElement>('#report-github')!;
const reportNotes = app.querySelector<HTMLTextAreaElement>('#report-notes')!;
const reportStatus = app.querySelector<HTMLParagraphElement>('#report-status')!;

async function loadSettings(): Promise<void> {
  try {
    const settings = await getSettings();
    toggle.checked = settings.enabled;
    toggle.disabled = false;
    status.textContent = '';
  } catch (error) {
    console.error('[Cookie Monster] Failed to load settings:', error);
    toggle.disabled = true;
    status.textContent =
      'Could not load settings. Open the popup from the extension toolbar icon, then reload the extension if needed.';
  }
}

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  status.textContent = 'Saving...';

  void setSettings({ enabled })
    .then(() => {
      status.textContent = '';
    })
    .catch((error) => {
      console.error('[Cookie Monster] Failed to save settings:', error);
      toggle.checked = !enabled;
      status.textContent = 'Failed to save settings. Try again.';
    });
});

reportButton.addEventListener('click', () => {
  reportButton.disabled = true;
  reportGithub.disabled = true;
  reportStatus.classList.remove('report__status--error');
  reportStatus.textContent = 'Sending report…';

  void getActiveTabInfo()
    .then((tab) => submitBannerReport(tab, reportNotes.value))
    .then((result) => {
      if (result.ok) {
        reportStatus.textContent = 'Thanks — report sent.';
        reportNotes.value = '';
        return;
      }

      reportStatus.classList.add('report__status--error');
      reportStatus.textContent = result.error;
    })
    .catch((error) => {
      console.error('[Cookie Monster] Failed to send banner report:', error);
      reportStatus.classList.add('report__status--error');
      reportStatus.textContent = 'Could not send the report. Try Prefer GitHub?.';
    })
    .finally(() => {
      reportButton.disabled = false;
      reportGithub.disabled = false;
    });
});

reportGithub.addEventListener('click', () => {
  reportButton.disabled = true;
  reportGithub.disabled = true;
  reportStatus.classList.remove('report__status--error');
  reportStatus.textContent = 'Opening GitHub…';

  void getActiveTabInfo()
    .then((tab) => {
      const reportUrl = buildBannerReportUrl(tab, reportNotes.value);
      window.open(reportUrl, '_blank', 'noopener,noreferrer');
      reportStatus.textContent = tab
        ? 'Opened a GitHub issue draft. Submit it when ready.'
        : 'Opened a GitHub issue draft. Paste the page URL if it was missing.';
    })
    .catch((error) => {
      console.error('[Cookie Monster] Failed to open GitHub report:', error);
      reportStatus.classList.add('report__status--error');
      reportStatus.textContent = 'Could not open GitHub. Try again from the toolbar icon.';
    })
    .finally(() => {
      reportButton.disabled = false;
      reportGithub.disabled = false;
    });
});

void loadSettings();
