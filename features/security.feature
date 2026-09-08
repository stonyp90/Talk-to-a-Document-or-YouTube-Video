Feature: Protect credentials and uploaded content

  @host
  Scenario: Keep the OpenAI API key out of client bundles
    When the production client bundle is inspected
    Then the OpenAI API key is absent
    And the key is not returned by any browser-facing response

  @host
  Scenario: Keep AWS credentials out of client bundles
    When the production client bundle and browser responses are inspected
    Then long-lived AWS credentials are absent

  @external
  Scenario: Return only an ephemeral Realtime token to the client
    When the client requests a Realtime session
    Then the backend keeps the provider API key server-side
    And the response contains only the short-lived session credential and required session data

  Scenario: Reject invalid upload size and type before extraction
    When a client submits an oversized or non-PDF upload
    Then the backend rejects it before invoking the extractor

  Scenario: Keep transcript retrieval on the server
    When a YouTube transcript is requested
    Then the browser sends the URL to the backend
    And provider credentials and transcript retrieval are not performed in the browser

  Scenario: Expire or clean up temporary uploaded objects
    Given a PDF is stored temporarily during processing
    When the retention period expires or processing completes
    Then the temporary object is deleted or becomes inaccessible
