Feature: Keyboard Fallback
  As a user in a quiet environment
  I want to type messages and commands
  So I can interact without voice

  Scenario: Enable keyboard in settings
    Given I am on the workspace page
    When I open settings
    And I enable "keyboard input"
    Then I should see a text composer at the bottom

  Scenario: Send text message
    Given keyboard input is enabled
    When I type "What is this document about?"
    And I press Enter
    Then the message should appear in the conversation

  Scenario: Use slash command
    Given keyboard input is enabled
    When I type "/upload"
    And I press Enter
    Then the file browser should open

  Scenario: Slash command autocomplete
    Given keyboard input is enabled
    When I type "/"
    Then I should see an autocomplete dropdown with commands

  Scenario: Keyboard coexists with voice
    Given keyboard input is enabled
    And voice is active
    When I type a message
    Then voice should remain active
