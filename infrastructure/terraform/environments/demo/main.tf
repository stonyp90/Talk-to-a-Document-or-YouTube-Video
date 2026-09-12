terraform {
  required_version = ">= 1.14.7, < 2.0.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  backend "s3" {
    key          = "demo/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}
provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]
  default_tags { tags = { Project = "talk-to-a-document", Environment = "demo", ManagedBy = "Terraform" } }
}
variable "region" { type = string }
variable "account_id" {
  type = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "Specify the intended 12-digit AWS account."
  }
}
variable "image_tag" { type = string }
variable "openai_secret_arn" { type = string }
variable "auth_pepper_secret_arn" { type = string }
variable "app_origin" {
  type    = string
  default = "http://localhost:3000"
}

# The module holds the defaults for these; they are repeated here only so an
# operator can override one with TF_VAR_ without editing configuration. The
# gate stays closed unless somebody says otherwise out loud.
variable "auth_mode" {
  type    = string
  default = "required"
}
variable "usage_limit_units" {
  type    = number
  default = 300
}
variable "usage_window_ms" {
  type    = number
  default = 86400000
}
variable "email_mode" {
  type    = string
  default = "ses"
}

# Empty until the operator has applied environments/email and copied its outputs
# into the production environment variables; sending stays impossible until then,
# and EMAIL_MODE=ses refuses to plan without them.
variable "ses_identity_arn" {
  type    = string
  default = ""
}
variable "ses_configuration_set_name" {
  type    = string
  default = ""
}
variable "ses_from_address" {
  type    = string
  default = ""
}

module "demo" {
  source                     = "../../modules/demo"
  region                     = var.region
  account_id                 = var.account_id
  image_tag                  = var.image_tag
  openai_secret_arn          = var.openai_secret_arn
  auth_pepper_secret_arn     = var.auth_pepper_secret_arn
  app_origin                 = var.app_origin
  auth_mode                  = var.auth_mode
  usage_limit_units          = var.usage_limit_units
  usage_window_ms            = var.usage_window_ms
  email_mode                 = var.email_mode
  ses_identity_arn           = var.ses_identity_arn
  ses_configuration_set_name = var.ses_configuration_set_name
  ses_from_address           = var.ses_from_address
}
output "public_url" { value = module.demo.public_url }
output "upload_bucket" { value = module.demo.upload_bucket }
