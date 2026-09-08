Feature: Native source conversations
  Scenario: Pick a local PDF
    Given the development build is installed on a simulator
    When I choose a downloaded PDF no larger than 25 MB
    Then its extracted text is visible and can be expanded

  Scenario: Upload directly when object storage is configured
    Given health reports directUpload enabled
    When I choose a PDF no larger than 25 MB
    Then the app requests upload metadata
    And uploads the native file as the last part of the signed form
    And preserves the presigned URL and fields unchanged
    And requests extraction by uploaded key only after upload succeeds

  Scenario: Reject a failed signed upload
    Given object storage rejects the signed upload
    Then the app shows a retryable error
    And does not call extraction or fall back to API multipart upload

  Scenario: Reach local object storage on Android
    Given adb reverse forwards ports 3000 and 9002
    When the backend returns a signed localhost URL
    Then the app uses that URL without replacing its hostname

  Scenario: Use YouTube and text fallback
    Given the Compose backend uses mock providers
    When I load a supported YouTube fixture URL
    And I submit a text question
    Then I see a source-based answer

  Scenario: Denied microphone permission
    Given a source is loaded in live mode
    When microphone permission is denied
    Then a useful error is shown
    And text chat remains available

  Scenario: Native live voice
    Given a source is loaded in live mode with server credentials
    When I start voice and speak
    Then WebRTC carries microphone and assistant audio
    And transcript events appear
    When I stop or background the app
    Then the microphone is released
