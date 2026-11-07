import { planPotentials, TutorService } from './tutor.service';
import { SkillRow } from '../reports/reports.service';

const row = (skillTag: string, section: string, accuracy: number): SkillRow => ({ skillTag, section, correct: 0, total: 5, accuracy, source: 'items' });

describe('coach planner', () => {
  const all = [row('inference', 'READING', 0.3), row('vocabulary', 'READING', 0.5), row('detail', 'READING', 0.9), row('main-idea', 'LISTENING', 0.4)];

  it('estimates larger gains for weaker skills and never exceeds the gap', () => {
    const plan = planPotentials([all[0], all[1]], all, 6);
    expect(plan[0].gain).toBeGreaterThan(plan[1].gain);
    expect(plan.reduce((a, p) => a + p.gain, 0)).toBeLessThanOrEqual(6.1);
  });

  it('gives no gain for skills already above the target accuracy', () => {
    expect(planPotentials([all[2]], all, 10)[0].gain).toBe(0);
  });

  it('builds plan items with exercises and resources, falling back to a generic recommendation', () => {
    const svc = new TutorService(null as never, null as never, null as never);
    const items = svc.buildPlanItems([all[0], row('unknown-skill', 'READING', 0.4)], all, 8);
    expect(items[0].description).toContain('Exercise:');
    expect(items[0].description).toContain('Resources:');
    expect(items[1].description).toContain('drills');
  });

  it('estimates weeks to target from the gap and daily study time', () => {
    const svc = new TutorService(null as never, null as never, null as never);
    expect(svc.weeksToTarget(0, 45)).toBe(0);
    expect(svc.weeksToTarget(20, 60)).toBeGreaterThan(svc.weeksToTarget(20, 120));
  });
});
