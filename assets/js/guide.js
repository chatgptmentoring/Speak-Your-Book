/*
 * The fair guide: a companion visitors can ask anything at any time. It answers on its own
 * from the fair's content, and once FAIR_GUIDE.endpoint is set it talks through OpenAI via the
 * Life Coach Code WordPress plugin (wordpress/lcc-virtual-book-fair), which keeps the API key private.
 * It can walk visitors to booths, open books and author panels, and point to the right links.
 */
const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'for', 'and', 'through', 'than', 'with', 'your', 'you', 'is', 'it', 'on', 'at', 'me', 'my', 'about', 'what', 'who', 'how', 'can', 'i', 'book', 'books', 'tell', 'more', 'this', 'that', 'be', 'are', 'do', 'does', 'please', 'show', 'take', 'go', 'there']);
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => fold(s).split(' ').filter((w) => w && !STOP.has(w));
const has = (q, re) => re.test(q);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Light markdown: **bold**, *italic*, [links](https://…), "- " lists, paragraphs */
export function renderMarkdown(md) {
  const inline = (t) => esc(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => `<a href="${url.replace(/"/g, '%22')}" target="_blank" rel="noopener">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  const out = [];
  let list = null;
  String(md).split('\n').forEach((line) => {
    const li = line.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)$/);
    if (li) { if (!list) { list = []; out.push(list); } list.push(inline(li[1])); return; }
    list = null;
    if (line.trim()) out.push(`<p>${inline(line.trim())}</p>`);
  });
  return out.map((b) => (Array.isArray(b) ? `<ul>${b.map((x) => `<li>${x}</li>`).join('')}</ul>` : b)).join('');
}

export function createGuide({ data, act, zone, eventInfo, track = () => {}, store }) {
  const { BOOKS, AUTHORS, EVENT, LINKS, STANDS = {}, CFG = {} } = data;
  const bySlug = Object.fromEntries(BOOKS.map((b) => [b.slug, b]));
  const authorById = Object.fromEntries(AUTHORS.map((a) => [a.id, a]));
  const authorOf = {};
  AUTHORS.forEach((a) => a.books.forEach((s) => { authorOf[s] = a; }));
  const $ = (s) => document.querySelector(s);
  const root = $('#guide'), orb = $('#guide-orb'), panel = $('#guide-panel'), log = $('#guide-log');
  const chipsEl = $('#guide-chips'), form = $('#guide-form'), input = $('#guide-input');
  const tip = $('#guide-tip'), tipText = $('#guide-tip-text');
  const KEY = 'lcc-fair-guide';
  const state = { open: false, away: false, quiet: false, voice: false, ...(store.get(KEY, null) || {}) };
  const history = [];
  const seenStands = new Set();
  let busy = false, tipTimer = 0, zoneTimer = 0, greeted = false;
  const save = () => store.set(KEY, { away: state.away, quiet: state.quiet, voice: state.voice });

  /* ---------- what the guide knows ---------- */
  const titleKeys = BOOKS.map((b) => ({ b, keys: words(b.title).filter((w) => w.length > 2) }));
  const nameKeys = AUTHORS.map((a) => {
    const parts = fold(a.name).split(' ').filter((w) => w.length > 2 && !['dr'].includes(w));
    return { a, parts };
  });
  const place = (slug) => 'book-' + slug;
  const evStatus = () => (eventInfo ? eventInfo.status() : null);
  const upcoming = () => !!(eventInfo && eventInfo.upcoming());
  const scheduleFor = (id) => ((EVENT && EVENT.schedule) || []).filter((s) => s.author === id);
  const remindable = (a) => !!a && upcoming() && act.canRemind(a.id);

  function findAuthor(q) {
    let best = null, score = 0;
    nameKeys.forEach(({ a, parts }) => {
      const s = parts.reduce((n, p) => n + (new RegExp(`\\b${p}\\b`).test(q) ? (p.length > 3 ? 2 : 1) : 0), 0);
      if (s > score) { score = s; best = a; }
    });
    return score >= 2 ? best : null;
  }
  function findBook(q) {
    let best = null, score = 0;
    titleKeys.forEach(({ b, keys }) => {
      const hit = keys.filter((k) => new RegExp(`\\b${k}`).test(q)).length;
      const s = keys.length ? hit / keys.length + (hit >= 2 ? 0.3 : 0) : 0;
      if (s > score) { score = s; best = b; }
    });
    return score >= 0.5 ? best : null;
  }
  function topicBooks(q) {
    const qw = new Set(words(q).filter((w) => w.length > 3));
    if (!qw.size) return [];
    return BOOKS.map((b) => {
      const hay = new Set(words([b.tags.join(' '), b.subtitle, b.hook, b.forWho, b.title].join(' ')));
      let s = 0;
      qw.forEach((w) => { hay.forEach((h) => { if (h === w) s += 2; else if (h.length > 4 && (h.startsWith(w) || w.startsWith(h))) s += 1; }); });
      return { b, s };
    }).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 3).map((x) => x.b);
  }
  const PLACES = [
    { re: /\b(stage|microphone|mic|seats?|chairs?|talks?)\b/, id: 'speak', label: 'the Speak Your Book stage' },
    { re: /\b(oracle|crystal ball)\b/, id: 'oracle', label: 'the Book Oracle' },
    { re: /\b(entrance|arch|start|beginning|crest|logo)\b/, id: 'welcome', label: 'the entrance' },
    { re: /\b(temple|pillars?|spirit|mind|body|heart)\b/, id: 'about', label: 'the temple of Life Coach Code' },
    { re: /\b(pedestal|your book here|my book)\b/, id: 'finale', label: 'the pedestal waiting for your book' },
    { re: /\b(hall|aisle|booths)\b/, id: 'hall', label: 'the Grand Hall' }
  ];

  /* ---------- answers written from the fair's own content ---------- */
  const authorLinks = (a) => [
    a.website && `[Website](${a.website})`,
    a.linkedin && `[LinkedIn](${a.linkedin})`,
    a.profile && `[Life Coach Code profile](${a.profile})`,
    a.interview && `[Interview on Life Coach Code](${a.interview})`
  ].filter(Boolean).join(' · ');
  const bookLine = (b) => `***${b.title}*** by ${b.displayAuthor || b.author}${b.status === 'coming-soon' ? ' (coming soon)' : ''}`;

  function eventAnswer(q) {
    if (!EVENT) return null;
    const st = evStatus();
    if (st.phase === 'after') return { reply: `**${EVENT.name}** took place on ${eventInfo.dateLong()}. Thank you to everyone who joined! If you have a book inside you, a free discovery call is the next step.`, actions: [{ type: 'link', label: 'Free discovery call', url: LINKS.discovery }] };
    const a = findAuthor(q);
    const sched = (EVENT.schedule || []);
    let reply = `**${EVENT.name}** is live on Zoom on **${eventInfo.dateLong()}**, and it's ${EVENT.price.toLowerCase()}.`;
    reply += eventInfo.time() ? ` It starts at **${eventInfo.time()}** (shown in your time zone).` : ' The exact start time isn’t listed in the fair yet: registering is the best way to receive it.';
    if (st.count) reply += ` *${st.count}.*`;
    if (a) {
      const slots = scheduleFor(a.id);
      reply += slots.length ? `\n\n**${a.displayName}** speaks at ${slots.map((s) => `**${s.time}**${s.title ? ` (*${s.title}*)` : ''}`).join(', ')}.` : `\n\n**${a.displayName}** is one of the speakers; the order of the talks hasn’t been published here yet.`;
    } else if (sched.length) {
      reply += '\n\n**The programme** (in your time zone):\n' + sched.map((s) => `- **${s.time}** · ${s.break ? `*${s.title || 'Break'}*` : `${authorById[s.author] ? authorById[s.author].displayName : s.author}${s.title ? `: *${s.title}*` : ''}`}`).join('\n');
    }
    const zoom = EVENT.stream && EVENT.stream.zoom;
    const actions = [{ type: 'link', label: 'Register free', url: EVENT.register }, ...(zoom ? [{ type: 'link', label: 'Join on Zoom', url: zoom }] : []), { type: 'event' }];
    if (remindable(a)) actions.unshift({ type: 'remind', id: a.id });
    if (act.canWatch()) actions.unshift({ type: 'watch' });
    return { reply, actions };
  }
  function speakersAnswer() {
    const lines = AUTHORS.map((a) => `- **${a.displayName}** · ${a.books.map((s) => `*${bySlug[s].title}*`).join(', ')}`);
    return { reply: `Every author in the fair speaks live at **${EVENT ? EVENT.name : 'the event'}**${upcoming() ? ` on ${eventInfo.dateLong()}` : ''}:\n${lines.join('\n')}`, actions: [{ type: 'event' }, ...(upcoming() ? [{ type: 'link', label: 'Register free', url: EVENT.register }] : [])] };
  }
  function watchAnswer() {
    const S = (EVENT && EVENT.stream) || {};
    if (act.canWatch()) return { reply: `You can watch the talks right here: the live window stays beside you while you walk the fair, or goes full screen.${S.zoom ? ' To take part and ask questions, join on Zoom.' : ''}`, actions: [{ type: 'watch' }, ...(S.zoom ? [{ type: 'link', label: 'Join on Zoom', url: S.zoom }] : [])] };
    return { reply: `The talks happen live on Zoom${upcoming() ? ` on **${eventInfo.dateLong()}**` : ''}. ${S.zoom ? 'The **Join on Zoom** button opens the call in a new window, or in the Zoom app on your phone.' : 'Register free to get the link.'}`, actions: [...(S.zoom ? [{ type: 'link', label: 'Join on Zoom', url: S.zoom }] : []), { type: 'link', label: 'Register free', url: EVENT ? EVENT.register : LINKS.discovery }] };
  }
  function sybAnswer() {
    return {
      reply: '**Speak Your Book** is Life Coach Code’s path for coaches who want to become published authors without wrestling a blank page:\n- **Book a free discovery call** and tell us about your story\n- **Speak your story** out loud, in your own voice\n- **Watch it become a book**, shaped into chapters\n- **Take your place at the fair**, like the authors here\n\nYou can also design a cover and see it on the last pedestal right now.',
      actions: [{ type: 'link', label: 'Free discovery call', url: LINKS.discovery }, { type: 'link', label: 'About Speak Your Book', url: LINKS.speakYourBook }, { type: 'creator' }]
    };
  }
  function authorAnswer(a) {
    const books = a.books.map((s) => bySlug[s]);
    let reply = `**${a.displayName}**${a.credentials ? `, ${a.credentials}` : ''}`;
    if (a.bio) reply += `\n\n${(a.bio.match(/^.*?[.!?](\s|$)/) || [a.bio])[0].trim()}`;
    reply += `\n\n**At the fair:** ${books.map((b) => `*${b.title}*`).join(', ')}.`;
    if (a.websiteByLCC) reply += ' ✦ Website made with Life Coach Code.';
    if (upcoming()) reply += ` Speaking live at ${EVENT.name} on ${eventInfo.dateLong()}.`;
    const l = authorLinks(a);
    if (l) reply += `\n\n${l}`;
    const actions = [{ type: 'goto', place: place(books[0].slug) }, { type: 'author', id: a.id }];
    if (a.inbox) actions.push({ type: 'message', id: a.id });
    return { reply, actions };
  }
  function bookAnswer(b, standFirst = false) {
    const a = authorOf[b.slug];
    const stand = STANDS[b.slug];
    let reply = standFirst && stand ? `**At this booth:** ${stand}\n\n${bookLine(b)}. *${b.hook}*` : `${bookLine(b)}\n\n*${b.hook}*`;
    if (!standFirst && stand) reply += `\n\n**At the booth:** ${stand}`;
    const actions = [{ type: 'goto', place: place(b.slug) }, { type: 'book', slug: b.slug }];
    if (b.amazon) actions.push({ type: 'link', label: `Buy on ${b.amazon.store}`, url: b.amazon.url });
    else if (a) actions.push({ type: 'author', id: a.id });
    return { reply, actions };
  }
  function lccAnswer() {
    return {
      reply: '**Life Coach Code** hosts this fair. It is a home for coaches and seekers, built on four pillars: **Spirit, Mind, Body and Heart**. We help coaches get seen, get heard and get published:\n- **Publishing**: Speak Your Book\n- **Visibility**: features and media\n- **Recognition**: awards and honours\n- **Stages**: summits and events',
      actions: [{ type: 'link', label: 'Solutions for coaches', url: LINKS.solutions }, { type: 'goto', place: 'about' }]
    };
  }
  function remindAnswer(q) {
    const a = findAuthor(q);
    if (remindable(a)) {
      const s = scheduleFor(a.id).find((x) => x.start > new Date());
      return { reply: `I can remind you about **${a.displayName}** at **${s.time}**: 30, 10 and 5 minutes before, while the fair is open. For your phone, add it to your calendar too.`, actions: [{ type: 'remind', id: a.id }] };
    }
    const any = AUTHORS.filter(remindable);
    if (any.length) return { reply: 'Whose talk would you like a reminder for? Each talk in the programme has a **Remind me** button: you get a reminder 30, 10 and 5 minutes before.', actions: [{ type: 'event' }, ...any.slice(0, 2).map((x) => ({ type: 'remind', id: x.id }))] };
    return { reply: 'The times of the talks aren’t in the fair yet. Once they are, every talk gets a **Remind me** button. Registering is the best way to receive them.', actions: [{ type: 'event' }] };
  }
  const ACTIVITIES = {
    reply: 'Between the talks you can:\n- **Breathe** for a guided minute with the four pillars\n- Release a **wishing lantern** with an intention, and watch it rise\n- Ask **the Oracle**: three questions, and the book you need right now',
    actions: [{ type: 'breathe' }, { type: 'lantern' }, { type: 'quiz' }]
  };
  const HELP = {
    passport: 'Every booth you open stamps your **Fair Passport** (top bar). Collect all of them for a certificate with your name.',
    map: 'The **map** (press **M**) jumps anywhere: every booth, the stage, the Oracle and the temple.',
    tour: 'The **guided tour** (press **T**) walks you through the whole fair with captions, and can read them aloud.',
    photo: '**Photo mode** (press **P**) takes a framed picture of exactly where you stand, ready to share.',
    walk: 'Walk with **W A S D** (or the joystick on a phone), drag to look around, and press **E** when something glows.'
  };

  function localAnswer(raw) {
    const q = fold(raw);
    const here = zone();
    const hereBook = here && here.startsWith('book-') ? bySlug[here.slice(5)] : null;
    if (!q || has(q, /^(hi|hello|hey|help|hola|good (morning|afternoon|evening))\b|what can you do/)) return welcome();
    if (has(q, /\b(create|write|publish|make|start|speak)\b.*\b(my|own|a)\b.*\bbook\b|\bspeak your book\b|\bbecome an? (author|writer)\b|\bpublish(ing|ed)?\b|\bdiscovery call\b/)) return sybAnswer();
    if (has(q, /\b(watch|stream|livestream|zoom|join (the )?(talk|event|call))\b/)) return watchAnswer();
    if (has(q, /\b(remind|reminders?|alarm|alert|notify|notification)\b/)) return remindAnswer(q);
    if (has(q, /\b(breathe|breathing|breath|meditat\w*|relax|calm|stress\w*|anxious|mindful\w*)\b/)) return { reply: 'Take a **breathing minute** with the four pillars: Spirit, Mind, Body and Heart. One or three minutes, with a voice to guide you if you like.', actions: [{ type: 'breathe' }] };
    if (has(q, /\b(lanterns?|intentions?|wish|wishes|wishing|gratitude)\b/)) return { reply: 'Write an intention, a wish or a word of gratitude on a **wishing lantern** and let it rise over the fair. Everyone here sees it float up; your words stay yours, and you can keep them as a card.', actions: [{ type: 'lantern' }] };
    if (has(q, /\b(quiz|which book|what book|recommend\w*|suggest\w*|right book|book for me|what should i read)\b/)) return { reply: 'Ask **the Oracle**: answer three questions and it turns over the book you need right now, with two more for you.', actions: [{ type: 'quiz' }] };
    if (has(q, /\b(things to do|activities|intermission|between (the )?(talks|sessions)|while (i )?wait\w*|bored)\b/) || (has(q, /\bbreak\b/) && !has(q, /\b(when|time)\b/))) return ACTIVITIES;
    if (has(q, /\b(when|what time|time|schedule|programme|program|agenda|date|starts?|today|tonight|register|registration|event)\b/) && !has(q, /\b(take me|go to|walk me)\b/)) return eventAnswer(q);
    if (has(q, /\b(who|which authors?)\b.*\b(speak|speaking|talk|talking|on stage|present)|\bspeakers?\b|\bline ?up\b/)) return speakersAnswer();
    const goto = has(q, /\b(take me|go to|walk me|lead me|guide me|bring me|where is|where s|how do i get|show me (the way|where))\b/);
    const a = findAuthor(q);
    const b = findBook(q);
    if (goto) {
      const target = b ? { id: place(b.slug), label: `the booth of *${b.title}*` } : a ? { id: place(a.books[0]), label: `${a.displayName}’s booth` } : PLACES.find((p) => p.re.test(q));
      if (target) { act.goto(target.id); return { reply: `On our way to ${target.label}. ✨`, actions: [{ type: 'goto', place: target.id }] }; }
      if (has(q, /\bnext\b/) && hereBook) {
        const nb = BOOKS[(BOOKS.indexOf(hereBook) + 1) % BOOKS.length];
        act.goto(place(nb.slug));
        return { reply: `On to the next booth: *${nb.title}*.`, actions: [{ type: 'goto', place: place(nb.slug) }] };
      }
    }
    if (hereBook && has(q, /\b(this|here)\b|\b(stand|booth|visual|statue|piece|sculpture)\b/) && !b && !a) return bookAnswer(hereBook, true);
    if (has(q, /\b(stand|booth|visual|piece)\b/) && b) return bookAnswer(b, true);
    if (a && (!b || has(q, /\b(who|author|bio|about (him|her|them)|contact|email|message|website|linkedin)\b/))) return authorAnswer(a);
    if (b) return bookAnswer(b);
    if (hereBook && has(q, /\b(author|who wrote|writer)\b/)) return authorAnswer(authorOf[hereBook.slug]);
    if (has(q, /\b(life coach code|lcc|host|organi[sz]er|who (made|runs|organi[sz]ed)|solutions|pillars?)\b/)) return lccAnswer();
    if (has(q, /\bpassport|stamps?|certificate\b/)) return { reply: HELP.passport, actions: [] };
    if (has(q, /\bmap\b/)) return { reply: HELP.map, actions: [] };
    if (has(q, /\btour\b/)) return { reply: HELP.tour, actions: [{ type: 'tour' }] };
    if (has(q, /\b(photo|picture|selfie)\b/)) return { reply: HELP.photo, actions: [] };
    if (has(q, /\b(walk|move|controls?|keys?|joystick)\b/)) return { reply: HELP.walk, actions: [] };
    const picks = topicBooks(raw);
    if (picks.length) return { reply: `These books speak to that:\n${picks.map((x) => `- ${bookLine(x)}: *${x.hook}*`).join('\n')}`, actions: picks.slice(0, 2).map((x) => ({ type: 'goto', place: place(x.slug) })) };
    return { reply: 'I may not know that one yet. I can tell you about the live event, the authors and their books, take you to any booth, or explain how to create your own book.', actions: [] };
  }

  function welcome() {
    const up = upcoming();
    return {
      reply: `Welcome to **The Virtual Book Fair**, hosted by Life Coach Code. ✨ I can tell you about every book and author, take you to any booth${up ? `, and help you join **${EVENT.name}**, live on ${eventInfo.dateLong()}` : ''}. What would you like to explore?`,
      actions: []
    };
  }

  /* ---------- the AI, through the Life Coach Code plugin ---------- */
  function knowledge() {
    const st = evStatus();
    return JSON.stringify({
      fair: `The Virtual Book Fair: a walkable 3D book fair floating in space, hosted by Life Coach Code. ${BOOKS.length} booths, each with a book, a hologram of its author and a themed piece. Visitors walk with W A S D or a joystick, press E to interact, M for the map, T for a guided tour, P for a photo. Every booth opened stamps the Fair Passport.`,
      host: { name: 'Life Coach Code', about: 'A home for coaches and seekers, built on four pillars: Spirit, Mind, Body and Heart. Helps coaches get seen, get heard and get published.', solutions: ['Publishing: Speak Your Book', 'Visibility: features and media', 'Recognition: awards and honours', 'Stages: summits and events'], links: LINKS },
      speakYourBook: ['Book a free discovery call', 'Speak your story in your own voice', 'Watch it become a book', 'Take your place at the fair'],
      event: EVENT && { name: EVENT.name, date: eventInfo.dateLong(), startTime: eventInfo.time() || 'not announced yet', where: EVENT.where, price: EVENT.price, register: EVENT.register, about: EVENT.about, status: st && st.count, schedule: (EVENT.schedule || []).map((s) => ({ time: s.time, author: s.author, break: !!s.break, title: s.title || '', canRemind: !!(s.start && s.start > new Date()) })), timesAreInTheVisitorsTimeZone: true, streamInTheFair: act.canWatch() },
      activities: ['A guided breathing minute with the four pillars (action breathe)', 'A wishing lantern: write an intention and let it rise over the fair; others see it rise, the words stay private (action lantern)', 'The Book Oracle: three questions that point to the right book (action quiz)', 'Reminders for a talk, 30, 10 and 5 minutes before (action remind with the author id)'],
      places: [{ id: 'welcome', label: 'Entrance' }, { id: 'hall', label: 'Grand Hall' }, { id: 'oracle', label: 'Book Oracle' }, { id: 'speak', label: 'Speak Your Book stage' }, { id: 'about', label: 'Temple of Life Coach Code' }, { id: 'finale', label: 'Pedestal for your book' }, ...BOOKS.map((b) => ({ id: place(b.slug), label: b.title }))],
      books: BOOKS.map((b) => ({ slug: b.slug, place: place(b.slug), title: b.title, subtitle: b.subtitle, author: b.displayAuthor || b.author, authorId: authorOf[b.slug] && authorOf[b.slug].id, status: b.status || 'published', hook: b.hook, description: b.description.join(' '), inside: b.inside, forWho: b.forWho, steps: b.steps && b.steps.items.map((s) => `${s.name}: ${s.text}`), stand: STANDS[b.slug], amazon: b.amazon && b.amazon.url })),
      authors: AUTHORS.map((a) => ({ id: a.id, name: a.displayName, credentials: a.credentials, bio: a.bio || '', books: a.books, website: a.website, linkedin: a.linkedin, profile: a.profile, interview: a.interview, canReceiveMessages: !!a.inbox }))
    });
  }
  async function aiAnswer(q) {
    const res = await fetch(CFG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ messages: history.slice(-10), knowledge: knowledge(), zone: zone() || 'welcome' })
    });
    if (!res.ok) throw new Error('guide ' + res.status);
    const out = await res.json();
    if (!out || typeof out.reply !== 'string') throw new Error('guide reply');
    return { reply: out.reply.slice(0, 3000), actions: Array.isArray(out.actions) ? out.actions : [] };
  }

  /* only actions that point at real places, books, authors and the fair's own links */
  const allowedUrls = () => new Set([
    ...Object.values(LINKS), EVENT && EVENT.register, EVENT && EVENT.stream && EVENT.stream.zoom,
    ...BOOKS.filter((b) => b.amazon).map((b) => b.amazon.url),
    ...AUTHORS.flatMap((a) => [a.website, a.linkedin, a.profile, a.interview])
  ].filter(Boolean));
  function cleanActions(list) {
    const urls = allowedUrls();
    const seen = new Set();
    return list.filter((x) => {
      if (!x || typeof x !== 'object') return false;
      const ok = (x.type === 'goto' && (bySlug[String(x.place).replace(/^book-/, '')] || PLACES.some((p) => p.id === x.place)))
        || (x.type === 'book' && bySlug[x.slug]) || (x.type === 'author' && authorById[x.id])
        || (x.type === 'message' && authorById[x.id] && authorById[x.id].inbox)
        || (x.type === 'link' && urls.has(x.url)) || ['event', 'creator', 'tour', 'breathe', 'lantern', 'quiz'].includes(x.type) || (x.type === 'watch' && act.canWatch())
        || (x.type === 'remind' && authorById[x.id] && act.canRemind(x.id));
      const key = JSON.stringify(x);
      if (!ok || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
  }
  function actionLabel(x) {
    switch (x.type) {
      case 'goto': { const b = bySlug[String(x.place).replace(/^book-/, '')]; return b ? `Walk me to “${b.title}”` : `Take me to ${(PLACES.find((p) => p.id === x.place) || {}).label || 'it'}`; }
      case 'book': return `Open “${bySlug[x.slug].title}”`;
      case 'author': return `Meet ${authorById[x.id].displayName}`;
      case 'message': return `Message ${authorById[x.id].displayName}`;
      case 'link': return x.label || 'Open link';
      case 'event': return 'The live event';
      case 'creator': return 'Design my cover';
      case 'tour': return 'Start the guided tour';
      case 'watch': return '● Watch live';
      case 'remind': return `🔔 Remind me: ${authorById[x.id].displayName}`;
      case 'breathe': return 'Breathe for a minute';
      case 'lantern': return 'Release a lantern';
      case 'quiz': return 'Ask the Oracle';
      default: return '';
    }
  }
  function runAction(x) {
    track('guide_action', { type: x.type });
    switch (x.type) {
      case 'goto': act.goto(x.place); break;
      case 'book': act.book(x.slug); break;
      case 'author': act.author(x.id); break;
      case 'message': act.message(x.id); break;
      case 'link': window.open(x.url, '_blank', 'noopener'); break;
      case 'event': act.event(); break;
      case 'creator': act.creator(); break;
      case 'tour': act.tour(); setOpen(false); break;
      case 'watch': act.watch(); break;
      case 'remind': act.remind(x.id); break;
      case 'breathe': act.breathe(); setOpen(false); break;
      case 'lantern': act.lantern(); setOpen(false); break;
      case 'quiz': act.quiz(); break;
      default:
    }
    if (window.matchMedia('(max-width: 760px)').matches && ['goto', 'book', 'author', 'event', 'creator', 'watch', 'message', 'quiz'].includes(x.type)) setOpen(false);
  }

  /* ---------- the conversation ---------- */
  function addMessage(role, md, actions = []) {
    const el = document.createElement('div');
    el.className = `gmsg gmsg--${role}`;
    el.innerHTML = role === 'user' ? `<p>${esc(md)}</p>` : renderMarkdown(md);
    if (actions.length) {
      const row = document.createElement('div');
      row.className = 'gmsg__actions';
      actions.forEach((x) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = x.type === 'link' || x.type === 'watch' ? 'gact gact--gold' : 'gact';
        btn.textContent = actionLabel(x);
        btn.addEventListener('click', () => runAction(x));
        row.appendChild(btn);
      });
      el.appendChild(row);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function speak(md) {
    if (!state.voice || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const text = md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_#>•]/g, '').replace(/\s+/g, ' ').slice(0, 600);
    const u = new SpeechSynthesisUtterance(text);
    const v = window.speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang) && /natural|google|samantha|serena|daniel/i.test(x.name));
    if (v) u.voice = v;
    u.rate = 1.0;
    window.speechSynthesis.speak(u);
  }
  async function ask(q) {
    q = String(q || '').trim().slice(0, 400);
    if (!q || busy) return;
    busy = true;
    addMessage('user', q);
    history.push({ role: 'user', content: q });
    const typing = addMessage('guide', '');
    typing.classList.add('is-typing');
    typing.innerHTML = '<span></span><span></span><span></span>';
    let ans;
    if (CFG.endpoint) {
      try { ans = await aiAnswer(q); ans.actions = cleanActions(ans.actions); } catch (e) { ans = null; }
    }
    if (!ans) { await new Promise((r) => setTimeout(r, 450)); ans = localAnswer(q); ans.actions = cleanActions(ans.actions); }
    typing.remove();
    addMessage('guide', ans.reply, ans.actions);
    history.push({ role: 'assistant', content: ans.reply });
    speak(ans.reply);
    renderChips();
    busy = false;
    track('guide_ask', { ai: !!CFG.endpoint });
  }
  function chipsFor() {
    const here = zone();
    const b = here && here.startsWith('book-') ? bySlug[here.slice(5)] : null;
    if (b) return ['Tell me about this booth', `Who is ${authorOf[b.slug] ? authorOf[b.slug].displayName : 'the author'}?`, 'Take me to the next booth', 'When is the live event?'];
    if (here === 'speak' || here === 'event') return ['When is the live event?', 'Who is speaking?', 'How can I watch?', 'How can I create my book?'];
    if (here === 'about') return ['Breathe with me', 'Release a wishing lantern', 'Who is Life Coach Code?', 'How can I create my own book?'];
    return ['When is the live event?', 'Which book is right for me?', 'Things to do between the talks', 'How can I create my own book?'];
  }
  function renderChips() {
    chipsEl.innerHTML = '';
    chipsFor().forEach((t) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip';
      c.textContent = t;
      c.addEventListener('click', () => ask(t));
      chipsEl.appendChild(c);
    });
  }

  /* ---------- open, quiet, away ---------- */
  function sync() {
    root.hidden = state.away;
    panel.hidden = !state.open;
    orb.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    root.classList.toggle('is-open', state.open);
    document.documentElement.classList.toggle('is-guiding', state.open);
    $('#guide-quiet').setAttribute('aria-pressed', state.quiet ? 'true' : 'false');
    $('#guide-quiet').setAttribute('aria-label', state.quiet ? 'Tips are off: turn them back on' : 'Quiet: no tips while I explore');
    $('#guide-voice').setAttribute('aria-pressed', state.voice ? 'true' : 'false');
    $('#guide-mode').textContent = state.quiet ? 'Quiet mode · ask me anytime' : 'Ask me anything about the fair';
  }
  function setOpen(v) {
    state.open = v;
    hideTip();
    if (v && !greeted) { greeted = true; const w = welcome(); addMessage('guide', w.reply); renderChips(); }
    if (v) { renderChips(); setTimeout(() => input.focus({ preventScroll: true }), 80); }
    if (!v && window.speechSynthesis) window.speechSynthesis.cancel();
    sync();
  }
  function showTip(md, ask) {
    if (state.quiet || state.away || state.open) return;
    tipText.innerHTML = renderMarkdown(md);
    tip.dataset.ask = ask || '';
    tip.hidden = false;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 11000);
  }
  function hideTip() { tip.hidden = true; clearTimeout(tipTimer); }

  orb.addEventListener('click', () => setOpen(!state.open));
  $('#guide-min').addEventListener('click', () => setOpen(false));
  $('#guide-quiet').addEventListener('click', () => { state.quiet = !state.quiet; save(); sync(); });
  $('#guide-voice').addEventListener('click', () => { state.voice = !state.voice; save(); sync(); if (!state.voice && window.speechSynthesis) window.speechSynthesis.cancel(); });
  $('#guide-away').addEventListener('click', () => { state.away = true; state.open = false; save(); sync(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); orb.focus(); } });
  tip.addEventListener('click', (e) => {
    if (e.target.closest('[data-guide-tip-close]')) { hideTip(); return; }
    const q = tip.dataset.ask;
    setOpen(true);
    if (q) ask(q);
  });
  sync();

  return {
    open: () => { state.away = false; save(); setOpen(true); },
    bringBack: () => { state.away = false; save(); sync(); },
    ask,
    // a gentle word when the visitor arrives somewhere new
    zoneChanged(id) {
      clearTimeout(zoneTimer);
      if (state.open) { renderChips(); return; }
      if (!id || !id.startsWith('book-') || seenStands.has(id)) return;
      const b = bySlug[id.slice(5)];
      if (!b || !STANDS[b.slug]) return;
      zoneTimer = setTimeout(() => {
        seenStands.add(id);
        showTip(`**${b.title}** · ${STANDS[b.slug]}`, 'Tell me about this booth');
      }, 1800);
    },
    hello() {
      if (state.away || state.quiet) return;
      setTimeout(() => showTip(`Hi! I’m your guide. Ask me about the authors, the books${upcoming() ? ' or the live event' : ''}, and I’ll take you anywhere in the fair.`, ''), 7000);
    },
    isAway: () => state.away
  };
}
