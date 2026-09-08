@external
Feature: Validate mobile clients on simulators

  Scenario: Launch the iOS client against the local API
    Given an iOS simulator is booted
    When I launch the native client with the host API URL
    Then the application starts successfully
    And the source selection screen is visible

  Scenario: Launch the Android client against the local API
    Given an Android emulator is booted and configured with the host gateway
    When I launch the native client with the host API URL
    Then the application starts successfully
    And the source selection screen is visible

  Scenario: Select a PDF from the simulator test fixture
    Given the native client is running on a simulator
    When I select the supplied PDF fixture
    Then the PDF is sent to the local API
    And ingestion progress and completion are visible

  Scenario: Display extracted text on the simulator
    Given a simulator PDF ingestion has completed
    When I open the source preview
    Then extracted text is readable on the mobile screen
    And the preview can be expanded and collapsed

  Scenario: Start and stop a mock voice conversation on the simulator
    Given the native client is using the realtime mock
    When I start and then stop a voice conversation
    Then the simulator shows preparing, connected, and disconnected states
    And microphone resources are released on stop

  Scenario: Use text fallback on the simulator
    Given microphone access is unavailable or denied on the simulator
    When I choose text fallback
    Then I can submit a question
    And the assistant response is displayed
