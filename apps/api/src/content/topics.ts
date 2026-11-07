import { pick, shuffle } from './text-utils';

/**
 * Topic taxonomy. Combined with LLM generation, open-license grounding and
 * per-user "seen" memory, this makes the number of distinct exams effectively
 * unbounded (fields × subtopics × genres × scenarios × difficulty × variation).
 */
export const ACADEMIC_TOPICS: Record<string, string[]> = {
  'Biology': ['bioluminescence in the deep sea', 'how coral reefs form', 'mycorrhizal fungi and forests', 'animal migration and navigation', 'the role of keystone species', 'how vaccines train the immune system', 'photosynthesis in extreme environments', 'symbiosis between ants and plants', 'the evolution of flight in insects', 'seed dispersal strategies', 'hibernation and torpor', 'the gut microbiome'],
  'Earth Science': ['formation of sedimentary rock', 'how glaciers shape valleys', 'the causes of El Niño', 'volcanic island chains', 'the water cycle in arid regions', 'soil formation', 'plate tectonics and earthquakes', 'how caves form', 'ocean currents and climate', 'the Ice Ages', 'desertification', 'tsunami warning systems'],
  'Astronomy and Physics': ['the life cycle of stars', 'dark matter', 'how telescopes reveal exoplanets', 'tides and the Moon', 'superconductivity', 'the physics of sound in concert halls', 'how GPS corrects for relativity', 'solar wind and auroras', 'friction and everyday engineering', 'the discovery of cosmic background radiation', 'thermal expansion in bridges', 'how lasers work'],
  'Chemistry and Materials': ['biomimetic materials', 'how batteries store energy', 'the chemistry of fermentation', 'corrosion and its prevention', 'bioplastics', 'catalysts in industry', 'how soap cleans', 'ceramics in ancient cultures', 'recycling of metals', 'self-healing concrete'],
  'Environmental Science': ['the carbon cycle', 'urban heat islands', 'wetland restoration', 'ocean plastic pollution', 'rewilding projects', 'sustainable fisheries', 'renewable energy storage', 'invasive species', 'green roofs and urban planning', 'air quality monitoring', 'water conservation in agriculture', 'permafrost thaw'],
  'Psychology': ['how memory is consolidated', 'the placebo effect', 'sleep and learning', 'attention and multitasking', 'child language acquisition', 'the bystander effect', 'habit formation', 'decision making under uncertainty', 'color perception', 'motivation and rewards', 'the spacing effect in study', 'emotion and facial expression'],
  'Sociology and Anthropology': ['the spread of early agriculture', 'social integration through sports', 'urbanization and community', 'gift economies', 'oral traditions and storytelling', 'migration and cultural exchange', 'the sociology of fashion', 'rituals and group identity', 'how languages die out', 'the origins of money', 'family structures across cultures', 'public markets as social spaces'],
  'History': ['the printing press and literacy', 'the Silk Road trade networks', 'ancient Roman engineering', 'the Industrial Revolution in textiles', 'the history of cartography', 'medieval universities', 'the invention of the telegraph', 'early public libraries', 'the Columbian Exchange', 'archaeology of Pompeii', 'the rise of canals', 'the history of public health'],
  'Art and Architecture': ['Renaissance perspective', 'Impressionism and photography', 'Gothic cathedral engineering', 'the Bauhaus movement', 'Japanese woodblock prints', 'mural traditions in Mexico', 'sustainable architecture', 'the history of the symphony orchestra', 'jazz and improvisation', 'pottery traditions', 'the invention of oil paint', 'urban street art'],
  'Economics and Business': ['supply and demand in local markets', 'the sunk cost fallacy', 'microfinance', 'economies of scale', 'the gig economy', 'branding and consumer trust', 'the history of banking', 'comparative advantage', 'cooperative businesses', 'inflation and everyday prices', 'supply chain resilience', 'the economics of public goods'],
  'Technology and Engineering': ['how bridges carry loads', 'the history of the bicycle', 'machine translation', 'desalination technology', 'smart grids', 'biomimicry in design', 'the development of the lithium battery', 'robotics in agriculture', 'earthquake-resistant buildings', 'how search engines rank pages', 'wind turbine design', 'the evolution of the elevator'],
  'Health and Medicine': ['the human microbiome', 'antibiotic resistance', 'how sleep affects health', 'the history of anesthesia', 'nutrition and the brain', 'public health campaigns', 'the physiology of altitude', 'telemedicine', 'how the heart regulates itself', 'the science of vaccines', 'ergonomics and posture', 'epidemiology and disease mapping'],
  'Linguistics and Education': ['how children learn to read', 'bilingualism and the brain', 'the origin of writing systems', 'language change over time', 'peer tutoring', 'project-based learning', 'the history of dictionaries', 'translation challenges', 'education technology', 'sign languages', 'how accents develop', 'the testing effect'],
};

export const DAILY_LIFE_GENRES = ['email', 'notice', 'flyer', 'text_chain', 'schedule', 'announcement_post'] as const;

export const DAILY_LIFE_SCENARIOS = [
  'a landlord announcing maintenance work', 'a library changing its hours during exams', 'a manager rescheduling a team meeting',
  'a gym posting a new class schedule', 'a university office confirming a course registration', 'a restaurant offering a catering menu',
  'a bookstore announcing a sale', 'a campus bus route being changed', 'an airline notifying a gate change', 'a clinic confirming an appointment',
  'a city office announcing a recycling schedule', 'a coworker asking to swap shifts', 'a club inviting members to a workshop',
  'a professor announcing an office-hours change', 'a delivery company reporting a delay', 'a dorm announcing quiet hours',
  'an IT department asking users to update passwords', 'a museum advertising a new exhibition', 'a language school offering evening courses',
  'a community center organizing a volunteer day',
];

export const CONVERSATION_SCENARIOS = [
  'a student asking an advisor about changing majors', 'two students planning a group presentation', 'a student asking a librarian for help finding sources',
  'a student visiting the campus IT desk with a laptop problem', 'two roommates sorting out chores', 'a student asking a professor for an extension',
  'a student asking about a scholarship deadline', 'two friends deciding where to study', 'a student reporting a billing error at the bursar’s office',
  'a student booking a lab slot', 'two classmates comparing lecture notes', 'a student asking about parking permits',
  'a student and a coworker swapping shifts at the bookstore', 'a student asking the housing office about a room change',
  'two students discussing an internship offer', 'a student asking a tutor for help with statistics',
];

export const ANNOUNCEMENT_SCENARIOS = [
  'a club meeting reminder', 'the campus radio station announcing an event', 'a library closing early', 'a change in a bus schedule',
  'registration for intramural sports', 'a guest speaker visiting campus', 'a career fair', 'a blood donation drive',
  'a lab safety reminder', 'a cafeteria menu change', 'a dormitory fire-drill notice', 'a film screening on campus',
];

export const INTERVIEW_THEMES = [
  'commuting habits', 'studying and learning habits', 'free time and hobbies', 'shopping and money', 'food and cooking', 'technology in daily life',
  'travel and neighborhoods', 'sports and exercise', 'friends and communication', 'working part-time', 'reading and media', 'the environment at home',
  'cities versus small towns', 'music and entertainment', 'time management', 'volunteering',
];

export const EMAIL_SCENARIOS = [
  'a coworker recommended a vendor that disappointed your team', 'you need to ask a professor for an extension on a project',
  'you must tell a landlord about a repair that was never completed', 'you want to cancel a reservation and ask about a refund',
  'you are inviting a speaker to a student club event', 'you must explain a scheduling conflict to your manager',
  'you are asking an advisor about changing a course', 'you are complaining about a late delivery and proposing a solution',
  'you are thanking a mentor and asking for a recommendation letter', 'you want to propose a new meeting time to your study group',
];

export const DISCUSSION_TOPICS = [
  ['sociology', 'Should cities invest more in public transportation or in new roads?'],
  ['education', 'Do online classes work better than in-person classes for most students?'],
  ['psychology', 'Does exercise or environment matter more for mental health?'],
  ['business', 'Is it better for companies to allow remote work or to require office attendance?'],
  ['environmental science', 'Should governments ban single-use plastics?'],
  ['technology', 'Will artificial intelligence help or harm creativity?'],
  ['economics', 'Should universities be free for all students?'],
  ['media studies', 'Is social media mostly a positive force for communities?'],
  ['health', 'Should schools start later in the morning?'],
  ['urban planning', 'Should historic buildings be preserved even when they are costly to maintain?'],
];

export interface PickOptions {
  avoid?: string[];
}

/** Pick a field + subtopic pair, avoiding recently used subtopics. */
export function sampleAcademicTopic(
  rand: () => number,
  avoid: string[] = [],
): { field: string; topic: string } {
  const avoidSet = new Set(avoid.map((a) => a.toLowerCase()));
  const pairs: Array<{ field: string; topic: string }> = [];
  for (const [field, topics] of Object.entries(ACADEMIC_TOPICS)) {
    for (const topic of topics) {
      if (!avoidSet.has(topic.toLowerCase()) && !avoidSet.has(field.toLowerCase())) {
        pairs.push({ field, topic });
      }
    }
  }
  const pool = pairs.length ? pairs : Object.entries(ACADEMIC_TOPICS).flatMap(([field, ts]) => ts.map((topic) => ({ field, topic })));
  return pick(pool, rand);
}

export function sampleFrom(list: readonly string[], rand: () => number, avoid: string[] = []): string {
  const avoidSet = new Set(avoid.map((a) => a.toLowerCase()));
  const pool = list.filter((x) => !avoidSet.has(x.toLowerCase()));
  return pick(pool.length ? pool : list, rand);
}

export function sampleMany(list: readonly string[], n: number, rand: () => number, avoid: string[] = []): string[] {
  const avoidSet = new Set(avoid.map((a) => a.toLowerCase()));
  const pool = list.filter((x) => !avoidSet.has(x.toLowerCase()));
  return shuffle(pool.length >= n ? pool : list, rand).slice(0, n);
}

/** Rough size of the combinatorial space (used by docs/diagnostics). */
export function topicSpaceSize(): number {
  const academic = Object.values(ACADEMIC_TOPICS).reduce((n, t) => n + t.length, 0);
  return (
    academic *
    DAILY_LIFE_GENRES.length *
    DAILY_LIFE_SCENARIOS.length *
    CONVERSATION_SCENARIOS.length *
    ANNOUNCEMENT_SCENARIOS.length *
    INTERVIEW_THEMES.length
  );
}
