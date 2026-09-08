Feature: Validate and deploy changes safely

  @external
  Scenario: Run lint, typecheck, unit, Gherkin, build, and security checks on a pull request
    Given a pull request targets the repository
    When the pull request workflow runs
    Then linting passes
    And strict typechecking passes
    And unit tests pass
    And all Gherkin acceptance tests pass
    And the web build passes
    And dependency and secret scans pass

  @external
  Scenario: Build the backend Docker image on a pull request
    Given a pull request passes source checks
    When the CI workflow builds the backend
    Then the Lambda-compatible Docker image builds reproducibly
    And the image is validated without publishing production credentials

  @external
  Scenario: Prevent deployment from an untrusted branch
    Given a workflow run is not for the approved deployment branch or environment
    When deployment authorization is evaluated
    Then production deployment is blocked

  @external
  Scenario: Assume the AWS deploy role through GitHub OIDC on main
    Given all required checks pass on `main`
    When the deployment workflow requests AWS access
    Then GitHub Actions exchanges its OIDC identity for short-lived AWS credentials
    And no static AWS access key is used

  @external
  Scenario: Deploy the Lambda container and frontend after checks pass
    Given the main deployment workflow has assumed the approved AWS role
    When deployment runs
    Then the backend image is pushed to ECR
    And the Lambda/API deployment is updated
    And the frontend hosting deployment is updated

  @external
  Scenario: Run deployed smoke tests after deployment
    Given the AWS deployment has completed
    When post-deployment smoke tests run
    Then health checks pass
    And deployed PDF extraction is verified
    And the Realtime token route contract is verified without printing secrets

  @host
  Scenario: Avoid storing long-lived AWS keys in GitHub Actions
    When repository workflow configuration is inspected
    Then no long-lived AWS access key or secret key is configured
    And the deploy role trust policy is restricted to the approved repository and ref

  @host
  Scenario: Grant least-privilege AWS deployment permissions
    When the deployment IAM policy is inspected
    Then permissions are limited to the selected ECR, Lambda, API, hosting, storage, and logging resources
    And unrelated AWS services are not granted
