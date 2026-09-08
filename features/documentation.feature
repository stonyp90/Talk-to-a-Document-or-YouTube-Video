Feature: Document how to use and operate the project

  @host
  Scenario: Follow the README to run the complete project locally
    When a new developer follows the README
    Then the developer can start the Compose environment
    And the developer can run the web application locally
    And the developer can run the local acceptance tests

  Scenario: Find environment variables and secret configuration guidance
    When I read the configuration documentation
    Then required local variables are listed
    And server-only secrets are clearly identified
    And production secrets are directed to the approved AWS secret mechanism

  Scenario: Find architecture and trade-off explanations
    When I read the technical overview
    Then frontend, backend, provider, storage, and infrastructure boundaries are explained
    And Lambda container deployment is compared with ECS
    And the cheapest suitable demo choice is stated

  Scenario: Find the YouTube cloud limitation and local workaround
    When I read the ingestion documentation
    Then the YouTube transcript provider limitation is explained
    And the deterministic local transcript fallback is documented
    And deployed retrieval behavior is documented if enabled

  Scenario: Find the AI-use disclosure
    When I read the project documentation
    Then AI-assisted work and its role in the implementation are disclosed

  Scenario: Find the 10-15 minute walkthrough script
    When I read the delivery documentation
    Then a walkthrough script covers source ingestion, preview, voice, fallback, tests, and deployment decisions

  Scenario: Find test and deployment commands
    When I read the project commands section
    Then local, unit, Gherkin, browser, simulator, Docker, and deployment commands are documented

  Scenario: Find simulator setup instructions
    When I read the mobile development documentation
    Then iOS simulator setup is documented
    And Android SDK, emulator, host gateway, and port forwarding setup are documented
