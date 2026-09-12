mock_provider "aws" {
  override_during = plan
  mock_resource "aws_s3_bucket" { defaults = { arn = "arn:aws:s3:::fixture-state" } }
  mock_resource "aws_iam_policy" { defaults = { arn = "arn:aws:iam::123456789012:policy/talk-to-a-document-runtime-boundary" } }
  mock_resource "aws_ecr_repository" { defaults = { arn = "arn:aws:ecr:us-east-1:123456789012:repository/fixture" } }
  mock_resource "aws_iam_openid_connect_provider" { defaults = { arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" } }
}
variables {
  region                 = "us-east-1"
  account_id             = "123456789012"
  github_repository      = "example/talk"
  openai_secret_arn      = "arn:aws:secretsmanager:us-east-1:123456789012:secret:fixture-abcdef"
  auth_pepper_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:fixture-pepper-abcdef"
  ses_from_address       = "no-reply@fixture.example"
}
run "identity_state_and_least_privilege" {
  command = plan
  assert {
    condition     = length(aws_iam_role_policy.deployment.policy) <= 10240
    error_message = "Keep the combined inline deployment policy within IAM's role policy-size limit."
  }
  assert {
    condition     = jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:example/talk:environment:production"
    error_message = "Trust only the production environment in the approved repository."
  }
  assert {
    condition     = jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" && aws_iam_role.deploy.max_session_duration == 3600
    error_message = "OIDC audience and short session lifetime are mandatory."
  }
  assert {
    condition     = alltrue([for repo in aws_ecr_repository.images : repo.image_tag_mutability == "IMMUTABLE" && repo.image_scanning_configuration[0].scan_on_push])
    error_message = "Tested image tags must not be overwritten."
  }
  assert {
    condition     = aws_s3_bucket_versioning.state.versioning_configuration[0].status == "Enabled" && aws_s3_bucket_public_access_block.state.block_public_policy
    error_message = "State must be private and recoverable."
  }
  assert {
    condition     = alltrue([for statement in jsondecode(aws_iam_role_policy.deployment.policy).Statement : !contains(statement.Action, "iam:DeleteRolePermissionsBoundary") && !contains(statement.Action, "iam:CreatePolicyVersion") && !contains(statement.Action, "iam:AttachRolePolicy") && !contains(statement.Action, "*")])
    error_message = "CI must not broaden its own permissions or runtime boundaries."
  }
  assert {
    condition     = alltrue([for statement in jsondecode(aws_iam_role_policy.deployment.policy).Statement : statement.Sid != "StateReadWrite" || !contains(statement.Action, "s3:DeleteObject")])
    error_message = "CI may delete locks, never application state."
  }
}
run "reject_pepper_wildcard" {
  command = plan
  variables { auth_pepper_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:*" }
  expect_failures = [var.auth_pepper_secret_arn]
}
run "boundary_permits_exactly_what_signing_in_needs" {
  command = plan
  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_policy.runtime_boundary.policy).Statement :
      !contains(statement.Action, "secretsmanager:GetSecretValue") || contains(statement.Resource, var.auth_pepper_secret_arn)
    ])
    error_message = "The boundary must let the task read the signing pepper, or the grant beneath it is dead."
  }
  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_policy.runtime_boundary.policy).Statement :
      contains(statement.Action, "ses:SendEmail") && !anytrue([for resource in statement.Resource : strcontains(resource, "*")])
    ])
    error_message = "The boundary must permit sending from the verified identity, and nothing wider."
  }
}
run "no_sender_means_no_sending_at_all" {
  command = plan
  variables { ses_from_address = "" }
  assert {
    condition     = !strcontains(aws_iam_policy.runtime_boundary.policy, "ses:")
    error_message = "A deployment with no verified sender must not be permitted to send."
  }
}
run "reject_repository_wildcard" {
  command = plan
  variables { github_repository = "example/*" }
  expect_failures = [var.github_repository]
}
run "reject_secret_wildcard" {
  command = plan
  variables { openai_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:*" }
  expect_failures = [var.openai_secret_arn]
}
run "immutable_repository_identity" {
  command = plan
  variables { github_subject_prefix = "repo:example@123/talk@456" }
  assert {
    condition     = jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:example@123/talk@456:environment:production"
    error_message = "Preserve immutable owner/repository IDs and the production environment restriction."
  }
}
run "reject_other_repository_subject" {
  command = plan
  variables { github_subject_prefix = "repo:example@123/another@456" }
  expect_failures = [var.github_subject_prefix]
}
