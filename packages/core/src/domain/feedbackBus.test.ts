import { describe, it, expect } from 'vitest';
import { FeedbackBus, FeedbackType, FeedbackEvent } from './feedbackBus';

describe('FeedbackBus', () => {
  it('emits feedback events', () => {
    const bus = new FeedbackBus();
    const events: FeedbackEvent[] = [];
    bus.on(event => events.push(event));

    bus.emit({
      type: FeedbackType.INFO,
      message: 'Test message',
      timestamp: new Date(),
    });

    expect(events).toHaveLength(1);
    expect(events[0].message).toBe('Test message');
  });

  it('caps queue at 20 events', () => {
    const bus = new FeedbackBus();
    for (let i = 0; i < 25; i++) {
      bus.emit({
        type: FeedbackType.INFO,
        message: `Event ${i}`,
        timestamp: new Date(),
      });
    }

    expect(bus.getQueueLength()).toBe(20);
  });

  it('removes listener', () => {
    const bus = new FeedbackBus();
    const events: FeedbackEvent[] = [];
    const listener = (event: FeedbackEvent) => events.push(event);
    bus.on(listener);
    bus.off(listener);

    bus.emit({
      type: FeedbackType.INFO,
      message: 'Test',
      timestamp: new Date(),
    });

    expect(events).toHaveLength(0);
  });
});
