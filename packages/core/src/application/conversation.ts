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
      if (!question.trim() || question.length > MAX_QUESTION_CHARACTERS)
        throw new InputValidationError(
          `Enter a question of at most ${MAX_QUESTION_CHARACTERS.toLocaleString("en-US")} characters.`,
          "INVALID_QUESTION",
        );
      return provider.answerTextQuestion(source, question.trim(), history);
    },
  };
}
