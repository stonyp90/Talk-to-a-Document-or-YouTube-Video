Feature: Prepare source context for conversation
  As the conversation service
  I want to build context from the ingested source
  So that the assistant can answer questions about it

  Scenario: Make extracted PDF text available to a new Realtime session
    Given a PDF has been ingested successfully
    When a Realtime session is prepared
    Then the complete extracted PDF text is included in the session context

  Scenario: Make extracted YouTube text available to a new Realtime session
    Given a YouTube transcript has been ingested successfully
    When a Realtime session is prepared
    Then the complete transcript is included in the session context

  Scenario: Preserve source text without chunking or summarization
    Given source text is within the configured safety limit
    When context is constructed
    Then the source text is passed directly to the session instructions
    And no unrequested chunking or summarization is applied

  Scenario: Reject a context payload that exceeds the configured safety limit
    Given source text exceeds the configured safety limit
    When a Realtime session is prepared
    Then the context request is rejected safely
    And I see an actionable context-size error
