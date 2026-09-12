Feature: Lend Ursly a voice, on purpose and only on purpose

  Ursly answers in a preset voice, which asks nothing of anyone. A person can
  lend it theirs instead, but only by asking for it in the interface: the
  microphone opens after that press and never before, and what it captures is
  thrown away unless they say to keep it.

  Scenario: Answer in the preset voice without asking anyone anything
    Given a person who has never lent their voice
    Then Ursly answers in its preset voice
    And the microphone is closed
    And no recording of their voice is kept

  Scenario: Refuse to start recording because of something said out loud
    Given a person who has never lent their voice
    When they say "learn my voice" out loud
    Then the microphone is closed
    And no recording of their voice is kept

  Scenario: Open the microphone only after an explicit opt-in
    Given a person who has never lent their voice
    When they choose to lend their voice
    Then the microphone is recording
    And they are asked to approve or decline the recording

  Scenario: Keep the recording only once the speaker approves it
    Given a person who is recording a sample
    When they have spoken for 12 seconds
    Then no recording of their voice is kept
    When they approve the recording
    Then the recording is kept
    And Ursly can answer in the voice they lent

  Scenario: Discard the recording the moment they decline
    Given a person who is recording a sample
    When they have spoken for 12 seconds
    And they decline the recording
    Then no recording of their voice is kept
    And the interface says the recording was discarded

  Scenario: Never keep a recording because a decision was slow
    Given a person who is recording a sample
    When they have spoken for 600 seconds
    Then they are asked to approve or decline the recording
    And no recording of their voice is kept

  Scenario: Refuse a sample too short for the provider to use
    Given a person who is recording a sample
    When they have spoken for 2 seconds
    And they approve the recording
    Then no recording of their voice is kept
    And they are asked to approve or decline the recording

  Scenario: Delete a lent voice in one action
    Given a person who has approved a recording
    When they delete their voice sample
    Then no recording of their voice is kept
    And Ursly answers in its preset voice
