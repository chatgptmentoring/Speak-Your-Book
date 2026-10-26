# The Virtual Book Fair · Speak Your Book

A walkable 3D book fair floating in space, hosted by **Life Coach Code**, and the home of the
**Speak Your Book** live event (Sunday 1 November, free, live on Zoom).
Visitors land straight inside the fair. They can walk from booth to booth, open each book in 3D,
meet the authors, and see the other people walking the fair. They can register for the live
event and discover how to speak their own book (free discovery call).

## What's inside

- **The entrance**: the Life Coach Code crest crowns the arch, with a gold medallion, laurels, a
  turning ring of text, a sunburst and searchlights. The logo is also inlaid in the plaza floor and
  flies on flags from the lamp posts. Two easels carry the poster for the live event.
- **A candlelit hall of 15 booths** (9 published books and 6 coming soon). Each booth has a poster,
  the book on a pedestal, and a hand-made piece that carries the spirit of the book. *Food Isn't
  the Problem* has its 3-Step Path: Name it, Claim it, Reframe it.
- **Meet the authors**: beside every booth the author waits as a hologram, with their portrait
  in a gold ring above it. Press `E` to meet them: their books, their credentials, and an
  invitation to hear them live on 1 November.
- **Look inside**: open a book and turn its pages in 3D (click the book, or use the arrows in the
  booth panel). The pages show the book's own words: title page, opening line, contents, the
  description and who it is for.
- **The Speak Your Book stage**: a microphone whose letters flow into a floating book. Screens
  beside the stage count down to the event and list every author speaking. Velvet seats face the
  stage: press `E` to take one.
- **Live presence**: everyone in the fair at the same moment sees each other as glowing figures
  with a first name. Visitors can wave (`E` when facing someone) and send reactions (`1` to `5`).
  Authors who open their private link glow gold, and their booth hologram says *Here now*.
- **Your book at the fair**: a gold *Make your book* button is always in reach. Design a cover
  (title, name, style), set it on the last pedestal, then take home a postcard of it.
- **Guided tour** with captions and optional spoken narration, **photo mode** with a Life Coach
  Code frame, a **Fair Passport** with a certificate for touring every booth, generative **music**
  with a spatial soundscape per booth, the **Book Oracle**, and a **map**.

## Controls

| Desktop | Phone / tablet |
| --- | --- |
| `W` `A` `S` `D` or arrow keys to walk, `Shift` to run | Thumb joystick (bottom left) |
| Drag to look around | Drag anywhere to look around |
| `E` to interact with what you're facing (books, authors, seats, people) | The `E` button (bottom right) |
| Click any book to open it, click an open book to turn its pages | Tap any book to open it |
| `M` map, `P` photo, `T` guided tour, `1` to `5` reactions, `Esc` to leave a booth | The `⋯` menu in the top bar |

Browsers without WebGL get a readable, scrolling version of the same content.

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick the branch
   and `/ (root)`, then save.
3. The fair is live at `https://<user>.github.io/<repo>/` a minute later.

To use your own domain, add it under **Settings → Pages → Custom domain** (GitHub writes a
`CNAME` file for you), then update the `canonical`, `og:url` and `og:image` addresses in
`index.html` and the `BASE` used by `tools/author-links.mjs`.

The site is plain HTML/CSS/JS with no build step. Three.js is bundled in `assets/vendor/three`,
so nothing loads from a CDN except Google Fonts.

To preview locally, serve the folder over HTTP (ES modules don't load from `file://`):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## The live event

Everything about the event lives in `FAIR_EVENT` in `assets/js/books.js`: the date, the
registration form, the Zoom wording and the short description. The countdown, the top-bar pill,
the posters, the stage screens, the calendar file and the event panel all read from it.

- **Start time**: when it is confirmed, set `start` with its UTC offset, for example
  `'2026-11-01T17:00:00+00:00'`. The fair then counts down to the minute and shows each visitor
  the time in their own time zone. Until then it counts days.
- **After the event** the posters and screens thank visitors for joining and point them to the
  free discovery call instead of the registration form. Nothing else needs to change.

## Author links

Each author can have a private link. Whoever opens it appears to everyone in the fair as that
author, glowing gold, and the author's booth hologram lights up with *Here now*. Visitors get a
notice that the author has arrived, and can walk over and wave.

When an author opens their link, a welcome card greets them with one clear first step: a big
**Go to my booth** button (and **Join on Zoom**, which comes first on the day of the event). The
gold button in the corner then becomes *Go to my booth* for them.

The links contain a private key. The fair stores only the matching public keys
(`FAIR_LIVE.authorKeys` in `books.js`), so nobody can pretend to be an author.

```sh
node tools/author-links.mjs                 # new links for every author
node tools/author-links.mjs chuck-barnard   # a new link for one author (the old one stops working)
```

Paste the printed `authorKeys` into `books.js`, publish, and send each author their own link.
**Never commit the links.** An author can stop appearing as the author from the *Who's here*
panel.

## The AI guide

A guide lives in the bottom-right corner. Visitors can ask it anything at any time: when the
live event is, who is speaking, what a book is about, who an author is, how to create their own
book. It answers with clear, formatted replies and buttons that walk them to a booth, open a
book or an author, register for the event or open the right link. When a visitor reaches a
booth, it offers a short description of that booth's themed piece. Visitors can
switch tips off (bell), have answers read aloud (speaker), or put the guide away entirely; it
comes back from the `⋯` menu.

The guide works straight away on its own, answering from `books.js`. To let it hold free-form
conversations through OpenAI (for example gpt-4o-mini), connect it through the WordPress plugin
in `tools/lcc-fair-guide`, which keeps the API key private:

1. On lifecoachcode.com: **Plugins → Add New → Upload Plugin**, choose
   `tools/lcc-fair-guide.zip`, then **Activate**.
2. **Settings → Fair Guide**: paste the OpenAI API key and save. The page shows the guide's
   address (`…/wp-json/lcc-fair/v1/guide`).
3. Put that address in `FAIR_GUIDE.endpoint` in `assets/js/books.js` and publish.
4. In your OpenAI account, set a monthly budget limit for the key's project.

**Never put an API key in this repository or in the site's code**: everything here is public.
The plugin only answers requests from the fair's own address, limits questions per visitor per
hour and per day, and the guide falls back to its own answers if the plugin is unavailable.

The guide only speaks from the fair's facts. To let it say who speaks when, fill in
`FAIR_EVENT.schedule` in `books.js`. Author bios, websites, LinkedIn and Life Coach Code
profiles live in `FAIR_AUTHOR_EXTRAS`, and the description of each booth's piece in `FAIR_STANDS`.

## Watching the talks inside the fair

Zoom meetings can't be shown inside another website, so stream the Zoom to YouTube Live
(in Zoom: **Settings → In Meeting (Advanced) → Allow livestreaming of meetings**, then
**More → Live on YouTube** during the meeting). Paste the YouTube link into
`FAIR_EVENT.stream.url` and the Zoom join link into `FAIR_EVENT.stream.zoom`.

Visitors then get a **Watch the live talks** button (event panel, `⋯` menu, the guide). The
stream plays in a window beside them while they keep walking the fair. They can make it
bigger, go full screen, minimise it, or press **Join on Zoom** to take part. Sitting in a seat by the stage opens it large. Once a start
time is set in `FAIR_EVENT.start`, the window opens by itself when the event goes live.
Vimeo links work too.

## Messages to authors

Each author's panel can show a **Send a message** button. Visitors write their name, email and
message, and it arrives in the author's inbox as an email they can simply reply to. The site
has no server, so messages are delivered by FormSubmit (https://formsubmit.co, free).

1. Each author's `inbox` in `FAIR_AUTHOR_EXTRAS` (`assets/js/books.js`) holds their email
   address. Authors with an empty `inbox` show no button.
2. Send one test message to each author. FormSubmit emails that inbox a one-time
   **Activate** link; once it is clicked, every message arrives normally.
3. Optional, for privacy: the activation email also gives a random alias for the address.
   Put the alias in `inbox` instead of the email, so the address is not visible in the site's code.

To route every message through Life Coach Code instead (for example for authors who prefer not
to share an address), set `FAIR_CONTACT.fallbackInbox`; authors without their own inbox then
get the button, and the visitor is told Life Coach Code will pass the message along.

## Live presence and privacy

Visitors see each other through a public MQTT relay over a secure WebSocket (`FAIR_LIVE.brokers`).
Only a first name (optional, letters only, filtered), a colour and the position in the fair are
shared, and only with the people there at that moment. There are no messages, no accounts and
nothing is stored. Visitors can hide themselves at any time in the *Who's here* panel.

- To turn presence off, set `FAIR_LIVE.enabled = false`.
- The public relays are free and have no uptime guarantee. For a large audience you can point
  `brokers` at your own MQTT broker with WebSocket support (for example a small EMQX or
  Mosquitto server, or a hosted plan). Every visitor must use the same first broker to see each
  other.
- If the relay can't be reached, the fair works exactly as before; the *Who's here* button just
  stays hidden.

## Analytics

Off by default. Every meaningful action (booth opened, Amazon click, registration click,
discovery call click, tour, photo, postcard, certificate, reactions) is sent as a `fair:track`
event on `window`. To record them, add Plausible or Google Analytics to `index.html` and set
`window.FAIR_ANALYTICS = { enabled: true }` in `books.js`; the fair calls `plausible()` or
`gtag('event', …)` when either is present.

## Editing content

- **Books, links, copy:** `assets/js/books.js` (titles, hooks, descriptions, Amazon links,
  colours, Oracle messages, coming-soon status). A coming-soon book uses
  `status: 'coming-soon'` and `amazon: null`.
- **Adding a book:** run `python3 tools/make_covers.py path/to/cover.jpg my-book-slug` (needs
  Pillow), then add an entry with the same `slug` to `books.js`. New books automatically get a
  booth, a poster, an author hologram, a passport stamp, a map entry and a gentle default piece
  beside their stand. The hall grows longer to fit them. To give a book its own themed piece,
  add a builder with its slug in `assets/js/props.js`.
- **Optional extras, shown only when you add them:**
  - per book: `samplePages` (real page images to leaf through in 3D) and `testimonials`
    (reader quotes);
  - per author, in `FAIR_AUTHOR_EXTRAS`: `photo`, `welcome` (a short message), `voice` (a recorded
    welcome, mp3) and `website`.
- **Author photos:** run `python3 tools/make_author_photo.py path/to/photo.jpg author-id` (add
  `--cy 0.35 --zoom 1.3` to frame the face), then set
  `photo: 'assets/img/authors/author-id.webp'` for that author in `FAIR_AUTHOR_EXTRAS`. The photo
  appears in the gold ring above their hologram, in their panel, at their booth and in the event
  lineup. Until then, their initials stand in.
- **Discovery call / Speak Your Book / Solutions links:** `FAIR_LINKS` in `books.js` and the
  links in `index.html`.
- **Logo and pillar symbols:** `assets/img/brand/` (SVG, plus PNG copies of the logo for
  keepsakes and the iOS home-screen icon).

## Files

```
index.html               page, cards, booth panel, event, authors, people, passport, map
assets/css/style.css     all styling (desktop, phone, no-WebGL fallback)
assets/js/books.js       the content: books, event, authors, live presence settings
assets/js/app.js         UI: cards, panels, passport, Oracle, tour, photo mode, music
assets/js/world.js       the 3D fair: crest, hall, booths, holograms, stage, seats, people
assets/js/props.js       the themed piece beside each booth
assets/js/sky.js         space: nebula, stars, planet, moon, shooting stars
assets/js/textures.js    posters, signs, crest, pages and name tags drawn on canvas
assets/js/live.js        live presence (a small MQTT client) and author signatures
assets/js/keepsakes.js   your cover, postcards, framed photos, certificates
assets/js/ambience.js    the spatial soundscape of the booths
assets/js/guide.js       the AI guide (built-in answers + OpenAI through the plugin)
assets/img/covers/       optimised covers (480 / 800 / full / glow)
assets/img/originals/    the covers as supplied
tools/make_covers.py     prepares covers for a new book
tools/make_author_photo.py  prepares an author's photo
tools/author-links.mjs   makes private author links
tools/lcc-fair-guide/    the WordPress plugin that connects the guide to OpenAI (+ .zip)
```
