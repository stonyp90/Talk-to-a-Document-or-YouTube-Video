# Operator-owned domain state; the application CI role cannot change DNS.
terraform {
  required_version = ">= 1.14.7, < 2.0.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  backend "s3" {
    key          = "domain/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region              = "us-east-1"
  allowed_account_ids = ["436136277668"]
  default_tags { tags = { Project = "talk-to-a-document", ManagedBy = "Terraform" } }
}

variable "api_id" { type = string }

resource "aws_apigatewayv2_domain_name" "app" {
  domain_name = "ursly.io"
  domain_name_configuration {
    certificate_arn = "arn:aws:acm:us-east-1:436136277668:certificate/597c2d3b-e3ae-4ba0-a1ff-a15a75e27d46"
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "app" {
  api_id      = var.api_id
  domain_name = aws_apigatewayv2_domain_name.app.id
  stage       = "$default"
}

resource "aws_route53_record" "app" {
  zone_id = "Z02814223MLIQXPXE4SZG"
  name    = "ursly.io"
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.app.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.app.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

output "public_url" { value = "https://ursly.io" }
