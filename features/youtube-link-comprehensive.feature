Feature: YouTube Link Input
  As a user
  I want to add YouTube videos by URL or voice search
  So that I can ask questions about video content

  Background:
    Given the application is running

  Scenario: YouTube URL is pasted
    Given I am on the application page
    When I paste a YouTube URL (https://www.youtube.com/watch?v=...)
    Then the video ID should be extracted
    And captions should be fetched
    And the video should be ready for questions

  Scenario: YouTube short URL is supported
    Given I am on the application page
    When I paste a short URL (https://youtu.be/...)
    Then the video ID should be extracted
    And the video should load successfully

  Scenario: YouTube embed URL is supported
    Given I am on the application page
    When I paste an embed URL (https://www.youtube.com/embed/...)
    Then the video ID should be extracted
    And the video should load successfully

  Scenario: YouTube shorts URL is supported
    Given I am on the application page
    When I paste a shorts URL (https://www.youtube.com/shorts/...)
    Then the video ID should be extracted
    And the video should load successfully

  Scenario: YouTube live URL is supported
    Given I am on the application page
    When I paste a live URL (https://www.youtube.com/live/...)
    Then the video ID should be extracted
    And the video should load successfully

  Scenario: YouTube /v/ URL is supported
    Given I am on the application page
    When I paste a /v/ URL (https://www.youtube.com/v/...)
    Then the video ID should be extracted
    And the video should load successfully

  Scenario: YouTube URL with extra parameters works
    Given I am on the application page
    When I paste a URL with parameters (https://www.youtube.com/watch?v=...&t=120)
    Then the video ID should be extracted
    And the parameters should be ignored
    And the video should load successfully

  Scenario: Invalid YouTube URL is rejected
    Given I am on the application page
    When I paste an invalid YouTube URL
    Then an error message should appear
    And I should be told the URL is invalid

  Scenario: YouTube video search via voice
    Given I am on the application page
    When I say "youtube"
    Then the voice search interface should appear
    And I should be able to speak a search query

  Scenario: YouTube voice search returns results
    Given the voice search interface is active
    When I speak a search query
    Then up to 5 video results should be returned
    And results should be ranked by relevance
    And duplicate videos should be removed

  Scenario: YouTube voice search query is limited
    Given the voice search interface is active
    When I speak a query longer than 200 characters
    Then the query should be truncated
    And the search should still work

  Scenario: YouTube captions are fetched
    Given a valid YouTube URL is provided
    When the video is processed
    Then captions should be fetched from the transcript service
    And the captions should be used as context

  Scenario: YouTube captions are wrapped in security boundaries
    Given YouTube captions are fetched
    When they are added to the conversation context
    Then they should be wrapped in <untrusted-source> tags
    And prompt injection should be prevented

  Scenario: YouTube transcript service is mocked in dev
    Given we are in development mode
    When captions are requested
    Then the mock transcript service should respond
    And no external API calls should be made

  Scenario: YouTube transcript service can use real API
    Given YOUTUBE_TRANSCRIPT_MODE is set to "api"
    When captions are requested
    Then the real YouTube Data API should be called
    And real captions should be returned

  Scenario: YouTube video with no captions is handled
    Given a YouTube video has no captions
    When I try to load it
    Then a graceful error should appear
    And I should be told captions are unavailable

  Scenario: YouTube URL is dropped into input
    Given I am on the application page
    When I drag and drop a YouTube URL
    Then the URL should be accepted
    And the video should load

  Scenario: YouTube URL works on mobile
    Given I am on the mobile app
    When I paste a YouTube URL
    Then the video should load
    And I should be able to ask questions

  Scenario: YouTube search is accessible
    Given I am using a keyboard
    When I navigate to the YouTube search
    Then I should be able to activate it
    And the search interface should appear

  Scenario: YouTube video context is windowed if too long
    Given a YouTube video with very long captions
    When it is processed
    Then the captions should be windowed
    And only relevant portions should be used

  Scenario: YouTube URL validation is strict
    Given I paste a URL that looks like YouTube but isn't
    When I try to load it
    Then it should be rejected
    And I should be told the URL is invalid
