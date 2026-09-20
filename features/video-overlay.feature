Feature: Video Overlay
  As a user who wants visual presence
  I want to see my camera feed as a subtle overlay
  So I feel connected without distraction

  Scenario: Enable video overlay in settings
    Given I am on the workspace page
    When I open settings
    And I enable camera
    Then I should see a semi-transparent video layer

  Scenario: Video overlay opacity
    Given the video overlay is active
    Then the overlay opacity should be 15%

  Scenario: Camera permission denied
    Given camera permission is denied
    When I try to enable the camera
    Then I should see a "Camera unavailable" message
