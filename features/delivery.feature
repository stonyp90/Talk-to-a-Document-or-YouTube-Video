Feature: Deliver a reviewable project

  @host
  Scenario: Verify the repository has modular frontend and backend code
    When the repository is reviewed
    Then frontend, domain, provider, test, and infrastructure boundaries are identifiable
    And the backend can be packaged as a Docker image

  @external
  Scenario: Verify the release is present on main
    Given all required checks have passed
    When the release is finalized
    Then the approved implementation is merged or pushed to the `main` branch
    And the repository contains the corresponding tests and documentation

  @external
  Scenario: Provide a publicly hosted working web application
    Given the production deployment has succeeded
    When a reviewer opens the published URL
    Then the mobile-first web application loads
    And a PDF or supported YouTube URL can be ingested
    And the conversation flow can be demonstrated

  @external
  Scenario: Demonstrate the complete product workflow
    Given a reviewer has the walkthrough instructions
    When the reviewer follows the 10-15 minute demo
    Then the reviewer can select a source
    And inspect the extracted preview
    And start a voice conversation
    And interrupt, mute, unmute, and stop it
    And use text fallback when voice is unavailable

  Scenario: Review and record edge-case verification status before release
    When the local edge-case review is inspected
    Then PDF size, file type, empty extraction, invalid URL, unavailable captions, and cloud blocking have recorded evidence and dispositions
    And poor-network, permission, reconnect, security, and mobile have recorded evidence and dispositions

  @external
  Scenario: Track the assessment delivery timeline
    Given the assessment has a seven-business-day deadline
    When milestones are reviewed
    Then foundation, ingestion, conversation, mobile, deployment, and final documentation milestones are tracked

  @external
  Scenario: Confirm required external setup is recorded
    When the final delivery is reviewed
    Then the GitHub repository and main-branch access are recorded
    And the AWS account and region are recorded
    And the OIDC repository/environment scope is recorded
    And the provider secret and optional transcript configuration are recorded
    And Android SDK/AVD readiness is recorded when Android coverage is required
