import { MockAiProvider } from './mock.provider';

describe('MockAiProvider', () => {
  const provider = new MockAiProvider();

  it('generates a reading section with the requested shape', async () => {
    const section = await provider.generateSection({
      section: 'READING',
      difficulty: 'standard',
      passages: 2,
      questionsPerPassage: 10,
      seed: 42,
    });

    expect(section.section).toBe('READING');
    expect(section.passages).toHaveLength(2);
    for (const p of section.passages) {
      expect(p.body.length).toBeGreaterThan(50);
      expect(p.questions).toHaveLength(10);
      for (const q of p.questions) {
        expect(q.options).toHaveLength(4);
        const ids = q.options.map((o) => o.id);
        // correct answer must reference a real option id
        expect(ids).toContain(q.correctAnswer);
        expect(q.explanation.length).toBeGreaterThan(0);
        expect(q.skillTag).toBeTruthy();
      }
    }
  });

  it('is deterministic for a fixed seed', async () => {
    const a = await provider.generateSection({
      section: 'LISTENING',
      difficulty: 'standard',
      passages: 2,
      questionsPerPassage: 5,
      seed: 7,
    });
    const b = await provider.generateSection({
      section: 'LISTENING',
      difficulty: 'standard',
      passages: 2,
      questionsPerPassage: 5,
      seed: 7,
    });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('produces productive tasks for speaking/writing', async () => {
    const speaking = await provider.generateSection({
      section: 'SPEAKING',
      difficulty: 'standard',
      passages: 0,
      questionsPerPassage: 0,
    });
    expect(speaking.tasks?.length).toBeGreaterThan(0);
    expect(speaking.passages).toHaveLength(0);
  });

  it('generates a coaching summary mentioning the score gap', async () => {
    const summary = await provider.generateCoachSummary({
      targetScore: 100,
      estimatedTotal: 80,
      weakestSkills: [{ skillTag: 'inference', accuracy: 0.4, section: 'READING' }],
      strongestSkills: [{ skillTag: 'detail', accuracy: 0.9, section: 'READING' }],
    });
    expect(summary).toContain('80');
    expect(summary).toContain('100');
  });
});
