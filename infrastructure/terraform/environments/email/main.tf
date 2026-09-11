# Operator-owned email state; the application CI role cannot verify an identity
# or change DNS. Its email/terraform.tfstate is separate from every other root.
terraform {
  required_version = ">= 1.14.7, < 2.0.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  backend "s3" {
    key          = "email/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region              = local.region
  allowed_account_ids = [local.account_id]
  default_tags { tags = { Project = "talk-to-a-document", ManagedBy = "Terraform" } }
}

locals {
  region     = "us-east-1"
  account_id = "436136277668"
  domain     = "ursly.io"
  # The same operator-owned zone the domain root publishes the apex alias in.
  zone_id = "Z02814223MLIQXPXE4SZG"
  # Named once: the record below and the import id that adopts it must agree.
  dmarc_name = "_dmarc.${local.domain}"
}

# Required, never defaulted: the registrar's record sends aggregate reports to
# the registrar's own collector, and this root replaces that with a mailbox the
# operator reads. ursly.io has no MX record, so that mailbox is on another
# domain; the README names the authorization record that domain must publish.
variable "dmarc_rua" {
  type = string
  validation {
    condition     = can(regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", var.dmarc_rua))
    error_message = "Supply one mailbox address that will actually read the aggregate reports."
  }
  # Covers subdomains too: mail.ursly.io only has the SES feedback MX, which
  # would swallow the reports just as silently as the apex does.
  validation {
    condition     = !can(regex("@([a-z0-9-]+\\.)*${replace(local.domain, ".", "\\.")}$", lower(var.dmarc_rua)))
    error_message = "ursly.io receives no mail; send DMARC reports to a mailbox on a domain that publishes the ursly.io._report._dmarc authorization record."
  }
}

# The zone already enforces p=quarantine (registrar default, verified on
# 2026-09-11), so this root publishes quarantine or reject and nothing weaker.
# p=none is a valid DMARC policy and a downgrade here: one stale tfvars line
# would leave a live domain with no enforcement at all, through a plan that
# reads exactly like the intended adoption, a single in-place record value.
# Move to reject once the aggregate reports show only aligned SES traffic.
variable "dmarc_policy" {
  type    = string
  default = "quarantine"
  validation {
    condition     = contains(["quarantine", "reject"], var.dmarc_policy)
    error_message = "This zone already enforces p=quarantine, so this root publishes quarantine or reject; monitoring with p=none would weaken a live policy."
  }
}

# Off by default. The apex carries no TXT record today (verified on 2026-09-11),
# so publishing one cannot collide with another provider, and SES does not need
# it: the envelope sender is the MAIL FROM subdomain, which has its own record.
# A second SPF record at one name breaks SPF outright, so include every system
# that sends with an ursly.io envelope in the single value you supply.
# DMARC below uses relaxed SPF alignment, so an SPF pass for any ursly.io
# envelope satisfies DMARC for any ursly.io From: a value that authorizes more
# than this domain's own senders would let the internet pass as ursly.io. That
# makes this the one published value an operator composes by hand, so it is
# matched against an allowlist and a wider record fails the plan rather than
# warn. Mechanism names are case-insensitive and the first match wins (RFC 7208
# 4.6.1 and 4.6.2), so every check below reads the lowercased value: an
# uppercase +ALL in front of a trailing -all passes everyone, and the -all is
# never reached.
variable "apex_spf_record" {
  type    = string
  default = ""
  validation {
    condition     = var.apex_spf_record == "" || startswith(lower(var.apex_spf_record), "v=spf1 ")
    error_message = "Supply one complete SPF record beginning with v=spf1, or leave it empty."
  }
  validation {
    condition = var.apex_spf_record == "" || (
      can(regex(" (-|~)all$", lower(var.apex_spf_record))) &&
      !can(regex("(^|\\s)\\+?all(\\s|$)|\\?all|redirect=", lower(var.apex_spf_record)))
    )
    error_message = "End the record with -all (or ~all) and never +all, a bare all, or a redirect: with relaxed alignment a permissive apex SPF lets anyone pass DMARC as ursly.io."
  }
  # An allowlist, because not every way to authorize the internet contains the
  # word all: ip4:0.0.0.0/0, ip6:::/0, ptr, exists: with a macro, and a:/mx:
  # naming a host somebody else runs each hand a pass to a sender this zone
  # cannot see. Accepted: this domain's own a and mx hosts, its own ranges at
  # /8 (IPv4) or /32 (IPv6) or narrower, include: delegations, and one closing
  # -all or ~all. exp= and qualifiers other than + are refused too: neither is
  # needed here, and each is one more form to read in a one-line tfvars review.
  validation {
    condition     = var.apex_spf_record == "" || can(regex("^v=spf1( \\+?(a|mx|include:[a-z0-9_][a-z0-9._-]*\\.[a-z]{2,}|ip4:[0-9]{1,3}(\\.[0-9]{1,3}){3}(/(8|9|[12][0-9]|3[0-2]))?|ip6:[0-9a-f:]+(/(3[2-9]|[4-9][0-9]|1[01][0-9]|12[0-8]))?))* (-|~)all$", lower(var.apex_spf_record)))
    error_message = "Build the record from include: delegations, ip4:/ip6: ranges no wider than /8 and /32, the bare a and mx mechanisms, and a closing -all or ~all. ptr, exists:, a: or mx: naming another host, and wider ranges pass mail this zone cannot vouch for."
  }
}

variable "record_ttl" {
  type    = number
  default = 1800
  validation {
    condition     = var.record_ttl >= 60 && var.record_ttl <= 86400
    error_message = "Keep the DNS TTL between one minute and one day so verification changes still propagate."
  }
}

# Empty by default because no SNS topic exists in this repository: the two
# reputation alarms then show in the console and page nobody. Name an existing
# operator-owned topic here to be told before AWS reviews the account.
variable "alarm_topic_arns" {
  type    = list(string)
  default = []
}

module "email" {
  source           = "../../modules/email"
  region           = local.region
  domain           = local.domain
  record_ttl       = var.record_ttl
  alarm_topic_arns = var.alarm_topic_arns
}

# The three DKIM CNAMEs plus the MAIL FROM MX and SPF records, exactly as SES
# requires them. Until these resolve, the identity stays unverified and sends fail.
resource "aws_route53_record" "ses" {
  for_each = module.email.dns_records
  zone_id  = local.zone_id
  name     = each.value.name
  type     = each.value.type
  ttl      = each.value.ttl
  records  = each.value.records
}

# Route 53 already holds a registrar-default TXT at _dmarc.ursly.io and refuses
# a second record set with the same name and type, so this root adopts the
# existing record: the first plan shows it imported and updated in place, never
# created. Terraform ignores the block once the record is in state, so it may
# stay or be removed after the first apply. The id is derived from the locals the
# record itself uses, so the zone and the name cannot drift apart.
# The identity = { zone_id, name, type } form documented for Terraform 1.12 and
# later would read better, but nothing available here can check it: Terraform
# matches identity attributes against the provider only during a real plan, and
# terraform validate accepts even an invented attribute (verified on 1.14.7 with
# provider 6.63.0). That would put an unproven form on the single plan that has
# to adopt a live record, so this keeps the documented ZONEID_NAME_TYPE id, which
# terraform import accepts as well.
import {
  to = aws_route53_record.dmarc
  id = "${local.zone_id}_${local.dmarc_name}_TXT"
}

# Alignment stays relaxed and is written out so the record states the whole
# policy: the MAIL FROM subdomain can never satisfy strict SPF alignment against
# the apex From domain, and adkim=r is the DKIM default made explicit.
# The record predates this root and must outlive it: a destroy here would drop
# the domain from quarantine to no policy at all, so it is refused. The README
# says how to release the record from state before unwinding the rest.
resource "aws_route53_record" "dmarc" {
  zone_id = local.zone_id
  name    = local.dmarc_name
  type    = "TXT"
  ttl     = var.record_ttl
  records = ["v=DMARC1; p=${var.dmarc_policy}; adkim=r; aspf=r; rua=mailto:${var.dmarc_rua}"]
  lifecycle { prevent_destroy = true }
}

resource "aws_route53_record" "apex_spf" {
  count   = var.apex_spf_record == "" ? 0 : 1
  zone_id = local.zone_id
  name    = local.domain
  type    = "TXT"
  ttl     = var.record_ttl
  records = [var.apex_spf_record]
}

output "identity_arn" { value = module.email.identity_arn }
output "configuration_set_name" { value = module.email.configuration_set_name }
output "mail_from_domain" { value = module.email.mail_from_domain }
# The three published DKIM names, so verification is a copy-paste, not a hunt.
output "dkim_record_names" { value = [for record in module.email.dns_records : record.name if record.type == "CNAME"] }
