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
