Feature: PDF Upload
  As a user
  I want to upload PDF documents
  So that I can ask questions about their content

  Background:
    Given the application is running

  Scenario: PDF upload via voice command
    Given I am on the application page
    When I say "upload"
    Then the file picker should open
    And I should be able to select a PDF

  Scenario: PDF upload via UI button
    Given I am on the application page
    When I click the upload button
    Then the file picker should open
    And I should be able to select a PDF

  Scenario: PDF upload validates file type
    Given the file picker is open
    When I try to select a non-PDF file (e.g., .txt, .jpg)
    Then the file should be rejected
    And an error message should appear

  Scenario: PDF upload validates file size
    Given the file picker is open
    When I try to select a PDF larger than 25MB
    Then the file should be rejected
    And I should be told the size limit

  Scenario: PDF upload shows progress
    Given I select a valid PDF
    When the upload starts
    Then a progress indicator should appear
    And it should show upload percentage

  Scenario: PDF upload handles network errors
    Given I select a valid PDF
    When the network fails during upload
    Then an error message should appear
    And I should be able to retry

  Scenario: PDF upload handles server errors
    Given I select a valid PDF
    When the server returns an error
    Then an error message should appear
    And the error should be actionable

  Scenario: PDF extraction happens after upload
    Given the PDF is uploaded successfully
    When the upload completes
    Then text extraction should begin
    And the extracted text should be used for context

  Scenario: PDF context is wrapped in security boundaries
    Given a PDF is extracted
    When the text is added to the conversation context
    Then it should be wrapped in <untrusted-source> tags
    And prompt injection should be prevented

  Scenario: Large PDF is windowed
    Given a PDF with text exceeding the context window
    When it is processed
    Then the text should be windowed
    And only relevant portions should be used

  Scenario: PDF upload works with presigned URLs
    Given object storage (MinIO/S3) is available
    When I upload a PDF
    Then a presigned URL should be used
    And the upload should go directly to storage

  Scenario: PDF upload falls back to multipart
    Given object storage is not available
    When I upload a PDF
    Then multipart upload should be used
    And the file should be uploaded in chunks

  Scenario: PDF upload validates MIME type
    Given I try to upload a file
    When the MIME type is not application/pdf
    Then the upload should be rejected
    And I should be told the file type is invalid

  Scenario: PDF upload handles zero-byte files
    Given I try to upload a PDF
    When the file size is 0 bytes
    Then the upload should be rejected
    And I should be told the file is empty

  Scenario: PDF upload handles unknown size
    Given I try to upload a PDF
    When the file size is unknown
    Then the upload should be rejected
    And I should be told the size must be known

  Scenario: PDF upload succeeds with valid file
    Given I select a valid PDF under 25MB
    When I confirm the upload
    Then the upload should complete successfully
    And the PDF should be processed
    And I should be able to ask questions about it

  Scenario: PDF upload is accessible
    Given I am using a keyboard
    When I navigate to the upload button
    Then I should be able to activate it
    And the file picker should open

  Scenario: PDF upload works on mobile
    Given I am on the mobile app
    When I trigger the upload
    Then the mobile file picker should open
    And I should be able to select a PDF

  Scenario: PDF upload cleans up temporary files
    Given a PDF is uploaded and processed
    When processing is complete
    Then temporary files should be cleaned up
    And storage should not accumulate orphaned files

  Scenario: PDF upload is secure
    Given I upload a PDF
    When the upload completes
    Then no credentials should be exposed
    And the upload path should be secure
