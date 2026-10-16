# Horse Perfection (repo: craft-horse)

A Minecraft horse and donkey calculator for Tim (and anyone with the link). You enter a horse's
speed, jump and health; it shows a 0-100 perfection score, keeps a saved stable, and recommends
which two horses to breed. Used on iPhone and laptop.

- **Live:** https://timothyhadfield.github.io/craft-horse/
- **Repo:** https://github.com/TimothyHadfield/craft-horse (public)
- **Main checkout:** `OneDrive\Desktop\my-website\Code Projects\Games\Craft_Horse`

## File map
- `index.html`: the whole app. React 18 + in-browser Babel from unpkg, JSX in one
  `<script type="text/babel">`. Components: `HorseCalc` (main), `StatRow`, `ParentCard`,
  `BreedingTab`, `ProbRow`. Pure helpers at the top (`normalize`, `computeTotal`,
  `simulateFoal`, `analyzePair`, `findDominated`, `findStatLeaders`).
- `horse_calculator.jsx`: older stand-alone version (an `export default` React component).
  Not loaded by the site. Kept as history; don't edit it expecting the site to change.
- `docs/screenshots/`: images used by `README.md`.
- Git-ignored: `stable*.json` (Tim's exported stables, personal data), `minecraft_horse.jsx`
  (duplicate of horse_calculator.jsx), `.claude/`.

## Data
- No backend, no accounts. Everything is in the browser's `localStorage`, four keys:
  `horse_perfect`, `horse_trash`, `donkey_perfect`, `donkey_trash` (arrays of
  `{id, name, speed, jump, hearts, total}`). Legacy keys `horses` / `trash_horses` are
  migrated once on load.
- Export writes `stable.json` (version 2, all four stables). Import accepts v1 and v2 and
  rejects a file whose entries lack numeric speed/jump/hearts (a bad entry used to blank
  the page on every load).
- Scores are always recomputed from raw stats with the current MIN/MAX constants; the stored
  `total` is not used for display.

## Run locally
`python -m http.server 8102` in the repo folder (background), then open http://localhost:8102/.
Needs internet (React, Babel and Google Fonts come from CDNs).

## Test
No test suite. Verify with `node ~/.claude/tools/phone-view.mjs <url>` (phone and `--desktop`).
Seed a stable with `--local 'horse_perfect=[{"id":1,"name":"A","speed":12,"jump":4,"hearts":14},...]'`.
phone-view `--do fill:`/`click:` selectors cannot contain `=`; drive inputs through `--eval`
(native value setter + `input` event) instead.

## Deploy
GitHub Pages from `main`, root folder. Push to `main` and it is live in about a minute.

## Traps
- **CDN versions must stay pinned.** Unpinned `@babel/standalone` became Babel 8, which emits
  ES `import`s for JSX and blanked the live page (found 2026-10-16). Keep Babel on 7.x.
- The CSS classes `.title-font`, `.pixel-btn`, `.pixel-input` etc. set
  `font-family: '"Press Start 2P", monospace'` (quoted twice), so they render in the browser's
  default serif, not the pixel font. That is how the published screenshots look; don't "fix"
  it without Tim's OK (it changes the look).
- Speed/jump/health text boxes, the items box and blocks/layers boxes sync through "skip next
  sync" refs. Only set a ref when the value really changes, or the flag sticks and the next
  slider move is ignored (fixed 2026-10-16).
- Breeding numbers are Monte Carlo (800 foals per pair), so they change on every render;
  screenshots of the BREED tab never match pixel for pixel.
