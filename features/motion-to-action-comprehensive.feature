Feature: Motion to Action
  As a user
  I want to control the application using hand gestures and body motion
  So that I can interact without touching any device

  Background:
    Given the application is running
    And camera access is granted
    And a source (PDF or YouTube video) is loaded

  Scenario: Swipe right triggers next action
    Given the motion camera is active
    When I swipe my hand right
    Then the "next" action should trigger
    And the view should advance

  Scenario: Swipe left triggers previous action
    Given the motion camera is active
    When I swipe my hand left
    Then the "back" action should trigger
    And the view should go back

  Scenario: Swipe up triggers summarize
    Given the motion camera is active
    When I swipe my hand up
    Then the "summarize" action should trigger
    And a summary should be generated

  Scenario: Swipe down triggers stop
    Given a response is streaming
    When I swipe my hand down
    Then the streaming should stop immediately

  Scenario: Hold gesture triggers ask
    Given the motion camera is active
    When I hold my hand still for 2 seconds
    Then the "ask" action should trigger
    And the question input should be focused

  Scenario: Motion works in low light
    Given the room is dimly lit
    When I perform a swipe gesture
    Then the gesture should still be detected
    And the action should trigger

  Scenario: Motion works in bright light
    Given the room is very bright
    When I perform a swipe gesture
    Then the gesture should still be detected
    And the action should trigger

  Scenario: Motion ignores background movement
    Given people are moving in the background
    When I perform a clear swipe gesture
    Then only my gesture should be detected
    And background movement should be ignored

  Scenario: Motion has cooldown between gestures
    Given I just performed a swipe
    When I immediately try another swipe within 500ms
    Then the second swipe should be ignored
    And the cooldown should prevent duplicate triggers

  Scenario: Motion requires minimum energy
    Given the motion camera is active
    When I make a very small, subtle movement
    Then no gesture should be detected
    And the movement should be below the energy threshold

  Scenario: Motion requires minimum swipe distance
    Given the motion camera is active
    When I move my hand less than the swipe threshold
    Then no swipe gesture should be detected
    And it should not trigger any action

  Scenario: Motion fullscreen mode activates
    Given the motion panel is visible
    When I click the fullscreen button
    Then the motion view should expand to fullscreen
    And the camera feed should fill the screen

  Scenario: Motion fullscreen mode deactivates
    Given the motion panel is in fullscreen
    When I click the exit fullscreen button
    Then the motion view should return to normal size

  Scenario: Motion HUD shows gesture overlays
    Given the motion camera is active
    When I look at the interface
    Then I should see eye-tracking visualization
    And hand-tracking visualization
    And gesture direction indicators

  Scenario: Motion action banner appears on trigger
    Given the motion camera is active
    When I trigger a gesture
    Then an action banner should appear briefly
    And show which action was triggered

  Scenario: Motion works with voice simultaneously
    Given both voice and motion are active
    When I swipe up while saying "summarize"
    Then only one summarize action should trigger
    And no duplicate actions should occur

  Scenario: Motion camera permission denied
    Given camera permission is denied
    When I try to activate motion
    Then an error message should appear
    And I should be told how to enable camera access

  Scenario: Motion camera not available
    Given the device has no camera
    When I try to activate motion
    Then a graceful fallback should appear
    And I should be told motion requires a camera

  Scenario: Motion gesture legend is visible
    Given the motion panel is visible
    When I look at the legend
    Then I should see all gesture mappings
    And each gesture should be clearly labeled

  Scenario: Motion does not record or store video
    Given the motion camera is active
    When I perform gestures
    Then no video should be recorded
    And no frames should be stored
    And each frame should be discarded after processing
