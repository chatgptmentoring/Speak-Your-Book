# The Virtual Book Fair · Speak Your Book

A walkable 3D book fair floating in space, sponsored and created by **Life Coach Code**.
Visitors land straight inside the fair, walk from booth to booth, open each book in 3D, take it
home on Amazon, and discover how to speak their own book (free discovery call).

## What's inside

- **The entrance arch** with the Life Coach Code medallion, then a candlelit hall of 12 booths
  (9 published books + 3 coming soon). Each booth has a poster, a pedestal with the book in 3D
  and a hand-made piece that carries the spirit of that book. For example, *Finding Love in the
  Mirror* has a mirror with wings of fire, and *Food Isn't the Problem* has the 3-Step Path:
  Name it, Claim it, Reframe it.
- **The Book Oracle**: pick an intention and the Oracle turns over a book, then walks you to its booth.
- **The Speak Your Book stage**: a microphone whose letters flow into a floating book.
- **The temple of Life Coach Code**: the four pillars (Spirit, Mind, Body, Heart) and an empty
  pedestal: *Your book here* (links to the discovery call).
- A **Fair Passport** (a stamp for every booth you open), a **map** to jump anywhere,
  generative **music** (off until the visitor turns it on), and share links per booth
  (`#booth/<slug>`).

## Controls

| Desktop | Phone / tablet |
| --- | --- |
| `W` `A` `S` `D` or arrow keys to walk, `Shift` to run | Thumb joystick (bottom left) |
| Drag to look around | Drag anywhere to look around |
| `E` to interact with what you're facing | The `E` button (bottom right) |
| Click any book to open it | Tap any book to open it |
| `M` for the map, `Esc` to leave a booth | Map button in the top bar |

Browsers without WebGL get a readable, scrolling version of the same content.

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick the branch
   and `/ (root)`, then save.
3. The fair is live at `https://<user>.github.io/<repo>/` a minute later.

The site is plain HTML/CSS/JS with no build step. Three.js is bundled in `assets/vendor/three`,
so nothing loads from a CDN except Google Fonts.

To preview locally, serve the folder over HTTP (ES modules don't load from `file://`):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Editing content

- **Books, links, copy:** `assets/js/books.js` (titles, hooks, descriptions, Amazon links,
  colors, Oracle messages, coming-soon status). A coming-soon book uses
  `status: 'coming-soon'` and `amazon: null`.
- **Adding a book:** run `python3 tools/make_covers.py path/to/cover.jpg my-book-slug` (needs
  Pillow), then add an entry with the same `slug` to `books.js`. New books automatically get a
  booth, a poster, a passport stamp, a map entry and a gentle default piece beside their stand.
  To give a book its own themed piece, add a builder with its slug in `assets/js/props.js`.
- **Discovery call / Speak Your Book / Solutions links:** `FAIR_LINKS` in `books.js` and the
  links in `index.html`.
- **Logo and pillar symbols:** `assets/img/brand/` (SVG).

## Files

```
index.html               page, cards, booth panel, passport, map
assets/css/style.css     all styling (desktop, phone, no-WebGL fallback)
assets/js/books.js       the content
assets/js/app.js         UI: cards, booth panel, passport, Oracle, map, joystick, music
assets/js/world.js       the 3D fair: hall, booths, stage, temple, walking, camera
assets/js/props.js       the themed piece beside each booth
assets/js/sky.js         space: nebula, stars, planet, moon, shooting stars
assets/js/textures.js    posters, signs, marble and pages drawn on canvas
assets/img/covers/       optimised covers (480 / 800 / full / glow)
assets/img/originals/    the covers as supplied
tools/make_covers.py     prepares covers for a new book
```
