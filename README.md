# The Virtual Book Fair · Speak Your Book

A walkable 3D book fair floating in space, hosted by **Life Coach Code**, and the home of the
**Speak Your Book** live event (Sunday 1 November, free, live on Zoom).
It runs as a page on lifecoachcode.com through a WordPress plugin, or on its own on GitHub Pages.
Visitors land straight inside the fair. They can walk from booth to booth, open each book in 3D,
meet the authors, and see the other people walking the fair. They can register for the live
event at any time (the form opens right inside the fair), join the talks on Zoom once the event
starts, and, if they want to create a book of their own, book a free discovery call with Life
Coach Code.

## What's inside

- **The entrance**: the Life Coach Code crest crowns the arch, with a gold medallion, laurels, a
  turning ring of text, a sunburst and searchlights. The logo is also inlaid in the plaza floor and
  flies on flags from the lamp posts. Two easels carry the poster for the live event.
- **A candlelit hall of 14 booths and 16 books**. Each book has a poster, a pedestal, and a
  hand-made piece that carries the spirit of the book. An author with several books has one booth
  for all of them (`booth` in `books.js`): Chuck Barnard's three books stand side by side under his
  name, with their three pieces between them. *Food Isn't the Problem* has its 3-Step Path: Name
  it, Claim it, Reframe it.
- **Two paths off the hall**, just past the entrance, each over a bridge to a floating island:
  - **The Garden** (left): a place to hang out between the talks, round a tree in blossom with
    benches to sit on together. Everything happens by walking up to it and pressing `E` (or
    tapping it): a free drink at **the Elixir Bar**, a **fortune cookie** with a message (kept as
    a card if you like), the **lantern pier** to write an intention and let a lantern rise, the
    **meditation circle** for a breathing minute, and a stone that asks seven questions:
    **Should you write a book?** When the signs say yes, it offers a free call with Life Coach Code.
  - **Life Coach Code** (right): all twelve solutions for coaches stand in an arc (press `E` at
    any of them for the problem it solves, what it includes and a free call), with **the Life
    Coach Code guide** at the centre to find where to start, **three ways to join as a coach**
    (get interviewed, publish your articles, a free coach account, with a search through the
    articles coaches have published), words from coaches, a board to **book a free call**, and
    **Life Coach Code's own booth** with Dejan Dachevski's two books.
- **A free call, inside the fair**: every *Create your book with us*, *Book a free call* and
  *Schedule a call* button opens the Calendly booking page in a window (`FAIR_LINKS.discovery`).
- **Meet the authors**: beside every booth the author's portrait rises from a beam of light in
  a gold ring, under their name. Press `E` to meet them: their books, their credentials, and an
  invitation to hear them live on 1 November.
- **Look inside**: open a book and turn its pages in 3D (click the book, or use the arrows in the
  booth panel). The pages show the book's own words: title page, opening line, contents, the
  description and who it is for.
- **The Speak Your Book stage**: a microphone whose letters flow into a floating book. Screens
  beside the stage count down to the event and list every author speaking. Velvet seats face the
  stage: press `E` to take one.
- **Live presence**: everyone in the fair at the same moment sees each other as glowing figures
  with a first name. Visitors can wave (`E` when facing someone) and send reactions (`1` to `5`).
  Authors who open their private link glow gold, and their booth portrait says *Here now*.
- **Your book at the fair**: a gold *Make your book* button is always in reach. Design a cover
  (title, name, style), set it on the last pedestal, then take home a postcard of it.
- **The programme and reminders**: once the talk times are set, the event panel lists every talk
  in each visitor's own time zone. **Remind me** alerts them in the fair 30, 10 and 5 minutes
  before a talk and when it starts (with a sound, and a browser notification if allowed), and
  offers a calendar file with the same three reminders for their phone.
- **Between the talks**: the top bar and the stage screens show who is speaking now, or who is
  next and in how many minutes. When a break starts, a card offers to walk to the Garden's bar,
  fortune cookies, lantern pier or meditation circle. The activities are not in the menu: they
  happen where they stand. In the hall, **the Book Oracle** asks three questions and turns over
  the right book.
- **The book cards**: in a book's panel, the cards slide with small arrows beside the dots (or a
  swipe on phones).
- **Guided tour** with captions and optional spoken narration, **photo mode** with a Life Coach
  Code frame, a **Fair Passport** with a certificate for touring every booth, generative **music**
  with a spatial soundscape per booth, and a **map**.

## Controls

| Desktop | Phone / tablet |
| --- | --- |
| `W` `S` (or ↑ ↓) to walk, `A` `D` (or ← →) to turn, `Shift` to run | Thumb joystick (bottom left) |
| Drag to look around | Drag anywhere to look around |
| `E` to interact with what you're facing (books, authors, seats, people, the Garden, the solutions) | The `E` button (bottom right) |
| Click any book to open it, click an open book to turn its pages | Tap any book to open it |
| `M` map, `P` photo, `T` guided tour, `1` to `5` reactions, `Esc` to leave a booth | The `⋯` menu in the top bar |

On phones the fair opens clean: no cards, logo or buttons over the view, just the 3D hall, the
thumb joystick and the `E` button when something can be opened. Everything else (make your
book, the live event, the guide, the map with the Garden and Life Coach Code, the passport, the
free call) is
in the `⋯` menu, which also shows who is speaking now or next. A card appears only when the
visitor asks for one (`E` at the Oracle, the stage or the temple, or the Oracle from the menu),
with a close button. *Register free* sits at the top of the `⋯` menu.

Browsers without WebGL get a readable, scrolling version of the same content.

## Put the fair on Life Coach Code (WordPress)

The plugin `dist/lcc-virtual-book-fair.zip` puts the whole fair on a page of lifecoachcode.com,
with its AI guide and the messages to authors running on the site's own server.

1. **Plugins → Add New → Upload Plugin**, choose `lcc-virtual-book-fair.zip`, **Install Now**,
   then **Activate**. (The zip is about 7 MB; if the upload is refused, ask the host to raise the
   upload limit or upload the unzipped folder to `wp-content/plugins` by SFTP.)
2. **Settings → Virtual Book Fair → Create the fair's page.** It is created as a draft at
   `/virtual-book-fair/`. Preview it, then publish it. Any other page can show the fair too:
   choose the template **Virtual Book Fair (full screen)** in the page's settings.
3. On the same settings screen, whenever they are confirmed:
   - **The live event:** start date and time, the registration form (its link, or the embed
     code from Google Forms: **Send → <>**), the Zoom link, and the programme, one line per talk
     or break:

     ```
     5:00 pm | Chuck Barnard | Raising resilient teens | 20
     5:20 pm | Break | Lanterns and a breathing minute
     5:30 pm | Tanya Fasnacht Jolliffe | Peace with food
     ```

     (time | author | title | minutes). Times are in the site's time zone unless a line names
     one (`5:00 pm GMT`); minutes is optional, and without it a talk lasts until the next line.
     Visitors see each time in their own time zone and can set reminders.
   - **The AI guide:** the OpenAI API key (it stays on the server), the model and the limits.
   - **Messages to authors:** each author's email address.
   - **Visitors:** live presence on or off, and an optional Google Analytics ID (the fair page
     doesn't use the theme, so the site's usual tracking doesn't run there).
4. Saving clears the fair page from the site's page cache. If visitors still see the old
   version, purge the cache (BigScoots or the cache plugin).

The fair fills the whole page, without the theme's header and footer. Its files are served from
the plugin's folder, and each build gives them a new version so visitors get updates at once.
If a security plugin blocks the WordPress REST API for visitors, allow `/wp-json/lcc-fair/v1/`.

**After changing the fair** (books, copy, images, code): run `node tools/build-wp-plugin.mjs`,
then upload the new `dist/lcc-virtual-book-fair.zip` the same way and choose **Replace current
with uploaded**. The settings are kept. The build takes the authors' email addresses out of the
public `books.js` and keeps them on the server, where visitors can't see them.

The plugin's source is in `wordpress/lcc-virtual-book-fair`.

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

On WordPress, set the start time, the registration form, the Zoom link and the programme in **Settings → Virtual Book Fair**;
they take precedence over `books.js`. On GitHub Pages, the programme goes in `FAIR_EVENT.schedule`
(see the example in `books.js`): each talk with its exact time (`at`, with its UTC offset), the
author's id, a title and optional `minutes`, and breaks as `{ at, break: true, title }`. Everything else about the event lives in `FAIR_EVENT` in
`assets/js/books.js`: the date, the registration form, the Zoom link and the short description. The countdown, the top-bar pill,
the posters, the stage screens, the calendar file and the event panel all read from it.

- **Start time**: when it is confirmed, set `start` with its UTC offset, for example
  `'2026-11-01T17:00:00+00:00'`. The fair then counts down to the minute and shows each visitor
  the time in their own time zone. Until then it counts days.
- **Registering**: every *Register free* button (top bar, `⋯` menu, event panel, posters, guide)
  opens the Google Form in a window inside the fair, at any time, also for people who already
  registered. `register` is the form's link and `registerEmbed` the address from its embed code.
  To let the form tell people they're already registered, turn on **Limit to 1 response** in the
  form's settings (Google then asks them to sign in). A link that isn't a Google Form opens in a
  new tab.
- **Zoom**: there is no video inside the fair. The talks happen on Zoom, always opened in a new
  tab (or the Zoom app). A **Join on Zoom** button appears 15 minutes before `start` (on the day,
  if no start time is set) and stays while the talks are on; each talk in the programme, the
  author's panel, the break card and the reminders gets its own **Watch on Zoom** button from 10
  minutes before it until it ends. All of them lead to the same Zoom link (`FAIR_EVENT.zoom`).
- **Creating a book**: the *Create your book with us* button (top bar, or the `⋯` menu on
  smaller screens) is for visitors who want to write their own book: it books a free discovery
  call.
- **After the event** the posters and screens thank visitors for joining and point them to the
  free discovery call instead of the registration form. Nothing else needs to change.

## Author links

Each author can have a private link. Whoever opens it appears to everyone in the fair as that
author, glowing gold, and the author's booth portrait lights up with *Here now*. Visitors get a
notice that the author has arrived, and can walk over and wave.

When an author opens their link, a welcome card greets them with one clear first step: a big
**Go to my booth** button (and **Join on Zoom**, which comes first on the day of the event). The
gold button in the corner then becomes *Go to my booth* for them.

The links contain a private key. The fair stores only the matching public keys
(`FAIR_LIVE.authorKeys` in `books.js`), so nobody can pretend to be an author.

```sh
BASE=https://www.lifecoachcode.com/virtual-book-fair/ node tools/author-links.mjs   # new links for every author
BASE=https://www.lifecoachcode.com/virtual-book-fair/ node tools/author-links.mjs chuck-barnard   # one author (their old link stops working)
```

Paste the printed `authorKeys` into `books.js`, publish (on WordPress: build and upload the
plugin again), and send each author their own link. Links look like
`…/virtual-book-fair/?fair-author=chuck-barnard#key=…`. Links made earlier for GitHub Pages
keep their key: to use one on lifecoachcode.com, keep everything from `#key=` and put
`https://www.lifecoachcode.com/virtual-book-fair/?fair-author=<author id>` in front of it.
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
conversations through OpenAI (for example gpt-4o-mini), paste the OpenAI API key in
**Settings → Virtual Book Fair** on lifecoachcode.com; the fair page on the site then uses it at
once. In your OpenAI account, set a monthly budget limit for the key's project. (The earlier
*Fair Guide* plugin is no longer needed; its key carries over.)

The GitHub Pages copy can use the same guide: put the address shown in the settings
(`https://www.lifecoachcode.com/wp-json/lcc-fair/v1/guide`) in `FAIR_GUIDE.endpoint` in
`assets/js/books.js`.

**Never put an API key in this repository or in the site's code**: everything here is public.
The plugin only answers requests from the fair's own address (and the other addresses listed in
the settings), limits questions per visitor per hour and per day, and the guide falls back to
its own answers if the plugin is unavailable.

The guide only speaks from the fair's facts. To let it say who speaks when, fill in
`FAIR_EVENT.schedule` in `books.js`. Author bios, websites, LinkedIn and Life Coach Code
profiles live in `FAIR_AUTHOR_EXTRAS`, and the description of each booth's piece in `FAIR_STANDS`.

## Visual quality and long visits

The fair rests when nobody moves (after 20 seconds it draws at 30 frames a second instead of
60) and while a window covers it (15 a second), so long visits stay smooth and phones stay
cool. The `⋯` menu has **Visual quality**:

| Setting | What it shows |
| --- | --- |
| **Auto** (default) | Starts at High on computers, Balanced on phones, and steps down by itself whenever the device can't keep up |
| **High** | Mirror floor, soft shadows, glow, the sharpest picture |
| **Balanced** | Glow and smooth edges, no mirror floor or shadows |
| **Light** | The simplest picture at 30 frames a second, no glow or frosted glass: for older devices and long visits |

The choice is remembered on the device. On phones the glow is softer so book covers stay
readable, and highlights are capped so nothing flares or flickers.

Built to stay light: the small parts of a booth (the book, the plate, the light cone) are only
drawn within about 24 metres, the colonnade is a handful of merged meshes, and the two islands
use unlit, painted materials, merged and instanced meshes and no extra lights; each island is
drawn only when you are within sight of it and animated only when you are close.

To hide the *here now* counter in the top bar, set `FAIR_LIVE.showCount = false` in `books.js`,
or untick it in **Settings → Virtual Book Fair → Visitors** on WordPress. Visitors still see and
greet each other.

## Messages to authors

Each author's panel can show a **Send a message** button. It opens a new email in Gmail (or, on
phones and for anyone not using Gmail, the visitor's own email app), addressed to the author and
already begun: "Hello Chuck, I visited your booth at the Virtual Book Fair…". The visitor adds
their words and sends it from their own email, so the author simply replies. A **Copy the
address** link covers any other webmail.

- On lifecoachcode.com the addresses are set in **Settings → Virtual Book Fair**; on GitHub Pages,
  in each author's `inbox` in `FAIR_AUTHOR_EXTRAS` (`assets/js/books.js`). Authors without an
  address show no button.
- Visitors see the address they write to. On WordPress the addresses are lightly encoded in the
  page so simple address-harvesting bots pass them by.
- To route messages for authors without their own address through Life Coach Code, set
  **For authors without an address** in the settings (or `FAIR_CONTACT.fallbackInbox`). The email
  then asks Life Coach Code to pass it on.

## Live presence and privacy

Visitors see each other through a public MQTT relay over a secure WebSocket (`FAIR_LIVE.brokers`).
Only a first name (optional, letters only, filtered), a colour, the position in the fair and the
moment someone releases a wishing lantern (never what they wrote on it) are shared, and only with
the people there at that moment. There are no messages, no accounts and nothing is stored. Visitors can hide themselves at any time in the *Who's here* panel.

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
  colours, Oracle messages, coming-soon status). The Oracle's three questions, and which books
  each answer points to, are in `FAIR_QUIZ`. A coming-soon book uses
  `status: 'coming-soon'` and `amazon: null`.
- **Adding a book:** run `python3 tools/make_covers.py path/to/cover.jpg my-book-slug` (needs
  Pillow), then add an entry with the same `slug` to `books.js`. New books automatically get a
  booth, a poster, an author portrait, a passport stamp, a map entry and a gentle default piece
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
  appears in the gold ring at their booth (under their name), in their panel and in the event
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
assets/js/world.js       the 3D fair: crest, hall, booths, portraits, stage, seats, people
assets/js/props.js       the themed piece beside each booth
assets/js/sky.js         space: nebula, stars, planet, moon, shooting stars
assets/js/textures.js    posters, signs, crest, pages and name tags drawn on canvas
assets/js/live.js        live presence (a small MQTT client) and author signatures
assets/js/keepsakes.js   your cover, postcards, framed photos, certificates
assets/js/ambience.js    the spatial soundscape of the booths
assets/js/guide.js       the AI guide (built-in answers + OpenAI through the plugin)
assets/js/program.js     the programme: now and next, reminders' calendar files, the Oracle's scoring
assets/img/covers/       optimised covers (480 / 800 / full / glow)
assets/img/originals/    the covers as supplied
tools/make_covers.py     prepares covers for a new book
tools/make_author_photo.py  prepares an author's photo
tools/author-links.mjs   makes private author links
tools/build-wp-plugin.mjs   builds the WordPress plugin zip
wordpress/lcc-virtual-book-fair/   the WordPress plugin: page template, settings, guide, messages
dist/lcc-virtual-book-fair.zip     the built plugin, ready to upload
```
