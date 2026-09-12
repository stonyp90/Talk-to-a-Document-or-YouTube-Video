Feature: Find a video from what a reader says

  Saying a link out loud is absurd: nobody dictates "watch question mark v
  equals". A reader says an artist or a title, and the application has to find
  something it can actually read. A video with no captions is not a source, so
  an uncaptioned result would only fail one step later.

  Scenario: Speak an artist instead of spelling out a link
    Given a reader has signed in and can search for videos
    When the reader says an artist instead of a link
    Then captioned videos are found for those words
    And the first result is a video the reader can be sent to
    And the remaining results stay available as alternatives

  Scenario: Refuse a search with nothing said
    Given a reader has signed in and can search for videos
    When the reader searches with no words at all
    Then the search is refused as an unusable query
    And no videos are offered

  Scenario: Refuse a dictation that ran away
    Given a reader has signed in and can search for videos
    When the reader searches with more words than the endpoint accepts
    Then the search is refused as an unusable query
    And no videos are offered

  Scenario: Refuse an anonymous search
    Given the video search is gated
    When an anonymous client searches for a video
    Then the search is refused as unauthenticated
    And no videos are offered
