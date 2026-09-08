Feature: Run the complete application locally

  @host
  Scenario: Start every local service with Docker Compose
    Given the documented Compose stack has been started
    Then the web service starts
    And the API service starts
    And the object-store service starts
    And the Python transcript service starts in mock mode
    And the application provides in-process simulated sessions

  @host
  Scenario: Ingest a fixture PDF without external credentials
    Given `PROVIDER_MODE=mock`
    When I upload the deterministic fixture PDF through the local web app
    Then PDF text extraction succeeds
    And no external provider credential is required

  @host
  Scenario: Ingest a fixture YouTube transcript without external credentials
    Given `PROVIDER_MODE=mock`
    When I submit a fixture YouTube URL through the local web app
    Then the transcript mock returns deterministic transcript text
    And no external provider credential is required

  Scenario: Run a mocked Realtime conversation without external credentials
    Given `PROVIDER_MODE=mock`
    When I start voice chat with the realtime mock
    Then a deterministic session is established
    And mock user and assistant events can be exchanged

  @host
  Scenario: Run the web application against the local API
    Given all Compose services are healthy
    When I open the web app
    Then the web client reaches the API over the Compose network
    And source ingestion and mock conversation work end to end

  @external
  Scenario: Run the native client against the Compose API
    Given the native client is running on a host simulator
    When it uses the configured host gateway API URL
    Then it can ingest a fixture source and start mock conversation

  @external
  Scenario: Run the live provider mode without exposing secrets to the browser
    Given `PROVIDER_MODE=live`
    When the API is started with a server-side provider secret
    Then the API can call the configured external provider
    And the browser never receives that long-lived secret

  Scenario: Use source conversation without creating an account
    Given a fresh browser session without stored login credentials
    When I ingest a source and ask a text question
    Then ingestion and conversation succeed without a login prompt
