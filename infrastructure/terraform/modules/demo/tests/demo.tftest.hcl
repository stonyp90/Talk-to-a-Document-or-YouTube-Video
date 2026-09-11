mock_provider "aws" {
  override_during = apply
  mock_resource "aws_apigatewayv2_api" {
    defaults = {
      api_endpoint  = "https://demo.execute-api.us-east-1.amazonaws.com"
      execution_arn = "arn:aws:execute-api:us-east-1:123456789012:demo"
    }
  }
  mock_resource "aws_iam_role" { defaults = { arn = "arn:aws:iam::123456789012:role/test" } }
  mock_resource "aws_s3_bucket" { defaults = { arn = "arn:aws:s3:::fixture-uploads" } }
  mock_resource "aws_cloudwatch_log_group" { defaults = { arn = "arn:aws:logs:us-east-1:123456789012:log-group:fixture" } }
  mock_resource "aws_lambda_function" { defaults = { invoke_arn = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123456789012:function:fixture/invocations" } }
}
variables {
  region            = "us-east-1"
  account_id        = "123456789012"
  image_tag         = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  openai_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:fixture-abcdef"
}
run "demo_security_and_cost_contract" {
  # In-memory mock apply resolves computed members of route-settings sets.
  # The only provider here is mocked: no AWS resources or credentials are used.
  command = apply
  assert {
    condition     = alltrue([for function in aws_lambda_function.runtime : function.package_type == "Image" && endswith(function.image_uri, var.image_tag)])
    error_message = "Both functions must deploy Docker images from the CI-tested SHA."
  }
  assert {
    condition     = aws_lambda_function.runtime["api"].reserved_concurrent_executions == 20 && aws_lambda_function.runtime["transcript"].memory_size == 256
    error_message = "Keep bounded, scale-to-zero capacity sufficient for the gateway’s 20-request page-load burst."
  }
  assert {
    condition     = alltrue([for role in aws_iam_role.runtime : role.permissions_boundary == local.boundary])
    error_message = "Every runtime role needs the operator-owned permissions boundary."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.uploads.block_public_policy && aws_s3_bucket_public_access_block.uploads.restrict_public_buckets
    error_message = "Temporary uploads must never be public."
  }
  assert {
    condition     = length(aws_apigatewayv2_stage.default.route_settings) == 5 && alltrue([for settings in aws_apigatewayv2_stage.default.route_settings : settings.throttling_rate_limit == 1])
    error_message = "Every costly endpoint needs its explicit throttle."
  }
  assert {
    condition     = length(jsondecode(aws_iam_role_policy.runtime["transcript"].policy).Statement) == 1
    error_message = "Transcript processing may only write its logs, not read documents or provider keys."
  }
}
run "reject_mutable_image_tag" {
  command = plan
  variables { image_tag = "latest" }
  expect_failures = [var.image_tag]
}
run "no_email_permission_before_the_operator_verifies_the_domain" {
  command = apply
  assert {
    condition     = length(jsondecode(aws_iam_role_policy.runtime["api"].policy).Statement) == 3 && alltrue([for statement in jsondecode(aws_iam_role_policy.runtime["api"].policy).Statement : !anytrue([for action in statement.Action : startswith(action, "ses:")])])
    error_message = "Without a verified identity the api role must hold no email permission at all."
  }
  assert {
    condition     = !contains(keys(aws_lambda_function.runtime["api"].environment[0].variables), "SES_FROM_ADDRESS")
    error_message = "An unconfigured deployment must keep exactly today's function environment."
  }
}
run "email_permission_scoped_to_one_identity_and_one_sender" {
  command = apply
  variables {
    ses_identity_arn           = "arn:aws:ses:us-east-1:123456789012:identity/example.test"
    ses_configuration_set_name = "talk-to-a-document-transactional"
    ses_from_address           = "no-reply@example.test"
  }
  assert {
    condition = length([for statement in jsondecode(aws_iam_role_policy.runtime["api"].policy).Statement : statement if try(
      statement.Action == ["ses:SendEmail"] &&
      statement.Condition.StringEquals["ses:FromAddress"] == "no-reply@example.test" &&
      contains(statement.Resource, "arn:aws:ses:us-east-1:123456789012:identity/example.test") &&
      contains(statement.Resource, "arn:aws:ses:us-east-1:123456789012:configuration-set/talk-to-a-document-transactional"),
    false)]) == 1
    error_message = "Sending must be one statement pinned to the identity, the configuration set and the single From address."
  }
  assert {
    condition     = length(jsondecode(aws_iam_role_policy.runtime["transcript"].policy).Statement) == 1
    error_message = "Transcript processing may only write its logs; it never sends mail."
  }
  assert {
    condition     = aws_lambda_function.runtime["api"].environment[0].variables["SES_FROM_ADDRESS"] == "no-reply@example.test" && aws_lambda_function.runtime["api"].environment[0].variables["SES_CONFIGURATION_SET_NAME"] == "talk-to-a-document-transactional"
    error_message = "The api function needs the From address and configuration set it is authorized to use."
  }
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
run "reject_identity_without_configuration_set_and_sender" {
  command = plan
  variables { ses_identity_arn = "arn:aws:ses:us-east-1:123456789012:identity/example.test" }
  expect_failures = [var.ses_configuration_set_name, var.ses_from_address]
}
