import { BankProvider, pickBankItems, pickQuestionSubset } from './bank.provider';
import { MODULE_BLUEPRINTS } from '../../common/toefl.constants';
import { validateStimulus } from '../../content/quality';
import { CHOOSE_RESPONSE_BANK } from '../../content/bank/listening.bank';
import { READING_BANK } from '../../content/bank/reading.bank';
import { mulberry32 } from '../../content/text-utils';

describe('BankProvider (offline content)', () => {
  const provider = new BankProvider();

  it('produces valid content for every task of every module of the 2026 blueprint', async () => {
    for (const bp of MODULE_BLUEPRINTS) {
      for (const task of bp.tasks) {
        const res = await provider.generateTask({
          kind: task.kind,
          difficulty: 'standard',
          questionCounts: task.questionCounts,
          avoidTopics: [],
          avoidBankIds: [],
          seed: 11,
        });
        res.stimuli.forEach((s, i) => {
          const rep = validateStimulus(task.kind, s, task.questionCounts[i] ?? task.questionCounts[0]);
          expect(rep.problems).toEqual([]);
        });
      }
    }
  });

  it('Complete the Words yields exactly 10 blanks with keys', async () => {
    const res = await provider.generateTask({ kind: 'COMPLETE_WORDS', difficulty: 'standard', questionCounts: [10], avoidTopics: [], avoidBankIds: [], seed: 2 });
    expect(res.stimuli[0].questions).toHaveLength(10);
    expect(res.stimuli[0].body).toContain('{{1|');
  });

  it('Build a Sentence yields 10 items with ordered answers', async () => {
    const res = await provider.generateTask({ kind: 'BUILD_SENTENCE', difficulty: 'standard', questionCounts: [10], avoidTopics: [], avoidBankIds: [], seed: 2 });
    expect(res.stimuli[0].questions).toHaveLength(10);
    expect(Array.isArray(res.stimuli[0].questions[0].correctAnswer)).toBe(true);
  });

  it('Listen and Repeat has 7 sentences of growing length', async () => {
    const res = await provider.generateTask({ kind: 'LISTEN_REPEAT', difficulty: 'standard', questionCounts: [7], avoidTopics: [], avoidBankIds: [], seed: 4 });
    const lens = res.stimuli[0].questions.map((q) => String(q.correctAnswer).split(' ').length);
    expect(lens).toHaveLength(7);
    expect(lens[6]).toBeGreaterThan(lens[0]);
  });

  it('Interview has 4 questions of 45 seconds', async () => {
    const res = await provider.generateTask({ kind: 'INTERVIEW', difficulty: 'standard', questionCounts: [4], avoidTopics: [], avoidBankIds: [], seed: 4 });
    expect(res.stimuli[0].questions).toHaveLength(4);
    expect(res.stimuli[0].questions.every((q) => q.timeLimitSec === 45)).toBe(true);
  });

  it('prefers unseen bank items', () => {
    const seen = READING_BANK.filter((b) => b.kind === 'ACADEMIC_PASSAGE').slice(0, 3).map((b) => b.id);
    const picked = pickBankItems(READING_BANK.filter((b) => b.kind === 'ACADEMIC_PASSAGE'), 1, 'standard', seen, mulberry32(1));
    expect(seen).not.toContain(picked[0].id);
  });

  it('reuses items instead of failing when the bank is smaller than needed', () => {
    const picked = pickBankItems(CHOOSE_RESPONSE_BANK.slice(0, 3), 8, 'standard', [], mulberry32(1));
    expect(picked).toHaveLength(8);
  });

  it('keeps question order when sampling a subset', () => {
    const sub = pickQuestionSubset([1, 2, 3, 4, 5], 3, mulberry32(8));
    expect(sub).toHaveLength(3);
    expect([...sub].sort((a, b) => a - b)).toEqual(sub);
  });

  it('is deterministic for a fixed seed', async () => {
    const p = { kind: 'ACADEMIC_TALK' as const, difficulty: 'standard' as const, questionCounts: [4], avoidTopics: [], avoidBankIds: [], seed: 21 };
    const a = await provider.generateTask(p);
    const b = await provider.generateTask(p);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
