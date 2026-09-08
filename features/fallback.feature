Feature: Continue through text when voice is unavailable
  As a user who cannot use a microphone
  I want to ask questions by text
  So that I can still use the source conversation

  Background:
    Given a source has been ingested successfully

  Scenario: Offer text mode when microphone hardware is unavailable
    Given the device has no usable microphone
    When I open the conversation controls
    Then text mode is offered
    And I can submit a text question

  Scenario: Offer text mode when microphone permission is denied
    Given microphone permission is denied
    When I try to start voice chat
    Then I see instructions for enabling microphone access
    And text mode remains available

  Scenario: Submit a text question using the ingested context
    Given text mode is active
    When I submit a text question
    Then the question appears in the conversation transcript
    And the ingested source context is used to produce the response

  Scenario: Render a text assistant response in the conversation transcript
    Given a text question has been submitted
    When the assistant returns a text response
    Then the response is rendered in the conversation transcript
    And the response follows the user question chronologically
