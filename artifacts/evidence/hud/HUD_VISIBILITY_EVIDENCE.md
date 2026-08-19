# HUD Visibility Evidence — Accessible Global Hide/Show Panels

Card `t_1dad6a8d` — Add accessible global panel visibility controls. This
evidence was produced against the implementation state on branch `main` in
The canonical project root only (`solar-system-demo` was not accessed).

## What was implemented

A global, accessible **Hide Panels / Show Panels** control collapses the whole
2D HUD as a group and restores it, driven by one root class.

- New module `src/ui/hudVisibility.ts`:
  - Pure, unit-testable helpers for the state + the two controls' accessible
    labels/`aria-pressed` and the set of hidden targets (`.hud-header`,
    `.info-panel`, `.control-bar`, `.kb-hint`).
  - `HudVisibility` DOM class owning both buttons; toggles root class
    `hud-hidden`, keeps `#ctrl-panels` `aria-pressed` in sync, and manages
    the always-present `#show-panels` affordance (present only while hidden).
  - Focus management: hiding moves focus to the affordance, restoring returns
    focus to the control-bar toggle, so keyboard users are never left on a
    hidden element.
- `index.html`: added the in-control-bar `#ctrl-panels` button and a separate,
  persistent `#show-panels` affordance button placed OUTSIDE the hidden group
  (its own high z-index, not inside any hidden container) so it can never be
  hidden with the rest of the HUD.
- `src/styles.css`: `#app.hud-hidden` collapses header / info panel / control
  bar / keyboard hint together; `.show-panels-btn` styling (top-most z-index
  `20`, tucked in a screen corner so it does not obstruct scene interaction).
- `src/ui/AppController.ts`: instantiates `HudVisibility` and, via the
  `onVisibilityChange` callback, folds in-scene name labels in/out while
  preserving the user's independent label preference (`labelsDesired`).

Nothing about simulation or orbital behavior was changed.

## Interaction details (desktop + mobile verified)

- Initial: header, info panel, control bar all visible; `#ctrl-panels` reads
  "패널 숨기기" with `aria-pressed="true"`; `#show-panels` `hidden`.
- Click `#ctrl-panels` → `#app` gets class `hud-hidden`; header, info panel,
  control bar and keyboard hint all `display:none`; in-scene labels hidden;
  `#ctrl-panels` `aria-pressed="false"`; persistent `#show-panels` appears,
  focused, labelled "패널 표시".
- Keyboard: the affordance is focused and activatable with Enter/Space; the
  in-bar toggle is a native button (Tab-reachable, Enter/Space activates).
- Press Enter on `#show-panels` → HUD fully restored, affordance hidden again,
  `aria-pressed="true"`.

## Commands + results

    npm run test        → PASS — 88/88 Vitest (5 files; +7 new hudVisibility)
    npm run typecheck   → PASS — tsc --noEmit strict
    npm run build       → PASS — vite production build (dist/assets ok)

Browser/WebGL smoke (Playwright Chromium + SwiftShader, served via `vite preview`
at http://localhost:5173/, global `playwright@1.62.1`):

    node artifacts/evidence/hud/verify-hud.mjs → PASS, 18/18 checks, 0 pageerrors

Checks passed on desktop 1280×800 and mobile 390×844: initial label/`aria-pressed`
correct; entire HUD hidden together; persistent affordance present + focused +
keyboard-reachable with accessible name "패널 표시"; label button reports labels
off while hidden; Enter restores the full HUD and `aria-pressed` back to true;
0 pageerrors.

Screenshots: `artifacts/evidence/hud/{desktop,mobile}-{hidden,shown}.png`
(verified by vision: hidden states show ONLY the scene + the small "패널 표시"
button, no header/info/control-bar/hint/labels).

## Changed files

- `src/ui/hudVisibility.ts` (new)
- `src/ui/__tests__/hudVisibility.test.ts` (new)
- `index.html`
- `src/styles.css`
- `src/ui/AppController.ts`
- `artifacts/evidence/hud/verify-hud.mjs` (evidence harness, committed)
- `artifacts/evidence/hud/*.png` (evidence)
- `artifacts/evidence/hud/HUD_VISIBILITY_EVIDENCE.md` (this file)

## Preserved behavior

Selection/focus, camera, labels semantics, and the simulation clock/speed were
not touched. The in-scene label preference is preserved across a hide/show
cycle (labels restore to the user's prior choice on show).
