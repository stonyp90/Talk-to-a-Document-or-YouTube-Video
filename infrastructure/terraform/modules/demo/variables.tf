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
  # The public origin the site is served on, when it is not the gateway's own
  # endpoint: the custom domain mapped to this API in the operator-owned root.
  # Empty means there is no separate site origin yet, and the deployment names
  # the gateway endpoint to callers instead of guessing at a domain.
  type    = string
  default = ""
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

# The pepper that turns a stolen table of code hashes into a table of useless
# hashes. It travels exactly as the provider key does: the operator creates the
# secret outside Terraform and supplies its ARN, the task is granted read access
# to that one ARN, and the value itself never reaches a variable file, a saved
# plan, state, or a workflow log.
variable "auth_pepper_secret_arn" {
  type = string
  validation {
    condition     = can(regex("^arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:[^*?]+$", var.auth_pepper_secret_arn))
    error_message = "An exact existing Secrets Manager secret ARN is required (not the secret value)."
  }
}

# The gate. "required" is the only default a deployment may have: an unset or
# misspelt mode must refuse the paid endpoints, never open them. Overriding this
# is deliberately awkward — there is no GitHub variable behind it, so opening
# the gate in production takes a reviewed change to this configuration.
variable "auth_mode" {
  type    = string
  default = "required"
  validation {
    condition     = contains(["required", "disabled"], var.auth_mode)
    error_message = "AUTH_MODE is required or disabled; nothing else opens the gate."
  }
}

# The spend cap, in the same units the application prices each paid call in.
# Defaults match the application's own defaults, so Terraform changes nothing
# by being added.
variable "usage_limit_units" {
  type    = number
  default = 300
  validation {
    condition     = var.usage_limit_units > 0
    error_message = "An allowance of zero units signs readers in and then refuses them everything."
  }
}
variable "usage_window_ms" {
  type    = number
  default = 86400000
  validation {
    condition     = var.usage_window_ms >= 60000
    error_message = "Use a window of at least a minute; anything shorter is a rate limiter, not an allowance."
  }
}

# --- Sign-in email --------------------------------------------------------
# A deployment defaults to real mail. The application's own default is the log
# notifier, which is right for a laptop and wrong here: a one-time code written
# to CloudWatch is a code anybody with log access can use. Real mail needs the
# operator-owned identity below, so the two are checked against each other: a
# deployment either sends through the verified identity or says out loud, by
# setting log, that its sign-in codes are going to a log group.
variable "email_mode" {
  type    = string
  default = "ses"
  validation {
    condition     = contains(["ses", "log"], var.email_mode)
    error_message = "EMAIL_MODE is ses or log; log writes sign-in codes to CloudWatch and is not for production."
  }
  validation {
    condition     = var.email_mode != "ses" || var.ses_identity_arn != ""
    error_message = "EMAIL_MODE=ses needs the identity, configuration set and From address the operator gets from environments/email."
  }
}

# Transactional email. The identity and configuration set are created by the
# operator-owned environments/email root, never by CI, and are named here so the
# api function can send and the runtime role can be scoped to exactly that.
# They are regional, and the boundary in bootstrap pins the same three values,
# so the identity has to live in the deployment region.
variable "ses_identity_arn" {
  type    = string
  default = ""
  validation {
    condition     = var.ses_identity_arn == "" || can(regex("^arn:aws:ses:${var.region}:${var.account_id}:identity/[a-z0-9.-]+$", var.ses_identity_arn))
    error_message = "Provide the exact verified domain identity ARN from the email root, without wildcards."
  }
}
# A configuration set is how bounces and complaints get recorded; without one,
# SES still sends and the reputation signals go nowhere. environments/email
# always creates one, so it is required alongside the identity rather than
# optional.
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
# The verified sender. Terraform does not verify it here: the identity belongs
# to the operator-owned email root, and the SES sandbox exit is a human step.
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
