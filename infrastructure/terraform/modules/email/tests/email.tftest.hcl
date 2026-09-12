mock_provider "aws" {
  override_during = apply
  mock_resource "aws_sesv2_email_identity" {
    defaults = {
      arn                     = "arn:aws:ses:us-east-1:123456789012:identity/example.test"
      dkim_signing_attributes = { tokens = ["aaaaaaa", "bbbbbbb", "ccccccc"] }
    }
  }
  mock_resource "aws_sesv2_configuration_set" {
    defaults = { arn = "arn:aws:ses:us-east-1:123456789012:configuration-set/fixture" }
  }
}
variables {
  region = "us-east-1"
  domain = "example.test"
}
run "email_authentication_and_observability_contract" {
  # In-memory mock apply resolves the DKIM tokens the DNS output is built from.
  # The only provider here is mocked: no AWS resources or credentials are used.
  command = apply
  assert {
    condition     = aws_sesv2_email_identity.domain.dkim_signing_attributes[0].next_signing_key_length == "RSA_2048_BIT"
    error_message = "Easy DKIM must sign with 2048-bit keys, not the SES 1024-bit default."
  }
  assert {
    condition     = aws_sesv2_email_identity_mail_from_attributes.domain.behavior_on_mx_failure == "REJECT_MESSAGE" && aws_sesv2_email_identity_mail_from_attributes.domain.mail_from_domain == "mail.example.test"
    error_message = "A missing MAIL FROM MX must reject the send, never fall back to an unaligned amazonses.com envelope."
  }
  assert {
    condition     = aws_sesv2_configuration_set.transactional.delivery_options[0].tls_policy == "REQUIRE"
    error_message = "Transactional mail must not be delivered over an unencrypted connection."
  }
  assert {
    condition     = aws_sesv2_configuration_set.transactional.reputation_options[0].reputation_metrics_enabled && aws_sesv2_configuration_set.transactional.sending_options[0].sending_enabled
    error_message = "Reputation metrics and sending must both be on for a production identity."
  }
  assert {
    condition     = aws_sesv2_email_identity.domain.configuration_set_name == aws_sesv2_configuration_set.transactional.configuration_set_name
    error_message = "The configuration set belongs on the identity so a caller cannot omit it."
  }
  assert {
    condition     = alltrue([for event in ["BOUNCE", "COMPLAINT", "REJECT", "DELIVERY_DELAY"] : contains(aws_sesv2_configuration_set_event_destination.cloudwatch.event_destination[0].matching_event_types, event)]) && aws_sesv2_configuration_set_event_destination.cloudwatch.event_destination[0].enabled
    error_message = "Bounces, complaints, rejects and delivery delays must reach CloudWatch."
  }
  assert {
    condition     = length(output.dns_records) == 5 && output.dns_records["dkim_1"].records == ["aaaaaaa.dkim.amazonses.com"] && output.dns_records["mail_from_mx"].records == ["10 feedback-smtp.us-east-1.amazonses.com"]
    error_message = "Publish three DKIM CNAMEs plus the MAIL FROM MX and SPF records."
  }
  assert {
    condition     = length(aws_sesv2_configuration_set.transactional.suppression_options) == 1 && contains(aws_sesv2_configuration_set.transactional.suppression_options[0].suppressed_reasons, "BOUNCE") && contains(aws_sesv2_configuration_set.transactional.suppression_options[0].suppressed_reasons, "COMPLAINT")
    error_message = "Addresses that hard-bounce or complain must be suppressed for later sends, on top of the account-level list."
  }
  assert {
    condition     = aws_cloudwatch_metric_alarm.reputation["bounce"].threshold == 0.05 && aws_cloudwatch_metric_alarm.reputation["complaint"].threshold == 0.001 && alltrue([for alarm in aws_cloudwatch_metric_alarm.reputation : alarm.namespace == "AWS/SES" && alarm.period == 3600 && alarm.treat_missing_data == "notBreaching" && length(coalesce(alarm.dimensions, {})) == 0])
    error_message = "Alarm on the account-level bounce and complaint rates at the AWS review thresholds; enforcement is account-wide, so the series with no dimension is the one that matters."
  }
  assert {
    condition     = alltrue([for alarm in aws_cloudwatch_metric_alarm.reputation : length(alarm.alarm_actions) == 0])
    error_message = "Without an operator-owned topic the alarms are console-only and must not invent a notification target."
  }
  assert {
    condition     = length(regexall("aws_route53_record|aws_iam_", join("\n", [for file in fileset(path.module, "*.tf") : file(file)]))) == 0
    error_message = "DNS and IAM authority stay with the operator-owned roots, never in this module."
  }
}
run "alarms_notify_the_operator_topic" {
  command = plan
  variables { alarm_topic_arns = ["arn:aws:sns:us-east-1:123456789012:ses-reputation"] }
  assert {
    condition     = alltrue([for alarm in aws_cloudwatch_metric_alarm.reputation : alarm.alarm_actions == toset(["arn:aws:sns:us-east-1:123456789012:ses-reputation"]) && alarm.ok_actions == toset(["arn:aws:sns:us-east-1:123456789012:ses-reputation"])])
    error_message = "Both alarms must page the supplied topic when they breach and when they recover."
  }
}
run "reject_alarm_topic_outside_the_region" {
  command = plan
  variables { alarm_topic_arns = ["arn:aws:sns:eu-west-1:123456789012:ses-reputation"] }
  expect_failures = [var.alarm_topic_arns]
}
run "reject_multi_label_mail_from_subdomain" {
  command = plan
  variables { mail_from_subdomain = "mail.bounces" }
  expect_failures = [var.mail_from_subdomain]
}
run "reject_sending_domain_url" {
  command = plan
  variables { domain = "https://example.test" }
  expect_failures = [var.domain]
}
