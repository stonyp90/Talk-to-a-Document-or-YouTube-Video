@fault-injection
Feature: Handle unreliable services and networks
  Local tests inject transport and request failures into the real client.
  Passing these tests does not verify physical network or live audio behavior.

  Scenario: Reconnect after a temporary WebRTC interruption
    Given a voice session was connected
    When the WebRTC connection is temporarily interrupted
    Then the UI enters a reconnecting state
    And the client attempts recovery
    And the UI returns to connected when recovery succeeds

  Scenario: Preserve the visible transcript during reconnect
    Given the conversation contains transcript turns
    When the realtime connection is interrupted
    Then all visible transcript turns remain available

  Scenario: Display a degraded-network status
    Given a voice session is connected
    When network quality degrades
    Then the UI shows a degraded or reconnecting status
    And the user receives a clear recovery message

  Scenario: Allow the user to retry after a backend timeout
    Given an ingestion or session request times out
    When the timeout error is displayed
    Then a retry action is offered
    And the application does not show a false success state

  Scenario: Avoid claiming success when extraction fails
    Given extraction fails after a source is submitted
    When the result is rendered
    Then the source is not marked ready
    And starting a voice session is disabled
