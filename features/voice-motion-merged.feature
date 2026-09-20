Feature: Voice and Motion Merged Interface
  As a user
  I want voice and motion to work together seamlessly
  So that I can use either modality without conflict

  Background:
    Given the application is running
    And both voice and motion are active
    And a source is loaded

  Scenario: Voice and motion are always mounted
    Given I am on the application page
    When I inspect the DOM
    Then VoiceActions component should be present
    And MotionActions component should be present
    And both should be active regardless of selected mode

  Scenario: Entry mode controls visual priority, not availability
    Given I select "voice" as the entry mode
    When I look at the interface
    Then voice should be visually primary
    But motion should still be fully functional
    And I can use either at any time

  Scenario: Switching to motion mode keeps voice active
    Given I switch to motion entry mode
    When I speak a command
    Then the voice command should work
    And voice should not be disabled

  Scenario: Switching to text mode keeps voice and motion active
    Given I switch to text (legacy) entry mode
    When I speak a command or make a gesture
    Then both should still work
    And the entry mode should not disable them

  Scenario: Simultaneous voice and motion triggers one action
    Given both voice and motion are active
    When I say "summarize" and swipe up at the same time
    Then only one summarize action should trigger
    And no duplicate actions should occur

  Scenario: Voice and motion share action vocabulary
    Given both voice and motion are active
    When I check the action mappings
    Then voice "summarize" and motion "swipe up" should map to the same action
    And voice "next" and motion "swipe right" should map to the same action
    And all actions should be consistent

  Scenario: Voice and motion dispatch to same handler
    Given both voice and motion are active
    When a voice command is recognized
    And when a motion gesture is detected
    Then both should call the same handleVoiceAction function
    And the dispatch should be unified

  Scenario: Voice and motion do not interfere
    Given I am using voice commands
    When I accidentally move in front of the camera
    Then the motion should not trigger unintended actions
    And only clear gestures should be detected

  Scenario: Voice and motion have independent recognition
    Given both are active
    When voice recognition is processing
    And motion detection is processing
    Then they should operate independently
    And one should not block the other

  Scenario: Voice and motion both show visual feedback
    Given both are active
    When I use voice
    Then voice visual feedback should appear
    When I use motion
    Then motion visual feedback should appear
    And both should be clear and distinct

  Scenario: Voice and motion work in all entry modes
    Given I am in voice entry mode
    Then both voice and motion work
    Given I am in motion entry mode
    Then both voice and motion work
    Given I am in text entry mode
    Then both voice and motion work

  Scenario: Voice and motion mode preference persists
    Given I set my preferred entry mode
    When I reload the page
    Then my preference should be remembered
    And the chosen mode should be active
    But both voice and motion should still work

  Scenario: Voice and motion are bilingual
    Given the language is set to French
    When I use voice commands in French
    Then they should work
    And motion should work the same regardless of language

  Scenario: Voice and motion are accessible
    Given I am using assistive technology
    When voice and motion are active
    Then both should be accessible
    And screen readers should announce them correctly

  Scenario: Voice and motion do not conflict with text input
    Given I am typing in the text input
    When voice or motion triggers
    Then the text input should not be disrupted
    And my typed text should be preserved

  Scenario: Voice and motion are tested together
    Given the test suite
    When integration tests run
    Then voice and motion should be tested together
    And their integration should be verified
