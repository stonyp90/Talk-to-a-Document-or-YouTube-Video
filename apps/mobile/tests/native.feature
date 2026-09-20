Feature: One native Sense to Action workspace
  Scenario: Every input shares one stage
    Given the native app is open with animations enabled
    Then Sense, Keyboard to action Legacy, and Brain to action Beta are in the header
    And one Start experience control and one Workspace settings control are in the dock
    And voice and motion have not requested permission or started
    When I open and close the source picker
    Then the same stage and controls remain visible

  Scenario: The source survives preferences and language changes
    Given I load Try a sample text from Workspace settings
    When I choose Keyboard to action and then Sense
    And change the interface language to French and back to English
    Then the original source and the question composer remain in the same stage
    And the source name and content retain their original language

  Scenario: Merged synthetic voice and motion act in the same conversation
    Given the dedicated QA development build uses deterministic sensor adapters
    And the local sense-api fixture is running without external providers
    When I inject a voice command before starting
    Then no action occurs
    When I press Start experience once
    And inject the voice command youtube
    Then the source sheet opens on YouTube
    When I sign in with the local example.test identity and fixture code
    And load the fixture video
    And type a question
    Then the simulated answer appears in the same stage
    And both inputs remain active
    When I inject tilt right and tilt forward
    Then the next suggested question receives an answer in the same conversation
    When I press Stop experience
    Then both inputs stop and later injected events do nothing

  Scenario: Pick a local PDF
    Given the development build is installed on a simulator
    When I choose a downloaded PDF no larger than 25 MB from the source picker
    Then its extracted text is available from The source
    And questions and input controls remain in the workspace

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

  Scenario: A denied input leaves the workspace usable
    Given a source is loaded with real input adapters
    When a microphone or camera permission is denied
    Then an actionable error is shown
    And text chat remains available in the same workspace

  Scenario: Backgrounding releases input resources
    Given the experience is active
    When I background the app
    Then recognition, camera, motion subscriptions, and live audio stop
    And returning to the app requires an explicit Start experience
