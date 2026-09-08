Feature: Ingest a document or video source
  As a user
  I want to provide a PDF or YouTube URL
  So that I can ask questions about its contents

  Background:
    Given the source selection screen is displayed

  Scenario: Ingest a valid PDF up to 25 MB
    When I upload a valid PDF that is no larger than 25 MB
    Then the upload is accepted
    And text is extracted from the PDF on the server
    And the extracted text is available for conversation context

  Scenario: Reject a PDF larger than 25 MB
    When I upload a valid PDF larger than 25 MB
    Then the upload is rejected before extraction starts
    And I see a clear 25 MB size limit error

  Scenario: Reject a non-PDF file
    When I upload a file that is not a PDF
    Then the upload is rejected before extraction starts
    And I see a clear file type error

  Scenario: Extract all selectable text from a multi-page PDF in order
    When I upload a multi-page PDF containing selectable text
    Then text from every page is extracted
    And the extracted text preserves page order
    And the extracted text is not silently summarized or chunked

  Scenario: Report a PDF with no extractable text
    When I upload a PDF with no extractable text
    Then I see an explanatory extraction error
    And the application does not claim that ingestion succeeded
    And I cannot start a voice session for that source

  Scenario: Ingest a YouTube URL with accessible captions
    When I submit a supported YouTube URL whose video has accessible captions
    Then the URL is accepted
    And the transcript is retrieved by the server
    And the transcript is available for conversation context

  Scenario: Reject a malformed or unsupported YouTube URL
    When I submit a malformed or unsupported video URL
    Then the URL is rejected
    And I see a clear URL validation error

  Scenario: Report that captions are unavailable
    When I submit a supported YouTube URL whose video has no accessible captions
    Then I see that a transcript is unavailable
    And I cannot start a voice session for that source

  @external
  Scenario: Report cloud transcript blocking and provide local fallback guidance
    Given the deployed transcript provider blocks the cloud request
    When I submit a supported YouTube URL
    Then I see a useful provider limitation error
    And I am directed to the documented local demonstration fallback

  Scenario: Display extracted text in a toggleable preview
    Given a source has been ingested successfully
    When the source result is displayed
    Then the extracted text preview can be toggled while preserving its text
    And the preview indicates that more text is available

  Scenario: Expand and collapse the extracted-text preview
    Given a source has been ingested successfully
    When I expand the extracted-text preview
    Then the available extracted text is displayed
    When I collapse the extracted-text preview
    Then the extracted text is hidden without losing the ingested source

  Scenario: Retry a transient ingestion failure
    Given source extraction fails temporarily
    When I select the retry action
    Then the source request is attempted again
    And the UI remains in a non-success state until extraction succeeds
