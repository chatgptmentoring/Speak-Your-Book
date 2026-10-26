/*
 * The live event's programme: who speaks when, the breaks between the talks, what is on now,
 * calendar files with reminders, and the Book Oracle's questions.
 *
 * FAIR_EVENT.schedule entries (books.js, or Settings > Virtual Book Fair on WordPress):
 *   { at: '2026-11-01T17:00:00+00:00', author: 'chuck-barnard', title: 'Raising resilient teens', minutes: 20 }
 *   { at: '2026-11-01T17:25:00+00:00', break: true, title: 'Lanterns and a breathing minute' }
 * A talk without minutes lasts until the next line; the last one, 30 minutes.
 * Entries with only a time text ({ time: '5:00 pm GMT', ... }) are shown as written.
 */
const MIN = 6e4;

export function createProgram(event) {
  const all = ((event && event.schedule) || []).filter((s) => s && (s.at || s.time));
  const timed = [];
  all.forEach((s) => {
    const d = s.at ? new Date(s.at) : null;
    if (!d || isNaN(d)) return;
    s.start = d;
    // every visitor reads the time in their own time zone (the guide reads it from here too)
    s.time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    s.key = `${s.at}|${s.break ? 'break' : s.author}`;
    timed.push(s);
  });
  timed.sort((a, b) => a.start - b.start);
  timed.forEach((s, i) => {
    const next = timed[i + 1];
    s.end = new Date(s.minutes ? +s.start + s.minutes * MIN : next ? +next.start : +s.start + 30 * MIN);
  });
  const talks = timed.filter((s) => !s.break && s.author);

  /* What is happening at a moment: a talk, a break between talks, or the wait before the first */
  function state(now = new Date()) {
    if (!timed.length) return null;
    const cur = timed.find((s) => s.start <= now && now < s.end);
    const next = talks.find((s) => s.start > now) || null;
    if (cur) return { kind: cur.break ? 'break' : 'talk', cur, next };
    if (next && now < timed[0].start) return { kind: 'before', cur: null, next };
    if (next) return { kind: 'break', cur: null, next };
    return { kind: 'done', cur: null, next: null };
  }

  const minsTo = (s, now = new Date()) => Math.max(0, Math.ceil((s.start - now) / MIN));

  /* A calendar entry for one talk, with reminders 30, 10 and 5 minutes before */
  function ics(s, { authorName, zoom, pageUrl }) {
    const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const escI = (t) => String(t).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const what = `${authorName}${s.title ? `: ${s.title}` : ''}`;
    const alarm = (m) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${m}M`, `DESCRIPTION:${escI(`${what} starts in ${m} minutes`)}`, 'END:VALARM'];
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life Coach Code//Virtual Book Fair//EN', 'BEGIN:VEVENT',
      `UID:${stamp(s.start)}-${s.author}@lifecoachcode.com`, `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(s.start)}`, `DTEND:${stamp(s.end)}`,
      `SUMMARY:${escI(`${what} · ${event.name}`)}`,
      ...(zoom ? [`LOCATION:${escI(zoom)}`] : []),
      `DESCRIPTION:${escI(`${authorName} speaks live at ${event.name}.\n${zoom ? `Join on Zoom: ${zoom}\n` : ''}The Virtual Book Fair: ${pageUrl}`)}`,
      ...alarm(30), ...alarm(10), ...alarm(5),
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }

  return {
    all: () => all,
    timed: () => timed,
    talks: () => talks,
    talksBy: (id) => talks.filter((s) => s.author === id),
    byKey: (key) => timed.find((s) => s.key === key) || null,
    state,
    minsTo,
    ics
  };
}

/*
 * The Book Oracle's questions: each answer leans towards some books, by the question's weight.
 * Returns the books from the best match down, with their scores.
 */
export function scoreQuiz(quiz, answers, books) {
  const score = new Map(books.map((b, i) => [b.slug, { b, s: 0, tie: Math.random() + i * 1e-6 }]));
  answers.forEach((pick, qi) => {
    const q = quiz[qi];
    const o = q && q.options[pick];
    if (!o) return;
    o.books.forEach((slug) => { const x = score.get(slug); if (x) x.s += q.weight || 1; });
  });
  return [...score.values()].filter((x) => x.s > 0).sort((a, b) => b.s - a.s || b.tie - a.tie);
}
