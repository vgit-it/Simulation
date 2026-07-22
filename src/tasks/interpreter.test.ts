import { describe, expect, it } from 'vitest';
import { candidate } from '../actions';
import { assembleContext } from '../context';
import type { Plan } from '../plans/types';
import { freshState } from '../state/reducer';
import { answerResolve, beginResolve } from './interpreter';
import type { ResolveState } from './types';

const session = { personId: 'ava-chen', deviceId: 'ava-phone' };
const ctx = assembleContext(session, freshState());

const shareStep = (ids: string[], payload?: Record<string, unknown>) => ({
  id: 'share',
  app: 'photos',
  intent: 'share-photos',
  ids,
  ...(payload && { payload }),
  description: 'Share it',
});
const remindStep = {
  id: 'remind',
  app: 'reminders',
  intent: 'create-reminder',
  ids: [] as string[],
  payload: { title: '' },
  description: 'Add a reminder',
};

/** Narrow a resolving result (throws in a test if it was `done`). */
function resolving(r: ReturnType<typeof beginResolve>): {
  state: ResolveState;
  ask: ResolveState['frames'][number];
} {
  if (r.status !== 'resolving') throw new Error('expected resolving');
  return { state: r.state, ask: r.ask };
}

describe('beginResolve', () => {
  it('is done when the plan has no gaps (explicit recipients)', () => {
    const plan: Plan = {
      id: 'p',
      goal: 'Share',
      steps: [shareStep(['img-004'], { recipients: ['leo-park'] })],
    };
    const r = beginResolve(plan, ctx, 'share this');
    expect(r.status).toBe('done');
  });

  it('surfaces an elicit ask for a solo photo missing recipients', () => {
    const plan: Plan = { id: 'p', goal: 'Share', steps: [shareStep(['img-004'])] };
    const { ask } = resolving(beginResolve(plan, ctx, 'share this'));
    expect(ask.kind).toBe('elicit');
    expect(ask.slot.key).toBe('recipients');
    expect(ask.stepIndex).toBe(0);
  });
});

describe('answerResolve — one candidate binds and advances', () => {
  it('binds the value and completes when it was the last gap', () => {
    const plan: Plan = { id: 'p', goal: 'Share', steps: [shareStep(['img-004'])] };
    const { state } = resolving(beginResolve(plan, ctx, 'share this'));
    const r = answerResolve(state, ctx, [candidate(['leo-park'], 'high', 'answer')]);
    expect(r.status).toBe('done');
    if (r.status === 'done') {
      expect(r.plan.steps[0].payload?.recipients).toEqual(['leo-park']);
    }
  });

  it('walks a multi-gap plan (share recipients → reminder title) sequentially', () => {
    const plan: Plan = {
      id: 'p',
      goal: 'Share + remind',
      steps: [shareStep(['img-004']), remindStep],
    };
    // First ask: the share's recipients.
    let step = resolving(beginResolve(plan, ctx, 'share and remind'));
    expect(step.ask.slot.key).toBe('recipients');
    // Answer it → the next ask is the reminder title.
    step = resolving(
      answerResolve(step.state, ctx, [candidate(['leo-park'], 'high', 'answer')]),
    );
    expect(step.ask.slot.key).toBe('title');
    // Answer the title → done, both inputs bound.
    const done = answerResolve(step.state, ctx, [candidate('buy milk', 'high', 'answer')]);
    expect(done.status).toBe('done');
    if (done.status === 'done') {
      expect(done.plan.steps[0].payload?.recipients).toEqual(['leo-park']);
      expect(done.plan.steps[1].payload?.title).toBe('buy milk');
    }
  });
});

describe('answerResolve — many candidates push a choice frame (the depth-2 nest)', () => {
  it('an ambiguous answer suspends the elicit under a choice; picking one resumes it', () => {
    const plan: Plan = { id: 'p', goal: 'Share', steps: [shareStep(['img-004'])] };
    const { state } = resolving(beginResolve(plan, ctx, 'share this'));
    expect(state.frames).toHaveLength(1); // [elicit]

    // Ambiguous: two alternatives → push a choice OVER the elicit.
    const choiceStep = resolving(
      answerResolve(state, ctx, [
        candidate(['leo-park'], 'high', 'answer'),
        candidate(['sam-ruiz'], 'high', 'answer'),
      ]),
    );
    expect(choiceStep.ask.kind).toBe('choice');
    expect(choiceStep.state.frames).toHaveLength(2); // [elicit, choice]
    if (choiceStep.ask.kind === 'choice') {
      expect(choiceStep.ask.alternatives).toHaveLength(2);
    }

    // Pick one → binds to the ORIGINAL recipients slot, pops both frames, done.
    const done = answerResolve(choiceStep.state, ctx, [
      candidate(['sam-ruiz'], 'high', 'answer'),
    ]);
    expect(done.status).toBe('done');
    if (done.status === 'done') {
      expect(done.plan.steps[0].payload?.recipients).toEqual(['sam-ruiz']);
    }
  });
});
