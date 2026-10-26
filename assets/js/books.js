/*
 * The books at the fair: the single place to edit titles, copy and links.
 *
 * Adding a book: put its covers in assets/img/covers as <slug>-480.webp, <slug>-800.webp,
 * <slug>-full.webp and <slug>-glow.webp (see README), then add an entry below.
 * A book that is not out yet: set status: 'coming-soon' and amazon: null. Its booth then
 * shows a "Coming soon" ribbon and a discovery-call invitation instead of a buy button.
 *
 * Optional extras per book, shown only when you add them:
 *   samplePages: ['assets/img/inside/<slug>-1.webp', ...]   real pages to leaf through in 3D
 *   testimonials: [{ quote: '...', name: '...' }]            reader quotes in the booth panel
 */

/* Where the fair's files are served from. Empty when the fair is the site itself (GitHub Pages);
   the WordPress plugin sets it to the plugin's folder before this file loads. */
window.FAIR_BASE = window.FAIR_BASE || '';
window.FAIR_ASSET = (path) => (path && !/^([a-z][a-z0-9+.-]*:|\/)/i.test(path) ? window.FAIR_BASE + path : path);

window.FAIR_BOOKS = [
  {
    slug: 'finding-love-in-the-mirror',
    title: 'Finding Love in the Mirror',
    subtitle: 'How I Lost My Money, My Marriage, and My God, Only to Find Myself',
    author: 'Soonjin Cho',
    credentials: '',
    tags: ['Memoir', 'Self-love', 'Spirituality'],
    aisles: ['healing', 'stories'],
    hook: 'Sometimes everything has to fall away before you can finally see yourself.',
    description: [
      'Money, marriage, faith: the three pillars a life is so often built around. In this raw and courageous memoir, Soonjin Cho tells the story of losing all three, and of what was waiting on the other side of that loss.',
      'Finding Love in the Mirror is about the love that remains when everything else is gone: the love that can only be found by finally turning around and looking at yourself.'
    ],
    inside: [
      'An honest story of losing what once defined a life',
      'Rebuilding identity, worth and faith from the inside out',
      'A mirror for anyone who is starting over'
    ],
    forWho: 'Anyone walking through loss, divorce or a crisis of faith, and anyone ready to meet themselves with love.',
    amazon: { url: 'https://www.amazon.com/dp/B0HL4YQQ15', store: 'Amazon.com', asin: 'B0HL4YQQ15' },
    cover: { w: 1253, h: 2000 },
    colors: { spine: '#0d0f15', spineText: '#e9b45c', glow: '#e07a2a' },
    oracle: 'What you lost made room for who you are. Look again. Love is already looking back.'
  },
  {
    slug: 'clarity-before-momentum',
    title: 'Clarity Before Momentum',
    subtitle: 'Executive Guidance for Realigning Your Next Career Chapter',
    author: 'Edith Moricz',
    credentials: '',
    tags: ['Career', 'Leadership', 'Transition'],
    aisles: ['purpose'],
    hook: 'Before you move fast, move true.',
    description: [
      'When a career reaches a crossroads, the instinct is to act: update the résumé, take the next offer, keep the momentum going. Edith Moricz invites leaders to take a different first step: clarity.',
      'Clarity Before Momentum is executive guidance for pausing with purpose, getting honest about what matters now, and realigning your next career chapter so the road ahead is one you truly want to travel.'
    ],
    inside: [
      'Why clarity has to come before speed',
      'Realigning your work with who you are now',
      'Guidance for executives and leaders in transition'
    ],
    forWho: 'Executives, senior professionals and leaders standing at the edge of their next chapter.',
    amazon: { url: 'https://www.amazon.com.au/Clarity-Before-Momentum-Executive-Realigning-ebook/dp/B0GHMGSPQG', store: 'Amazon.com.au', asin: 'B0GHMGSPQG' },
    cover: { w: 1253, h: 2000 },
    colors: { spine: '#7a2f27', spineText: '#ffd27a', glow: '#f08a2c' },
    oracle: 'Stillness is not standing still. Let clarity choose your direction, and momentum will follow.'
  },
  {
    slug: 'teen-mental-health',
    title: 'Teen Mental Health',
    subtitle: 'What Every Parent Needs to Know to Build a Resilient Teen',
    author: 'Chuck Barnard',
    credentials: '',
    tags: ['Parenting', 'Teens', 'Mental health'],
    aisles: ['family', 'mind'],
    hook: 'Behind every screen is a young mind asking to be understood.',
    description: [
      'Today’s teenagers are growing up in a world of constant notifications, comparison and pressure. Chuck Barnard brings three decades as an educator, mentor and coach of young people to the question every parent is quietly asking.',
      'Teen Mental Health is a practical, compassionate guide to understanding the inner world of your teen, and to helping them build the resilience to thrive in it.'
    ],
    inside: [
      'Understanding the world your teen lives in',
      'What every parent needs to know',
      'Building a resilient teen, together'
    ],
    forWho: 'Parents, caregivers and educators of teenagers.',
    amazon: { url: 'https://www.amazon.com/Teen-Mental-Health-Parent-Resilient-ebook/dp/B0GN5BHBNS/', store: 'Amazon.com', asin: 'B0GN5BHBNS' },
    cover: { w: 1253, h: 2000 },
    colors: { spine: '#06080a', spineText: '#8fd0f0', glow: '#e9a240' },
    oracle: 'The strongest thing you can give a young heart is the feeling of being understood.'
  },
  {
    slug: 'the-invisible-midlife-woman',
    title: 'The Invisible Midlife Woman',
    subtitle: 'Why High-Performing Women Disappear from Their Own Lives, and How to Return',
    author: 'Sonia Jenkins',
    credentials: '',
    tags: ['Midlife', 'Wellbeing', 'Women'],
    aisles: ['healing', 'mind', 'purpose'],
    hook: 'You didn’t disappear. You were busy holding everyone else.',
    description: [
      'High-performing women are so often the ones holding everything together: careers, children, ageing parents, everyone’s needs but their own. Somewhere along the way, they quietly vanish from their own lives.',
      'Drawing on more than four decades as an NHS nurse practitioner, and on work as a certified functional medicine health coach, Sonia Jenkins explains why this happens, why rest can feel out of reach, and how to find the way back to yourself.'
    ],
    inside: [
      'Why capable women vanish from their own lives',
      'The weight of caring for everyone at once',
      'The gentle path back to yourself'
    ],
    forWho: 'Women in midlife who give everything, and are ready to receive some of it back.',
    amazon: { url: 'https://www.amazon.co.uk/Invisible-Midlife-Woman-high-performing-disappear-ebook/dp/B0H6PS1LPN', store: 'Amazon.co.uk', asin: 'B0H6PS1LPN' },
    cover: { w: 1253, h: 2000 },
    colors: { spine: '#d8c2a2', spineText: '#1e4a5e', glow: '#f2b25c' },
    oracle: 'You are allowed to be held, too. Come back to the life that has been waiting for you.'
  },
  {
    slug: 'conscious-integrative-therapy',
    title: 'Conscious Integrative Therapy',
    subtitle: 'TrancePlan Hypnotherapy',
    author: 'Susan J. Razavi',
    credentials: 'LCSW-R',
    tags: ['Therapy', 'Hypnotherapy', 'Yogic wisdom'],
    aisles: ['healing', 'mind'],
    hook: 'Where Western psychotherapy meets ancient yogic wisdom.',
    description: [
      'Drawing on more than three decades of clinical practice and a deep study of yogic philosophy, psychotherapist and clinical hypnotherapist Susan J. Razavi introduces Conscious Integrative Therapy (CIT).',
      'CIT brings Freud and Jung into conversation with the Yoga Sutras, and blends CBT and mindfulness with yogic principles. At its heart is TrancePlan: a personalised approach to hypnotherapy that goes beyond scripts to reach trauma, inner-child wounds and core identity.'
    ],
    inside: [
      'A bridge between Freud, Jung and the Yoga Sutras',
      'TrancePlan: hypnotherapy that goes beyond scripts',
      'Healing trauma, inner-child wounds and core identity'
    ],
    forWho: 'Therapists, coaches, healers and seekers drawn to the meeting place of mind and spirit.',
    amazon: { url: 'https://www.amazon.in/Conscious-Integrative-Therapy-TrancePlan-Hypnotherapy-ebook/dp/B0FQTW3HP9', store: 'Amazon.in', asin: 'B0FQTW3HP9' },
    cover: { w: 1024, h: 1536 },
    colors: { spine: '#1d0b86', spineText: '#f2c14a', glow: '#4b3cf0' },
    oracle: 'The mind has doors the body remembers. Breathe slowly, and let them open.'
  },
  {
    slug: 'more-than-a-game',
    title: 'More Than a Game',
    subtitle: 'Raising a Resilient Athlete Without Sacrificing Their Childhood',
    author: 'Chuck Barnard',
    displayAuthor: 'Coach Chuck Barnard',
    credentials: '',
    tags: ['Parenting', 'Youth sports', 'Resilience'],
    aisles: ['family'],
    hook: 'Raise the athlete. Protect the child.',
    description: [
      'Youth sport can build extraordinary young people, or quietly wear them down. Coach Chuck Barnard draws on three decades as an educator, mentor and coach to help parents raise athletes who are resilient, without sacrificing the childhood that matters most.',
      'Guided by a compass of character, resilience, effort and joy, More Than a Game is for the parent in the stands who wants their child to win at sport and at life.'
    ],
    inside: [
      'The compass: character, resilience, effort and joy',
      'Supporting performance without stealing the fun',
      'Raising a strong athlete and a whole human'
    ],
    forWho: 'Sports parents, youth coaches and anyone who loves a young athlete.',
    amazon: { url: 'https://www.amazon.com/More-Than-Game-Resilient-Sacrificing-ebook/dp/B0FQKNVD3L', store: 'Amazon.com', asin: 'B0FQKNVD3L' },
    cover: { w: 1253, h: 2000 },
    colors: { spine: '#15191c', spineText: '#e9e3d2', glow: '#b8913f' },
    oracle: 'Let them play for love first. Champions are grown from joy, not pressure.'
  },
  {
    slug: 'food-isnt-the-problem',
    title: 'Food Isn’t the Problem',
    subtitle: 'Understanding Emotional Eating and Crossing the Bridge to Peace with Food',
    author: 'Tanya Fasnacht Jolliffe',
    credentials: 'RDN, LD, CIMHP',
    tags: ['Wellness', 'Emotional eating', 'Mindset'],
    aisles: ['mind'],
    hook: 'You were born to be free.',
    description: [
      'Registered dietitian Tanya Fasnacht Jolliffe knows that emotional eating is rarely about willpower, or even about food. It is about everything food has been asked to soothe.',
      'Food Isn’t the Problem helps readers understand what is really driving the pull toward food, and offers a gentle 3-Step Path to freedom from emotional eating: a bridge across to lasting peace with food.'
    ],
    inside: [
      'What emotional eating is really about',
      'The 3-Step Path: Name it, Claim it, Reframe it',
      'Crossing the bridge to lasting peace with food'
    ],
    forWho: 'Anyone tired of fighting food, and ready to understand it, make peace with it and feel free.',
    steps: {
      title: 'The 3-Step Path to Freedom',
      items: [
        { name: 'Name it', text: 'Recognize that you are not physically hungry and identify what you are feeling. Use specific words like \u201Cangry,\u201D \u201Csad,\u201D or \u201Canxious.\u201D' },
        { name: 'Claim it', text: 'Acknowledge that it makes sense to feel this way, and remind yourself that you don\u2019t need to fix or numb this feeling with food.' },
        { name: 'Reframe it', text: 'Understand that this emotion is a message telling you what you actually need. Take a moment to pause and mindfully address that need.' }
      ]
    },
    amazon: { url: 'https://www.amazon.com/Food-Isnt-Problem-Understanding-Emotional/dp/B0HHCBCQGB/', store: 'Amazon.com', asin: 'B0HHCBCQGB' },
    cover: { w: 1253, h: 2000 },
    colors: { spine: '#1b3a57', spineText: '#f39a4c', glow: '#2f86c9' },
    oracle: 'Name it. Claim it. Reframe it. Your hunger is a messenger, and you are ready to listen.'
  },
  {
    slug: 'prince-and-the-prodigal',
    title: 'Prince and the Prodigal',
    subtitle: 'An Unlikely Friendship. A World-Changing Destiny.',
    author: 'Chuck Barnard',
    credentials: '',
    tags: ['Fiction', 'Friendship', 'Destiny'],
    aisles: ['stories'],
    hook: 'Two lives. One horizon. A friendship that could change the world.',
    description: [
      'An unlikely friendship. A world-changing destiny. In this novel, Chuck Barnard turns from guidance to storytelling.',
      'Prince and the Prodigal follows two very different lives drawn together by a bond neither expected, and toward a destiny far bigger than either of them.'
    ],
    inside: [
      'An unlikely friendship',
      'A destiny bigger than both of them',
      'Storytelling from a coach’s heart'
    ],
    forWho: 'Readers who love stories of friendship, purpose and destiny.',
    amazon: { url: 'https://www.amazon.com/Honoring-Horatio-Simon-Potter-ebook/dp/B00G13B57W/', store: 'Amazon.com', asin: 'B00G13B57W' },
    cover: { w: 1024, h: 1536 },
    colors: { spine: '#1f3f45', spineText: '#f3e6c0', glow: '#e6a53a' },
    oracle: 'The right companion can turn any road into a destiny. Look who is walking beside you.'
  },
  {
    slug: 'journey-to-empowerment',
    title: 'The Journey to Empowerment Through Self-Love',
    subtitle: 'A Journey of Rediscovery, Healing, Reinvention, and Becoming',
    author: 'Jessica V. Fuentes',
    credentials: '',
    tags: ['Self-love', 'Healing', 'Reinvention'],
    aisles: ['healing'],
    hook: 'Open the drawer. Let what was hidden rise.',
    description: [
      'Jessica V. Fuentes guides readers through four movements of a life reclaimed: rediscovery, healing, reinvention and becoming.',
      'Through the lens of self-love, this book is an invitation to take out every part of yourself that was ever folded away, and to rise into the fullest version of who you are.'
    ],
    inside: [
      'Rediscovering the self you put away',
      'Healing that begins with self-love',
      'Reinvention, and the courage of becoming'
    ],
    forWho: 'Anyone ready to stop shrinking and start becoming, gently and on their own terms.',
    amazon: { url: 'https://www.amazon.in/Journey-Empowerment-Through-Self-Love-Rediscovery-ebook/dp/B0HH173RK1', store: 'Amazon.in', asin: 'B0HH173RK1' },
    cover: { w: 1253, h: 2000 },
    colors: { spine: '#f2e8da', spineText: '#8e1c1c', glow: '#d39a4a' },
    oracle: 'You were never too much. You were only waiting for the room to rise.'
  },

  /* ---------- Coming soon ---------- */
  {
    slug: 'when-the-blueprint-burned',
    status: 'coming-soon',
    title: 'When the Blueprint Burned',
    subtitle: 'A Unicorn Mama Memoir of Neurodiversity, Strength, Joy & Humor',
    author: 'Jennifer A. Schmeisser',
    credentials: '',
    tags: ['Memoir', 'Neurodiversity', 'Parenting'],
    aisles: ['family', 'stories'],
    hook: 'Not the life I planned… but the one I was meant to live.',
    description: [
      '“A son who changed everything. A daughter who reminded me what matters most.” In this warm and funny memoir, Jennifer A. Schmeisser tells the story of the day the parenting blueprint went up in flames, and of the strength, joy and humour that rose from the ashes.',
      'For every family raising a neurodivergent child, it is proof that the life you didn’t plan can turn out to be the one you were meant to live.'
    ],
    inside: [
      'Raising a neurodivergent child, with honesty',
      'Strength, joy and plenty of humour',
      'Letting go of the plan, and finding something better'
    ],
    forWho: 'Parents of neurodivergent children, and anyone whose life took an unexpected turn.',
    amazon: null,
    cover: { w: 1000, h: 1502 },
    colors: { spine: '#e7d8bd', spineText: '#1f4f8a', glow: '#d9a35a' },
    oracle: 'When the plan burns, something truer grows in its place. Laugh, love, and keep going.'
  },
  {
    slug: 'everything-happens-for-you',
    status: 'coming-soon',
    title: 'Everything Happens For You',
    subtitle: 'Understanding the Hidden Lessons Behind Life’s Greatest Challenges',
    author: 'Monika Puiu',
    credentials: '',
    tags: ['Wisdom', 'Resilience', 'Spirituality'],
    aisles: ['healing', 'purpose'],
    hook: 'Life is not happening to you. It is happening for you.',
    description: [
      'What if your greatest challenges were never punishments, but invitations? In Everything Happens For You, Monika Puiu explores the hidden lessons woven into life’s hardest moments.',
      'It is a book about turning pain into understanding, and understanding into a quieter, wiser kind of peace.'
    ],
    inside: [
      'Seeing challenge as an invitation',
      'Finding the hidden lessons in hard seasons',
      'Turning pain into wisdom and peace'
    ],
    forWho: 'Anyone in a difficult chapter who is searching for its meaning.',
    amazon: null,
    cover: { w: 975, h: 1500 },
    colors: { spine: '#2c7d92', spineText: '#f0cf78', glow: '#46a9bd' },
    oracle: 'This chapter is not against you. It is quietly shaping you for what comes next.'
  },
  {
    slug: 'healing-unraveled',
    status: 'coming-soon',
    title: 'Healing Unraveled',
    subtitle: 'Returning to Your Original Blueprint: A Medical Intuitive’s Guide to Releasing What Was Never Yours',
    author: 'Dolores Fazzino',
    displayAuthor: 'Dr. Dolores Fazzino',
    credentials: '',
    tags: ['Energy healing', 'Intuition', 'Medicine'],
    aisles: ['healing', 'mind'],
    hook: 'The cage door is already open.',
    description: [
      'As a medical intuitive, Dr. Dolores Fazzino works where medicine, intuition and energy meet.',
      'Healing Unraveled is a guide to releasing what was never yours to carry, and to returning to the original blueprint of who you are: bridging medicine, intuition and energy for a higher you.'
    ],
    inside: [
      'Bridging medicine, intuition and energy',
      'Releasing what was never yours',
      'Returning to your original blueprint'
    ],
    forWho: 'Seekers, healers and anyone ready to feel free in their body and their life.',
    amazon: null,
    cover: { w: 1024, h: 1536 },
    colors: { spine: '#f3e8e6', spineText: '#6b1f4e', glow: '#c792e0' },
    oracle: 'Set down what was never yours. What remains is your original light.'
  },
  {
    slug: 'life-is-happening-now',
    status: 'coming-soon',
    title: 'Life Is Happening Now',
    subtitle: 'Not 10 Pounds From Now: How I Lost 290 lbs Without Surgery',
    author: 'Beth Donovan',
    credentials: 'CMC, CWCS',
    tags: ['Memoir', 'Weight loss', 'Wellness'],
    aisles: ['healing', 'story'],
    hook: 'You don’t have to wait to be you.',
    description: [
      'A true SparkPeople story of transformation, courage, spirit and choosing life.',
      'Over twenty years, Beth Donovan lost 290 pounds without surgery. With a great sense of humour, real wisdom and practical advice, this is a guide from someone who truly walks the talk.'
    ],
    inside: [
      'A 20-year journey, told with humour',
      'Real, practical advice that lasts',
      'Living now, not 10 pounds from now'
    ],
    forWho: 'Anyone who has been waiting to start living until the scale says so.',
    amazon: null,
    cover: { w: 1032, h: 1523 },
    colors: { spine: '#4a2a6a', spineText: '#f3e6ff', glow: '#b58cff' },
    oracle: 'Life is happening now, not ten pounds from now. You don’t have to wait to be you.'
  },
  {
    slug: 'truly-yours-life',
    status: 'coming-soon',
    title: 'Truly Yours, Life',
    subtitle: 'A Journey Through Expectation, Rewiring, and Coherence',
    author: 'Yevheniya Shalimova',
    credentials: 'PCC',
    tags: ['Memoir', 'Personal development', 'Leadership'],
    aisles: ['stories', 'purpose'],
    hook: 'Resilience keeps us strong, but Coherence brings us home.',
    description: [
      'How much of the life you are living was consciously chosen by you, and how much was inherited, expected, or merely survived? Truly Yours, Life is a memoir-meets-methodology that guides high-achievers, perfectionists and burnt-out leaders out of the exhaustion of constant performance.',
      'Raised on a top-secret Soviet military base, Yevheniya Shalimova learned early that love and approval had to be earned through flawless execution. For decades she lived as the ultimate “shadow translator”, amplifying the brilliance of international leaders and making quiet compromises to keep the peace. It took escaping the 2022 war in Ukraine, surviving a freezing 40-foot shipping container and a total physical collapse as a refugee in Norway for her to stop performing and start living.',
      'Blending a cinematic memoir with behavioural neuroscience, and framed as a series of letters written by Life to the reader, the book unveils the origin of the Coherence Architecture and The Shalimova Method®: how to stop making quiet compromises, rewire the brain’s trauma responses, and bring Mind, Body and Spirit home into Coherence.'
    ],
    inside: [
      'The danger of “quiet compromises”',
      'Resilience vs. Coherence',
      'The “Helper Syndrome” in leadership',
      'Doing vs. Being: from performance to inner peace'
    ],
    forWho: 'High-achievers, perfectionists and leaders who look successful on the outside but feel quietly suffocated on the inside.',
    amazon: null,
    cover: { w: 1024, h: 1536 },
    colors: { spine: '#2c2a28', spineText: '#e8c47a', glow: '#f3d38c' },
    oracle: 'Resilience kept you strong. Now let Coherence bring you home.'
  },
  {
    slug: 'curiously-certain',
    status: 'coming-soon',
    coverPending: true,
    workingTitle: true,
    title: 'Curiously Certain',
    subtitle: 'Friendly conversations over coffee',
    author: 'Rachel Tamilio',
    credentials: '',
    tags: ['Purpose', 'Personal growth', 'Conversations'],
    aisles: ['mind', 'story'],
    hook: 'You don’t have to be perfect to follow your purpose.',
    description: [
      'Curiously Certain reads like a friendly conversation over coffee. Rachel Tamilio doesn’t claim to have it all figured out: a work in progress, speaking from experience the way a good friend does.',
      'The point is simple and freeing: we don’t need to be perfect to follow our purpose and help other people.'
    ],
    inside: [
      'Conversations like coffee with a friend',
      'Wisdom from someone still growing too',
      'Purpose before perfection'
    ],
    forWho: 'Anyone waiting to feel ready before following their purpose.',
    amazon: null,
    cover: { w: 1000, h: 1500 },
    colors: { spine: '#5a3a28', spineText: '#f6e3c8', glow: '#ffb877' },
    oracle: 'Pour a cup, take a breath. You don’t have to be perfect to begin.'
  },
  {
    slug: 'how-to-build-yourself-up',
    status: 'coming-soon',
    title: 'How to Build Yourself Up in Difficult Times',
    subtitle: 'Famous fables and a life lived, for anyone rebuilding',
    author: 'Bengü Davchevski',
    credentials: '',
    tags: ['Resilience', 'Fables', 'Personal growth'],
    aisles: ['healing', 'stories'],
    hook: 'Some people turn pain into a wall and hide behind it. Some people turn pain into a staircase and rise by stepping on it.',
    description: [
      'How to Build Yourself Up in Difficult Times weaves famous fables together with Bengü Davchevski’s own life experience, to show how a person can rebuild themselves when life gets hard.',
      'It is written for anyone: whatever you are going through, you will find yourself somewhere in its stories, and a next step to take.'
    ],
    inside: [
      'Famous fables, read for hard times',
      'Lessons from the author’s own life',
      'Pain turned into a staircase, one step at a time'
    ],
    forWho: 'Anyone going through a difficult time and ready to rise from it.',
    amazon: null,
    cover: { w: 1024, h: 1536 },
    colors: { spine: '#1c2c4a', spineText: '#f3e2bd', glow: '#f0a050' },
    oracle: 'The pain you carry can become a staircase. Take the first step.'
  }
];

/* The aisles of the Grand Hall (filters). A book can sit in several aisles. */
window.FAIR_AISLES = [
  { id: 'all', label: 'All books' },
  { id: 'healing', label: 'Healing & self-love' },
  { id: 'mind', label: 'Mind & body' },
  { id: 'family', label: 'Parents & young people' },
  { id: 'purpose', label: 'Purpose & career' },
  { id: 'stories', label: 'Memoirs & stories' },
  { id: 'soon', label: 'Coming soon' }
];

/* The Book Oracle's three questions. Each answer leans towards some books; the weight says how
   much the question counts (the first decides, the other two choose among its books). The book
   with the most points is revealed, with two more for you. */
window.FAIR_QUIZ = [
  {
    q: 'What is your heart asking for right now?',
    weight: 5,
    options: [
      { label: 'Peace after heartbreak or loss', books: ['finding-love-in-the-mirror', 'everything-happens-for-you', 'how-to-build-yourself-up'] },
      { label: 'To come home to myself', books: ['journey-to-empowerment', 'the-invisible-midlife-woman', 'finding-love-in-the-mirror', 'life-is-happening-now', 'truly-yours-life'] },
      { label: 'A clear next chapter', books: ['clarity-before-momentum', 'curiously-certain', 'everything-happens-for-you'] },
      { label: 'Healing for body and mind', books: ['food-isnt-the-problem', 'healing-unraveled', 'conscious-integrative-therapy', 'life-is-happening-now'] },
      { label: 'Faith and courage to begin again', books: ['truly-yours-life', 'curiously-certain', 'everything-happens-for-you', 'how-to-build-yourself-up'] },
      { label: 'Strong, happy children', books: ['teen-mental-health', 'more-than-a-game', 'when-the-blueprint-burned'] },
      { label: 'A story to get lost in', books: ['prince-and-the-prodigal', 'when-the-blueprint-burned', 'finding-love-in-the-mirror'] }
    ]
  },
  {
    q: 'Who is the book for?',
    weight: 2,
    options: [
      { label: 'For me', books: ['finding-love-in-the-mirror', 'the-invisible-midlife-woman', 'food-isnt-the-problem', 'journey-to-empowerment', 'everything-happens-for-you', 'healing-unraveled', 'life-is-happening-now', 'truly-yours-life', 'curiously-certain', 'clarity-before-momentum', 'how-to-build-yourself-up'] },
      { label: 'For my family', books: ['teen-mental-health', 'more-than-a-game', 'when-the-blueprint-burned'] },
      { label: 'For my work and the people I help', books: ['clarity-before-momentum', 'conscious-integrative-therapy', 'healing-unraveled', 'teen-mental-health', 'more-than-a-game', 'truly-yours-life'] },
      { label: 'A gift for someone I love', books: ['prince-and-the-prodigal', 'finding-love-in-the-mirror', 'everything-happens-for-you', 'curiously-certain', 'how-to-build-yourself-up'] }
    ]
  },
  {
    q: 'How do you like to read?',
    weight: 2,
    options: [
      { label: 'A true story that moves me', books: ['finding-love-in-the-mirror', 'when-the-blueprint-burned', 'life-is-happening-now', 'truly-yours-life', 'journey-to-empowerment'] },
      { label: 'Practical steps I can use', books: ['clarity-before-momentum', 'teen-mental-health', 'more-than-a-game', 'food-isnt-the-problem', 'the-invisible-midlife-woman', 'conscious-integrative-therapy'] },
      { label: 'Wisdom to reflect on', books: ['everything-happens-for-you', 'healing-unraveled', 'curiously-certain', 'journey-to-empowerment', 'how-to-build-yourself-up'] },
      { label: 'A novel to get lost in', books: ['prince-and-the-prodigal'] }
    ]
  }
];

/* Other Amazon stores readers can switch to (same ASIN). */
window.FAIR_STORES = [
  { tld: 'com', label: 'United States' },
  { tld: 'co.uk', label: 'United Kingdom' },
  { tld: 'ca', label: 'Canada' },
  { tld: 'com.au', label: 'Australia' },
  { tld: 'in', label: 'India' },
  { tld: 'de', label: 'Germany' }
];

window.FAIR_LINKS = {
  discovery: 'https://forms.gle/d2YU7q9SEHPW9bZP8',
  speakYourBook: 'https://www.lifecoachcode.com/speak-your-book',
  solutions: 'https://www.lifecoachcode.com/solutions'
};

/* =========================================================================
   The live event the fair is built around
   ========================================================================= */
window.FAIR_EVENT = {
  name: 'Speak Your Book',
  date: '2026-11-01', // the day of the event (YYYY-MM-DD)
  // When the start time is confirmed, add it with its UTC offset, for example
  // '2026-11-01T17:00:00+00:00'. The fair then counts down to the minute and shows
  // every visitor the start time in their own time zone.
  start: '',
  where: 'Live on Zoom',
  price: 'Free',
  // the registration form: register is its link, registerEmbed the address from Google Forms'
  // Send > <> embed code, so it opens in a window inside the fair
  register: 'https://forms.gle/5ZBD2bLsYYTeYtoo9',
  registerEmbed: 'https://docs.google.com/forms/d/e/1FAIpQLSdCwn0gwOIX2-ViHwA5tAygGIISv1m9jYFFm5BCung5iRsqGQ/viewform?embedded=true',
  // The talks happen on Zoom, opened in a new tab: a Join on Zoom button appears a quarter of an
  // hour before the start, and each talk gets its own Watch on Zoom button while it is on
  zoom: 'https://us06web.zoom.us/j/83736821137',
  // Who speaks when, once it is decided (on WordPress: Settings > Virtual Book Fair). at: the exact
  // time with its UTC offset; visitors see it in their own time zone and can set reminders.
  // minutes is optional: without it a talk lasts until the next entry. Breaks: break: true.
  // schedule: [
  //   { at: '2026-11-01T17:00:00+00:00', author: 'chuck-barnard', title: 'Raising resilient teens', minutes: 20 },
  //   { at: '2026-11-01T17:20:00+00:00', break: true, title: 'Lanterns and a breathing minute' }
  // ]
  schedule: [],
  about: 'A free, live virtual event on Zoom, hosted by Life Coach Code. Every author in this fair speaks at the event: come and meet them live.'
};

/* =========================================================================
   Meet everyone: live presence
   Visitors who are in the fair at the same time see each other as glowing figures with
   a first name, can wave and send reactions. No free text is ever exchanged.
   Messages travel through a public MQTT broker over a secure WebSocket.
   ========================================================================= */
window.FAIR_LIVE = {
  enabled: true,
  brokers: ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'],
  room: 'lcc-virtual-book-fair-2026',
  // Public keys for the private author links (made with: node tools/author-links.mjs).
  // An author who opens their link shows up as a verified, golden author avatar.
  authorKeys: {
    'soonjin-cho': 'BPhRu1O0Ne-u9_ELCt3WnUDtaGfqGqL_7xkLqsuYWA4Rnc64giM4d4LKDFc2ilLSEyDG1oYzIbm9vUJ5JCQqhZE',
    'edith-moricz': 'BJPbsztX_w4F1Zo12D8bb-IKyeFtqQiREaRsFHOP2oqhoru_bdEeoD_j2fyvR9GmcwDg94eSkfjzRYx9PTEOcc8',
    'chuck-barnard': 'BAQRA4btFEAsOg_F-FoSj4nvJGXlfdESW3LNm3T94YnOUKIt_isbpKrB5jWshZVXwK8ZnwZmT1_A8CKXKCnMnHs',
    'sonia-jenkins': 'BMHGdnF63SuxDCu2wiVuRlbmWLt5o0Xkrz_E7DhOI73rKjyRHG_y8hUktqKFUx1KPMIMlTDnaZZYjSwJEEdVDIk',
    'susan-j-razavi': 'BAnPlt24iFrI39D1zwN3E1aMT8E49ZaPvhylLNdPN1Tay8fs151bPuRIOBvMAIk1OgUjh20kWA8jEv0ES_0acq4',
    'tanya-fasnacht-jolliffe': 'BN1N-_0Z8c19QXe8UdoJ14jdQFucAKCj6ZVPRzlek7YvcVr6z0CvNMGNc_mpsL6Zio4mhkjauctDBCQMwCzW5bQ',
    'jessica-v-fuentes': 'BFjZOIiXEebfGAxty2cf96rCtILk-tJtRBAlxwPzyRTgirso7Sb3VIwUJBQR9G2IIDO-1vzevdznxNBYkwoya04',
    'jennifer-a-schmeisser': 'BMjXWCz1MZqqqBLPWOf_s244f4WNSCY-K6XXsl4n2sHWKSaLDIAQoFCPRTKiSI_WUD7XEWugidkwZ7swLzj4F2A',
    'monika-puiu': 'BGGMy8JfVOOjh7lYW437-QLmTELGcd5jdnLqKf7z21J0es4ACfByndn-P-KtUuuf55N_Cm0NzeJHu6Jsy_RmI14',
    'dolores-fazzino': 'BGttLQ4XqjkRbD43fCIcOa6sI1swNfeDEqVlyqvSCOfMzt246AWANtAqigQV2GxA7BSsiRFqaUkCslRfk6Yq3a0',
    'beth-donovan': 'BEQ8d1-pN4GOo_cJHkVo_KVljodSvqorIKo9OWjs5JFDgVhyhUPiDULHa6ukqmwDLTNW26i4f18SLtSyxh9U3tI',
    'yevheniya-shalimova': 'BLnYXR9oDNZq4gHd8cAPkUS4EWABKf2xVy4acktknH8WtuA8rK2YFOH_4oaK8NKpySf9YPtlo1k3Mp8Kauebnww',
    'rachel-tamilio': 'BPmM0k6G13XIkh5AtFfF4kULlz6qlrU11gJ4lack8bmwqYusUEl3koIoUX1BS-kOTkFp6r6-tPuCBVNAZ9NQSfY',
    'bengu-davchevski': 'BABPgnpAJkbjLJzvmBZMYt5YEusIn3DkGsFUKE_QArjd1R8w-T9sXfatI0Im4XIS7TMmczkYEIKHQ1eB1t-VI1Y'
  }

};

/* Analytics: off by default. Turn on after adding Plausible or Google Analytics to index.html. */
window.FAIR_ANALYTICS = { enabled: false };

/* =========================================================================
   The authors (built from the books). Optional extras per author id:
     photo: 'assets/img/authors/<id>.webp', welcome: 'A short welcome message',
     voice: 'assets/audio/<id>.mp3' (a recorded welcome), website: 'https://...'
   ========================================================================= */
window.FAIR_AUTHOR_EXTRAS = {
  // inbox: the address "Send a message" writes to (see FAIR_CONTACT below). Empty hides the button.
  // bio: shown in the author's panel and used by the guide. Keep it to what the author has published.
  'soonjin-cho': {
    photo: 'assets/img/authors/soonjin-cho.webp',
    inbox: 'hugloveheal@gmail.com',
    linkedin: 'https://www.linkedin.com/in/soonjin-cho-b2bba0254/',
    interview: 'https://www.lifecoachcode.com/2024/07/28/find-life-coach-soonjin-cho/'
  },
  'edith-moricz': {
    photo: 'assets/img/authors/edith-moricz.webp',
    inbox: 'edith.t.moriczrfc@gmail.com',
    linkedin: 'https://www.linkedin.com/in/edithmoricz/',
    profile: 'https://www.lifecoachcode.com/members/edith/'
  },
  'chuck-barnard': {
    photo: 'assets/img/authors/chuck-barnard.webp',
    inbox: 'charles.barnard@successinstitutes.co',
    website: 'https://coachchuck360.com/',
    linkedin: 'https://www.linkedin.com/in/chuck-barnard-6304b154/',
    profile: 'https://www.lifecoachcode.com/members/chuck-barnard/',
    bio: 'Author, speaker and Champion’s Mindset mentor for teens, families, athletes, homeschoolers and entrepreneurs, after 30 years in education. Chuck holds a master’s degree in special education and certifications in NLP and hypnotherapy.'
  },
  'sonia-jenkins': {
    photo: 'assets/img/authors/sonia-jenkins.webp',
    inbox: 'hello@soniajenkins.co.uk',
    website: 'https://soniajenkins.co.uk/',
    linkedin: 'https://www.linkedin.com/in/soniajenkinsfmchc/',
    profile: 'https://www.lifecoachcode.com/members/sonia-jenkins/',
    bio: 'A Certified Functional Medicine Health Coach in Wales, drawing on more than 45 years as an NHS health professional. Sonia works with high-achieving women over 40 on healthy ageing, stress and energy.'
  },
  'susan-j-razavi': {
    photo: 'assets/img/authors/susan-j-razavi.webp',
    inbox: 'susanjrazavi@gmail.com',
    website: 'https://tranceplan.com/',
    websiteByLCC: true,
    linkedin: 'https://www.linkedin.com/in/susan-j-razavi-lcsw-r-tranceplan-53188817/',
    profile: 'https://www.lifecoachcode.com/members/tranceplan/',
    bio: 'A veteran psychotherapist (LCSW-R) and clinical hypnotherapist in New York, with an integrative approach that bridges science, mindfulness and spirituality. Susan developed TrancePlan, a personalised approach to hypnotherapy.'
  },
  'tanya-fasnacht-jolliffe': {
    photo: 'assets/img/authors/tanya-fasnacht-jolliffe.webp',
    inbox: 'tanya@litwellnesssolutions.com',
    website: 'https://litwellnesssolutions.com/',
    websiteByLCC: true,
    linkedin: 'https://www.linkedin.com/in/tanya-fasnacht-jolliffe/',
    profile: 'https://www.lifecoachcode.com/members/tanya-fasnacht-jolliffe/',
    bio: 'A non-diet registered dietitian and the founder of L I T Wellness Solutions, offering non-diet nutrition care, wellness integration and health coaching under the motto “IGNITE the Change Within”.'
  },
  'jessica-v-fuentes': {
    photo: 'assets/img/authors/jessica-v-fuentes.webp',
    inbox: 'jessica.fuentes@empowered-selflove.com',
    website: 'https://empowered-selflove.com/',
    linkedin: 'https://www.linkedin.com/in/jessica-v-fuentes-cpc-03679a20/',
    profile: 'https://www.lifecoachcode.com/members/jessica-fuentes/'
  },
  'jennifer-a-schmeisser': {
    photo: 'assets/img/authors/jennifer-a-schmeisser.webp',
    inbox: 'jensmizer@yahoo.com',
    linkedin: 'https://www.linkedin.com/in/jenniferschmeisser7/',
    profile: 'https://www.lifecoachcode.com/members/jennifer-schmeisser/'
  },
  'monika-puiu': {
    photo: 'assets/img/authors/monika-puiu.webp',
    inbox: 'monika.puiu@wayra-astrae.ro',
    website: 'https://wayra-astrae.ro/',
    linkedin: 'https://www.linkedin.com/in/monika-maria-puiu/',
    profile: 'https://www.lifecoachcode.com/members/monika-maria/'
  },
  'beth-donovan': {
    photo: 'assets/img/authors/beth-donovan.webp',
    inbox: 'BethD101@comcast.net',
    linkedin: 'https://www.linkedin.com/in/beth-donovan-9663a7142/',
    profile: 'https://www.lifecoachcode.com/members/beth-donovan/'
  },
  'yevheniya-shalimova': {
    photo: 'assets/img/authors/yevheniya-shalimova.webp',
    bio: 'A globally recognised Executive Coach, credentialed PCC with the International Coaching Federation, and founder of The Shalimova Method®. Yevheniya draws on more than 2,300 coaching hours with leaders across 35 countries and advanced studies at Harvard, Yale and the Brain Academy, and is an Executive Contributor to Brainz Magazine.',
    inbox: 'evgenia7shalimova@gmail.com',
    website: 'https://theshalimovamethod.com/',
    websiteByLCC: true,
    linkedin: 'https://www.linkedin.com/in/yevheniya-shalimova/',
    profile: 'https://www.lifecoachcode.com/members/yevheniya-shalimova/'
  },
  'rachel-tamilio': {
    photo: 'assets/img/authors/rachel-tamilio.webp',
    inbox: 'rtamilio.unshackledcoach@gmail.com',
    linkedin: 'https://www.linkedin.com/in/rtamilio/',
    interview: 'https://www.lifecoachcode.com/2023/09/06/find-life-coach-rachel-tamilio/'
  },
  'bengu-davchevski': {
    photo: 'assets/img/authors/bengu-davchevski.webp',
    inbox: 'bengudavchevski@gmail.com',
    linkedin: 'https://www.linkedin.com/in/bengu-davchevski-713039203/',
    bio: 'Writes about rebuilding yourself in difficult times, drawing on famous fables and her own life experience.'
  },
  'dolores-fazzino': {
    photo: 'assets/img/authors/dolores-fazzino.webp',
    inbox: 'doloresfazzino@gmail.com',
    website: 'https://drdoloresfazzino.com/',
    linkedin: 'https://www.linkedin.com/in/doloresfazzino/',
    profile: 'https://www.lifecoachcode.com/members/dolores/',
    bio: 'A nurse practitioner (DNP) and medical intuitive with over 40 years of experience, combining energy healing and intuitive counselling with conventional medicine.'
  }
};

/* What each booth's themed piece shows (the guide describes it to visitors). */
window.FAIR_STANDS = {
  'finding-love-in-the-mirror': 'A gilded mirror with wings of fire rising behind it. Look into it and a winged silhouette looks back, the reflection from the cover brought to life.',
  'clarity-before-momentum': 'A signpost pointing to Clarity, Purpose and Momentum, at the start of a winding road that leads to a rising sun.',
  'teen-mental-health': 'Glowing app icons orbiting a bright young mind: the constant pull of screens that teenagers live with.',
  'the-invisible-midlife-woman': 'A little wooden dock reaching into a misty pond at sunrise: a quiet place to be seen again.',
  'conscious-integrative-therapy': 'A slowly turning Sri Yantra, an ancient pattern of sacred geometry, floating above a glowing lotus.',
  'more-than-a-game': 'A great brass compass whose four points read Character, Resilience, Effort and Joy.',
  'food-isnt-the-problem': 'Three stepping stones for the book’s 3-Step Path, Name it, Claim it and Reframe it, each with its symbol from the cover and a ribbon of light flowing back to the book.',
  'prince-and-the-prodigal': 'Two friends standing side by side, facing a sunset over the mountains, as on the cover.',
  'journey-to-empowerment': 'An open drawer with golden vines growing out of it: what we once tucked away can still bloom.',
  'when-the-blueprint-burned': 'A vintage typewriter, with blueprints drifting up from it as glowing embers.',
  'everything-happens-for-you': 'An hourglass of glowing sand: every grain falls for a reason.',
  'healing-unraveled': 'A golden birdcage with its door open and a radiant diamond inside.',
  'life-is-happening-now': 'A sunlit tree in a little park, a winding path of glowing footsteps leading to it, and a sign that says NOW.',
  'truly-yours-life': 'Three rings of light, Mind, Body and Spirit, drift apart and then come back into line as one glowing circle above a sparkling sea, while a letter signed “Truly yours, Life” floats overhead: resilience keeps us strong, coherence brings us home.',
  'curiously-certain': 'A little café table with two steaming cups of coffee, set for a friendly conversation.',
  'how-to-build-yourself-up': 'A broken wall whose stones climb into a staircase of light, rising towards a wing of colourful feathers: pain turned into a way up.'
};

/* =========================================================================
   The AI guide
   The guide always works on its own, answering from this file. Connect it to OpenAI for
   free-form conversation with the Virtual Book Fair plugin on lifecoachcode.com
   (wordpress/lcc-virtual-book-fair): on the site it connects by itself; for the GitHub Pages
   copy, paste its address below. The OpenAI key lives only in the plugin's settings on your
   WordPress site, never in this public code.
   ========================================================================= */
window.FAIR_GUIDE = {
  enabled: true,
  name: 'Your fair guide',
  // e.g. 'https://www.lifecoachcode.com/wp-json/lcc-fair/v1/guide'
  endpoint: ''
};

/* =========================================================================
   Messages to authors
   "Send a message" in an author's panel opens a new email in Gmail (or the visitor's own email
   app), addressed to the author and already begun. The visitor sends it from their own email,
   so the author simply replies.
   - inbox (per author, above): the author's email address. On lifecoachcode.com the addresses
     are set in Settings > Virtual Book Fair instead.
   - fallbackInbox: a Life Coach Code address for authors who have none of their own. Messages
     to those authors go there, to pass along.
   ========================================================================= */
window.FAIR_CONTACT = {
  enabled: true,
  fallbackInbox: ''
};

window.FAIR_AUTHORS = (() => {
  const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const map = new Map();
  window.FAIR_BOOKS.forEach((b) => {
    const id = slugify(b.author);
    if (!map.has(id)) map.set(id, { id, name: b.author, displayName: b.author, credentials: '', books: [] });
    const a = map.get(id);
    a.books.push(b.slug);
    if (b.credentials && !a.credentials) a.credentials = b.credentials;
    if (b.displayAuthor && /^(Dr\.|Prof\.)/.test(b.displayAuthor)) a.displayName = b.displayAuthor;
  });
  return [...map.values()].map((a) => {
    const out = { ...a, ...(window.FAIR_AUTHOR_EXTRAS[a.id] || {}) };
    if (out.photo) out.photo = window.FAIR_ASSET(out.photo);
    if (out.voice) out.voice = window.FAIR_ASSET(out.voice);
    return out;
  });
})();
