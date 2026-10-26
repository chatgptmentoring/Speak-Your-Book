/*
 * The books at the fair: the single place to edit titles, copy and links.
 *
 * Adding a book: put its covers in assets/img/covers as <slug>-480.webp, <slug>-800.webp,
 * <slug>-full.webp and <slug>-glow.webp (see README), then add an entry below.
 * A book that is not out yet: set status: 'coming-soon' and amazon: null. Its booth then
 * shows a "Coming soon" ribbon and a discovery-call invitation instead of a buy button.
 */
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

/* Intentions for the Book Oracle. The Oracle draws one book from the matching set. */
window.FAIR_INTENTS = [
  { label: 'Peace after heartbreak or loss', books: ['finding-love-in-the-mirror', 'everything-happens-for-you'] },
  { label: 'To come home to myself', books: ['journey-to-empowerment', 'the-invisible-midlife-woman'] },
  { label: 'A clear next chapter', books: ['clarity-before-momentum', 'everything-happens-for-you'] },
  { label: 'Healing for mind, body & spirit', books: ['conscious-integrative-therapy', 'food-isnt-the-problem', 'healing-unraveled'] },
  { label: 'Raising strong, happy kids', books: ['more-than-a-game', 'teen-mental-health', 'when-the-blueprint-burned'] },
  { label: 'A story to get lost in', books: ['prince-and-the-prodigal', 'when-the-blueprint-burned', 'finding-love-in-the-mirror'] }
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
