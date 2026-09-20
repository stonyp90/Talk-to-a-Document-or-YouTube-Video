Feature: Feedback UI
  As a user performing actions
  I want clear visual feedback
  So I know what happened

  Scenario: Success flash on file upload
    Given I upload a file
    Then I should see a success flash at the screen edge

  Scenario: Error toast on upload failure
    Given an upload fails
    Then I should see an error toast with outlined red border

  Scenario: Info toast while listening
    Given voice is active
    Then I should see a "Listening..." info toast

  Scenario: Reduced motion support
    Given prefers-reduced-motion is enabled
    When a toast appears
    Then it should fade in without sliding
