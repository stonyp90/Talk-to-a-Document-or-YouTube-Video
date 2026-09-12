"use client";

import styles from "./Pricing.module.css";
import {
  paidPlanPrice,
  paidPlanUrl,
  resolvePricingCopy,
} from "../content/pricing";

/**
 * What Ursly costs, said in full: free, where your conversations help train
 * the models, or paid, where nothing of yours ever does. The paid figure and
 * its sign-up link come from configuration, so the section can state the deal
 * honestly before billing exists: until both are set, the card says billing is
 * not open instead of showing a number nobody can pay.
 */
export function Pricing({
  locale,
  appHref,
}: {
  locale?: string;
  /** Where the free plan's way in leads: the application's own page. */
  appHref: string;
}) {
  const copy = resolvePricingCopy(locale);
  const price = paidPlanPrice();
  const url = paidPlanUrl();

  return (
    <section
      className={styles.section}
      id="pricing"
      aria-labelledby="pricing-heading"
    >
      <div className={styles.heading}>
        <span className="eyebrow">{copy.eyebrow}</span>
        <h2 id="pricing-heading">{copy.heading}</h2>
        <p className={styles.intro}>{copy.intro}</p>
      </div>

      <ul className={styles.plans} aria-label={copy.planListLabel}>
        {copy.plans.map((plan) => {
          const paid = plan.id === "paid";
          const amount = paid ? (price ?? plan.amount) : plan.amount;
          const href = paid ? url : appHref;
          return (
            <li key={plan.id} className={styles.plan} data-plan={plan.id}>
              <span className={styles.name}>{plan.name}</span>
              <p className={styles.amount} data-announced={paid && !price}>
                {amount}
              </p>
              <p className={styles.cadence}>{plan.cadence}</p>
              <p className={styles.deal}>{plan.deal}</p>
              <ul className={styles.points}>
                {plan.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {href ? (
                <a
                  className={`${paid ? "secondary" : "primary"} ${styles.action}`}
                  href={href}
                >
                  {plan.action}
                </a>
              ) : (
                <p className={styles.pending}>{copy.pending}</p>
              )}
              <p className={styles.note}>{plan.note}</p>
            </li>
          );
        })}
      </ul>

      <p className={styles.promise}>{copy.promise}</p>
      <p className={styles.switchNote}>{copy.switchNote}</p>
    </section>
  );
}
