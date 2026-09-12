import {
  buildContextInstructions,
  InputValidationError,
  type IngestedSource,
} from "../domain/ingestion";
import type { ConversationPort, ConversationTurn } from "./ports";

export const MAX_QUESTION_CHARACTERS = 4000;
const MAX_SDP_CHARACTERS = 100000;

export function createConversation(
  provider: ConversationPort,
  contextBudget?: number,
): ConversationPort {
  /** Fails fast on an unusable source before any paid provider call is made. */
  const guard = (source: IngestedSource) =>
    buildContextInstructions(source, contextBudget);

  /** Shared by both text paths so they cannot drift apart. */
  const requireQuestion = (question: string) => {
    if (!question.trim() || question.length > MAX_QUESTION_CHARACTERS)
      throw new InputValidationError(
        `Enter a question of at most ${MAX_QUESTION_CHARACTERS.toLocaleString("en-US")} characters.`,
        "INVALID_QUESTION",
      );
    return question.trim();
  };

  return {
    async createRealtimeSession(source) {
      guard(source);
      return provider.createRealtimeSession(source);
    },
    async createRealtimeCallAnswer(sdp, source) {
      guard(source);
      if (!sdp.trim() || sdp.length > MAX_SDP_CHARACTERS)
        throw new InputValidationError(
          "Invalid session description.",
          "INVALID_SDP",
        );
      return provider.createRealtimeCallAnswer(sdp, source);
    },
    async answerTextQuestion(
      source: IngestedSource,
      question: string,
      history?: ConversationTurn[],
    ) {
      guard(source);
      return provider.answerTextQuestion(
        source,
        requireQuestion(question),
        history,
      );
    },
    /**
     * Deliberately not `async`: validation runs while the caller is still on
     * the call stack, so a rejected question fails before the reader is handed
     * an iterable and can never surface as a half-written answer.
     */
    streamTextAnswer(
      source: IngestedSource,
      question: string,
      history?: ConversationTurn[],
    ) {
      guard(source);
      return provider.streamTextAnswer(
        source,
        requireQuestion(question),
        history,
      );
    },
  };
}
