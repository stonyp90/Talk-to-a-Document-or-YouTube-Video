@local-contract
Feature: Verify local domain boundaries and API contracts
  These checks exercise the real domain and local mock API.
  Mock credentials and deterministic answers do not verify live provider behavior.

  Scenario: Enforce the precise PDF size boundary
    When the PDF size validator receives exactly 25 MiB
    Then the boundary file is accepted and one extra byte is rejected

  Scenario: Enforce the precise context size boundary
    Given context contains exactly 60000 characters
    Then the context boundary is preserved and one extra character is rejected

  Scenario: Reject whitespace-only context
    Given empty context is provided to the domain
    Then empty context is rejected before session construction

  Scenario: Treat document instructions as untrusted context
    Given a document includes instructions to reveal server secrets
    Then session instructions label the source as untrusted reference material

  Scenario: Verify the explicitly simulated session contract
    When the mock session endpoint receives valid context
    Then the response declares simulation with an expiring mock credential

  Scenario: Reject session requests without context
    When a client requests a session without a source
    Then the session endpoint rejects missing source context

  Scenario: Reject text requests without context
    When a client sends a text question without context
    Then the text endpoint rejects the incomplete question request
