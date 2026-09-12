Feature: Sound like a conversation, in the caller's own words and voice

  Spoken answers are heard, not read, and the words that trigger an action are
  whatever the caller actually says. Answering in a particular person's voice
  is a deliberate, consented enrolment, never something a phrase can request.

  Scenario: Prime a spoken conversation differently from a written one
    When a realtime voice session is configured
    Then the assistant is told to answer in short spoken sentences without markup
    And the assistant is told to expect interruptions
    And the written fallback keeps its own instructions

  Scenario: Let the caller finish a thought before answering
    When a realtime voice session is configured
    Then turn detection waits for a finished thought
    And the caller can interrupt the spoken answer
    And microphone noise reduction is applied

  Scenario: Answer in a named voice by default
    When a realtime voice session is configured
    Then a built-in voice is selected
    And the speaking speed is one the provider accepts

  Scenario: Answer in an enrolled person's voice
    Given a custom voice has been provisioned
    When a realtime voice session is configured
    Then the session selects that voice by its identifier

  Scenario: Tell a speaker exactly what to say to lend their voice
    When I ask how to lend my voice in French
    Then I am given the approved consent sentence word for word
    And I am told how long the speech sample must be
    And no phrase spoken in the application can enrol a voice

  Scenario: Recognize a French command the way it was actually spoken
    Given the interface is in French
    When I say "résume ceci s'il te plaît"
    Then the summary action is triggered

  Scenario: Recognize a command transcribed without its accents
    Given the interface is in French
    When I say "resume ceci"
    Then the summary action is triggered

  Scenario: Answer a caller who switches to the other language mid-sentence
    Given the interface is in French
    When I say "go back please"
    Then the back action is triggered

  Scenario: Leave ordinary speech alone
    Given the interface is in French
    When I say "je lisais le backlog hier"
    Then no action is triggered
