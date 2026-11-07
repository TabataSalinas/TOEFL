import { buildPrompt, parseLlmTask } from './llm-task';
import { GenerateTaskParams } from './ai.types';

const base = (kind: GenerateTaskParams['kind'], counts: number[]): GenerateTaskParams => ({
  kind,
  difficulty: 'standard',
  questionCounts: counts,
  avoidTopics: ['Photosynthesis'],
  avoidBankIds: [],
  seed: 1,
});

describe('LLM task prompts and parsing', () => {
  it('builds a prompt for every task kind that mentions the schema and the avoid list', () => {
    const kinds = ['COMPLETE_WORDS', 'DAILY_LIFE', 'ACADEMIC_PASSAGE', 'CHOOSE_RESPONSE', 'CONVERSATION', 'ANNOUNCEMENT', 'ACADEMIC_TALK', 'BUILD_SENTENCE', 'WRITE_EMAIL', 'ACADEMIC_DISCUSSION', 'LISTEN_REPEAT', 'INTERVIEW'] as const;
    for (const k of kinds) {
      const { system, user } = buildPrompt(base(k, k === 'CHOOSE_RESPONSE' ? [1, 1] : [2]));
      expect(system).toContain('ORIGINAL');
      expect(user).toContain('JSON');
      expect(user).toContain('Photosynthesis');
    }
  });

  it('puts grounding facts in the prompt with their license', () => {
    const p = base('ACADEMIC_PASSAGE', [5]);
    p.grounding = [{ provider: 'wikipedia', title: 'Urban heat island', url: 'https://en.wikipedia.org/wiki/Urban_heat_island', license: 'CC BY-SA 4.0', text: 'Urban areas are warmer.' }];
    const { user } = buildPrompt(p);
    expect(user).toContain('CC BY-SA 4.0');
    expect(user).toContain('your own words');
  });

  it('parses a Complete the Words paragraph into blanks built by code', () => {
    const paragraph = 'Maps are tools that help us understand the world around us. They show the locations of places like cities, rivers, and mountains. These visual guides can also display different types of information, such as climate or population. There are many kinds, including physical, political, and thematic versions.';
    const st = parseLlmTask(base('COMPLETE_WORDS', [10]), { paragraph, topic: 'Geography' });
    expect(st[0].questions).toHaveLength(10);
    expect(st[0].questions[0].type).toBe('READING_COMPLETE_WORDS');
  });

  it('parses MCQ stimuli, validating answer indices and allowed types', () => {
    const raw = {
      stimuli: [
        {
          title: 'T',
          topic: 'x',
          turns: [{ speaker: 'Man', text: 'Hello there.' }, { speaker: 'Woman', text: 'Hi.' }],
          questions: [
            { type: 'NOT_A_TYPE', prompt: 'Why?', options: ['a', 'b', 'c', 'd'], answerIndex: 2, explanation: 'e', skillTag: 'detail' },
          ],
        },
      ],
    };
    const st = parseLlmTask(base('CONVERSATION', [1]), raw);
    expect(st[0].questions[0].correctAnswer).toBe('C');
    expect(st[0].questions[0].type).toBe('LISTENING_DETAIL'); // unknown type falls back
    expect(st[0].body).toContain('Man: Hello there.');
    expect(() =>
      parseLlmTask(base('CONVERSATION', [1]), { stimuli: [{ ...raw.stimuli[0], questions: [{ ...raw.stimuli[0].questions[0], answerIndex: 9 }] }] }),
    ).toThrow();
  });

  it('keeps a vocabulary highlight only when the word appears in the text', () => {
    const mk = (hl: string) => ({
      stimuli: [{ title: 'T', topic: 'x', body: 'The results were significant for all groups.', questions: [{ type: 'READING_VOCABULARY', prompt: 'p', options: ['a', 'b', 'c', 'd'], answerIndex: 0, explanation: 'e', skillTag: 'vocabulary', highlight: hl }] }],
    });
    expect(parseLlmTask(base('ACADEMIC_PASSAGE', [1]), mk('significant'))[0].questions[0].meta).toEqual({ highlight: 'significant' });
    expect(parseLlmTask(base('ACADEMIC_PASSAGE', [1]), mk('absent'))[0].questions[0].meta).toBeUndefined();
  });

  it('rejects malformed Build a Sentence items', () => {
    expect(() => parseLlmTask(base('BUILD_SENTENCE', [1]), { items: [{ context: 'x', words: ['Only', 'two'], end: '.' }] })).toThrow();
  });

  it('requires 3 email bullets and 2 student posts', () => {
    expect(() => parseLlmTask(base('WRITE_EMAIL', [1]), { scenario: 's', to: 'Dana', subject: 'x', bullets: ['a'] })).toThrow();
    expect(() => parseLlmTask(base('ACADEMIC_DISCUSSION', [1]), { professor: 'p', students: [{ name: 'A', post: 'x' }] })).toThrow();
  });
});
