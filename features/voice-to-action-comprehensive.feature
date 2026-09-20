Feature: Voice to Action
  As a user
  I want to control the application using voice commands
  So that I can interact hands-free with documents and videos

  Background:
    Given the application is running
    And a source (PDF or YouTube video) is loaded

  Scenario: Voice command triggers YouTube search
    Given I am on the application page
    When I say "youtube"
    Then the YouTube search interface should appear
    And I should be able to speak a search query

  Scenario: Voice command triggers PDF upload
    Given I am on the application page
    When I say "upload"
    Then the file picker should open
    And I should be able to select a PDF file

  Scenario: Voice command summarizes content
    Given a source is loaded and ready
    When I say "summarize"
    Then a summary request should be sent
    And the response should stream back

  Scenario: Voice command asks a question
    Given a source is loaded and ready
    When I say "ask" followed by a question
    Then the question should be sent to the conversation
    And the answer should stream back

  Scenario: Voice command stops current action
    Given a response is streaming
    When I say "stop"
    Then the streaming should halt immediately

  Scenario: Voice command navigates forward
    Given multiple conversation turns exist
    When I say "next"
    Then the view should scroll to the next turn

  Scenario: Voice command navigates backward
    Given multiple conversation turns exist
    When I say "back"
    Then the view should scroll to the previous turn

  Scenario: Voice command cancels current operation
    Given an operation is in progress
    When I say "cancel"
    Then the operation should be cancelled
    And the UI should return to idle state

  Scenario: Voice command activates dictation mode
    Given the microphone is active
    When I say "voice"
    Then dictation mode should activate
    And my speech should be transcribed as text

  Scenario: Voice command works in French
    Given the language is set to French
    When I say "résume"
    Then the summarize action should trigger

  Scenario: Near-miss voice command is tolerated
    Given the microphone is active
    When I say "summraize" (one edit distance from "summarize")
    Then the summarize action should still trigger

  Scenario: Voice command with negation is ignored
    Given the microphone is active
    When I say "don't summarize"
    Then no action should trigger

  Scenario: Voice command in clause is ignored
    Given the microphone is active
    When I say "I want you to, uh, summarize"
    Then only "summarize" should trigger, not filler words

  Scenario: Voice trigger customization persists
    Given I customize the "youtube" trigger to "video"
    When I reload the page
    And I say "video"
    Then the YouTube search should trigger

  Scenario: Voice trigger has character limit
    Given I try to set a trigger longer than 80 characters
    Then the trigger should be rejected
    And an error message should appear

  Scenario: Maximum voice triggers enforced
    Given I already have 32 custom triggers
    When I try to add another
    Then the addition should be rejected
    And I should be told to remove one first

  Scenario: Voice consent is required before first use
    Given this is the first time using voice
    When I activate the microphone
    Then a consent dialog should appear
    And I must accept before voice works

  Scenario: Voice errors don't leak credentials
    Given a voice recognition error occurs
    When the error is displayed
    Then no API keys or credentials should be visible

  Scenario: Voice works with motion simultaneously
    Given both voice and motion are active
    When I say "summarize" while making a swipe-up gesture
    Then only one summarize action should trigger
    And no duplicate actions should occur

  Scenario: Voice echo is suppressed
    Given the assistant is speaking
    When the microphone picks up the assistant's voice
    Then the echoed speech should not trigger commands
