# Poetry Wordle

Six chances to guess **which line of classical Chinese poetry** it is today. Wordle's mechanics, moved onto Chinese characters: one character per tile — green means the right character in the right place, yellow means the character appears in the line but elsewhere, gray means it doesn't appear at all.

Pure static page: no framework, no build step. Just open `index.html` in a browser.

## How to play

- **Six guesses** to find the hidden line
- A guess must be a **real line from the built-in corpus** — gibberish won't submit, so brute-forcing characters is useless
- **Character tray**: the characters below the board are collected from the **first four lines of three poems** (the one containing the answer plus two others), deduplicated and shuffled (~50–75 characters). Tap to type, so **no IME is needed on mobile**. If you can type, tap the empty area of the board to bring up the keyboard — you're then not limited to the tray
- **Daily puzzle** is derived from the date (same puzzle for everyone that day); **Free practice** gives a random line anytime
- Three modes: **7-character / 5-character / lyric (ci) lines**

### Hints (all recorded in your score)

| Hint | What it does |
|---|---|
| Author | Reveals the author and dynasty |
| Title | Reveals which poem it's from |
| Picture | Opens an image generated from the line's imagery |
| Reveal a character | Reveals the character at one position |

### Colors

| Color | Meaning |
|---|---|
| 🟩 Green | Right character, right position |
| 🟨 Yellow | The character is in the line, wrong position |
| ⬜ Gray | The character is not in the line |

After finishing you can copy an emoji result grid to share. Stats (played, win rate, streak, guess distribution) are stored locally.

## Run it

Open `index.html` in any browser — no dependencies.

On GitHub Pages: Settings → Pages → pick the branch and `/` (root). It's a static site, so there is no build step.

## Project layout

```
index.html            markup
css/style.css         rice-paper style sheet, light + dark theme
js/data-poems.js      poem corpus (Tang & Song poetry)
js/data-ci.js         lyric corpus (Five Dynasties & Song ci)
js/hint-images.js     picture-hint index (line -> image)
js/game.js            game logic: puzzles, judging, tray, hints, stats, sharing
assets/hints/         pre-generated hint images
tools/                test and diagnostic scripts
```

The corpus holds **249 works / 1,719 lines**: 673 five-character lines, 679 seven-character lines, and lyric lines bucketed by length (89–176 lines each for 4/5/6/7 characters). To add a poem, append one entry to `js/data-poems.js` or `js/data-ci.js`:

```js
{ t: 'Title', a: 'Author', d: 'Dynasty', c: 0, l: ['line 1', 'line 2', 'line 3', 'line 4'] }   // c: 0 = poem, 1 = lyric
```

## Picture hints and the port for live generation

**Current behaviour:** images are generated offline, stored in `assets/hints/`, and indexed in `js/hint-images.js`. Tapping "Picture" is a table lookup — instant, no network, no cost. Lines without an image show a "no picture yet" message.

> Why not generate on demand: the cloud service's model channel currently exposes text chat only. An image model (`hunyuan-image-alpha`) appears in the model directory, but calling it through `chat.completions` returns `request_invalid_parameter` (a text model works fine over the same path, so it isn't a network or config issue), and the SDK exposes no image endpoint. Switch to live generation once the platform opens it.

**★ The port: `IMAGE_PORT` in `js/game.js` ★**

It defaults to `null`, meaning "pre-generated images only". Assign an async function to switch to live generation — scoring, the modal, caching and sharing need no changes:

```js
// js/game.js
IMAGE_PORT = async function (line) {
  showImageLoading();                       // generation takes ~10–20s, always show a loading state
  const url = await callYourImageApi({      // <- replace with your real image API
    prompt: buildPaintingPrompt(line),      // builds the painting prompt (already provided)
    size: '1536x1024',
  });
  return url;                               // return a reachable image URL
};
```

Two helpers already exist in `js/game.js`:

- `buildPaintingPrompt(line)` — turns the line into a painting prompt and explicitly forbids **any text in the image** (otherwise models tend to write the poem onto the picture)
- `showHintImage(text, url)` — shows the image and **writes the result back into `window.HINT_IMAGES` as a cache**, so the same line opens instantly next time

When wiring it up:

1. Handle failures with a fallback message — never let the button look dead;
2. Write results back to the cache so the same line isn't billed repeatedly;
3. Picture hints count as `hints.image`; scoring and share text need no changes.

## Tests

```bash
npm install jsdom                       # test-only dependency
node tools/smoke.js                     # corpus data + judging algorithm (incl. duplicate-character cases)
node tools/dom-smoke.js                 # loads the real page in jsdom and plays a full round
```

`tools/dom-smoke.js` covers: rejecting non-poetry input, tapping the character tray, tile flip coloring, hint counting, the win modal, persisting stats, and mode switching — plus 10 random rounds per mode asserting that **the answer can always be spelled from the tray**.

Cloud-service diagnostics (`tools/check-models.js`, `tools/test-image-model.js`) need environment variables:

```bash
export WB_PUBLISHABLE_KEY=<publicConfig.publishableKey>
export WB_ENDPOINT=<publicConfig.endpoint>
```

## Note

The poetry text comes from the public-domain classical Chinese canon and is used here for learning and fun. A few lines have variant readings (e.g. "白云生处 / 白云深处"); this project uses the commonly accepted version.
