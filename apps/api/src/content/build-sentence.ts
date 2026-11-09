import { pick, shuffle } from './text-utils';

/**
 * "Build a Sentence" generator. A context statement is shown, and the learner
 * orders word chunks into one grammatical reply (some chunks may be fixed).
 * Items are original; template families multiply the hand-written pool.
 */
export interface BuildItem {
  context: string;
  /** Words/chunks of the target sentence, in order (first one capitalised). */
  words: string[];
  /** Indices (into `words`) that are shown fixed instead of movable. */
  fixed?: number[];
  end: '.' | '?';
}

export type LayoutPart = { fixed: string } | { slot: true };

export interface BuildSentenceQuestion {
  context: string;
  chunks: string[];
  layout: LayoutPart[];
  end: '.' | '?';
  /** Expected chunks for the slots, in order. */
  answer: string[];
  sentence: string;
}

const HAND_WRITTEN: BuildItem[] = [
  { context: 'I’m trying to register for a biology course.', words: ['Which', 'professor', 'is', 'teaching', 'the', 'class'], end: '?' },
  { context: 'The scholarship deadline is this Friday.', words: ['Have', 'you', 'submitted', 'the', 'application', 'form', 'yet'], end: '?' },
  { context: 'I’m new on campus and a bit lost.', words: ['Could', 'you', 'tell', 'me', 'where', 'the', 'registrar’s', 'office', 'is'], end: '?' },
  { context: 'Do you have any plans for the evening?', words: ['I’m', 'wondering', 'whether', 'the', 'lab', 'will', 'be', 'open', 'tonight'], fixed: [0], end: '.' },
  { context: 'Why is your friend calling so often?', words: ['She', 'asked', 'me', 'if', 'I', 'could', 'help', 'her', 'move'], end: '.' },
  { context: 'Why did you pay a fee at the library?', words: ['The', 'book', 'that', 'I', 'borrowed', 'was', 'overdue'], end: '.' },
  { context: 'What if the weather is bad on Saturday?', words: ['We', 'will', 'hold', 'the', 'meeting', 'indoors', 'if', 'it', 'rains'], end: '.' },
  { context: 'I just started a part-time job there too.', words: ['How', 'long', 'have', 'you', 'been', 'working', 'at', 'the', 'bookstore'], end: '?' },
  { context: 'I plan to stay at the library until closing.', words: ['What', 'time', 'does', 'the', 'last', 'shuttle', 'leave', 'tonight'], end: '?' },
  { context: 'Are you ready for next semester?', words: ['I', 'haven’t', 'decided', 'which', 'elective', 'to', 'take'], end: '.' },
  { context: 'Our group project is due on Monday.', words: ['Who', 'is', 'going', 'to', 'present', 'the', 'results'], end: '?' },
  { context: 'I love the color of your coat.', words: ['Where', 'did', 'you', 'buy', 'your', 'winter', 'jacket'], end: '?' },
  { context: 'I need to pick up some medicine.', words: ['Is', 'there', 'a', 'pharmacy', 'near', 'the', 'dormitory'], end: '?' },
  { context: 'Has the committee announced anything yet?', words: ['They', 'are', 'still', 'waiting', 'for', 'the', 'results', 'of', 'the', 'survey'], end: '.' },
  { context: 'I missed the lecture because I was sick.', words: ['Would', 'you', 'mind', 'sending', 'me', 'the', 'notes', 'from', 'yesterday'], end: '?' },
  { context: 'When can we visit the museum?', words: ['The', 'museum', 'opens', 'at', 'nine', 'on', 'weekdays'], end: '.' },
  { context: 'I heard there was a change in plans.', words: ['Why', 'was', 'the', 'concert', 'moved', 'to', 'another', 'hall'], end: '?' },
  { context: 'What did your brother ask you?', words: ['He', 'wants', 'to', 'know', 'how', 'much', 'the', 'tickets', 'cost'], end: '.' },
  { context: 'I have a conflict on Thursday.', words: ['Can', 'we', 'reschedule', 'our', 'appointment', 'for', 'next', 'week'], end: '?' },
  { context: 'Was the Wi-Fi outage a big problem?', words: ['It', 'took', 'them', 'three', 'hours', 'to', 'fix', 'the', 'network'], end: '.' },
  { context: 'The results were posted online.', words: ['Do', 'you', 'know', 'who', 'won', 'the', 'debate', 'competition'], end: '?' },
  { context: 'The game starts at seven.', words: ['We', 'should', 'leave', 'early', 'to', 'avoid', 'the', 'traffic'], end: '.' },
  { context: 'Our last semester is almost over.', words: ['What', 'are', 'you', 'planning', 'to', 'do', 'after', 'graduation'], end: '?' },
  { context: 'Are you thinking of joining the campus tour?', words: ['I', 'would', 'like', 'to', 'find', 'out', 'if', 'the', 'tour', 'is', 'free'], end: '.' },
  { context: 'I can’t find my notes.', words: ['Has', 'anyone', 'seen', 'my', 'blue', 'notebook'], end: '?' },
  { context: 'What did the instructor say about the quiz?', words: ['The', 'students', 'who', 'finish', 'early', 'may', 'leave'], end: '.' },
  { context: 'I’m going to my grandparents’ house this weekend.', words: ['How', 'often', 'do', 'you', 'visit', 'your', 'grandparents'], end: '?' },
  { context: 'How long has Maria studied Spanish?', words: ['She', 'has', 'been', 'studying', 'Spanish', 'since', 'last', 'year'], end: '.' },
  { context: 'I need to catch a flight on Sunday.', words: ['Which', 'bus', 'goes', 'to', 'the', 'airport'], end: '?' },
  { context: 'I’m heading to the store.', words: ['Please', 'let', 'me', 'know', 'if', 'you', 'need', 'anything'], end: '.' },
];

// Template families: {pp} past participle, {obj}, etc.
const PERFECT_PAIRS: Array<[string, string[], string]> = [
  ['The report is due tomorrow morning.', ['Have', 'you', 'finished', 'writing', 'it', 'yet'], '?'],
  ['I’m flying home for the holidays.', ['Did', 'you', 'book', 'your', 'ticket', 'yet'], '?'],
  ['Our professor wants everyone to pick a topic.', ['Have', 'you', 'decided', 'on', 'one', 'yet'], '?'],
  ['The course starts on Monday.', ['Have', 'you', 'bought', 'the', 'textbook', 'yet'], '?'],
  ['Registration closes tonight.', ['Have', 'you', 'chosen', 'your', 'classes', 'yet'], '?'],
  ['The interview is next Tuesday.', ['Have', 'you', 'practiced', 'your', 'answers', 'yet'], '?'],
];

const WH_PAIRS: Array<[string, string, string[], string]> = [
  ['I’m thinking about getting a hobby.', 'What', ['kind', 'of', 'hobby', 'are', 'you', 'considering'], '?'],
  ['I want to join a club this term.', 'Which', ['club', 'are', 'you', 'most', 'interested', 'in'], '?'],
  ['I’m planning a surprise party.', 'When', ['is', 'her', 'birthday', 'this', 'year'], '?'],
  ['I’ve started a new fitness routine.', 'How', ['many', 'days', 'a', 'week', 'do', 'you', 'exercise'], '?'],
  ['My phone stopped working yesterday.', 'Where', ['did', 'you', 'get', 'it', 'repaired'], '?'],
  ['We need a place for the study group.', 'Where', ['can', 'we', 'find', 'a', 'quiet', 'room'], '?'],
];

function familyItems(): BuildItem[] {
  const out: BuildItem[] = [];
  for (const [context, words, end] of PERFECT_PAIRS) {
    out.push({ context, words, end: end as '.' | '?' });
  }
  for (const [context, first, rest, end] of WH_PAIRS) {
    out.push({ context, words: [first, ...rest], end: end as '.' | '?' });
  }
  return out;
}

export const BUILD_SENTENCE_POOL: BuildItem[] = [...HAND_WRITTEN, ...familyItems()];

const lowerFirst = (w: string, isFirst: boolean, keepAsIs: boolean): string =>
  isFirst && !keepAsIs && w !== 'I' && !w.startsWith('I’') ? w.charAt(0).toLowerCase() + w.slice(1) : w;

/** Turn an item into a playable question (shuffled chunks + layout). */
export function toQuestion(item: BuildItem, rand: () => number): BuildSentenceQuestion {
  const fixedSet = new Set(item.fixed ?? []);
  // Occasionally pin one interior word, as in the real task.
  if (fixedSet.size === 0 && item.words.length >= 7 && rand() < 0.3) {
    fixedSet.add(1 + Math.floor(rand() * (item.words.length - 2)));
  }
  const layout: LayoutPart[] = [];
  const answer: string[] = [];
  item.words.forEach((w, i) => {
    if (fixedSet.has(i)) layout.push({ fixed: w });
    else {
      layout.push({ slot: true });
      // Only the sentence-initial word is lower-cased (except "I"); proper nouns elsewhere stay.
      answer.push(i === 0 ? lowerFirst(w, true, false) : w);
    }
  });
  let chunks = shuffle(answer, rand);
  let guard = 0;
  while (chunks.join('|') === answer.join('|') && guard++ < 10) chunks = shuffle(answer, rand);
  return {
    context: item.context,
    chunks,
    layout,
    end: item.end,
    answer,
    sentence: item.words.join(' ') + item.end,
  };
}

/** Pick `count` distinct items (avoiding contexts seen before). */
export function generateBuildSentenceSet(
  count: number,
  rand: () => number,
  avoidContexts: string[] = [],
): BuildSentenceQuestion[] {
  const avoid = new Set(avoidContexts);
  let pool = shuffle(BUILD_SENTENCE_POOL, rand).filter((i) => !avoid.has(i.context));
  if (pool.length < count) pool = shuffle(BUILD_SENTENCE_POOL, rand);
  // Mix of questions and statements, like the real task.
  return pool.slice(0, count).map((it) => toQuestion(it, rand));
}

/** Validate an LLM-produced item: chunks must reassemble the sentence. */
export function validateBuildItem(q: {
  chunks: string[];
  answer: string[];
  layout: LayoutPart[];
}): string[] {
  const problems: string[] = [];
  const slots = q.layout.filter((p) => 'slot' in p).length;
  if (slots !== q.answer.length) problems.push('slots do not match answer length');
  if (slots < 4) problems.push('too few movable chunks');
  const a = [...q.answer].map((x) => x.toLowerCase()).sort().join('|');
  const c = [...q.chunks].map((x) => x.toLowerCase()).sort().join('|');
  if (a !== c) problems.push('chunks are not a permutation of the answer');
  return problems;
}

/** Ordered, case-insensitive comparison. */
export function checkBuildSentence(response: unknown, answer: unknown): boolean {
  if (!Array.isArray(response) || !Array.isArray(answer)) return false;
  if (response.length !== answer.length) return false;
  const n = (v: unknown) => String(v ?? '').trim().toLowerCase();
  return response.every((r, i) => n(r) === n(answer[i]));
}

export function samplePool(rand: () => number): BuildItem {
  return pick(BUILD_SENTENCE_POOL, rand);
}
