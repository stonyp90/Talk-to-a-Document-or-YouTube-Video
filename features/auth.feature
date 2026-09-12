Feature: Require an account and cap what it can spend

  Every endpoint behind these scenarios spends provider credit. Anonymous access
  hands that budget to whoever finds the address, and an account alone does not
  fix it: whoever signs up can still burn it. Both halves are checked here.

  Scenario: Refuse an anonymous request to a paid endpoint
    Given the sign-in gate is required
    When an anonymous client asks a question about a source
    Then the request is refused as unauthenticated
    And no answer is produced

  Scenario: Let a signed-in reader ask a question
    Given a reader has signed in with a mailed code
    When the reader asks a question about a source
    Then the answer is grounded in the source

  Scenario: Refuse a reader who has spent their allowance
    Given a reader has signed in with a mailed code
    And the reader has spent their whole allowance
    When the reader asks a question about a source
    Then the request is refused with a clear usage-limit message
    And the reply says when the allowance reopens

  Scenario: Never hand the sign-in code back over the API
    Given the sign-in gate is required
    When a client asks for a sign-in code
    Then the reply carries no body at all
    And the code reaches the reader only through the notifier

  Scenario: Send one branded message, in the reader's language
    Given the sign-in gate is required
    When a French reader asks for a sign-in code
    Then the message is the one branded template, word for word
    And it is written in the reader's language
    And it carries no way in but the code
