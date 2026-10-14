// Entry point. Loads fonts and styles, starts the interface, then loads the 3D scene as a separate chunk
// so the page is usable while three.js downloads.
import './styles/fonts.css';
import './styles/main.css';

import { BM } from './core/bm.js';
import './ui/app.js';

import('./scene/showroom.js').catch((err) => {
  if (BM.fail3D) BM.fail3D(err);
});
