import './style.css';
import { getSettings, setSettings } from '@/utils/storage';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <main class="popup">
    <header class="popup__header">
      <h1>Cookie Reject</h1>
      <p>Reject optional cookies and legitimate interest on EU consent popups.</p>
    </header>

    <label class="toggle">
      <input id="enabled-toggle" type="checkbox" disabled />
      <span class="toggle__slider"></span>
      <span class="toggle__label">Auto-reject enabled</span>
    </label>

    <p id="status" class="status">Loading settings...</p>

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

async function loadSettings(): Promise<void> {
  try {
    const settings = await getSettings();
    toggle.checked = settings.enabled;
    toggle.disabled = false;
    status.textContent = '';
  } catch (error) {
    console.error('[Cookie Reject] Failed to load settings:', error);
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
      console.error('[Cookie Reject] Failed to save settings:', error);
      toggle.checked = !enabled;
      status.textContent = 'Failed to save settings. Try again.';
    });
});

void loadSettings();
