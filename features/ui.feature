Feature: Provide a polished mobile-first conversation UI

  Scenario: Render the source selector at a 390 px viewport
    Given the browser viewport is 390 pixels wide
    When I open the application
    Then the PDF and YouTube source options are visible
    And the primary controls are usable without horizontal scrolling

  Scenario: Show loading and disabled states during ingestion
    Given I have submitted a source
    When ingestion is in progress
    Then a loading state is visible
    And duplicate submission controls are disabled

  Scenario: Show an empty state before a source is selected
    When I open the application without selecting a source
    Then I see an explanatory empty state
    And I see how to upload a PDF or enter a YouTube URL

  Scenario: Show a clear error and retry action after failure
    Given source ingestion has failed
    When the error state is displayed
    Then the error explains what happened in plain language
    And a retry action is available when retrying is safe

  Scenario: Show microphone, mute, stop, and fallback controls
    Given a source is ready for conversation
    When the conversation controls are displayed
    Then start, mute, unmute, stop, and text fallback actions are discoverable

  Scenario: Show conversation turns in chronological order
    Given user and assistant transcript events have arrived
    When the conversation is rendered
    Then turns are displayed in their arrival order
    And user and assistant turns are visually distinguishable

  Scenario: Show connection status throughout the session lifecycle
    When the session changes between idle, preparing, connecting, connected, reconnecting, ended, and error
    Then the UI displays the corresponding status
    And controls match the current session state

  Scenario: Remain usable on a narrow mobile viewport without horizontal scrolling
    Given the browser viewport is narrower than 390 pixels
    When I use the source and conversation screens
    Then all essential content remains reachable
    And no horizontal scrolling is required
