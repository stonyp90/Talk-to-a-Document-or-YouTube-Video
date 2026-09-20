Feature: Brain to Action (Beta)
  As a user
  I want to see that brain-computer interface is coming
  So that I understand the future direction of the application

  Background:
    Given the application is running

  Scenario: Brain mode appears in mode switcher
    Given I am on the application page
    When I look at the mode switcher
    Then I should see a "Brain" option
    And it should be marked as "Beta"
    And it should be disabled/unselectable

  Scenario: Brain mode shows as unavailable
    Given I am on the application page
    When I try to click the Brain mode button
    Then nothing should happen
    And the button should have aria-disabled="true"
    And it should be styled as unavailable

  Scenario: Brain mode beta badge is visible
    Given I am on the application page
    When I look at the Brain mode button
    Then I should see a "Beta" badge
    And the badge should be clearly visible

  Scenario: Brain mode is not in EntryMode type
    Given the application code
    When I check the EntryMode type definition
    Then it should only include "voice", "text", "motion"
    And "brain" should not be a valid entry mode

  Scenario: Brain mode has no domain logic
    Given the application code
    When I search for brain-related domain files
    Then no brain domain logic should exist
    And no brain adapters should exist

  Scenario: Brain mode mobile shows as coming soon
    Given I am on the mobile app
    When I look at the mode bar
    Then I should see the brain option
    And it should indicate it's coming soon
    And it should not be selectable

  Scenario: Brain mode sets expectations
    Given the brain mode is visible but disabled
    When users see it
    Then they should understand it's a future feature
    And they should learn what is coming
    And they should not be able to select it

  Scenario: Brain mode does not break navigation
    Given the brain mode button is present
    When I use keyboard navigation
    Then the brain button should be skipped
    And focus should move to the next available mode

  Scenario: Brain mode is accessible
    Given the brain mode button is present
    When I use a screen reader
    Then it should announce "Brain mode, Beta, unavailable"
    And the purpose should be clear

  Scenario: Brain mode styling is distinct
    Given the brain mode button is present
    When I look at it visually
    Then it should be styled differently from active modes
    And it should use the "mode-unavailable" class
    And it should be visually muted
