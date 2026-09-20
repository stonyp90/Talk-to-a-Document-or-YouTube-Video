import { useFeedback } from "./useFeedback";
import { FeedbackType } from "@talk/core/domain/feedbackBus";
import styles from "./FeedbackOverlay.module.css";

export function FeedbackOverlay() {
  const { events, dismissEvent } = useFeedback();

  if (events.length === 0) return null;

  return (
    <div className={styles.overlay}>
      {events.slice(0, 3).map((event, index) => {
        const typeClass = styles[event.type] || styles.info;
        const role = event.type === FeedbackType.ERROR ? "alert" : "status";
        const ariaLive =
          event.type === FeedbackType.ERROR ? "assertive" : "polite";

        return (
          <div
            key={event.timestamp.getTime()}
            className={`${styles.toast} ${typeClass}`}
            role={role}
            aria-live={ariaLive}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span className={styles.message}>{event.message}</span>
            {event.action && (
              <button
                className={styles.action}
                onClick={() => dismissEvent(event.timestamp.getTime())}
              >
                {event.action}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
