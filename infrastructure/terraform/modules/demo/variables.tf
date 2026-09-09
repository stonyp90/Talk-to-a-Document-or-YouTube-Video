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
