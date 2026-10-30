import { describe, expect, it } from 'vitest';
import { createEventBus } from './bus.js';

describe('event bus', () => {
  it('calls the handlers of an event in registration order and awaits each', async () => {
    const bus = createEventBus();
    const order: string[] = [];
    bus.on('SetupDeleted', async () => {
      await Promise.resolve();
      order.push('first');
    });
    bus.on('SetupDeleted', () => {
      order.push('second');
    });
    await bus.publish('SetupDeleted', { userId: 'u', setupId: 's' });
    expect(order).toEqual(['first', 'second']);
  });

  it('delivers the payload and only to the matching event', async () => {
    const bus = createEventBus();
    const seen: unknown[] = [];
    bus.on('UserRegistered', (payload) => void seen.push(payload));
    bus.on('AccountPurged', () => void seen.push('wrong'));
    await bus.publish('UserRegistered', { userId: 'u1' });
    expect(seen).toEqual([{ userId: 'u1' }]);
  });

  it('does nothing when nobody listens', async () => {
    await expect(
      createEventBus().publish('AccountPurged', { userId: 'u' }),
    ).resolves.toBeUndefined();
  });

  it('lets a handler failure reach the publisher and stops the chain', async () => {
    const bus = createEventBus();
    let reached = false;
    bus.on('SightScaleChanged', () => {
      throw new Error('recalculation failed');
    });
    bus.on('SightScaleChanged', () => {
      reached = true;
    });
    await expect(bus.publish('SightScaleChanged', { userId: 'u', sightId: 's' })).rejects.toThrow(
      'recalculation failed',
    );
    expect(reached).toBe(false);
  });

  it('keeps separate buses independent', async () => {
    const a = createEventBus();
    const b = createEventBus();
    let calls = 0;
    a.on('SetupRestored', () => void calls++);
    await b.publish('SetupRestored', { userId: 'u', setupId: 's' });
    expect(calls).toBe(0);
  });

  it('does not compile a payload that does not match the event', async () => {
    const bus = createEventBus();
    // @ts-expect-error SetupDeleted needs a setupId
    await bus.publish('SetupDeleted', { userId: 'u' });
    // @ts-expect-error no such event
    await bus.publish('SetupExploded', {});
    expect(true).toBe(true);
  });
});
