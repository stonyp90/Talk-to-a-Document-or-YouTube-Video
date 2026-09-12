Feature: Discuss a source in real time over one open channel
  As a reader with an ingested source
  I want a back-and-forth discussion that answers while it is still writing
  So that the conversation feels like a conversation and not a form

  Background:
    Given a live discussion channel is running
    And a reader has opened a discussion about their source

  Scenario: Open a discussion and learn how much of the source is in play
    Then the channel confirms the conversation and names it
    And the channel reports how much of the source the assistant can see

  Scenario: Watch an answer arrive as it is written
    When the reader asks "What is the budget?"
    Then the answer arrives in more than one fragment
    And the fragments add up to the finished answer

  Scenario: Ask a follow-up without sending the source again
    When the reader asks "What is the budget?"
    And the reader asks "And who approved it?"
    Then only the conversation's name crossed the network with the follow-up
    And both answers arrived on the same connection

  Scenario: Carry the earlier exchange into the follow-up
    When the reader asks "What is the budget?"
    And the reader asks "And who approved it?"
    Then the assistant was given the earlier exchange

  Scenario: Resume the same discussion after the connection drops
    When the reader asks "What is the budget?"
    And the connection drops and the reader reconnects
    Then the discussion resumes under the same name

  Scenario: Survive a message the server cannot read
    When an unreadable message reaches the channel
    Then the channel reports the problem
    And the discussion is still open

  Scenario: Keep an idle discussion alive
    When the channel is asked whether it is still there
    Then the channel answers that it is

  Scenario: Refuse a channel opened from another site
    When a page on another origin tries to open a discussion
    Then the connection is refused

  Scenario: Tell a reader who asks faster than the budget allows
    Given the channel allows one question a minute
    When the reader asks two questions at once
    Then the second is refused with a reason the reader can act on
    And the discussion is still open
