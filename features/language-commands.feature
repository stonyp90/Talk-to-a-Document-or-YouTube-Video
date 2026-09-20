Feature: Language-Specific Voice Commands
  As a French-speaking user
  I want to use French voice commands
  So I can interact in my language

  Scenario: French upload command
    Given the language is set to French
    When I say "téléverse"
    Then the file browser should open

  Scenario: French summarize command
    Given the language is set to French
    And a document is loaded
    When I say "résume"
    Then the assistant should summarize the document

  Scenario: English command works in English mode
    Given the language is set to English
    When I say "upload"
    Then the file browser should open

  Scenario: Fuzzy matching with 1 edit distance
    Given the language is set to English
    When I say "uplaod"
    Then the file browser should open
