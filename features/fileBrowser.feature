Feature: Immersive File Browser

  Scenario: Open file browser and see root directory
    Given the file browser is loaded
    Then the root directory shows demo files and folders
    And the breadcrumb shows "My Documents"

  Scenario: Navigate into a directory
    Given the file browser is loaded
    When the user navigates into "Projects"
    Then the breadcrumb shows "My Documents / Projects"
    And the grid shows files inside "Projects"

  Scenario: Navigate up to parent directory
    Given the file browser is loaded
    When the user navigates into "Projects"
    And the user navigates up
    Then the breadcrumb shows "My Documents"

  Scenario: Select a file by index
    Given the file browser is loaded
    When the user selects item at index 0
    Then the selected index is 0

  Scenario: Move selection forward and back
    Given the file browser is loaded
    When the user moves to next
    Then the selected index is 0
    When the user moves to next
    Then the selected index is 1
    When the user moves to previous
    Then the selected index is 0

  Scenario: Open selected directory
    Given the file browser is loaded
    When the user selects item at index 0
    And the user opens the selection
    Then the breadcrumb shows "My Documents / Projects"

  Scenario: Open selected file emits intent
    Given the file browser is loaded
    When the user selects item at index 2
    And the user opens the selection
    Then a file selection intent is emitted

  Scenario: Search for files by name
    Given the file browser is loaded
    When the user searches for "Annual"
    Then the search results contain "Annual Report.pdf"
    And the file browser is in search mode

  Scenario: Exit search mode
    Given the file browser is loaded
    When the user searches for "Annual"
    And the user exits search
    Then the file browser is not in search mode
