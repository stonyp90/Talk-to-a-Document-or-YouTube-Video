export enum FeedbackType {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CORRECTION = 'correction',
}

export interface FeedbackEvent {
  type: FeedbackType;
  message: string;
  timestamp: Date;
  duration?: number;
  action?: string;
}

export type FeedbackListener = (event: FeedbackEvent) => void;

export class FeedbackBus {
  private listeners: FeedbackListener[] = [];
  private queue: FeedbackEvent[] = [];
  private readonly MAX_QUEUE_SIZE = 20;

  on(listener: FeedbackListener): void {
    this.listeners.push(listener);
  }

  off(listener: FeedbackListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  emit(event: FeedbackEvent): void {
    this.queue.push(event);
    if (this.queue.length > this.MAX_QUEUE_SIZE) {
      const dropped = this.queue.shift();
      console.warn('FeedbackBus: dropped event', dropped);
    }
    this.listeners.forEach(listener => listener(event));
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}
