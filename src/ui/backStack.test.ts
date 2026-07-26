import { describe, expect, it } from 'vitest';
import { createBackStack } from './backStack';

describe('backStack', () => {
  it('dispatch is a no-op with nothing registered', () => {
    const stack = createBackStack();
    expect(stack.dispatch()).toBe(false);
  });

  it('runs the only registered handler', () => {
    const stack = createBackStack();
    let ran = false;
    stack.register(10, () => {
      ran = true;
    });
    expect(stack.dispatch()).toBe(true);
    expect(ran).toBe(true);
  });

  it('a higher layer always wins over a lower one, regardless of registration order', () => {
    const stack = createBackStack();
    const order: string[] = [];
    stack.register(40, () => order.push('overlay'));
    stack.register(0, () => order.push('screen'));
    stack.register(20, () => order.push('subview'));
    stack.dispatch();
    expect(order).toEqual(['overlay']);
  });

  it('registering after a higher layer still loses to it', () => {
    const stack = createBackStack();
    const order: string[] = [];
    stack.register(0, () => order.push('screen'));
    stack.register(40, () => order.push('overlay'));
    stack.dispatch();
    expect(order).toEqual(['overlay']);
  });

  it('ties within the same layer break to the most recently registered', () => {
    const stack = createBackStack();
    const order: string[] = [];
    stack.register(20, () => order.push('first'));
    stack.register(20, () => order.push('second'));
    stack.dispatch();
    expect(order).toEqual(['second']);
  });

  it('unregister removes exactly that handler and only that one', () => {
    const stack = createBackStack();
    const order: string[] = [];
    const unregisterA = stack.register(20, () => order.push('a'));
    stack.register(10, () => order.push('b'));
    unregisterA();
    stack.dispatch();
    expect(order).toEqual(['b']);
  });

  it('a handler registered while "inactive" (never registered) is never called', () => {
    const stack = createBackStack();
    let called = false;
    const unregister = stack.register(50, () => {
      called = true;
    });
    unregister();
    expect(stack.dispatch()).toBe(false);
    expect(called).toBe(false);
  });

  it('dispatching after every handler unregisters returns false', () => {
    const stack = createBackStack();
    const unregister = stack.register(10, () => {});
    unregister();
    expect(stack.dispatch()).toBe(false);
  });
});
