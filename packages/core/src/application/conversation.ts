import {
  buildContextInstructions,
  InputValidationError,
  type IngestedSource,
} from "../domain/ingestion";
import type { ConversationPort } from "./ports";

export function createConversation(
  provider: ConversationPort,
): ConversationPort {
  return {
    async createRealtimeSession(source) {
      buildContextInstructions(source);
      return provider.createRealtimeSession(source);
    },
    async createRealtimeCallAnswer(sdp, source) {
      buildContextInstructions(source);
      if (!sdp.trim() || sdp.length > 100000)
        throw new InputValidationError(
          "Invalid session description.",
          "INVALID_SDP",
        );
      return provider.createRealtimeCallAnswer(sdp, source);
    },
    async answerTextQuestion(source: IngestedSource, question: string) {
      buildContextInstructions(source);
      if (!question.trim() || question.length > 4000)
        throw new InputValidationError(
          "Enter a question of at most 4,000 characters.",
          "INVALID_QUESTION",
        );
      return provider.answerTextQuestion(source, question.trim());
    },
  };
}
