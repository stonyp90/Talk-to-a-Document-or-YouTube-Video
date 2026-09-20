@human-sense
Feature: One immersive Sense to Action experience

  Voice, movement and keyboard share one source and one conversation.
  Source selection and settings appear only when requested, without adding
  sections to scroll through or interrupting an active input channel.

  Scenario: Keep the complete workspace inside desktop and mobile viewports
    Given the human sense workspace uses local provider fixtures
    When I open the unified workspace at desktop and mobile sizes
    Then the complete workspace fits each viewport without page scrolling
    And Sense is primary while Keyboard is Legacy and Brain is Beta

  Scenario: Keep source selection and settings accessible on demand
    Given the human sense workspace uses local provider fixtures
    When I open the unified workspace source picker
    Then keyboard focus stays inside the source picker
    And closing the source picker returns focus to its opener
    When I open the unified workspace settings
    Then keyboard focus stays inside settings
    And closing settings returns focus to its opener

  Scenario: Keep the same experience after loading a source and changing input
    Given the human sense workspace uses local provider fixtures
    When I load the human sense PDF fixture
    And I ask a question with the unified keyboard input
    Then the answer appears in the same immersive workspace
    And the shared experience control remains available after changing input preference

  Scenario: Start and stop every input channel with one deliberate action
    Given the human sense workspace uses local provider fixtures
    When I arrive at the unified experience without starting it
    Then no microphone or camera has been started
    When I start the shared experience
    Then voice and movement are active together
    When I stop the shared experience
    Then both input channels release their resources
