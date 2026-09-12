/**
 * How an answer should sound when it is heard rather than read. A spoken turn
 * that arrives as a written paragraph is the single biggest reason a voice
 * assistant feels artificial: it reads punctuation nobody can hear, and it
 * holds the floor for far too long before the caller can react.
 */
export const SPOKEN_DELIVERY_GUIDANCE: readonly string[] = [
  "You are speaking out loud, so write every answer the way a person talks: short sentences, one idea at a time, no markdown, no bullet points, no headings, no emoji and no URLs read character by character.",
  "Answer in two or three sentences, then stop and let the caller react. Offer the detail only if they ask for it.",
  "Expect to be interrupted. When the caller cuts in, drop the rest of the sentence and answer what they just asked.",
  "Speak the caller's language, matching the language they used in their last turn, and keep numbers, names and quotations from the source exact.",
];

export type Delivery = "text" | "voice";
