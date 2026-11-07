import { Injectable, Logger } from '@nestjs/common';
import { QuestionType, Section } from '@prisma/client';
import {
  AiProvider,
  CoachSummaryInput,
  GenerateSectionParams,
  GeneratedPassage,
  GeneratedQuestion,
  GeneratedSection,
} from '../ai.types';

/**
 * Deterministic, offline question generator.
 *
 * Produces original, varied academic-style passages and questions WITHOUT any
 * external API, so the platform is fully usable without an OpenAI key and in
 * tests/CI. Content is templated from large topic/fact pools and shuffled with
 * a seeded RNG, so repeats are rare across sessions.
 */
@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockAiProvider.name);

  // ── seeded RNG (mulberry32) ──────────────────────────────────────────
  private rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private pick<T>(arr: T[], rand: () => number): T {
    return arr[Math.floor(rand() * arr.length)];
  }

  private shuffle<T>(arr: T[], rand: () => number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── content pools ────────────────────────────────────────────────────
  private readonly readingTopics = [
    {
      topic: 'Marine Biology',
      subject: 'bioluminescence in deep-sea organisms',
      facts: [
        'Many deep-sea creatures produce their own light through a chemical reaction called bioluminescence.',
        'The light is generated when a molecule named luciferin reacts with oxygen, catalyzed by the enzyme luciferase.',
        'Bioluminescence serves several purposes, including attracting prey, deterring predators, and communicating with mates.',
        'Because sunlight cannot penetrate below roughly 1,000 meters, bioluminescent light is often the only illumination in the deep ocean.',
        'Some species, such as the anglerfish, use a glowing lure to draw smaller fish within striking distance.',
      ],
    },
    {
      topic: 'Art History',
      subject: 'the development of Renaissance perspective',
      facts: [
        'During the early fifteenth century, Italian artists developed linear perspective, a technique that creates the illusion of depth on a flat surface.',
        'The architect Filippo Brunelleschi is credited with demonstrating the mathematical principles of perspective around 1420.',
        'Linear perspective relies on a single vanishing point toward which parallel lines appear to converge.',
        'The adoption of perspective transformed painting, allowing figures and architecture to occupy believable three-dimensional space.',
        'Leon Battista Alberti later codified these methods in a written treatise, spreading the technique across Europe.',
      ],
    },
    {
      topic: 'Geology',
      subject: 'the formation of sedimentary rock',
      facts: [
        'Sedimentary rocks form from the accumulation and compaction of mineral and organic particles over long periods.',
        'Weathering breaks down existing rock into small fragments that are then transported by wind, water, or ice.',
        'As layers of sediment build up, the weight of overlying material compresses the lower layers in a process called compaction.',
        'Dissolved minerals act as a natural cement, binding particles together in a process known as cementation.',
        'Fossils are most commonly found in sedimentary rock because the gentle layering can preserve the remains of organisms.',
      ],
    },
    {
      topic: 'Astronomy',
      subject: 'the life cycle of stars',
      facts: [
        'Stars begin their lives within clouds of gas and dust known as nebulae, where gravity pulls material together.',
        'When the core of a forming star becomes hot and dense enough, nuclear fusion begins, converting hydrogen into helium.',
        'A star spends most of its life in a stable phase called the main sequence, during which it fuses hydrogen steadily.',
        'Once the hydrogen fuel is exhausted, the star expands into a red giant and begins fusing heavier elements.',
        'The final fate of a star depends on its mass: smaller stars become white dwarfs, while the most massive end in supernova explosions.',
      ],
    },
    {
      topic: 'Anthropology',
      subject: 'the spread of early agriculture',
      facts: [
        'The transition from hunting and gathering to farming is often called the Neolithic Revolution.',
        'Agriculture appears to have arisen independently in several regions, including the Fertile Crescent and parts of East Asia.',
        'Domesticating plants and animals allowed communities to produce surplus food and settle permanently.',
        'Permanent settlements led to population growth and, eventually, to the rise of complex societies and cities.',
        'The shift also introduced new challenges, such as a less varied diet and the spread of disease in crowded settlements.',
      ],
    },
    {
      topic: 'Environmental Science',
      subject: 'the carbon cycle',
      facts: [
        'Carbon moves continuously among the atmosphere, oceans, soil, and living organisms in what is called the carbon cycle.',
        'Plants remove carbon dioxide from the air during photosynthesis and store carbon in their tissues.',
        'When organisms respire or decompose, carbon is returned to the atmosphere as carbon dioxide.',
        'The oceans absorb large amounts of atmospheric carbon, acting as a major carbon reservoir.',
        'Human activities, especially the burning of fossil fuels, release stored carbon far faster than natural processes can absorb it.',
      ],
    },
  ];

  private readonly listeningScenarios = [
    {
      topic: 'Biology Lecture',
      subject: 'animal migration',
      facts: [
        'Today we are going to look at how certain animals navigate during long migrations.',
        'Researchers once believed migration was guided mainly by landmarks, but we now know several cues are involved.',
        'Many birds appear to sense the Earth\u2019s magnetic field, using it like an internal compass.',
        'Some species also rely on the position of the sun and stars to maintain a consistent direction.',
        'What is remarkable is that young birds can complete a migration they have never made before, suggesting an inherited map.',
      ],
    },
    {
      topic: 'Campus Conversation',
      subject: 'a student visiting the library help desk',
      facts: [
        'Hi, I was hoping you could help me find some sources for my history research paper.',
        'Have you tried the library\u2019s online database? It indexes thousands of academic journals.',
        'I did, but I kept getting results that were too general for my specific topic.',
        'In that case, I\u2019d recommend narrowing your search using subject keywords rather than broad terms.',
        'You can also request articles we don\u2019t have through interlibrary loan, though that takes a few days.',
      ],
    },
    {
      topic: 'Psychology Lecture',
      subject: 'how memory is formed',
      facts: [
        'Let\u2019s discuss how short-term memories are converted into long-term ones, a process called consolidation.',
        'When you first experience something, the information is held briefly in short-term memory.',
        'If the information is rehearsed or deemed important, it can be transferred to long-term storage.',
        'The hippocampus plays a central role in this transfer, especially during sleep.',
        'This is one reason why a good night\u2019s sleep before an exam can actually improve recall.',
      ],
    },
    {
      topic: 'Environmental Science Lecture',
      subject: 'wetland ecosystems',
      facts: [
        'Wetlands are among the most productive ecosystems on the planet, yet they are often undervalued.',
        'They act as natural filters, trapping sediment and removing pollutants from water.',
        'Wetlands also absorb excess rainfall, reducing the severity of floods downstream.',
        'A remarkable variety of species depend on wetlands for breeding and feeding.',
        'Despite these benefits, wetlands continue to be drained for agriculture and development.',
      ],
    },
  ];

  // ── public API ───────────────────────────────────────────────────────
  async generateSection(
    params: GenerateSectionParams,
  ): Promise<GeneratedSection> {
    const seed =
      params.seed ??
      Math.floor(Math.random() * 1_000_000) + Date.now() % 100000;
    const rand = this.rng(seed);

    if (params.section === 'READING' || params.section === 'LISTENING') {
      return this.generateObjectiveSection(params, rand);
    }
    return this.generateProductiveSection(params);
  }

  private generateObjectiveSection(
    params: GenerateSectionParams,
    rand: () => number,
  ): GeneratedSection {
    const isReading = params.section === 'READING';
    const pool = isReading ? this.readingTopics : this.listeningScenarios;
    const avoid = new Set((params.avoidTopics ?? []).map((t) => t.toLowerCase()));

    const chosen = this.shuffle(pool, rand).filter(
      (p) => !avoid.has(p.topic.toLowerCase()),
    );
    const source = chosen.length >= params.passages ? chosen : this.shuffle(pool, rand);

    const passages: GeneratedPassage[] = [];
    for (let i = 0; i < params.passages; i++) {
      const base = source[i % source.length];
      passages.push(
        this.buildPassage(base, params.questionsPerPassage, isReading, rand),
      );
    }

    return {
      section: params.section,
      instructions: isReading
        ? 'Read each passage and answer the questions that follow.'
        : 'Listen to each recording and answer the questions that follow.',
      timeLimitSec: 0, // set by caller from blueprint
      passages,
    };
  }

  private buildPassage(
    base: { topic: string; subject: string; facts: string[] },
    questionCount: number,
    isReading: boolean,
    rand: () => number,
  ): GeneratedPassage {
    const intro = isReading
      ? `The following passage discusses ${base.subject}.`
      : `Narrator: Listen to part of a talk about ${base.subject}.`;
    const body = [intro, ...base.facts].join(' ');

    const questions: GeneratedQuestion[] = [];
    const skillRotation = isReading
      ? [
          { type: 'READING_FACTUAL', skill: 'factual-detail' },
          { type: 'READING_INFERENCE', skill: 'inference' },
          { type: 'READING_VOCABULARY', skill: 'vocabulary' },
          { type: 'READING_NEGATIVE_FACTUAL', skill: 'negative-factual' },
          { type: 'READING_RHETORICAL_PURPOSE', skill: 'rhetorical-purpose' },
        ]
      : [
          { type: 'LISTENING_MAIN_IDEA', skill: 'main-idea' },
          { type: 'LISTENING_DETAIL', skill: 'detail' },
          { type: 'LISTENING_INFERENCE', skill: 'inference' },
          { type: 'LISTENING_FUNCTION', skill: 'function' },
          { type: 'LISTENING_ATTITUDE', skill: 'attitude' },
        ];

    for (let i = 0; i < questionCount; i++) {
      const slot = skillRotation[i % skillRotation.length];
      questions.push(
        this.buildQuestion(base, slot.type as QuestionType, slot.skill, i, rand),
      );
    }

    return {
      title: base.topic,
      body,
      topic: base.topic,
      audioScript: isReading ? undefined : body,
      questions,
    };
  }

  private buildQuestion(
    base: { topic: string; subject: string; facts: string[] },
    type: QuestionType,
    skill: string,
    index: number,
    rand: () => number,
  ): GeneratedQuestion {
    const fact = base.facts[index % base.facts.length];
    // Correct answer is a paraphrase of a real fact from the passage;
    // distractors are plausible but unsupported statements.
    const correctText = this.paraphrase(fact);
    const distractors = this.buildDistractors(base, fact, rand);

    const optionTexts = this.shuffle(
      [correctText, ...distractors.slice(0, 3)],
      rand,
    );
    const letters = ['A', 'B', 'C', 'D'];
    const options = optionTexts.map((text, i) => ({ id: letters[i], text }));
    const correctId = options.find((o) => o.text === correctText)!.id;

    const prompt = this.promptFor(type, base);

    return {
      type,
      prompt,
      options,
      correctAnswer: correctId,
      explanation: `The passage states that ${fact} The correct choice restates this idea. The other options are not supported by the text or contradict it.`,
      skillTag: skill,
      points: 1,
    };
  }

  private promptFor(
    type: QuestionType,
    base: { subject: string; topic: string },
  ): string {
    switch (type) {
      case 'READING_INFERENCE':
      case 'LISTENING_INFERENCE':
        return `What can be inferred about ${base.subject}?`;
      case 'READING_VOCABULARY':
        return `Which choice is closest in meaning to the ideas emphasized in the passage about ${base.subject}?`;
      case 'READING_NEGATIVE_FACTUAL':
        return `According to the passage, which of the following is NOT true about ${base.subject}?`;
      case 'READING_RHETORICAL_PURPOSE':
        return `Why does the author include details about ${base.subject}?`;
      case 'LISTENING_MAIN_IDEA':
        return `What is the main idea of the talk?`;
      case 'LISTENING_FUNCTION':
        return `Why does the speaker mention the details about ${base.subject}?`;
      case 'LISTENING_ATTITUDE':
        return `What is the speaker's attitude toward ${base.subject}?`;
      default:
        return `According to the passage, which statement about ${base.subject} is correct?`;
    }
  }

  private paraphrase(fact: string): string {
    // Light transformation so the option is not a verbatim copy.
    return fact
      .replace(/^Many /, 'A number of ')
      .replace(/^Some /, 'Certain ')
      .replace(/\u2019/g, "'")
      .replace(/\.$/, '');
  }

  private buildDistractors(
    base: { facts: string[] },
    correctFact: string,
    rand: () => number,
  ): string[] {
    const others = base.facts.filter((f) => f !== correctFact);
    const negations = others.map((f) =>
      // Create a plausible-but-wrong twist.
      f
        .replace('always', 'never')
        .replace('increase', 'decrease')
        .replace('removes', 'adds')
        .replace('reduces', 'increases')
        .replace(/\.$/, ' — a claim the passage does not make'),
    );
    return this.shuffle(negations, rand);
  }

  private generateProductiveSection(
    params: GenerateSectionParams,
  ): GeneratedSection {
    // Speaking/Writing tasks (graded in later phases).
    const tasks =
      params.section === 'SPEAKING'
        ? [
            {
              type: 'SPEAKING_INDEPENDENT' as QuestionType,
              prompt:
                'Some people prefer to study alone, while others prefer to study in groups. Which do you prefer, and why? Use details and examples to support your answer.',
              skillTag: 'independent-speaking',
            },
            {
              type: 'SPEAKING_INTEGRATED' as QuestionType,
              prompt:
                'Read a short campus announcement and listen to two students discuss it. Then state the woman\u2019s opinion and explain the reasons she gives.',
              skillTag: 'integrated-speaking',
              stimulus:
                'Announcement: The university library will reduce its weekend hours next semester to save on operating costs.',
            },
          ]
        : [
            {
              type: 'WRITING_ACADEMIC_DISCUSSION' as QuestionType,
              prompt:
                'Your professor is teaching a class on urban planning. Respond to the discussion question: "Should cities invest more in public transportation or in expanding roads?" State your opinion and support it with reasons and examples.',
              skillTag: 'academic-discussion',
            },
            {
              type: 'WRITING_INTEGRATED' as QuestionType,
              prompt:
                'Summarize the points made in the lecture, explaining how they cast doubt on the claims in the reading passage.',
              skillTag: 'integrated-writing',
              stimulus:
                'Reading: Some researchers argue that remote work reduces overall productivity. Lecture: A recent study suggests the opposite under certain conditions.',
            },
          ];

    return {
      section: params.section,
      instructions:
        params.section === 'SPEAKING'
          ? 'Respond to each task by speaking into your microphone.'
          : 'Respond to each task by typing your response.',
      timeLimitSec: 0,
      passages: [],
      tasks,
    };
  }

  async generateCoachSummary(input: CoachSummaryInput): Promise<string> {
    const gap = input.targetScore - input.estimatedTotal;
    const weak = input.weakestSkills
      .slice(0, 3)
      .map((w) => `${w.skillTag} (${Math.round(w.accuracy * 100)}% in ${w.section.toLowerCase()})`)
      .join(', ');
    const strong = input.strongestSkills
      .slice(0, 2)
      .map((s) => s.skillTag)
      .join(', ');

    return (
      `Your estimated total is ${input.estimatedTotal}/120 and your target is ${input.targetScore}/120 ` +
      `(${gap > 0 ? `a gap of ${gap} points` : 'you are at or above target'}). ` +
      `Your strongest areas are ${strong || 'developing across the board'}. ` +
      `Focus your next sessions on your weakest skills: ${weak || 'complete a full mock to build a profile'}. ` +
      `Short, frequent practice on these skills will yield the fastest score gains.`
    );
  }
}
