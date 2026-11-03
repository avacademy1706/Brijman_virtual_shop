# Responsive design: phones, tablets, laptops and large screens

The showroom is one page that adapts to the screen it is on: a full-screen 3D view with floating controls. This guide explains how each screen size is handled, the rules every change must keep, and how to check them. All styles are in `src/styles/main.css`; the automated checks are in `tests/e2e/layout.spec.js`.

---

## 1. Layouts at a glance

| Screen                             | Width × height (CSS px)        | Layout                                                                                                                                                                             |
| ---------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small phone, portrait              | 320–374 wide                   | Phone layout. Compact welcome card that scrolls inside itself if needed. Top bar with logo, section name and three icon buttons; four-button bar at the bottom.                    |
| Phone, portrait                    | 375–760 wide                   | Phone layout: top bar, small floor plan under it, section card above the bottom bar, product details in a sheet that slides up from the bottom.                                    |
| Phone, landscape                   | up to 760 wide, up to 500 high | Landscape phone layout: no bottom bar (Tour and Directory move into the top bar as icons, Store details is the logo button), no floor-plan card, section card at the bottom right. |
| Short screens of any width         | up to 500 high                 | The floor-plan card is hidden (Directory opens the full plan); cards scroll inside themselves.                                                                                     |
| Tablet, portrait; small laptop     | 761–1080 wide                  | Desktop layout with a narrower dock: floor plan bottom left, section card beside it, product details in a panel on the right.                                                      |
| Tablet, landscape; laptop; desktop | 1081 wide and up               | Full desktop layout. The 3D view fills the screen; panels keep fixed widths (product panel 430 px, welcome card 470 px) so large screens show more of the store.                   |

Breakpoints are in CSS pixels, not device pixels, so a 1170-pixel-wide iPhone screen (390 CSS px at 3×) gets the phone layout.

### Breakpoints in `main.css`

| Media query                                                               | Purpose                                                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `(max-width: 760px)`                                                      | Phone layout: bottom bar, bottom sheet, compact top bar         |
| `(min-width: 761px)`                                                      | Desktop layout: right-hand panel                                |
| `(min-width: 761px) and (max-width: 1080px)`                              | Tablet and small laptop: narrower dock, shorter brand           |
| `(max-height: 700px)`                                                     | Compact welcome card                                            |
| `(max-height: 500px)`                                                     | Short screens: no floor-plan card, scrolling cards              |
| `(max-width: 760px) and (max-height: 500px) and (orientation: landscape)` | Phones held sideways: no bottom bar                             |
| `(pointer: coarse)`                                                       | Touch screens: larger buttons                                   |
| `(hover: hover)`                                                          | Hover pauses the section card's timer only where a mouse exists |
| `(prefers-reduced-motion: reduce)`                                        | No animations; walking becomes a fade ("Jump")                  |
| `(prefers-color-scheme: dark)`                                            | Dark interface colours                                          |

---

## 2. Rules every change must keep

1. **Everything stays inside the safe area.** Notches, the Dynamic Island, rounded corners and the iPhone home bar never cover a control, a card, a sheet or a bottom button. The page uses `viewport-fit=cover` and pads the root element with `env(safe-area-inset-top/right/bottom/left)`, so the whole interface (`.app`) sits inside the safe area automatically. Position new elements inside `.app` with `position: absolute`; do not use `position: fixed` against the window.
2. **No sideways scrolling**, on any screen. Widths use `min(…, calc(100% - 2 * var(--gutter)))`; long names truncate with an ellipsis.
3. **Floating controls never cover each other.** Top bar, floor plan, section card, tour card, corner button and bottom bar each have their own place. When the product panel opens on a tablet, the dock hides rather than squeezes.
4. **Nothing runs off a short screen.** Cards and the welcome card have a `max-height` and scroll inside themselves.
5. **Touch targets are at least 44 px** on touch screens (`pointer: coarse`), never under 40 px. Desktop keeps the compact 40 px controls.
6. **Text fields are 16 px on touch screens**, so iOS does not zoom the page when one gets focus.
7. **Heights follow the visible screen.** `html` uses `100dvh` where supported, so the layout follows the phone's address bar as it slides in and out.
8. **Performance follows the device.** Touch devices (`pointer: coarse`) get lower cloth resolution and 30 Hz cloth; see the performance table in `README.md`. Battery saver in Store details lowers it further.

---

## 3. How each part adapts

| Part                       | Phone (portrait)                                           | Phone (landscape)                        | Tablet and desktop                                                          |
| -------------------------- | ---------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Top bar                    | Logo, section pill, Try on, Search, Bag (icons)            | Adds Tour and Directory (icons)          | Logo with name, section pill, labelled buttons                              |
| Floor plan card            | 118 × 86 px under the top bar                              | Hidden (Directory button opens the plan) | 232 × 169 px, bottom left                                                   |
| Section card / tour card   | Above the bottom bar, full width                           | Bottom right, up to 420 px wide          | Bottom centre, up to 560 px wide, beside the floor plan                     |
| Corner button              | Above the bottom bar, right                                | Bottom right                             | Bottom right                                                                |
| Bottom bar                 | Directory, Tour, Try on, Info                              | Hidden                                   | Hidden                                                                      |
| Product details, bag, info | Bottom sheet, up to 88 % of the height, with a grab handle | Bottom sheet, almost full height         | Right-hand panel, 430 px wide, under the top bar                            |
| Product viewer             | 200 px tall (300 px for the mannequin view)                | 160 px tall                              | 230 px tall (380 px for the mannequin view)                                 |
| Welcome card               | Above the bottom bar, scrolls if needed                    | Above the bottom edge, scrolls if needed | Centred, scrolls if the window is short                                     |
| Camera try-on              | Full screen                                                | Full screen                              | Full screen; a portrait camera on a landscape screen is fitted, not cropped |
| Walking                    | Double-tap the floor; drag to look; pinch to zoom          | Same                                     | Double-click; drag; scroll wheel to zoom; W A S D and arrows                |

---

## 4. Checking a change

### Automatically

```bash
npm run test:devices      # layout test on all 12 screens (see TESTING.md for the list)
npm run test:report       # screenshots of each screen and step
```

On every screen the test checks that the welcome card, top bar, floor plan, section and tour cards, corner button, bottom bar, product sheet, Add to bag button, bag and Store details lie inside the safe area, that no two floating controls overlap, that the page never scrolls sideways, that touch targets are at least 40 px, and that the console shows no errors. On the iPhone projects it emulates the notch and home bar, so anything drawn under them fails the test.

Add every new floating control or panel to the selector lists in `tests/e2e/layout.spec.js`.

### By hand in Chrome

1. Open the site, press <kbd>F12</kbd>, then the device toolbar (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>).
2. Try **iPhone SE**, **iPhone 14 Pro Max**, **Pixel 7**, **iPad Mini** and **iPad Pro**, in both orientations (rotate button), plus **Responsive** at 1366 × 768 and 1920 × 1080.
3. In the device toolbar's menu (⋮) choose **Show device frame** to see where the notch falls.
4. Walk a little, open a product, the bag and Store details on each.

### On real devices

Use a Vercel preview URL (HTTPS, so the camera works). Check at least one iPhone with a notch, one Android phone, one tablet, in both orientations. iOS Safari and Chrome for Android differ from desktop emulation in the address bar and the safe areas; the emulation is close but not exact.

---

## 5. Adding something new to the interface

- **A floating button or card:** place it inside `.app` with `position: absolute`, using `var(--gutter)`, `var(--top-h)` and `var(--bb-h)` for offsets, so it follows the phone, landscape and desktop layouts. Give it a `z-index` between 15 (floor plan) and 25 (welcome); sheets are 30, toasts 40.
- **A panel:** open it in the existing sheet (`openSheet` in `app.js`); it already becomes a bottom sheet on phones and a side panel elsewhere.
- **A button:** use `.btn`, `.icon-btn` or `.chip`; they grow to touch size on touch screens. Icon-only buttons need an `aria-label`.
- **Text:** keep 13 px or more for body text on phones; long names need `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` or wrapping.
- Then run `npm run test:devices`.
