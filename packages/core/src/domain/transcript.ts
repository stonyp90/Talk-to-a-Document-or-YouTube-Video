export class TranscriptUnavailableError extends Error {
  readonly code = "TRANSCRIPT_UNAVAILABLE";
  constructor(
    message: string,
    readonly reason: string = "NO_CAPTIONS",
  ) {
    super(message);
    this.name = "TranscriptUnavailableError";
  }
}
