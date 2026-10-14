/**
 * guideFaq — the Genie guide's pre-written questions and answers.
 *
 * The Genie is a how-to-use-the-app guide only: a fixed menu of questions,
 * each with a fixed answer. It never takes free text, never calls a server
 * and never says anything about a person's chart, question or verdict —
 * judgment belongs to the RKP engine through the Oracle alone.
 *
 * Every answer describes the app as it is built. When a screen or flow
 * changes, update the answer here in the same change.
 *
 * English only for now; Urdu and Hindi need the owner's translation (the
 * guide shows English in every language until then).
 */

export interface GuideEntry {
  id: string;
  question: string;
  answer: string;
}

export const GUIDE_GREETING =
  'Peace be upon you. I am the Genie of Shams al-Asrār. I can show you how to use this app — choose a question below.';

export const GUIDE_SCOPE_NOTE =
  'I only explain how the app works. For a reading about your own question, tap the golden mandala on Home and ask the Oracle.';

export const GUIDE_ENTRIES: readonly GuideEntry[] = [
  {
    id: 'ask',
    question: 'How do I ask the Oracle a question?',
    answer:
      'Tap the golden mandala in the middle of Home. A new Reading opens: type your question in the box at the bottom and send it. The Oracle reads the sky at that moment and gives its verdict in the same conversation.',
  },
  {
    id: 'voice',
    question: 'Can I ask by voice?',
    answer:
      'Yes. In a Reading, tap the microphone in the question box and speak. Your words become text and are sent to the Oracle exactly like a typed question — the verdict is the same either way.',
  },
  {
    id: 'readings',
    question: 'Where are my past readings?',
    answer:
      'Tap the ≡ menu at the top of Home and choose Readings. Every Reading you have started is listed there; tap one to open the full conversation again.',
  },
  {
    id: 'tiles',
    question: 'What do the tiles on Home mean?',
    answer:
      "The six tiles are today's sky at a glance: Current Hora, Today's Sky for You, Moon Manzil, Favored Now, Daily Dhikr and Today's Blessing. Tap any tile to read its full text; tap Close to return.",
  },
  {
    id: 'times',
    question: 'What are Sunrise, Current Hora and Sunset at the top?',
    answer:
      "Sunrise and Sunset are today's times for your location. Current Hora shows how long the present planetary hour has left; the Current Hora tile names its planet.",
  },
  {
    id: 'alfalak',
    question: 'What is Al-Falak?',
    answer:
      'Al-Falak is the live sky clock: the current hora and day, the Moon’s sign and phase, and a table of the planets’ positions. Open it from the ≡ menu on Home. It is for viewing the sky only — verdicts come from the Oracle.',
  },
  {
    id: 'wait',
    question: 'Why does Home sometimes say the Oracle prefers to wait?',
    answer:
      'When the Moon is void of course, Home shows a short notice with the time it ends. The Oracle prefers a fresh question after that time.',
  },
  {
    id: 'quota',
    question: 'How many questions can I ask?',
    answer:
      'The line at the bottom of Home shows your plan and what you can ask right now — your free question, when the next one comes, or what is left today. Premium (₹299 a month) gives unlimited questions, with a fair-use limit of 10 a day.',
  },
  {
    id: 'coins',
    question: 'What are the gold coins?',
    answer:
      'Coins pay for what goes beyond your plan: 1 coin = ₹10. After a verdict you can discuss your reading with the Oracle; that conversation is charged by length, like ChatGPT — 1 coin per 10,000 tokens, so a typical reply costs less than 1 coin. On the free plan, an extra question beyond the free one costs 3 coins. Tap the gold coin at the top of Home to see your balance and buy coin packs through Google Play: 10, 30 or 100 coins.',
  },
  {
    id: 'location',
    question: 'Why does the app need my location?',
    answer:
      'Sunrise, sunset, the planetary hours and the sky the Oracle reads all depend on where you are. Your coordinates are shown under the app name at the top of Home.',
  },
  {
    id: 'settings',
    question: 'How do I change language, theme or my plan?',
    answer:
      'Tap the ≡ menu at the top of Home and choose Settings. Language and theme are there, along with your plan and account.',
  },
];
