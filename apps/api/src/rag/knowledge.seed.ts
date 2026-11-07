/**
 * Knowledge base for the evaluation RAG.
 *
 * ALL text below is original: rubric descriptors are written against the public,
 * general idea of 0–5 holistic scoring and CEFR-style descriptors, and the anchor
 * responses were authored for this project. No ETS scoring material is reproduced.
 */
export interface KnowledgeSeed {
  key: string;
  kind: 'rubric' | 'anchor' | 'guideline';
  taskType: string; // WRITE_EMAIL | ACADEMIC_DISCUSSION | INTERVIEW | LISTEN_REPEAT | GENERAL
  section: 'READING' | 'LISTENING' | 'SPEAKING' | 'WRITING' | null;
  title: string;
  tags: string[];
  content: string;
}

const SCALE =
  '5 = fully successful, 4 = generally successful with minor lapses, 3 = partially successful, 2 = limited, 1 = very limited, 0 = no response or off-task.';

export const KNOWLEDGE_SEED: KnowledgeSeed[] = [
  // ───────────────────────── General guidelines ─────────────────────────
  {
    key: 'g-scale', kind: 'guideline', taskType: 'GENERAL', section: null,
    title: 'Holistic 0–5 scale used by this platform', tags: ['scale', 'consistency'],
    content: `Every productive response is scored per dimension on a 0–5 scale in steps of 0.5. ${SCALE} Score what is on the page, not what the writer probably meant. A response cannot score above 3 on a dimension if the evidence for that dimension is too short to judge. Use the full range: reserve 5 for responses with no meaningful weakness in that dimension, and 0 only for empty or completely irrelevant responses.`,
  },
  {
    key: 'g-errors', kind: 'guideline', taskType: 'GENERAL', section: null,
    title: 'Error taxonomy for feedback', tags: ['errors', 'grammar', 'feedback'],
    content: 'Classify each error with one label: article, preposition, subject-verb agreement, verb tense, verb form, word order, plural/countable, run-on or comma splice, fragment, word choice, collocation, register (too informal or too stiff), spelling, punctuation, or missing/unclear reference. For every error give the exact original text, a corrected version, and a one-sentence reason. Prioritise errors that change meaning or occur repeatedly over isolated slips. Do not mark stylistic preferences as errors.',
  },
  {
    key: 'g-feedback', kind: 'guideline', taskType: 'GENERAL', section: null,
    title: 'How to write actionable feedback', tags: ['feedback', 'consistency'],
    content: 'Feedback must be specific and actionable. State (1) what the response did well with a short quote, (2) the top two or three improvements ordered by impact on the score, each with a concrete next step the learner can practise (for example "add one concrete example after each reason" rather than "develop ideas more"), and (3) a justification that links the scores to the rubric wording. Never invent errors; every correction must quote text that appears in the response.',
  },
  {
    key: 'g-pace', kind: 'guideline', taskType: 'INTERVIEW', section: 'SPEAKING',
    title: 'Speech-rate and pause norms', tags: ['speaking', 'fluency', 'pace', 'pauses'],
    content: 'Comfortable, intelligible academic speech by non-native speakers usually falls between about 110 and 170 words per minute. Below about 90 words per minute the delivery sounds hesitant; above about 190 it can reduce clarity. Natural speech contains short pauses (under about 0.5 seconds) at phrase boundaries. Pauses of 1.5 seconds or more inside an answer, repeated several times, signal planning difficulty. Silences of 3 seconds or more break continuity. Filler sounds such as "um" or "uh" are normal in small numbers (one or two per minute) and become distracting when frequent. Fluency, pace, and clarity values are computed from the audio and transcript by code; the rater must not re-estimate them.',
  },

  // ───────────────────────── Write an Email ─────────────────────────
  {
    key: 'r-email-task', kind: 'rubric', taskType: 'WRITE_EMAIL', section: 'WRITING',
    title: 'Email — task fulfillment', tags: ['email', 'task_fulfillment'],
    content: `Dimension task_fulfillment. ${SCALE} 5: addresses every bullet in the prompt with specific, relevant details; tone and purpose fit the recipient and situation; includes a clear opening and closing. 4: addresses all bullets, but one is thin or slightly generic. 3: addresses most bullets, or addresses all of them only superficially; purpose is understandable. 2: omits a bullet or two or drifts from the situation; reader would need to ask follow-up questions. 1: barely relates to the prompt. 0: blank or unrelated.`,
  },
  {
    key: 'r-email-org', kind: 'rubric', taskType: 'WRITE_EMAIL', section: 'WRITING',
    title: 'Email — organization and coherence', tags: ['email', 'organization_coherence'],
    content: `Dimension organization_coherence. ${SCALE} 5: logical order (greeting, purpose, details, request or suggestion, closing); each paragraph has one job; transitions make relationships clear. 4: clear overall order with an occasional abrupt shift. 3: order is mostly followable but ideas are mixed within paragraphs or transitions are mechanical. 2: ideas appear in a confusing order; little signposting. 1: disconnected sentences. 0: no organization to evaluate.`,
  },
  {
    key: 'r-email-gram', kind: 'rubric', taskType: 'WRITE_EMAIL', section: 'WRITING',
    title: 'Email — grammar accuracy', tags: ['email', 'grammar_accuracy'],
    content: `Dimension grammar_accuracy. ${SCALE} 5: a range of structures with essentially no errors. 4: occasional minor errors that never obscure meaning. 3: noticeable errors (articles, agreement, tense) but meaning is clear most of the time. 2: frequent errors that sometimes obscure meaning; mostly simple sentences. 1: errors in nearly every sentence; meaning often unclear. 0: no sentences that can be evaluated.`,
  },
  {
    key: 'r-email-vocab', kind: 'rubric', taskType: 'WRITE_EMAIL', section: 'WRITING',
    title: 'Email — vocabulary and register', tags: ['email', 'vocabulary_register'],
    content: `Dimension vocabulary_register. ${SCALE} 5: precise, natural word choice; polite, professional register throughout; effective collocations. 4: generally precise with an occasional imprecise or repetitive word; register is appropriate. 3: adequate but repetitive or general vocabulary; some register slips (too casual or too stiff). 2: limited vocabulary causing vagueness; inappropriate register is common. 1: very basic vocabulary; frequent wrong words. 0: nothing to evaluate.`,
  },

  // ───────────────────── Write for an Academic Discussion ─────────────────────
  {
    key: 'r-disc-contrib', kind: 'rubric', taskType: 'ACADEMIC_DISCUSSION', section: 'WRITING',
    title: 'Discussion — contribution to the discussion', tags: ['discussion', 'contribution_to_discussion'],
    content: `Dimension contribution_to_discussion. ${SCALE} 5: states a clear position that answers the professor's question and engages with at least one classmate's idea (agreeing, extending, or respectfully disagreeing) in the writer's own words. 4: clear position with brief engagement with classmates. 3: clear position but classmates are ignored or merely repeated. 2: position is vague or only partly answers the question. 1: restates the question. 0: off-topic or blank.`,
  },
  {
    key: 'r-disc-dev', kind: 'rubric', taskType: 'ACADEMIC_DISCUSSION', section: 'WRITING',
    title: 'Discussion — development and support', tags: ['discussion', 'development_support'],
    content: `Dimension development_support. ${SCALE} 5: at least two well-developed reasons, each supported by a specific example, explanation, or consequence. 4: reasons are well explained; examples are somewhat general. 3: reasons are stated but explained thinly; examples missing. 2: one weak reason or unsupported claims. 1: only assertions. 0: nothing to evaluate. Length matters only because short responses (under about 100 words) cannot develop ideas fully.`,
  },
  {
    key: 'r-disc-coh', kind: 'rubric', taskType: 'ACADEMIC_DISCUSSION', section: 'WRITING',
    title: 'Discussion — coherence and cohesion', tags: ['discussion', 'coherence_cohesion'],
    content: `Dimension coherence_cohesion. ${SCALE} 5: ideas progress logically; reference words and transitions (however, for instance, as a result) are used accurately and naturally. 4: progression is clear; a few transitions are mechanical or missing. 3: understandable order, but cohesion relies on simple connectors ("and", "also") or repetition. 2: ideas are hard to follow; unclear pronoun reference. 1: sentences feel unrelated. 0: nothing to evaluate.`,
  },
  {
    key: 'r-disc-lang', kind: 'rubric', taskType: 'ACADEMIC_DISCUSSION', section: 'WRITING',
    title: 'Discussion — language use (grammar and vocabulary)', tags: ['discussion', 'language_use'],
    content: `Dimension language_use. ${SCALE} 5: varied, accurate sentence structures and precise academic vocabulary; errors are rare and minor. 4: good range; occasional errors that do not impede meaning. 3: adequate range; errors in articles, agreement, or word choice are noticeable but meaning is clear. 2: limited range; frequent errors sometimes obscure meaning. 1: very limited control. 0: nothing to evaluate.`,
  },

  // ─────────────────────────── Interview (speaking) ───────────────────────────
  {
    key: 'r-int-gram', kind: 'rubric', taskType: 'INTERVIEW', section: 'SPEAKING',
    title: 'Interview — grammar', tags: ['interview', 'grammar'],
    content: `Rater dimension grammar (judge from the transcript only). ${SCALE} 5: accurate and varied structures; errors are rare. 4: minor errors that never obscure meaning. 3: visible errors (tense, agreement, articles) but meaning is clear. 2: frequent errors; mostly simple sentences; meaning sometimes unclear. 1: fragmentary language. Spoken transcripts have unreliable punctuation and may omit fillers; do not penalise missing punctuation or capitalisation.`,
  },
  {
    key: 'r-int-vocab', kind: 'rubric', taskType: 'INTERVIEW', section: 'SPEAKING',
    title: 'Interview — vocabulary', tags: ['interview', 'vocabulary'],
    content: `Rater dimension vocabulary (judge from the transcript only). ${SCALE} 5: precise, flexible word choice with natural collocations and some less common words. 4: wide enough vocabulary with occasional imprecision. 3: adequate but repetitive or general ("good", "thing"). 2: limited vocabulary that causes vagueness or circumlocution. 1: very basic words only.`,
  },
  {
    key: 'r-int-dev', kind: 'rubric', taskType: 'INTERVIEW', section: 'SPEAKING',
    title: 'Interview — topic development and idea development', tags: ['interview', 'topic_development', 'development'],
    content: `Rater dimension topic_development. ${SCALE} 5: fully answers every part of the question with a clear point, reasons, and a concrete example or detail. 4: answers the question with relevant reasons; example somewhat general. 3: answers but ideas are thin or repeated; limited detail. 2: partial answer, mostly general statements. 1: little relevant content. 0: no response. A response that stops far before the time allowed usually cannot reach 4 or 5.`,
  },
  {
    key: 'r-int-coh', kind: 'rubric', taskType: 'INTERVIEW', section: 'SPEAKING',
    title: 'Interview — coherence', tags: ['interview', 'coherence'],
    content: `Rater dimension coherence. ${SCALE} 5: ideas are sequenced logically with clear connectors ("first", "because", "for example", "on the other hand"). 4: easy to follow with occasional loose connections. 3: mostly followable but ideas jump or connectors are limited to "and/so". 2: hard to follow; ideas listed without relationships. 1: disconnected words or phrases.`,
  },
  {
    key: 'r-repeat', kind: 'rubric', taskType: 'LISTEN_REPEAT', section: 'SPEAKING',
    title: 'Listen and Repeat — accuracy mapping', tags: ['listen_repeat', 'accuracy', 'pronunciation'],
    content: 'Listen and Repeat is scored by comparing the recognised repetition with the target sentence word by word. Word accuracy of 95% or more earns 5; 85–94% earns 4; 70–84% earns 3; 50–69% earns 2; 25–49% earns 1; below 25% or no response earns 0. Because recognition is automatic, this is a proxy for intelligibility, not a phoneme-level pronunciation measurement. Missing words, substituted words, and extra words are all reported to the learner.',
  },

  // ─────────────────────────────── Anchors ───────────────────────────────
  {
    key: 'a-email-5', kind: 'anchor', taskType: 'WRITE_EMAIL', section: 'WRITING',
    title: 'Email anchor — score 5', tags: ['anchor', 'email', 'score-5'],
    content: 'Prompt summary: you used a vendor a coworker recommended; guests were unhappy; explain, describe reactions, suggest next time. SCORE 5 (all dimensions 4.5–5). Response: "Hi Dana, Thank you again for recommending Greenleaf Catering. Unfortunately, the event did not go as we had hoped. The food arrived forty minutes late, and several dishes were already cold, so we had to delay the opening toast. Many guests were polite about it, but a few told me they were disappointed, and two colleagues left before dessert. For the next event, I would suggest comparing two or three caterers and asking each for references from similar-sized events. We could also request a tasting beforehand. I would be glad to help you collect quotes next week if that is useful. Best regards, Sam"',
  },
  {
    key: 'a-email-3', kind: 'anchor', taskType: 'WRITE_EMAIL', section: 'WRITING',
    title: 'Email anchor — score 3', tags: ['anchor', 'email', 'score-3'],
    content: 'Prompt summary: same catering scenario. SCORE 3 (task 3, organization 3, grammar 3, vocabulary 3). Response: "Hi Dana, I want to tell you about the catering. It was not very good. The food come late and it was cold. People was not happy about this. Next time maybe we can use other company. Thanks, Sam" — Addresses all three bullets but each in one thin sentence; recurring agreement and tense errors; repetitive vocabulary ("not good", "not happy"); no detail on reactions or the alternative.',
  },
  {
    key: 'a-email-1', kind: 'anchor', taskType: 'WRITE_EMAIL', section: 'WRITING',
    title: 'Email anchor — score 1', tags: ['anchor', 'email', 'score-1'],
    content: 'Prompt summary: same catering scenario. SCORE 1. Response: "Dana the food bad. We eat late. Other place." — Only fragments; two of three bullets are barely touched; no greeting or closing; meaning must be guessed.',
  },
  {
    key: 'a-disc-5', kind: 'anchor', taskType: 'ACADEMIC_DISCUSSION', section: 'WRITING',
    title: 'Discussion anchor — score 5', tags: ['anchor', 'discussion', 'score-5'],
    content: 'Prompt summary: should cities invest more in public transit or roads; Claire favors transit, Marcus favors roads. SCORE 5. Response: "I agree with Claire that public transportation is the stronger long-term investment, but Marcus raises a fair point about people who live far from the center. The main advantage of transit is efficiency: one train line can move as many commuters as several highway lanes while using far less space. In my hometown, the new tram reduced downtown traffic noticeably, which made the streets safer for cyclists and pedestrians. Roads still matter, of course, but I would argue that cities should expand bus routes first, because they improve access for residents without cars and cost less than building new highways. In the long run, this approach supports both the economy and the environment."',
  },
  {
    key: 'a-disc-3', kind: 'anchor', taskType: 'ACADEMIC_DISCUSSION', section: 'WRITING',
    title: 'Discussion anchor — score 3', tags: ['anchor', 'discussion', 'score-3'],
    content: 'Prompt summary: same transit-versus-roads discussion. SCORE 3 (contribution 3, development 3, coherence 3, language 3). Response: "I think public transportation is better. It is good for the environment and many people can use it. Also it is cheaper than roads. Roads are expensive and they make more cars. So city should spend more money for public transportation." — Clear position, but reasons are generic and unexplained, no example, classmates not mentioned, simple connectors, article and agreement errors.',
  },
  {
    key: 'a-disc-1', kind: 'anchor', taskType: 'ACADEMIC_DISCUSSION', section: 'WRITING',
    title: 'Discussion anchor — score 1', tags: ['anchor', 'discussion', 'score-1'],
    content: 'Prompt summary: same discussion. SCORE 1. Response: "Transport is important for city. Roads and train. I like." — No developed position; one fragment-level idea; response is far too short to show development or cohesion.',
  },
  {
    key: 'a-int-4', kind: 'anchor', taskType: 'INTERVIEW', section: 'SPEAKING',
    title: 'Interview anchor — score 4', tags: ['anchor', 'interview', 'score-4'],
    content: 'Question: "Do you prefer to study alone or with other people? Why?" SCORE 4 (grammar 4, vocabulary 4, topic_development 4, coherence 4). Transcript: "I usually prefer studying alone, mainly because I can concentrate better. When I study with friends, we often start talking about other things, so I lose time. For example, last semester I prepared for my chemistry exam by myself in the library, and I finished all the chapters a week early. That said, I sometimes join a group when I do not understand a topic, because explaining ideas to others helps me remember them." — Clear answer, two reasons, a concrete example, a balanced qualification; small slips only.',
  },
  {
    key: 'a-int-2', kind: 'anchor', taskType: 'INTERVIEW', section: 'SPEAKING',
    title: 'Interview anchor — score 2', tags: ['anchor', 'interview', 'score-2'],
    content: 'Question: same. SCORE 2 (grammar 2, vocabulary 2, topic_development 2, coherence 2). Transcript: "I like study alone. Because is more quiet. With friend is not good, I do not study. Alone is good." — Answer is understandable but extremely brief, repeats the same idea, no example, frequent grammar errors, limited vocabulary.',
  },
];
