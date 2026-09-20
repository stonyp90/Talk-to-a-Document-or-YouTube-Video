Feature: Legacy Keyboard Input
  As a user
  I want to type my questions and commands
  So that I can use the application traditionally

  Background:
    Given the application is running
    And a source (PDF or YouTube video) is loaded

  Scenario: Text mode is marked as legacy
    Given I am on the application page
    When I look at the mode switcher
    Then I should see "Text" mode
    And it should be marked as "Legacy"
    But it should still be fully functional

  Scenario: Text input accepts questions
    Given I am in text mode
    When I type a question
    And I press Enter
    Then the question should be sent
    And the answer should stream back

  Scenario: Text input supports multiline
    Given I am in text mode
    When I type text
    And I press Shift+Enter
    Then a new line should be added
    And the text should not be sent

  Scenario: Text input sends on Enter
    Given I am in text mode
    When I type a question
    And I press Enter (not Shift+Enter)
    Then the question should be sent immediately

  Scenario: Text input clears after sending
    Given I am in text mode
    When I send a question
    Then the input field should clear
    And I should be able to type another question

  Scenario: Text mode works alongside voice and motion
    Given voice and motion are also active
    When I switch to text mode
    Then text input should work
    And voice and motion should still be available

  Scenario: Text mode persists across reloads
    Given I am in text mode
    When I reload the page
    Then text mode should still be active
    And my preference should be remembered

  Scenario: Text input has proper focus management
    Given I am in text mode
    When I click the input field
    Then it should receive focus
    And the cursor should appear
    And I should be able to type immediately

  Scenario: Text input handles long messages
    Given I am in text mode
    When I type a very long message (1000+ characters)
    And I press Enter
    Then the message should be sent
    And it should not be truncated
    And the UI should handle it gracefully

  Scenario: Text input handles special characters
    Given I am in text mode
    When I type special characters: @#$%^&*()
    And I press Enter
    Then the message should be sent correctly
    And special characters should be preserved

  Scenario: Text input handles unicode
    Given I am in text mode
    When I type unicode characters: 你好世界 🌍
    And I press Enter
    Then the message should be sent correctly
    And unicode should be preserved

  Scenario: Text input empty message is prevented
    Given I am in text mode
    When I press Enter without typing anything
    Then no message should be sent
    And the input should remain empty

  Scenario: Text input whitespace-only is prevented
    Given I am in text mode
    When I type only spaces and press Enter
    Then no message should be sent
    And the input should be cleared or trimmed

  Scenario: Text mode is accessible
    Given I am in text mode
    When I use a keyboard
    Then I should be able to tab to the input
    And I should be able to type and submit
    And screen readers should announce it correctly

  Scenario: Text mode works on mobile
    Given I am on the mobile app in text mode
    When I tap the input field
    Then the keyboard should appear
    And I should be able to type and send
