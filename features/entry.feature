Feature: Welcome each visitor once, then keep the controls one tap away

  The introduction explains Ursly, so the application itself can stay simple:
  a fixed top menu with the control modes, and the workspace right away. The
  menu reads as a progression, not as a menu of equals: voice is the way in,
  motion is what comes next, and the keyboard is the old way that still works.

  Scenario: Play the introduction on a first visit and land in the workspace
    When I open the application for the first time
    Then the introduction video is playing in my language
    And I can skip the introduction at any time
    When the introduction ends
    Then the workspace is ready and no introduction remains

  Scenario: Do not replay the introduction on a return visit
    Given I have already seen the introduction
    When I open the application
    Then no introduction is shown
    And the introduction can be replayed from the top menu

  Scenario: Serve the introduction and the interface in French for a French browser
    Given my browser prefers French
    When I open the application for the first time
    Then the page language is French
    And the introduction video is the French version

  Scenario: Keep the control modes in a fixed top menu while scrolling
    When I open the application
    Then the top menu stays fixed while I scroll
    And the control modes read voice first, motion next and keyboard last
    And voice to action is the selected control mode
    And motion to action is shown as the beta that comes next for headsets
    And keyboard to action is marked legacy and can still be selected

  Scenario: Reach the platform section from the top menu
    When I open the application
    And I choose Platform in the top menu
    Then the platform section explains voice now, movement next and the keyboard as the old way
    And the platform section explains connected objects, 3D objects and voice adaptation

  Scenario: Ask a first question in three actions with the keyboard
    When I open the application
    Then I can add a source and ask a question with at most three actions
