mock_provider "aws" {
  override_during = apply
  mock_resource "aws_apigatewayv2_api" {
    defaults = {
      api_endpoint  = "https://demo.execute-api.us-east-1.amazonaws.com"
      execution_arn = "arn:aws:execute-api:us-east-1:123456789012:demo"
    }
  }
  # The socket stage hands out a wss:// url; the chat function needs the https
  # one, so the fixture has to carry the real scheme for that rewrite to be tested.
  mock_resource "aws_apigatewayv2_stage" { defaults = { invoke_url = "wss://socket.execute-api.us-east-1.amazonaws.com/live" } }
  mock_resource "aws_iam_role" { defaults = { arn = "arn:aws:iam::123456789012:role/test" } }
  mock_resource "aws_s3_bucket" { defaults = { arn = "arn:aws:s3:::fixture-uploads" } }
  mock_resource "aws_cloudwatch_log_group" { defaults = { arn = "arn:aws:logs:us-east-1:123456789012:log-group:fixture" } }
  mock_resource "aws_lambda_function" { defaults = { invoke_arn = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123456789012:function:fixture/invocations" } }
}
variables {
  region                 = "us-east-1"
  account_id             = "123456789012"
  image_tag              = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  openai_secret_arn      = "arn:aws:secretsmanager:us-east-1:123456789012:secret:fixture-abcdef"
  auth_pepper_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:fixture-pepper-abcdef"
  # A deployment sends real mail, so the fixture carries what the operator-owned
  # email root hands over. The runs below take them away again to prove what an
  # account without a verified identity is and is not allowed to do.
  ses_identity_arn           = "arn:aws:ses:us-east-1:123456789012:identity/fixture.example"
  ses_configuration_set_name = "talk-to-a-document-transactional"
  ses_from_address           = "no-reply@fixture.example"
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
  assert {
    condition     = contains(jsondecode(aws_iam_role_policy.runtime["api"].policy).Statement[2].Resource, var.auth_pepper_secret_arn)
    error_message = "The task must be able to read the signing pepper by its exact ARN."
  }
  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role_policy.runtime["api"].policy).Statement :
      !contains(try(tolist(statement.Action), []), "ses:SendEmail") || (
        statement.Condition.StringEquals["ses:FromAddress"] == var.ses_from_address &&
        !anytrue([for resource in statement.Resource : strcontains(resource, "*")])
      )
    ])
    error_message = "Sending must be pinned to the verified sender and to exact identity ARNs."
  }
  assert {
    condition     = alltrue([for role in ["transcript"] : !strcontains(aws_iam_role_policy.runtime[role].policy, "ses:")])
    error_message = "Only the application task may send mail."
  }
  assert {
    condition     = aws_lambda_function.runtime["api"].environment[0].variables["AUTH_MODE"] == "required"
    error_message = "A deployment must come up with the gate closed."
  }
  assert {
    condition     = aws_lambda_function.runtime["api"].environment[0].variables["AUTH_PEPPER_SECRET_ARN"] == var.auth_pepper_secret_arn
    error_message = "The task reads the pepper from Secrets Manager at runtime, by ARN."
  }
  assert {
    condition     = !anytrue([for value in values(aws_lambda_function.runtime["api"].environment[0].variables) : strcontains(lower(value), "pepper") && !startswith(value, "arn:")])
    error_message = "No pepper value may be written into the task environment; only its ARN."
  }
  assert {
    condition = alltrue([
      aws_lambda_function.runtime["api"].environment[0].variables["EMAIL_MODE"] == "ses",
      aws_lambda_function.runtime["api"].environment[0].variables["SES_FROM_ADDRESS"] == var.ses_from_address,
      aws_lambda_function.runtime["api"].environment[0].variables["SES_REGION"] == var.region,
      aws_lambda_function.runtime["api"].environment[0].variables["USAGE_LIMIT_UNITS"] == "300",
      aws_lambda_function.runtime["api"].environment[0].variables["USAGE_WINDOW_MS"] == "86400000",
    ])
    error_message = "Sign-in mail and the allowance must reach the task, defaulted to the application's own values."
  }
  # The discussion is reached over the socket alone. An HTTP route or an invoke
  # permission on the site's API would be a second, unthrottled way in.
  assert {
    condition     = !contains(values(local.routes), "chat") && !contains(keys(aws_apigatewayv2_integration.lambda), "chat") && !contains(keys(aws_lambda_permission.gateway), "chat")
    error_message = "The chat function belongs on the WebSocket API only, never on the HTTP API."
  }
  assert {
    condition     = aws_apigatewayv2_api.socket.protocol_type == "WEBSOCKET" && aws_apigatewayv2_api.socket.route_selection_expression == "$request.body.type" && length(aws_apigatewayv2_route.socket) == 3
    error_message = "Connect, disconnect and the default message route all reach the chat handler."
  }
  assert {
    condition     = aws_apigatewayv2_stage.socket.name == "live" && aws_apigatewayv2_stage.socket.auto_deploy && aws_apigatewayv2_stage.socket.default_route_settings[0].throttling_rate_limit < aws_apigatewayv2_stage.default.default_route_settings[0].throttling_rate_limit
    error_message = "Each question on the socket is a model call, so it must be throttled harder than the site."
  }
  # Only the socket function may write back down a connection, and only on the
  # one API this module creates.
  assert {
    condition = length([for statement in jsondecode(aws_iam_role_policy.runtime["chat"].policy).Statement : statement if try(
      statement.Action == ["execute-api:ManageConnections"] &&
      statement.Resource == ["arn:aws:execute-api:us-east-1:123456789012:${aws_apigatewayv2_api.socket.id}/*"],
    false)]) == 1
    error_message = "The chat role posts answers back through exactly one WebSocket API."
  }
  assert {
    condition     = alltrue([for name in ["api", "chat"] : length([for statement in jsondecode(aws_iam_role_policy.runtime[name].policy).Statement : statement if try(statement.Resource == ["${aws_s3_bucket.uploads.arn}/sessions/*"], false)]) == 1 && aws_lambda_function.runtime[name].environment[0].variables["SESSION_BUCKET"] == aws_s3_bucket.uploads.id])
    error_message = "Both halves of a conversation must share one session store, scoped to the sessions prefix."
  }
  assert {
    condition     = length([for statement in jsondecode(aws_iam_role_policy.runtime["chat"].policy).Statement : statement if try(contains(statement.Resource, "${aws_s3_bucket.uploads.arn}/uploads/*"), false)]) == 0
    error_message = "The socket answers from stored conversations; it never reads the upload prefix."
  }
  assert {
    condition     = startswith(aws_lambda_function.runtime["chat"].environment[0].variables["CHAT_CALLBACK_URL"], "https://") && contains(split(",", aws_lambda_function.runtime["chat"].environment[0].variables["CHAT_ALLOWED_ORIGINS"]), aws_apigatewayv2_api.http.api_endpoint)
    error_message = "Replies go back over https because a custom domain cannot serve the management API, and only named origins may open the socket."
  }
  assert {
    condition     = length([for rule in aws_s3_bucket_lifecycle_configuration.uploads.rule : rule if rule.filter[0].prefix == "sessions/" && rule.expiration[0].days == 1]) == 1
    error_message = "Stored conversations expire with the documents they are about."
  }
}
run "reject_a_pepper_value_in_place_of_its_arn" {
  command = plan
  variables { auth_pepper_secret_arn = "a-secret-looking-string" }
  expect_failures = [var.auth_pepper_secret_arn]
}
run "reject_sending_mail_with_no_verified_sender" {
  command = plan
  variables { ses_from_address = "" }
  expect_failures = [var.ses_from_address]
}
# The gate is closed by default, so sign-in needs mail that reaches a reader.
# EMAIL_MODE=ses with no identity would come up sending nothing at all.
run "reject_real_mail_with_no_identity_behind_it" {
  command = plan
  variables {
    ses_identity_arn           = ""
    ses_configuration_set_name = ""
    ses_from_address           = ""
  }
  expect_failures = [var.email_mode]
}
run "reject_an_unrecognised_gate_mode" {
  command = plan
  variables { auth_mode = "off" }
  expect_failures = [var.auth_mode]
}
run "reject_mutable_image_tag" {
  command = plan
  variables { image_tag = "latest" }
  expect_failures = [var.image_tag]
}
# The function publishes its own OpenAPI document, and the server URL in that
# document is the only address a generated client will ever call. It learns that
# address from APP_ORIGIN, so APP_ORIGIN has to be the origin the public reaches
# this deployment on — the same value CORS allows, not a second opinion.
run "the_function_is_told_the_public_origin_it_is_reached_on" {
  command = apply
  variables { app_origin = "https://ursly.io" }
  assert {
    condition     = aws_lambda_function.runtime["api"].environment[0].variables["APP_ORIGIN"] == "https://ursly.io"
    error_message = "The api function must be handed the configured public origin, not the gateway endpoint."
  }
  assert {
    condition     = contains(aws_apigatewayv2_api.http.cors_configuration[0].allow_origins, "https://ursly.io")
    error_message = "The browser origin the app is served on must be allowed to call the API."
  }
  assert {
    # cors_rule is a set of objects, which has no addressable keys: ask whether
    # any rule allows the origin rather than reaching for the first one.
    condition     = anytrue([for rule in aws_s3_bucket_cors_configuration.uploads.cors_rule : contains(rule.allowed_origins, "https://ursly.io")])
    error_message = "The browser origin the app is served on must be allowed to upload."
  }
  # The socket is not covered by the same-origin policy, so the page the reader
  # is actually on has to be named or the discussion never opens for anyone.
  assert {
    condition     = contains(split(",", aws_lambda_function.runtime["chat"].environment[0].variables["CHAT_ALLOWED_ORIGINS"]), "https://ursly.io")
    error_message = "The browser origin the app is served on must be allowed to open the socket."
  }
}
# Nothing configured must still leave the document naming somewhere that
# answers. The gateway's own endpoint is that address; a guessed default is not.
run "an_unconfigured_deployment_publishes_its_gateway_endpoint" {
  command = apply
  assert {
    condition     = aws_lambda_function.runtime["api"].environment[0].variables["APP_ORIGIN"] == aws_apigatewayv2_api.http.api_endpoint
    error_message = "Without a site origin the function must publish the gateway endpoint, which is reachable."
  }
  assert {
    condition     = length(aws_apigatewayv2_api.http.cors_configuration[0].allow_origins) == 0
    error_message = "With no separate site origin, no cross-origin caller is allowed rather than an empty one."
  }
}
run "no_email_permission_before_the_operator_verifies_the_domain" {
  command = apply
  variables {
    # log is the only mode available before environments/email is applied, and
    # naming it is the deployment admitting its sign-in codes go to CloudWatch.
    email_mode                 = "log"
    ses_identity_arn           = ""
    ses_configuration_set_name = ""
    ses_from_address           = ""
  }
  assert {
    condition     = length(jsondecode(aws_iam_role_policy.runtime["api"].policy).Statement) == 4 && alltrue([for statement in jsondecode(aws_iam_role_policy.runtime["api"].policy).Statement : !anytrue([for action in statement.Action : startswith(action, "ses:")])])
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
    condition     = aws_lambda_function.runtime["api"].environment[0].variables["SES_FROM_ADDRESS"] == "no-reply@example.test" && aws_lambda_function.runtime["api"].environment[0].variables["SES_CONFIGURATION_SET"] == "talk-to-a-document-transactional"
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
  # Explicitly empty, because the file-level fixture supplies all three.
  variables {
    ses_identity_arn           = "arn:aws:ses:us-east-1:123456789012:identity/example.test"
    ses_configuration_set_name = ""
    ses_from_address           = ""
  }
  expect_failures = [var.ses_configuration_set_name, var.ses_from_address]
}
