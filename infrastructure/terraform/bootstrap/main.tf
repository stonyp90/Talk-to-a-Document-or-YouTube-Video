terraform {
  required_version = ">= 1.14.7, < 2.0.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  # Initial operator run uses local state. See README before migrating to S3.
}
provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]
  default_tags { tags = { Project = "talk-to-a-document", ManagedBy = "Terraform" } }
}
variable "region" { type = string }
variable "account_id" {
  type = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "Specify the intended 12-digit AWS account."
  }
}
variable "github_repository" {
  type = string
  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Use OWNER/REPO, not a URL or wildcard."
  }
}
variable "openai_secret_arn" {
  type = string
  validation {
    condition     = can(regex("^arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:[^*?]+$", var.openai_secret_arn))
    error_message = "Provide the exact existing secret ARN, without wildcards or secret contents."
  }
}
variable "existing_oidc_provider_arn" {
  type    = string
  default = null
  validation {
    condition     = var.existing_oidc_provider_arn == null || var.existing_oidc_provider_arn == "arn:aws:iam::${var.account_id}:oidc-provider/token.actions.githubusercontent.com"
    error_message = "Reuse only GitHub's OIDC provider in the intended AWS account."
  }
}
locals {
  name          = "talk-to-a-document"
  bucket_arn    = "arn:aws:s3:::${local.name}-uploads-${var.account_id}-${var.region}"
  runtime_arns  = ["arn:aws:iam::${var.account_id}:role/${local.name}-runtime", "arn:aws:iam::${var.account_id}:role/${local.name}-transcript-runtime"]
  function_arns = [for name in ["api", "transcript"] : "arn:aws:lambda:${var.region}:${var.account_id}:function:${local.name}-${name}"]
  log_arns      = [for name in ["api", "transcript"] : "arn:aws:logs:${var.region}:${var.account_id}:log-group:/aws/lambda/${local.name}-${name}"]
}
resource "aws_s3_bucket" "state" {
  bucket = "${local.name}-tfstate-${var.account_id}-${var.region}"
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Deny", Principal = "*", Action = "s3:*"
      Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
resource "aws_ecr_repository" "images" {
  for_each             = toset(["api", "transcript"])
  name                 = "${local.name}-${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
  lifecycle { prevent_destroy = true }
}
resource "aws_ecr_repository_policy" "lambda" {
  for_each   = aws_ecr_repository.images
  repository = each.value.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }
      Action = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
      Condition = {
        StringEquals = { "aws:SourceAccount" = var.account_id }
        ArnLike      = { "aws:SourceArn" = "arn:aws:lambda:${var.region}:${var.account_id}:function:${local.name}-${each.key}" }
      }
    }]
  })
}
resource "aws_iam_policy" "runtime_boundary" {
  name = "${local.name}-runtime-boundary"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = ["${local.bucket_arn}/uploads/*"] },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"], Resource = [var.openai_secret_arn] },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = [for arn in local.log_arns : "${arn}:*"] }
    ]
  })
  lifecycle { prevent_destroy = true }
}
resource "aws_iam_openid_connect_provider" "github" {
  count          = var.existing_oidc_provider_arn == null ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}
resource "aws_iam_role" "deploy" {
  name                 = "${local.name}-github"
  max_session_duration = 3600
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = var.existing_oidc_provider_arn != null ? var.existing_oidc_provider_arn : aws_iam_openid_connect_provider.github[0].arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = { StringEquals = {
        "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:production"
      } }
    }]
  })
}
output "github_role_arn" { value = aws_iam_role.deploy.arn }
output "state_bucket" { value = aws_s3_bucket.state.id }
output "runtime_boundary_arn" { value = aws_iam_policy.runtime_boundary.arn }
