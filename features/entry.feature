Feature: Land in the workspace, with the story one tap away

  Adding a source is the first thing a visitor sees. The introduction and the
  platform story are offered from the fixed top menu rather than placed in the
  way, so the application itself stays simple: a fixed top menu with the three
  control modes, and the workspace right away.

  Scenario: Land straight in the workspace on a first visit
    When I open the application for the first time
    Then no introduction is shown
    And adding a source is the first thing in the workspace
    And the introduction can be played from the top menu

  Scenario: Land in the workspace on a return visit too
    Given I have already seen the introduction
    When I open the application
    Then no introduction is shown
    And the introduction can be played from the top menu

  Scenario: Keep the workspace page free of the platform story
    When I open the application
    Then the platform story is not on the workspace page
    And the source picker is reachable within the first screen

  Scenario: Serve the introduction and the interface in French for a French browser
    Given my browser prefers French
    When I open the application for the first time
    Then the page language is French
    And the introduction played from the top menu is the French version

  Scenario: Keep the control modes in a fixed top menu while scrolling
    When I open the application
    Then the top menu stays fixed while I scroll
    And voice to action is the selected control mode
    And keyboard to action can be selected
    And motion to action is shown as a beta that is not yet available

  Scenario: Reach the platform story from the top menu
    When I open the application
    And I choose Platform in the top menu
    Then the platform page explains voice, movement and keyboard control
    And the platform page explains connected objects, 3D objects and voice adaptation

  Scenario: Ask a first question in three actions with the keyboard
    When I open the application
    Then I can add a source and ask a question with at most three actions
