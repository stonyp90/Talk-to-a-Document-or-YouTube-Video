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
# The demo root's socket_api_id output. The live discussion is a second, separate
# gateway: a WebSocket API cannot be mapped onto the HTTP API's custom domain.
variable "socket_api_id" { type = string }
# A WebSocket API accepts only a single-level mapping key, so the socket is
# served at the host root and the browser dials wss://ws.ursly.io. The path
# belongs to the local transport, where one Node process also serves health
# checks and has to tell the two apart. Whatever is set here and the
# CHAT_SOCKET_URL repository variable must agree.
variable "socket_mapping_key" {
  type    = string
  default = ""
}

locals {
  zone_id     = "Z02814223MLIQXPXE4SZG"
  domain      = "ursly.io"
  socket_host = "ws.ursly.io"
}

resource "aws_apigatewayv2_domain_name" "app" {
  domain_name = local.domain
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
  zone_id = local.zone_id
  name    = local.domain
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.app.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.app.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# The apex certificate above is named by ARN alone, and nothing in this state
# says which names it covers, so it is not reused for the socket host: a
# certificate that turns out not to cover ws.ursly.io fails the domain at TLS,
# after DNS already points at it. A dedicated DNS-validated certificate costs
# nothing and is validated through the zone this root already owns. If the
# existing certificate does cover ws.ursly.io, an operator may point the domain
# below at that ARN and remove these three resources in a reviewed plan.
resource "aws_acm_certificate" "socket" {
  domain_name       = local.socket_host
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "socket_validation" {
  for_each = { for option in aws_acm_certificate.socket.domain_validation_options : option.domain_name => option }
  zone_id  = local.zone_id
  name     = each.value.resource_record_name
  type     = each.value.resource_record_type
  records  = [each.value.resource_record_value]
  ttl      = 60
  # Validation records are re-issued unchanged on renewal; owning the name is
  # the point, and refusing to overwrite it only strands the apply.
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "socket" {
  certificate_arn         = aws_acm_certificate.socket.arn
  validation_record_fqdns = [for record in aws_route53_record.socket_validation : record.fqdn]
}

resource "aws_apigatewayv2_domain_name" "socket" {
  domain_name = local.socket_host
  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.socket.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "socket" {
  api_id          = var.socket_api_id
  domain_name     = aws_apigatewayv2_domain_name.socket.id
  stage           = "live"
  api_mapping_key = var.socket_mapping_key
}

resource "aws_route53_record" "socket" {
  zone_id = local.zone_id
  name    = local.socket_host
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.socket.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.socket.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

output "public_url" { value = "https://${local.domain}" }
# What the web image must be built with: the browser is refused by its own
# content policy if it dials anything else.
output "socket_url" { value = trimsuffix("wss://${local.socket_host}/${var.socket_mapping_key}", "/") }
