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
    condition     = length(setsubtract(["api", "transcript", "chat"], keys(aws_ecr_repository.images))) == 0
    error_message = "Every deployed function needs an operator-owned repository to be published to."
  }
  # The live discussion is a function like the others: CI may replace its image
  # and its role, and may do so nowhere else.
  assert {
    condition     = contains(local.function_arns, "arn:aws:lambda:us-east-1:123456789012:function:talk-to-a-document-chat") && contains(local.runtime_arns, "arn:aws:iam::123456789012:role/talk-to-a-document-chat-runtime")
    error_message = "The deployment policy must reach the chat function and its role, and only by exact name."
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
  # IAM has no condition key for the contents of a trust policy, so this action
  # on a runtime role cannot be constrained: whoever holds it rewrites that role
  # to trust the deploy role, assumes it, and holds the runtime role itself with
  # everything the boundary allows it, ses:SendEmail included. modules/demo
  # writes the trust policy once at iam:CreateRole and never changes it, so a
  # normal deploy never calls this; only drift correction would.
  assert {
    condition     = alltrue([for statement in jsondecode(aws_iam_role_policy.deployment.policy).Statement : !contains(statement.Action, "iam:UpdateAssumeRolePolicy")])
    error_message = "CI must not rewrite a runtime role's trust policy: no condition can restrain that action, and it hands over the role itself."
  }
}
run "reject_pepper_wildcard" {
  command = plan
  variables { auth_pepper_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:*" }
  expect_failures = [var.auth_pepper_secret_arn]
}
run "boundary_permits_exactly_what_signing_in_needs" {
  command = plan
  variables {
    ses_identity_arn           = "arn:aws:ses:us-east-1:123456789012:identity/fixture.example"
    ses_configuration_set_name = "talk-to-a-document-transactional"
    ses_from_address           = "no-reply@fixture.example"
  }
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
run "no_runtime_sending_capability_until_the_identity_exists" {
  command = plan
  assert {
    condition     = length(jsondecode(aws_iam_policy.runtime_boundary.policy).Statement) == 4 && alltrue([for statement in jsondecode(aws_iam_policy.runtime_boundary.policy).Statement : !anytrue([for action in statement.Action : startswith(action, "ses:")])])
    error_message = "An account without a verified identity must not carry a sending capability in its boundary."
  }
}
run "boundary_caps_sending_to_one_verified_sender" {
  command = plan
  variables {
    ses_identity_arn           = "arn:aws:ses:us-east-1:123456789012:identity/example.test"
    ses_configuration_set_name = "talk-to-a-document-transactional"
    ses_from_address           = "no-reply@example.test"
  }
  assert {
    condition = length([for statement in jsondecode(aws_iam_policy.runtime_boundary.policy).Statement : statement if try(
      statement.Action == ["ses:SendEmail"] &&
      statement.Condition.StringEquals["ses:FromAddress"] == "no-reply@example.test" &&
      contains(statement.Resource, "arn:aws:ses:us-east-1:123456789012:identity/example.test") &&
      contains(statement.Resource, "arn:aws:ses:us-east-1:123456789012:configuration-set/talk-to-a-document-transactional"),
    false)]) == 1
    error_message = "The boundary must cap runtime sending to the verified identity, that one configuration set and exactly one From address."
  }
  assert {
    condition     = !can(regex("StringLike.*ses:FromAddress|ses:FromAddress.*\\*", aws_iam_policy.runtime_boundary.policy))
    error_message = "The operator-owned boundary pins one mailbox; a domain-wide StringLike would let CI-written policies send as any address."
  }
  assert {
    condition     = alltrue([for statement in jsondecode(aws_iam_role_policy.deployment.policy).Statement : !anytrue([for action in statement.Action : startswith(action, "ses:") || startswith(action, "route53:")])])
    error_message = "CI must gain no direct email or DNS authority: the identity, the sender pin and the hosted zone stay operator-owned."
  }
}
run "reject_identity_wildcard" {
  command = plan
  variables {
    ses_identity_arn           = "arn:aws:ses:us-east-1:123456789012:identity/*"
    ses_configuration_set_name = "talk-to-a-document-transactional"
    ses_from_address           = "no-reply@example.test"
  }
  # Only the identity is reported: the sender validation reads the domain out of
  # that ARN, so Terraform cannot evaluate it while the ARN itself is invalid.
  expect_failures = [var.ses_identity_arn]
}
run "reject_identity_without_configuration_set_and_sender" {
  command = plan
  variables { ses_identity_arn = "arn:aws:ses:us-east-1:123456789012:identity/example.test" }
  expect_failures = [var.ses_configuration_set_name, var.ses_from_address]
}
run "reject_sender_outside_the_verified_domain" {
  command = plan
  variables {
    ses_identity_arn           = "arn:aws:ses:us-east-1:123456789012:identity/example.test"
    ses_configuration_set_name = "talk-to-a-document-transactional"
    ses_from_address           = "no-reply@attacker.test"
  }
  expect_failures = [var.ses_from_address]
}
