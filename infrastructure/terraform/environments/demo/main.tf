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
variable "app_origin" {
  type    = string
  default = "http://localhost:3000"
}
module "demo" {
  source            = "../../modules/demo"
  region            = var.region
  account_id        = var.account_id
  image_tag         = var.image_tag
  openai_secret_arn = var.openai_secret_arn
  app_origin        = var.app_origin
}
output "public_url" { value = module.demo.public_url }
output "upload_bucket" { value = module.demo.upload_bucket }
