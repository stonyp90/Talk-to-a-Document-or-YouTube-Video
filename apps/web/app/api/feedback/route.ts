import { z } from "zod/v4";
import { errorResponse, json, jsonError, rateLimit } from "@/apps/web/src/http";
import { requireAccount } from "@/apps/web/src/auth";
import { getAccountPlan } from "@/apps/web/src/auth";
import {
  isValidRating,
  MAX_FEEDBACK_COMMENT_CHARACTERS,
  type FeedbackSubmission,
} from "@/packages/core/src/domain/feedback";

const FEEDBACK_RATE_LIMIT = 10;
const FEEDBACK_RATE_WINDOW_MS = 60_000;

const feedbackBodySchema = z.object({
  rating: z.string().refine(isValidRating, {
    message: "Rating must be helpful, partially, or not-helpful.",
  }),
  comment: z.string().trim().max(MAX_FEEDBACK_COMMENT_CHARACTERS).optional(),
  sourceId: z.string().min(1, "A sourceId is required."),
});

const feedbackStore = new Map<string, FeedbackSubmission>();

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    name: "feedback",
    limit: FEEDBACK_RATE_LIMIT,
    windowMs: FEEDBACK_RATE_WINDOW_MS,
  });
  if (limited) return limited;

  const account = await requireAccount(request);
  if (account instanceof Response) return account;

  try {
    const parsed = feedbackBodySchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError(
        "INVALID_FEEDBACK",
        "Provide a rating (helpful, partially, or not-helpful) and a sourceId.",
        400,
      );

    const { rating, comment, sourceId } = parsed.data;
    const plan = getAccountPlan(account.id);

    const submission: FeedbackSubmission = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `feedback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      rating,
      comment: comment || undefined,
      sourceId,
      accountId: account.id,
      plan,
      createdAt: Date.now(),
    };

    feedbackStore.set(submission.id, submission);

    return json({ id: submission.id }, 201);
  } catch (error) {
    return errorResponse(error, "The feedback could not be saved.");
  }
}

export function getFeedbackStore(): Map<string, FeedbackSubmission> {
  return feedbackStore;
}
