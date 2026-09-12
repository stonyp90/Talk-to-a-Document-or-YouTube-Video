Feature: Drive the application with a hand
  As a reader whose hands are busy with something other than a keyboard
  I want to choose and ask a question by moving in front of the camera
  So that a conversation does not depend on speaking or typing

  Scenario: Motion is a mode a reader can choose
    When the control modes are listed
    Then motion is offered alongside voice and keyboard
    And motion is marked as beta

  Scenario: The camera is never taken without being asked for
    Given the motion panel is shown
    Then the camera is off until the reader starts it
    And the panel says that nothing is recorded or sent

  Scenario: The page is allowed to use a camera at all
    When the response headers are inspected
    Then the permissions policy allows this origin to use the camera
    And it still allows the microphone and nothing else

  Scenario: A hand crossing the frame chooses the next question
    Given the camera is running with a source ready
    When a hand crosses the frame to the right
    Then the next question is chosen
    When a hand crosses the frame to the left
    Then the previous question is chosen

  Scenario: A wave asks the chosen question
    Given the camera is running with a source ready
    When a hand waves in one place
    Then the chosen question is asked

  Scenario: A wave with no source explains itself instead of failing
    Given the camera is running with no source
    When a hand waves in one place
    Then nothing is asked
    And the reader is told to add a source first

  Scenario: Rising and falling reach the same actions the voice reaches
    Given the camera is running with a source ready
    When a hand rises through the frame
    Then the source is summarized
    When a hand falls through the frame
    Then the answer is stopped

  Scenario: A room that is simply lit differently is not a gesture
    Given the camera is running with a source ready
    When the light in the room changes all at once
    Then nothing is chosen and nothing is asked

  Scenario: A refused camera is explained, and the other modes still work
    Given the motion panel is shown
    When the reader refuses the camera
    Then the reason is shown with what to do next
    And voice and keyboard remain available
