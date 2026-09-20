import { useState, useCallback, useEffect, useRef } from 'react';
import { FeedbackBus, FeedbackType, FeedbackEvent } from '@talk/core/domain/feedbackBus';

export function useFeedback() {
  const [events, setEvents] = useState<FeedbackEvent[]>([]);
  const busRef = useRef(new FeedbackBus());

  useEffect(() => {
    const bus = busRef.current;
    const listener = (event: FeedbackEvent) => {
      setEvents(prev => [...prev, event]);
    };
    bus.on(listener);
    return () => {
      bus.off(listener);
    };
  }, []);

  const emitSuccess = useCallback((message: string) => {
    busRef.current.emit({ type: FeedbackType.SUCCESS, message, timestamp: new Date(), duration: 1200 });
  }, []);

  const emitInfo = useCallback((message: string) => {
    busRef.current.emit({ type: FeedbackType.INFO, message, timestamp: new Date(), duration: 3000 });
  }, []);

  const emitWarning = useCallback((message: string) => {
    busRef.current.emit({ type: FeedbackType.WARNING, message, timestamp: new Date(), duration: 4000 });
  }, []);

  const emitError = useCallback((message: string, action?: string) => {
    busRef.current.emit({ type: FeedbackType.ERROR, message, timestamp: new Date(), duration: 6000, action });
  }, []);

  const emitCorrection = useCallback((message: string) => {
    busRef.current.emit({ type: FeedbackType.CORRECTION, message, timestamp: new Date(), duration: 2000 });
  }, []);

  const dismissEvent = useCallback((timestamp: number) => {
    setEvents(prev => prev.filter(e => e.timestamp.getTime() !== timestamp));
  }, []);

  return { events, emitSuccess, emitInfo, emitWarning, emitError, emitCorrection, dismissEvent };
}
