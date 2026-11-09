import { buildSteps, serveQuestion, servePassage } from './serve';

describe('exam-mode serving (no answer leakage)', () => {
  const listening = {
    id: 'p1', order: 0, title: 'Conversation', body: 'Man: secret transcript', kind: 'conversation', topic: 'campus',
    meta: { context: 'Listen to a conversation.', taskKind: 'CONVERSATION', turns: [{ speaker: 'Man', text: 'secret transcript' }] },
  };

  it('never sends the listening transcript as body; with server audio it sends no text at all', () => {
    const noAudio = servePassage(listening);
    expect(noAudio.body).toBeNull();
    expect(noAudio.meta.turns).toBeDefined(); // browser TTS fallback
    const withAudio = servePassage({ ...listening, meta: { ...(listening.meta as object), audio: ['tts/abc.mp3'] } });
    expect(withAudio.body).toBeNull();
    expect(withAudio.meta.turns).toBeUndefined();
    expect(withAudio.meta.audioUrls).toEqual(['/media/tts/abc.mp3']);
    expect(JSON.stringify(withAudio)).not.toContain('secret transcript');
  });

  it('keeps reading passages readable', () => {
    const p = servePassage({ id: 'r', order: 0, title: 'T', body: 'Readable text', kind: 'academic', topic: 'x', meta: {} });
    expect(p.body).toBe('Readable text');
  });

  it('hides the Listen and Repeat sentence from the prompt and meta when audio exists', () => {
    const q = serveQuestion({
      id: 'q', passageId: 'p', order: 0, type: 'SPEAKING_LISTEN_REPEAT', taskKind: 'LISTEN_REPEAT',
      prompt: 'Welcome to the chemistry lab.', options: null, points: 0, timeLimitSec: 12,
      meta: { audioText: 'Welcome to the chemistry lab.', audio: 'tts/x.mp3' },
    });
    expect(q.prompt).toBe('Listen and repeat.');
    expect(JSON.stringify(q)).not.toContain('chemistry');
    expect(q.audioUrl).toBe('/media/tts/x.mp3');
  });

  it('serves questions without correct answers or explanations', () => {
    const q = serveQuestion({
      id: 'q', passageId: 'p', order: 0, type: 'READING_FACTUAL', taskKind: 'ACADEMIC_PASSAGE',
      prompt: 'Why?', options: [{ id: 'A', text: 'x' }], points: 1, timeLimitSec: null, meta: null,
    } as never);
    expect(Object.keys(q)).not.toContain('correctAnswer');
    expect(Object.keys(q)).not.toContain('explanation');
  });

  it('builds one step per stimulus in order, with task clocks for writing', () => {
    const steps = buildSteps(
      [
        { id: 'b', order: 1, title: 'Email', body: '', kind: 'email_task', topic: null, meta: { taskKind: 'WRITE_EMAIL', taskTitle: 'Write an Email', taskSec: 420 } },
        { id: 'a', order: 0, title: 'BS', body: '', kind: 'build_sentence', topic: null, meta: { taskKind: 'BUILD_SENTENCE', taskTitle: 'Build a Sentence', taskSec: 360 } },
      ],
      [
        { id: 'q2', passageId: 'b', order: 11, type: 'WRITING_EMAIL', taskKind: 'WRITE_EMAIL', prompt: '', options: null, points: 0, timeLimitSec: null, meta: null },
        { id: 'q1', passageId: 'a', order: 0, type: 'WRITING_BUILD_SENTENCE', taskKind: 'BUILD_SENTENCE', prompt: '', options: null, points: 1, timeLimitSec: null, meta: null },
      ],
    );
    expect(steps.map((s) => s.kind)).toEqual(['BUILD_SENTENCE', 'WRITE_EMAIL']);
    expect(steps[1].timeLimitSec).toBe(420);
    expect(steps[0].questionIds).toEqual(['q1']);
  });
});
