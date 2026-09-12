Feature: Welcome each visitor once, then keep the way in one tap away

  The introduction explains Ursly on the front door, so the story and the
  application can each stay simple: a landing page that says what this is,
  and an application at /app that is nothing but a source and a question.
  A fixed top menu carries a visitor between the two from either side.

  Scenario: Play the introduction on a first visit and land on the story
    When I open the landing page for the first time
    Then the introduction video is playing in my language
    And I can skip the introduction at any time
    When the introduction ends
    Then the landing page is ready and no introduction remains

  Scenario: Do not replay the introduction on a return visit
    Given I have already seen the introduction
    When I open the landing page
    Then no introduction is shown
    And the introduction can be replayed from the top menu

  Scenario: Do not interrupt work in the application with the introduction
    Given I have already seen the introduction
    When I open the application
    Then no introduction is shown
    And the workspace is ready for a source

  Scenario: Serve the introduction and the interface in French for a French browser
    Given my browser prefers French
    When I open the landing page for the first time
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
    When I open the landing page
    And I choose Platform in the top menu
    Then the platform section explains voice now, movement next and the keyboard as the old way
    And the platform section explains connected objects, 3D objects and voice adaptation

  Scenario: Open the story on how we build, before anything else
    When I open the landing page
    Then how we build is the first section of the story
    And every part of the story offers a way into the application

  Scenario: Keep the story and the application in separate places
    When I open the landing page
    Then the landing page tells the story without the workspace
    And the top menu stays fixed while I scroll
    And the application is one tap from the landing page
    And I return to the story from the application

  Scenario: Keep a French reader inside the application when they switch language
    Given my browser prefers French
    When I open the application
    Then the control modes are named in French
    And switching language keeps me in the application

  Scenario: Ask a first question in three actions with the keyboard
    When I open the application
    Then I can add a source and ask a question with at most three actions
