locals {
  name     = "talk-to-a-document"
  bucket   = "${local.name}-uploads-${var.account_id}-${var.region}"
  boundary = "arn:aws:iam::${var.account_id}:policy/${local.name}-runtime-boundary"
  # The origin the public reaches this deployment on: the site's own domain
  # once one is mapped to the gateway, and the gateway's endpoint until then.
  # Reachable either way, which is the point — the function publishes this as
  # the server URL of its OpenAPI document, and a client generated from that
  # document can only call an address that answers. The gateway endpoint is the
  # honest fallback; a guessed default would send those clients nowhere.
  public_origin = var.app_origin != "" ? var.app_origin : aws_apigatewayv2_api.http.api_endpoint
  functions = {
    # A fresh page loads several JS/CSS assets in parallel through this function.
    # Match the gateway burst capacity so five occupied slots cannot break hydration.
    api        = { memory = 1024, timeout = 28, concurrency = 20, role = "${local.name}-runtime" }
    transcript = { memory = 256, timeout = 20, concurrency = 2, role = "${local.name}-transcript-runtime" }
    # The live discussion. It answers after the gateway has already replied to the
    # frame, posting fragments back down the connection, so it outlives the 29s
    # integration timeout on purpose; the cap is how many models it may run at once.
    chat = { memory = 512, timeout = 60, concurrency = 5, role = "${local.name}-chat-runtime" }
  }
  # Only these two belong on the HTTP API. The discussion is reached over the
  # socket and has no HTTP route of its own, so it gets no integration, no route
  # and no permission for apigateway to invoke it from the site's API.
  http_functions = { for name, function in local.functions : name => function if name != "chat" }
  # Both halves of a conversation read and write the same stored session, so an id
  # opened over HTTP resolves on the socket and the other way round.
  conversation_functions = ["api", "chat"]
  # Transactional email is operator-owned: environments/email verifies the domain
  # identity and creates the configuration set, and this module only consumes
  # them. Sending is all the api task may ever do -- from one address, on one
  # identity. It may not verify an identity, read a quota, or change SES at all.
  #
  # SendEmail is authorized against the identity and, when the call names one,
  # the configuration set, so both ARNs are listed. The FromAddress condition is
  # what stops a compromised function sending as any other mailbox on the domain;
  # a bare identity grant would hand it the whole domain. The configuration set
  # is also attached to the identity itself, so bounce and complaint events are
  # published even if a caller omits the parameter.
  ses_sending = var.email_mode == "ses" && var.ses_identity_arn != ""
  ses_statements = local.ses_sending ? [{
    Effect    = "Allow"
    Action    = ["ses:SendEmail"]
    Resource  = [var.ses_identity_arn, "arn:aws:ses:${var.region}:${var.account_id}:configuration-set/${var.ses_configuration_set_name}"]
    Condition = { StringEquals = { "ses:FromAddress" = var.ses_from_address } }
  }] : []
  # These are the names the application itself reads (packages/adapters/src/
  # accounts.ts): SES_CONFIGURATION_SET, not the Terraform variable's spelling.
  # The identity ARN is not passed: the task never names the identity, it sends
  # from the address, and the grant above is what ties the two together.
  ses_environment = local.ses_sending ? {
    SES_REGION            = var.region
    SES_FROM_ADDRESS      = var.ses_from_address
    SES_CONFIGURATION_SET = var.ses_configuration_set_name
  } : {}
  paid_routes = toset(["POST /api/realtime/session", "POST /api/realtime/connect", "POST /api/text-chat", "POST /api/uploads", "POST /api/uploads/extract"])
  routes = merge(
    { "ANY /" = "api", "ANY /{proxy+}" = "api", "GET /transcript/{videoId}" = "transcript" },
    { for route in local.paid_routes : route => "api" }
  )
  environments = {
    api = merge({
      PORT                     = "3000", HOSTNAME = "0.0.0.0", PROVIDER_MODE = "live"
      OPENAI_SECRET_ARN        = var.openai_secret_arn
      UPLOAD_BUCKET            = aws_s3_bucket.uploads.id
      SESSION_BUCKET           = aws_s3_bucket.uploads.id
      APP_ORIGIN               = local.public_origin
      YOUTUBE_TRANSCRIPT_MODE  = "live"
      TRANSCRIPT_SERVICE_URL   = aws_apigatewayv2_api.http.api_endpoint
      OPENAI_BASE_URL          = "https://api.openai.com"
      OPENAI_REALTIME_MODEL    = "gpt-realtime", OPENAI_TEXT_MODEL = "gpt-4.1-mini"
      CONTEXT_CHARACTER_BUDGET = tostring(var.context_character_budget)
      # The gate, the allowance, and the two things without which nobody can
      # sign in. The pepper arrives as an ARN and is read at runtime, exactly
      # like the provider key beside it; its value is never in this file. The
      # SES names arrive only once the operator has applied environments/email.
      AUTH_MODE              = var.auth_mode
      AUTH_PEPPER_SECRET_ARN = var.auth_pepper_secret_arn
      USAGE_LIMIT_UNITS      = tostring(var.usage_limit_units)
      USAGE_WINDOW_MS        = tostring(var.usage_window_ms)
      EMAIL_MODE             = var.email_mode
    }, local.ses_environment)
    transcript = merge(
      { PORT = "3010", TRANSCRIPT_MODE = "live", UPSTREAM_TIMEOUT_SECONDS = "10" },
      var.transcript_proxy_url == "" ? {} : { TRANSCRIPT_PROXY_URL = var.transcript_proxy_url }
    )
    # A custom domain cannot serve the management API, so the answer goes back
    # through the stage's own https endpoint rather than whatever host the browser
    # dialled. The stage hands out a wss:// url; only the scheme differs.
    chat = {
      PROVIDER_MODE            = "live"
      OPENAI_SECRET_ARN        = var.openai_secret_arn
      OPENAI_BASE_URL          = "https://api.openai.com"
      OPENAI_TEXT_MODEL        = "gpt-4.1-mini"
      CONTEXT_CHARACTER_BUDGET = tostring(var.context_character_budget)
      SESSION_BUCKET           = aws_s3_bucket.uploads.id
      CHAT_ALLOWED_ORIGINS     = join(",", distinct([local.public_origin, aws_apigatewayv2_api.http.api_endpoint]))
      CHAT_CALLBACK_URL        = replace(aws_apigatewayv2_stage.socket.invoke_url, "wss://", "https://")
    }
  }
}
resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name}-api"
  protocol_type = "HTTP"
  cors_configuration {
    # Only a site on another origin needs these headers, and this cannot name
    # the gateway's own endpoint without depending on itself. Unconfigured, the
    # app is reached here and calls itself, so allowing nothing is both correct
    # and the closed door: an empty origin string would allow nothing either,
    # while reading as though it allowed something.
    allow_origins = compact([var.app_origin])
    allow_methods = ["*"]
    allow_headers = ["content-type"]
  }
}
resource "aws_s3_bucket" "uploads" {
  bucket = local.bucket
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_ownership_controls" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule { object_ownership = "BucketOwnerEnforced" }
}
resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Deny", Principal = "*", Action = "s3:*"
      Resource  = [aws_s3_bucket.uploads.arn, "${aws_s3_bucket.uploads.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    id     = "expire-temporary-pdfs"
    status = "Enabled"
    filter { prefix = "uploads/" }
    expiration { days = 1 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
  # A conversation is written here only so the site and the socket agree on what
  # an id means. It is worth no more than the document it was held about.
  rule {
    id     = "expire-shared-sessions"
    status = "Enabled"
    filter { prefix = "sessions/" }
    expiration { days = 1 }
  }
}
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_origins = distinct([aws_apigatewayv2_api.http.api_endpoint, local.public_origin])
    allowed_methods = ["POST"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 300
  }
}
resource "aws_cloudwatch_log_group" "runtime" {
  for_each          = local.functions
  name              = "/aws/lambda/${local.name}-${each.key}"
  retention_in_days = 7
  lifecycle { prevent_destroy = true }
}
resource "aws_iam_role" "runtime" {
  for_each             = local.functions
  name                 = each.value.role
  permissions_boundary = local.boundary
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy" "runtime" {
  for_each = local.functions
  name     = "runtime"
  role     = aws_iam_role.runtime[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [{ Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = ["${aws_cloudwatch_log_group.runtime[each.key].arn}:*"] }],
      each.key == "api" ? [
        { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = ["${aws_s3_bucket.uploads.arn}/uploads/*"] },
        # Two exact ARNs, no wildcard: the provider key and the signing pepper.
        { Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"], Resource = [var.openai_secret_arn, var.auth_pepper_secret_arn] }
      ] : [],
      # The stored conversation, reachable from whichever half is answering.
      contains(local.conversation_functions, each.key) ? [
        { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = ["${aws_s3_bucket.uploads.arn}/sessions/*"] }
      ] : [],
      # The socket answers questions, so it needs the provider key, and it needs
      # to write down an open connection. It never signs anyone in, so the
      # pepper stays with the function that does.
      each.key == "chat" ? [
        { Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"], Resource = [var.openai_secret_arn] },
        { Effect = "Allow", Action = ["execute-api:ManageConnections"], Resource = ["arn:aws:execute-api:${var.region}:${var.account_id}:${aws_apigatewayv2_api.socket.id}/*"] }
      ] : [],
      each.key == "api" ? local.ses_statements : []
    )
  })
}
resource "aws_lambda_function" "runtime" {
  for_each                       = local.functions
  function_name                  = "${local.name}-${each.key}"
  package_type                   = "Image"
  image_uri                      = "${var.account_id}.dkr.ecr.${var.region}.amazonaws.com/${local.name}-${each.key}:${var.image_tag}"
  role                           = aws_iam_role.runtime[each.key].arn
  architectures                  = ["x86_64"]
  memory_size                    = each.value.memory
  timeout                        = each.value.timeout
  reserved_concurrent_executions = each.value.concurrency
  environment {
    variables = local.environments[each.key]
  }
  depends_on = [aws_iam_role_policy.runtime, aws_cloudwatch_log_group.runtime]
}
resource "aws_apigatewayv2_integration" "lambda" {
  for_each               = local.http_functions
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.runtime[each.key].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}
resource "aws_apigatewayv2_route" "routes" {
  for_each  = local.routes
  api_id    = aws_apigatewayv2_api.http.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value].id}"
}
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
  dynamic "route_settings" {
    for_each = local.paid_routes
    content {
      route_key              = route_settings.value
      throttling_burst_limit = 2
      throttling_rate_limit  = 1
    }
  }
  depends_on = [aws_apigatewayv2_route.routes]
}
resource "aws_lambda_permission" "gateway" {
  for_each       = local.http_functions
  statement_id   = "AllowHttpApi"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.runtime[each.key].function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
  source_account = var.account_id
}
# The live discussion. Routing on the message type is what lets the gateway speak
# the same protocol the long-lived server speaks locally, so one application
# channel serves both and neither can drift.
resource "aws_apigatewayv2_api" "socket" {
  name                       = "${local.name}-socket"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.type"
}
resource "aws_apigatewayv2_integration" "socket" {
  api_id                    = aws_apigatewayv2_api.socket.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.runtime["chat"].invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
  timeout_milliseconds      = 29000
}
# Opening, closing and everything said in between reach the same handler: the
# connect route is where an origin is refused, so every route must be integrated.
resource "aws_apigatewayv2_route" "socket" {
  for_each  = toset(["$connect", "$disconnect", "$default"])
  api_id    = aws_apigatewayv2_api.socket.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.socket.id}"
}
# Deliberately without depends_on the routes: the chat function reads this stage's
# url to post answers back, and waiting for routes that wait for that function
# would close the cycle. auto_deploy publishes each route as it is created.
resource "aws_apigatewayv2_stage" "socket" {
  api_id      = aws_apigatewayv2_api.socket.id
  name        = "live"
  auto_deploy = true
  # Every question here is a model call, so the socket is held well under the
  # site's 10/s: a burst is a reader reconnecting, not a page loading its assets.
  default_route_settings {
    throttling_burst_limit = 5
    throttling_rate_limit  = 2
  }
}
resource "aws_lambda_permission" "socket" {
  statement_id   = "AllowSocketApi"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.runtime["chat"].function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${aws_apigatewayv2_api.socket.execution_arn}/*/*"
  source_account = var.account_id
}
output "public_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "socket_url" { value = aws_apigatewayv2_stage.socket.invoke_url }
output "socket_api_id" { value = aws_apigatewayv2_api.socket.id }
output "upload_bucket" { value = aws_s3_bucket.uploads.id }
