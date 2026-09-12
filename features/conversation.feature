Feature: Hold a conversation rather than submit a form

  A reader who has to press a button between every sentence is filling in a
  form. These scenarios describe the two things that turn that into a
  conversation: speech that carries its own meaning, and an answer that arrives
  while it is being written.

  Scenario: Run a command spoken inside an ordinary sentence
    When the reader says "can you go back please"
    Then the back action runs
    And nothing is left waiting to be sent

  Scenario: Ignore a hypothesis the recogniser has not settled on
    When the recogniser offers "back" as an unsettled guess
    Then no action runs
    And the words are only shown as heard so far

  Scenario: Turn free speech into the question
    When the reader says "what does this source actually claim"
    Then the words become the question
    And the question is sent once the reader stops speaking

  Scenario: Prefer the reader's own wording over a built-in shortcut
    When the reader says "summarize this in three short points"
    Then the whole sentence is sent as the question
    And the built-in summary shortcut does not run

  Scenario: Name a video instead of spelling its address
    When the reader says "YouTube Miles Davis Kind of Blue"
    Then the words after the command are used as a search
    And the command does not ask the reader for a link

  Scenario: Hear a French command in the French interface
    When the reader says "peux-tu résumer ça" in French
    Then the summarize action is recognised

  Scenario: Write the answer as it arrives
    Given a source is ready and the reader has asked a question
    When the answer is produced
    Then the words appear as they arrive
    And the finished answer is shown in full

  Scenario: Keep the words already written when the reader stops the answer
    Given an answer is still being written
    When the reader stops it
    Then the words already written remain
    And the failure state is not shown

  Scenario: Fall back when the connection cannot stream
    Given the connection cannot carry an event stream
    When the reader asks a question
    Then the answer is fetched in one piece instead
    And the reader still receives it

  Scenario: Keep one thread of memory across speaking and typing
    Given the reader has spoken an exchange in a live voice session
    When the reader then types a follow-up question
    Then the spoken exchange is part of the history the answer reads
