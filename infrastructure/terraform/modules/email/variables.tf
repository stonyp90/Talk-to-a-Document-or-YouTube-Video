variable "region" { type = string }
variable "domain" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.domain))
    error_message = "Use the bare lowercase sending domain, such as example.com, not a URL or an address."
  }
}

# SES sets the envelope sender to this subdomain so SPF is checked against a
# domain that aligns with the From domain. It must exist only for SES: its MX
# points at the SES feedback endpoint and nothing else should receive there.
variable "mail_from_subdomain" {
  type    = string
  default = "mail"
  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", var.mail_from_subdomain))
    error_message = "Use a single lowercase DNS label; the MAIL FROM domain is a subdomain of the sending domain."
  }
}

variable "configuration_set_name" {
  type    = string
  default = "talk-to-a-document-transactional"
  validation {
    condition     = can(regex("^[A-Za-z0-9_-]{1,64}$", var.configuration_set_name))
    error_message = "Configuration set names accept letters, digits, dashes and underscores only."
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

# SES judges bounce and complaint rates per account and region, not per domain,
# so the alarms watch the account-level series and page whatever topic the
# operator already owns. Empty leaves them visible in the console and silent.
variable "alarm_topic_arns" {
  type    = list(string)
  default = []
  validation {
    condition     = alltrue([for arn in var.alarm_topic_arns : can(regex("^arn:aws:sns:${var.region}:[0-9]{12}:[A-Za-z0-9_-]{1,256}$", arn))])
    error_message = "Name exact SNS topic ARNs in the sending region, without wildcards."
  }
}
