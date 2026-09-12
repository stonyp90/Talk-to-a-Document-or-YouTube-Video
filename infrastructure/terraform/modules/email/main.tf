locals {
  mail_from_domain = "${var.mail_from_subdomain}.${var.domain}"
  dkim_tokens      = aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens
  # Easy DKIM always publishes exactly three selectors. Their token values are
  # only known after apply, so index a fixed range: the map keys stay planned
  # and a consuming root can still create the records with for_each.
  dkim_records = {
    for index in range(3) : "dkim_${index + 1}" => {
      name    = "${local.dkim_tokens[index]}._domainkey.${var.domain}"
      type    = "CNAME"
      ttl     = var.record_ttl
      records = ["${local.dkim_tokens[index]}.dkim.amazonses.com"]
    }
  }
  mail_from_records = {
    mail_from_mx = {
      name    = local.mail_from_domain
      type    = "MX"
      ttl     = var.record_ttl
      records = ["10 feedback-smtp.${var.region}.amazonses.com"]
    }
    # Only SES ever uses this subdomain as an envelope sender, so a hard fail is
    # safe and unambiguous. AWS documents ~all here because they cannot know that.
    mail_from_spf = {
      name    = local.mail_from_domain
      type    = "TXT"
      ttl     = var.record_ttl
      records = ["v=spf1 include:amazonses.com -all"]
    }
  }
}
resource "aws_sesv2_configuration_set" "transactional" {
  configuration_set_name = var.configuration_set_name
  delivery_options {
    # Refuse the delivery instead of silently downgrading to plaintext SMTP.
    tls_policy = "REQUIRE"
  }
  reputation_options { reputation_metrics_enabled = true }
  sending_options { sending_enabled = true }
  # A hard bounce or a complaint suppresses the address for later sends. AWS
  # judges the account on those rates, and re-sending to them is what loses a
  # sending domain its reputation.
  suppression_options { suppressed_reasons = ["BOUNCE", "COMPLAINT"] }
}
resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain
  # Attached to the identity, not only passed per call: a caller that forgets
  # ConfigurationSetName still gets TLS, suppression and event publishing.
  configuration_set_name = aws_sesv2_configuration_set.transactional.configuration_set_name
  dkim_signing_attributes {
    # SES still defaults new Easy DKIM identities to 1024-bit keys.
    next_signing_key_length = "RSA_2048_BIT"
  }
}
resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity   = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain = local.mail_from_domain
  # Falling back to amazonses.com would put an unaligned envelope domain on the
  # message and quietly break SPF alignment for DMARC. Refuse to send instead.
  behavior_on_mx_failure = "REJECT_MESSAGE"
}
# Without a destination, bounces, complaints and rejects exist only inside SES.
resource "aws_sesv2_configuration_set_event_destination" "cloudwatch" {
  configuration_set_name = aws_sesv2_configuration_set.transactional.configuration_set_name
  event_destination_name = "cloudwatch"
  event_destination {
    enabled              = true
    matching_event_types = ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT", "REJECT", "DELIVERY_DELAY", "RENDERING_FAILURE"]
    cloud_watch_destination {
      dimension_configuration {
        dimension_name          = "ses:configuration-set"
        dimension_value_source  = "MESSAGE_TAG"
        default_dimension_value = aws_sesv2_configuration_set.transactional.configuration_set_name
      }
    }
  }
}
# AWS reviews the account at a 5% bounce or 0.1% complaint rate and may pause
# sending at 10% and 0.5%, for every identity in the account and region at once.
# These thresholds are the review ones, so the operator hears first. The series
# with no dimension is the account-level one enforcement is based on; the
# per-configuration-set series would miss the other identities that share it.
resource "aws_cloudwatch_metric_alarm" "reputation" {
  for_each = {
    bounce    = { metric = "Reputation.BounceRate", threshold = 0.05 }
    complaint = { metric = "Reputation.ComplaintRate", threshold = 0.001 }
  }
  alarm_name          = "${var.configuration_set_name}-account-${each.key}-rate"
  alarm_description   = "SES account-level ${each.key} rate in ${var.region} at or above the AWS review threshold; every identity in the account shares the consequence."
  namespace           = "AWS/SES"
  metric_name         = each.value.metric
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 1
  threshold           = each.value.threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_topic_arns
  ok_actions          = var.alarm_topic_arns
}
output "identity_arn" { value = aws_sesv2_email_identity.domain.arn }
output "dkim_tokens" { value = local.dkim_tokens }
output "mail_from_domain" { value = aws_sesv2_email_identity_mail_from_attributes.domain.mail_from_domain }
output "configuration_set_name" { value = aws_sesv2_configuration_set.transactional.configuration_set_name }
output "configuration_set_arn" { value = aws_sesv2_configuration_set.transactional.arn }
# DNS is the domain operator's authority: this module publishes nothing itself
# and hands the exact records to the root that owns the hosted zone.
output "dns_records" { value = merge(local.dkim_records, local.mail_from_records) }
