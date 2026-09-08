@external
Feature: Have a live voice conversation
  As a user with an ingested source
  I want to speak with the assistant in real time
  So that I can explore the source naturally

  Background:
    Given a source has been ingested successfully

  Scenario: Start a voice chat and establish WebRTC
    When I select "Start Voice Chat"
    Then the client requests a Realtime session from the backend
    And the browser establishes a WebRTC connection
    And the connection status becomes "Connected"

  Scenario: Receive a short-lived ephemeral token from the backend
    When the client requests a Realtime session
    Then the backend authenticates server-side with the Realtime provider
    And the client receives only a short-lived ephemeral token

  Scenario: Speak a question and see the user transcript
    Given the voice session is connected
    When I speak a question
    Then microphone audio is sent through the WebRTC session
    And my transcript appears in the conversation in real time

  Scenario: Hear a spoken assistant response
    Given the voice session is connected
    When the assistant responds to my question
    Then a remote audio track is received
    And I hear the spoken assistant response

  Scenario: See assistant transcript events in real time
    Given the voice session is connected
    When the assistant response transcript events arrive
    Then the assistant response appears incrementally in the conversation
    And the final response is shown in chronological order

  Scenario: Ask a follow-up question using the same source context
    Given I have received an answer in the active session
    When I ask a follow-up question
    Then the follow-up is sent in the same conversation
    And the source context remains available to the assistant

  Scenario: Interrupt an assistant response by speaking
    Given the assistant is speaking
    When I begin speaking
    Then the assistant audio is interrupted
    And the new user turn is processed

  Scenario: Mute the microphone
    Given the voice session is connected
    When I select mute
    Then the local microphone track is disabled
    And no microphone audio is sent while muted
    And the UI shows the muted state

  Scenario: Unmute the microphone
    Given the microphone is muted
    When I select unmute
    Then the local microphone track is enabled
    And the UI shows the active microphone state

  Scenario: Stop the session and release the microphone
    Given the voice session is connected
    When I select stop
    Then the WebRTC connection is closed
    And microphone access is released
    And the connection status becomes "Disconnected"

  Scenario: Show connecting and connected status
    When I start a voice chat
    Then the UI shows "Preparing" or "Connecting" while setup is in progress
    And the UI shows "Connected" only after WebRTC is established

  Scenario: Handle a Realtime connection failure
    Given I am starting or using a voice session
    When the Realtime connection fails
    Then the UI shows a clear connection error
    And the text fallback remains available
