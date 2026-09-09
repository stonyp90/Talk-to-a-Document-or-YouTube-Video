locals {
  name     = "talk-to-a-document"
  bucket   = "${local.name}-uploads-${var.account_id}-${var.region}"
  boundary = "arn:aws:iam::${var.account_id}:policy/${local.name}-runtime-boundary"
  functions = {
    # A fresh page loads several JS/CSS assets in parallel through this function.
    # Match the gateway burst capacity so five occupied slots cannot break hydration.
    api        = { memory = 1024, timeout = 28, concurrency = 20, role = "${local.name}-runtime" }
    transcript = { memory = 256, timeout = 20, concurrency = 2, role = "${local.name}-transcript-runtime" }
  }
  paid_routes = toset(["POST /api/realtime/session", "POST /api/realtime/connect", "POST /api/text-chat", "POST /api/uploads", "POST /api/uploads/extract"])
  routes = merge(
    { "ANY /" = "api", "ANY /{proxy+}" = "api", "GET /transcript/{videoId}" = "transcript" },
    { for route in local.paid_routes : route => "api" }
  )
}
resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = [var.app_origin]
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
}
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_origins = distinct([aws_apigatewayv2_api.http.api_endpoint, var.app_origin])
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
        { Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"], Resource = [var.openai_secret_arn] }
      ] : []
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
    variables = each.key == "api" ? {
      PORT                    = "3000", HOSTNAME = "0.0.0.0", PROVIDER_MODE = "live"
      OPENAI_SECRET_ARN       = var.openai_secret_arn
      UPLOAD_BUCKET           = aws_s3_bucket.uploads.id
      APP_ORIGIN              = aws_apigatewayv2_api.http.api_endpoint
      YOUTUBE_TRANSCRIPT_MODE = "live"
      TRANSCRIPT_SERVICE_URL  = aws_apigatewayv2_api.http.api_endpoint
      OPENAI_BASE_URL         = "https://api.openai.com"
      OPENAI_REALTIME_MODEL   = "gpt-realtime", OPENAI_TEXT_MODEL = "gpt-4.1-mini"
    } : { PORT = "3010", TRANSCRIPT_MODE = "live", UPSTREAM_TIMEOUT_SECONDS = "10" }
  }
  depends_on = [aws_iam_role_policy.runtime, aws_cloudwatch_log_group.runtime]
}
resource "aws_apigatewayv2_integration" "lambda" {
  for_each               = local.functions
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
  for_each       = local.functions
  statement_id   = "AllowHttpApi"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.runtime[each.key].function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
  source_account = var.account_id
}
output "public_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "upload_bucket" { value = aws_s3_bucket.uploads.id }
