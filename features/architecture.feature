Feature: Replace technology without changing the core

  Scenario: Switch the transcript adapter using the same application and source model
    Given two interchangeable transcript adapters
    When the same YouTube source is ingested through each adapter
    Then both return the shared source model without changing the use case

  @host
  Scenario: Keep deployment authority separate from application code
    When repository workflow configuration is inspected
    Then no long-lived AWS access key or secret key is configured
    And the deploy role trust policy is restricted to the approved repository and ref
    When the deployment IAM policy is inspected
    Then permissions are limited to the selected ECR, Lambda, API, hosting, storage, and logging resources
    And unrelated AWS services are not granted
