variable "region" { type = string }
variable "account_id" { type = string }
variable "image_tag" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{40}$", var.image_tag))
    error_message = "Use the full 40-character commit SHA that passed CI; never latest."
  }
}
variable "openai_secret_arn" {
  type = string
  validation {
    condition     = can(regex("^arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:[^*?]+$", var.openai_secret_arn))
    error_message = "An exact existing Secrets Manager secret ARN is required (not the secret value)."
  }
}
variable "app_origin" {
  type    = string
  default = "http://localhost:3000"
}

# YouTube refuses caption requests from cloud address ranges. Routing the caption
# function through an outbound proxy is what makes the deployed YouTube path work;
# leaving this empty keeps today's behaviour, where the app explains the block and
# offers a PDF instead. Supply it at apply time from your own secret store: it is
# never committed, and Lambda encrypts function environment variables at rest.
variable "transcript_proxy_url" {
  type      = string
  default   = ""
  sensitive = true
  validation {
    condition     = var.transcript_proxy_url == "" || can(regex("^https?://", var.transcript_proxy_url))
    error_message = "Supply an http:// or https:// proxy URL, or leave it empty."
  }
}

variable "context_character_budget" {
  type    = number
  default = 120000
  validation {
    condition     = var.context_character_budget >= 1000
    error_message = "A conversation needs at least 1000 characters of source context."
  }
}

# Transactional email. The identity and configuration set are created by the
# operator-owned environments/email root, never by CI, and are named here so the
# api function can send and the runtime role can be scoped to exactly that.
# Empty keeps the existing deployment unchanged: no permission, no environment.
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
variable "ses_from_address" {
  type    = string
  default = ""
  validation {
    condition     = (var.ses_from_address == "") == (var.ses_identity_arn == "")
    error_message = "Set the SES identity ARN, configuration set name and From address together, or none of them."
  }
  validation {
    condition     = var.ses_from_address == "" || endswith(var.ses_from_address, "@${trimprefix(var.ses_identity_arn, "arn:aws:ses:${var.region}:${var.account_id}:identity/")}")
    error_message = "Send only from a mailbox on the verified identity domain."
  }
}
