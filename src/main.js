// Entry point. Loads fonts and styles, then the store data (API or bundled JSON), then the interface, and finally
// the 3D scene as a separate chunk so the page is usable while three.js downloads.
import './styles/fonts.css';
import './styles/main.css';

import { BM } from './core/bm.js';
import { loadInitialData } from './services/data-loader.js';

const statusText = document.getElementById('status-text');

async function boot() {
  let result;
  try {
    result = await loadInitialData();
  } catch (err) {
    console.error(err);
    if (statusText) statusText.textContent = 'The showroom could not load. Check your connection and reload the page.';
    const sp = document.querySelector('#status .spinner');
    if (sp) sp.hidden = true;
    return;
  }
  if (statusText) statusText.textContent = 'Building the showroom…';
  await import('./ui/app.js');
  if (result.fallback) BM.toast('Showing the saved catalogue. Prices are confirmed at checkout.', 5000);
  if (statusText) statusText.textContent = 'Downloading the 3D store (about 170 kB)…';
  import('./scene/showroom.js').catch((err) => {
    if (BM.fail3D) BM.fail3D(err);
  });
}

boot();
