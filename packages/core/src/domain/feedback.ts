export type FeedbackRating = "helpful" | "partially" | "not-helpful";

export type FeedbackSubmission = {
  id: string;
  rating: FeedbackRating;
  comment?: string;
  sourceId: string;
  accountId: string;
  plan: "free" | "paid";
  createdAt: number;
};

export const FEEDBACK_RATINGS: readonly FeedbackRating[] = [
  "helpful",
  "partially",
  "not-helpful",
];

export const MAX_FEEDBACK_COMMENT_CHARACTERS = 1000;

export function isValidRating(value: unknown): value is FeedbackRating {
  return typeof value === "string" && FEEDBACK_RATINGS.includes(value as FeedbackRating);
}
