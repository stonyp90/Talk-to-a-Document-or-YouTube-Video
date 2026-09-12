# The module's contract is tested next to the module. What only exists here is
# the DNS this root publishes, the adoption of the zone's own DMARC record and
# the operator inputs that could weaken a live policy, so these runs plan this
# root with a mocked provider. The identity ARN and the three DKIM tokens come
# from the mock; the DMARC record is overridden because Terraform refuses to
# import through a mock provider and points at exactly this block instead.
# No AWS resources or credentials are used, and no import is exercised.
# The mocked values have to land during plan: the DKIM record names contain
# tokens SES only issues on apply, and a plan run cannot assert an unknown.
mock_provider "aws" {
  override_during = plan
  mock_resource "aws_sesv2_email_identity" {
    defaults = {
      arn                     = "arn:aws:ses:us-east-1:436136277668:identity/ursly.io"
      dkim_signing_attributes = { tokens = ["aaaaaaa", "bbbbbbb", "ccccccc"] }
    }
  }
  mock_resource "aws_sesv2_configuration_set" {
    defaults = { arn = "arn:aws:ses:us-east-1:436136277668:configuration-set/talk-to-a-document-transactional" }
  }
}
override_resource {
  target = aws_route53_record.dmarc
}
variables {
  dmarc_rua = "dmarc-reports@example.test"
}
run "publishes_the_ses_records_and_rewrites_dmarc_in_the_operator_zone" {
  command = plan
  assert {
    condition     = length(aws_route53_record.ses) == 5 && alltrue([for record in aws_route53_record.ses : record.zone_id == "Z02814223MLIQXPXE4SZG"])
    error_message = "Publish the three DKIM CNAMEs plus the MAIL FROM MX and SPF records, all in the existing ursly.io zone."
  }
  assert {
    condition     = length([for record in aws_route53_record.ses : record if record.type == "CNAME" && endswith(record.name, "._domainkey.ursly.io") && record.records == toset(["${trimsuffix(record.name, "._domainkey.ursly.io")}.dkim.amazonses.com"])]) == 3
    error_message = "Each DKIM CNAME must point the token SES issued at that token's amazonses.com target."
  }
  assert {
    condition     = aws_route53_record.ses["mail_from_mx"].records == toset(["10 feedback-smtp.us-east-1.amazonses.com"]) && aws_route53_record.ses["mail_from_mx"].name == "mail.ursly.io"
    error_message = "The MAIL FROM subdomain needs the SES feedback MX in the sending region."
  }
  assert {
    condition     = aws_route53_record.ses["mail_from_spf"].records == toset(["v=spf1 include:amazonses.com -all"]) && aws_route53_record.ses["mail_from_spf"].type == "TXT"
    error_message = "Only SES ever uses the MAIL FROM subdomain as an envelope sender, so its SPF record must hard-fail everything else."
  }
  assert {
    condition     = aws_route53_record.dmarc.name == "_dmarc.ursly.io" && aws_route53_record.dmarc.records == toset(["v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc-reports@example.test"])
    error_message = "The adopted record must keep the domain at quarantine with relaxed alignment and send reports to the supplied mailbox."
  }
  assert {
    condition     = length(aws_route53_record.apex_spf) == 0
    error_message = "The apex carries no SPF record unless the operator supplies one."
  }
}
run "apex_spf_is_published_only_when_the_operator_supplies_it" {
  command = plan
  variables {
    apex_spf_record = "v=spf1 include:amazonses.com -all"
    dmarc_policy    = "reject"
  }
  assert {
    condition     = length(aws_route53_record.apex_spf) == 1 && aws_route53_record.apex_spf[0].name == "ursly.io" && aws_route53_record.apex_spf[0].records == toset(["v=spf1 include:amazonses.com -all"])
    error_message = "A supplied apex SPF record belongs at the apex, exactly as written, as the zone's single TXT value there."
  }
  assert {
    condition     = aws_route53_record.dmarc.records == toset(["v=DMARC1; p=reject; adkim=r; aspf=r; rua=mailto:dmarc-reports@example.test"])
    error_message = "Moving to reject must change only the policy tag of the adopted record."
  }
}
# DMARC here uses relaxed SPF alignment, so an apex SPF pass for any ursly.io
# envelope satisfies DMARC for any ursly.io From. A permissive qualifier would
# hand that pass to the whole internet while p=quarantine still reads as enforced.
run "reject_apex_spf_that_lets_anyone_pass" {
  command = plan
  variables { apex_spf_record = "v=spf1 +all" }
  expect_failures = [var.apex_spf_record]
}
run "reject_apex_spf_with_a_bare_all" {
  command = plan
  variables { apex_spf_record = "v=spf1 include:amazonses.com all" }
  expect_failures = [var.apex_spf_record]
}
run "reject_apex_spf_that_redirects_out_of_sight" {
  command = plan
  variables { apex_spf_record = "v=spf1 redirect=_spf.elsewhere.test" }
  expect_failures = [var.apex_spf_record]
}
run "reject_apex_spf_without_a_qualifier" {
  command = plan
  variables { apex_spf_record = "v=spf1 include:amazonses.com" }
  expect_failures = [var.apex_spf_record]
}
# SPF mechanism names are case-insensitive and evaluation is first-match-wins
# (RFC 7208 4.6.1 and 4.6.2), so an uppercase ALL earlier in the record answers
# every sender with a pass and the trailing -all is never reached.
run "reject_apex_spf_that_lets_anyone_pass_in_capitals" {
  command = plan
  variables { apex_spf_record = "v=spf1 +ALL -all" }
  expect_failures = [var.apex_spf_record]
}
run "reject_apex_spf_with_a_bare_all_in_capitals" {
  command = plan
  variables { apex_spf_record = "v=spf1 ALL -all" }
  expect_failures = [var.apex_spf_record]
}
# These authorize the whole internet without using the word all, so ending the
# record in -all proves nothing: the permissive mechanism matches first.
run "reject_apex_spf_that_authorizes_every_ipv4_address" {
  command = plan
  variables { apex_spf_record = "v=spf1 ip4:0.0.0.0/0 -all" }
  expect_failures = [var.apex_spf_record]
}
run "reject_apex_spf_that_authorizes_every_ipv6_address" {
  command = plan
  variables { apex_spf_record = "v=spf1 ip6:::/0 -all" }
  expect_failures = [var.apex_spf_record]
}
# ptr passes anyone whose reverse DNS ends in this domain, exists: with a macro
# hands the answer to the sender's own address, and a: names a host somebody
# else controls: each is a pass for a sender this zone cannot see.
run "reject_apex_spf_that_passes_on_reverse_dns" {
  command = plan
  variables { apex_spf_record = "v=spf1 ptr -all" }
  expect_failures = [var.apex_spf_record]
}
run "reject_apex_spf_that_delegates_through_a_macro" {
  command = plan
  variables { apex_spf_record = "v=spf1 exists:%%{i}.wild.attacker.test -all" }
  expect_failures = [var.apex_spf_record]
}
run "reject_apex_spf_that_authorizes_a_foreign_host" {
  command = plan
  variables { apex_spf_record = "v=spf1 a:attacker.test -all" }
  expect_failures = [var.apex_spf_record]
}
# The guard has to keep admitting what a real sender needs: the domain's own A
# and MX hosts, its own address ranges, other senders by include, and a soft fail.
run "apex_spf_accepts_the_mechanisms_a_real_sender_needs" {
  command = plan
  variables { apex_spf_record = "v=spf1 a mx ip4:203.0.113.0/24 ip6:2001:db8::/32 include:amazonses.com include:_spf.google.com ~all" }
  assert {
    condition     = aws_route53_record.apex_spf[0].records == toset(["v=spf1 a mx ip4:203.0.113.0/24 ip6:2001:db8::/32 include:amazonses.com include:_spf.google.com ~all"])
    error_message = "A record built only from the domain's own hosts, its own address ranges and include: terms must publish exactly as written."
  }
}
# ursly.io publishes no MX, so a mailbox there receives nothing: the record would
# publish and every aggregate report would be dropped without a trace.
run "reject_report_mailbox_on_the_sending_domain" {
  command = plan
  variables { dmarc_rua = "dmarc@ursly.io" }
  expect_failures = [var.dmarc_rua]
}
run "reject_report_mailbox_on_the_mail_from_subdomain" {
  command = plan
  variables { dmarc_rua = "dmarc@mail.ursly.io" }
  expect_failures = [var.dmarc_rua]
}
run "reject_report_recipient_that_is_not_an_address" {
  command = plan
  variables { dmarc_rua = "mailto:dmarc-reports@example.test" }
  expect_failures = [var.dmarc_rua]
}
run "reject_unknown_dmarc_policy" {
  command = plan
  variables { dmarc_policy = "monitor" }
  expect_failures = [var.dmarc_policy]
}
# p=none is a valid DMARC policy and still a downgrade here: the zone already
# enforces quarantine, and the plan for this one-word change reads exactly like
# the intended adoption, a single in-place record value.
run "reject_dmarc_policy_that_weakens_the_live_zone" {
  command = plan
  variables { dmarc_policy = "none" }
  expect_failures = [var.dmarc_policy]
}
