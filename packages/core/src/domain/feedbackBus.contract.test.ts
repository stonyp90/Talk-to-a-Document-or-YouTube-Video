import { describe, it, expect } from 'vitest';
import { FeedbackBus, FeedbackType } from './feedbackBus';

describe('FeedbackBus Contract', () => {
  it('satisfies port interface', () => {
    const bus = new FeedbackBus();
    expect(typeof bus.on).toBe('function');
    expect(typeof bus.off).toBe('function');
    expect(typeof bus.emit).toBe('function');
    expect(typeof bus.getQueueLength).toBe('function');
    expect(typeof bus.clear).toBe('function');
  });

  it('emits events with correct structure', () => {
    const bus = new FeedbackBus();
    let received: any = null;
    bus.on(event => { received = event; });

    bus.emit({
      type: FeedbackType.ERROR,
      message: 'Test error',
      timestamp: new Date(),
    });

    expect(received).toHaveProperty('type');
    expect(received).toHaveProperty('message');
    expect(received).toHaveProperty('timestamp');
  });
});
