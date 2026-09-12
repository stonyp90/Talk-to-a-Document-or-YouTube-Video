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

# The signing pepper, by the same rule as the provider key: the operator creates
# the secret and supplies its exact ARN. The boundary below is why it belongs
# here as well as in the application module — a grant the boundary does not
# allow is a grant the task does not have, and sign-in would fail with an AWS
# denial nobody is looking for.
variable "auth_pepper_secret_arn" {
  type = string
  validation {
    condition     = can(regex("^arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:[^*?]+$", var.auth_pepper_secret_arn))
    error_message = "Provide the exact existing secret ARN, without wildcards or secret contents."
  }
}

variable "github_subject_prefix" {
  type    = string
  default = null
  validation {
    condition = var.github_subject_prefix == null ? true : (
      can(regex("^repo:[A-Za-z0-9_.-]+(@[0-9]+)?/[A-Za-z0-9_.-]+(@[0-9]+)?$", var.github_subject_prefix)) &&
      replace(var.github_subject_prefix, "/@[0-9]+/", "") == "repo:${var.github_repository}"
    )
    error_message = "Use the exact sub_claim_prefix reported by GitHub for this repository, without wildcards or environment suffix."
  }
}
# Transactional email is operator-owned: environments/email verifies the domain
# identity and creates the configuration set. Naming them here, with the one
# mailbox the application sends as, lets the boundary cap what a runtime role
# can ever send. Empty leaves runtime sending impossible.
variable "ses_identity_arn" {
  type    = string
  default = ""
  validation {
    condition     = var.ses_identity_arn == "" || can(regex("^arn:aws:ses:${var.region}:${var.account_id}:identity/[a-z0-9.-]+$", var.ses_identity_arn))
    error_message = "Provide the exact verified domain identity ARN from the email root, without wildcards."
  }
}
variable "ses_configuration_set_name" {
  type    = string
  default = ""
  validation {
    condition     = (var.ses_configuration_set_name == "") == (var.ses_identity_arn == "")
    error_message = "Set the SES identity ARN, configuration set name and From address together, or none of them."
  }
  validation {
    condition     = var.ses_configuration_set_name == "" || can(regex("^[A-Za-z0-9_-]{1,64}$", var.ses_configuration_set_name))
    error_message = "Configuration set names accept letters, digits, dashes and underscores only."
  }
}
# The pin to a single sender belongs here, not only in the api role policy: CI
# writes that policy through iam:PutRolePolicy, so a policy-level pin caps
# nothing against the deploy role. The boundary is operator-owned and does.
variable "ses_from_address" {
  type    = string
  default = ""
  validation {
    condition     = (var.ses_from_address == "") == (var.ses_identity_arn == "")
    error_message = "Set the SES identity ARN, configuration set name and From address together, or none of them."
  }
  validation {
    condition     = var.ses_from_address == "" || endswith(var.ses_from_address, "@${local.ses_domain}")
    error_message = "Send only from a mailbox on the verified identity domain."
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
  name       = "talk-to-a-document"
  bucket_arn = "arn:aws:s3:::${local.name}-uploads-${var.account_id}-${var.region}"
  # The application is three functions: the site and its HTTP routes, the caption
  # proxy, and the live discussion behind the WebSocket gateway. Naming them here
  # is what caps CI to exactly these functions, roles, log groups and repositories.
  services      = ["api", "transcript", "chat"]
  runtime_arns  = [for role in ["runtime", "transcript-runtime", "chat-runtime"] : "arn:aws:iam::${var.account_id}:role/${local.name}-${role}"]
  function_arns = [for name in local.services : "arn:aws:lambda:${var.region}:${var.account_id}:function:${local.name}-${name}"]
  log_arns      = [for name in local.services : "arn:aws:logs:${var.region}:${var.account_id}:log-group:/aws/lambda/${local.name}-${name}"]
  ses_domain    = trimprefix(var.ses_identity_arn, "arn:aws:ses:${var.region}:${var.account_id}:identity/")
  # The ceiling on sending, mirroring the grant the application module writes.
  # SendEmail is authorized against the identity and, when the call names one,
  # the configuration set, so the cap has to list both ARNs. The boundary limits
  # runtime roles to that identity, that set and exactly one From address; the
  # api role policy in modules/demo repeats the same pin as defense in depth.
  # Changing the sender therefore takes an operator bootstrap apply, on purpose.
  # Raw MIME sending would need ses:SendRawEmail added here deliberately.
  ses_statements = var.ses_identity_arn == "" ? [] : [{
    Effect    = "Allow"
    Action    = ["ses:SendEmail"]
    Resource  = [var.ses_identity_arn, "arn:aws:ses:${var.region}:${var.account_id}:configuration-set/${var.ses_configuration_set_name}"]
    Condition = { StringEquals = { "ses:FromAddress" = var.ses_from_address } }
  }]
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
  for_each             = toset(local.services)
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
    Statement = concat([
      # Uploaded documents and the stored conversations that name them. Both are
      # expired by lifecycle rules within a day; neither prefix is ever public.
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = ["${local.bucket_arn}/uploads/*", "${local.bucket_arn}/sessions/*"] },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"], Resource = [var.openai_secret_arn, var.auth_pepper_secret_arn] },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = [for arn in local.log_arns : "${arn}:*"] },
      # Posting an answer back down an open socket. API IDs are assigned by AWS,
      # so the cap is this account and region; the chat role policy that CI writes
      # narrows it to the one WebSocket API, and the boundary keeps it there.
      { Effect = "Allow", Action = ["execute-api:ManageConnections"], Resource = ["arn:aws:execute-api:${var.region}:${var.account_id}:*/*"] }
    ], local.ses_statements)
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
        "token.actions.githubusercontent.com:sub" = "${coalesce(var.github_subject_prefix, "repo:${var.github_repository}")}:environment:production"
      } }
    }]
  })
}
output "github_role_arn" { value = aws_iam_role.deploy.arn }
output "state_bucket" { value = aws_s3_bucket.state.id }
output "runtime_boundary_arn" { value = aws_iam_policy.runtime_boundary.arn }
