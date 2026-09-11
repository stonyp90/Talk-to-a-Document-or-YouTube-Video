# ursly.io transactional email

An authorized operator runs this Terraform root. Its `email/terraform.tfstate` state is separate from the application deployment. The GitHub role cannot access this state, verify an identity, or change DNS.

It creates the SESv2 domain identity for `ursly.io` with 2048-bit Easy DKIM, the `mail.ursly.io` MAIL FROM subdomain that rejects a message rather than fall back to an unaligned envelope sender, a configuration set that requires TLS and publishes send, delivery, bounce, complaint, reject and delivery-delay events to CloudWatch, two alarms on the account's reputation, and the Route 53 records SES needs. It adopts the zone's existing DMARC record and rewrites it. It reuses the existing hosted zone without managing it. It does not create inbound mail, SMTP credentials, or any application code that sends.

## What was verified against AWS

Read-only checks on 2026-09-11 with the operator's SSO session, in account 436136277668, region us-east-1:

- SES production access is already granted at the account level: `ProductionAccessEnabled` is `true`, `EnforcementStatus` is `HEALTHY`, the quota is 50,000 messages per 24 hours at 14 per second, and the account review was granted for transactional mail (support case 176945371100211). The account-level suppression list is on for bounces and complaints.
- The region holds identities for `plainledger.ca`, `sstdiamantex.ca` and one Gmail address. There is no `ursly.io` identity, so this root creates it and imports nothing for it.
- Hosted zone `Z02814223MLIQXPXE4SZG` already holds a TXT record at `_dmarc.ursly.io` with the registrar default `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;`. Route 53 refuses a second record set with that name and type, so the root imports it instead of creating it.
- There is no TXT record at the apex and no MX record in the zone: `ursly.io` receives no mail, which is fine for transactional sending, and `mail.ursly.io` does not exist, which is why it is the MAIL FROM subdomain.
- Records this root must never touch: the apex `A` alias (managed by `environments/domain`); the `www`, `api`, `auth`, `grpc` and `vault` CNAMEs, which point at the `ursly-agent-production` load balancer in us-west-2, a separate Ursly system outside this repository; `_domainconnect` (registrar); and two ACM validation CNAMEs. None of them may appear in the plan.

## What the tests prove, and what they cannot

`modules/email` is mock-applied in CI: 2048-bit DKIM, `REJECT_MESSAGE` on MAIL FROM failure, TLS `REQUIRE`, the CloudWatch event destination, the suppression list, the two reputation alarms and the five DNS records the module hands back. This root is syntax-validated in the same job and planned against a mocked provider by `tests/email.tftest.hcl`: the five record sets land in this zone, the DMARC value carries the policy and the reports mailbox, the apex record appears only when it is supplied and is published exactly as written, and each of the three inputs that could weaken the live policy is refused: a DMARC policy below the quarantine the zone already enforces, a reports mailbox on a domain that receives no mail, and an apex SPF record that authorizes more than this domain's own senders, including the uppercase forms and the address ranges that never spell the word `all`.

The two guards on the live record are structural, so `infrastructure/tests/terraform-contract.test.cjs` asserts that the `import` block builds its id from the record's own locals and that the record keeps `prevent_destroy`; deleting either turns that test red. The adoption itself is proven by nothing but the first real plan. Terraform refuses to import through a mock provider, so the test overrides the DMARC record and exercises no import: the import id, the actual contents of the zone, and the plan shape described below are unverified until an operator runs `terraform plan` against the account. The test also feeds the plan three fixture DKIM tokens; in a real plan SES has not issued them yet, so the three CNAMEs appear with their names known only after apply. Nothing in this root has been planned or applied against the real account.

## Before applying

Re-read the zone and the identities; the facts above can drift. The first query lists the whole zone, so the records this root must never touch can be re-confirmed by name, not taken on trust.

```sh
aws route53 list-resource-record-sets --hosted-zone-id Z02814223MLIQXPXE4SZG \
  --query "ResourceRecordSets[].[Name,Type]" --output text
aws route53 list-resource-record-sets --hosted-zone-id Z02814223MLIQXPXE4SZG \
  --query "ResourceRecordSets[?Type=='TXT' || Type=='MX'].[Name,Type,TTL,ResourceRecords[].Value]"
aws sesv2 list-email-identities
aws sesv2 get-account --query '{Production:ProductionAccessEnabled,Enforcement:EnforcementStatus,Quota:SendQuota}'
```

Decide which mailbox receives the DMARC aggregate reports and confirm a person reads it. It cannot be on `ursly.io` or any subdomain of it: the domain has no MX record and receives nothing, so the variable refuses such an address rather than publish a record whose reports are dropped in silence. A mailbox on another domain works only if that domain publishes `ursly.io._report._dmarc.<that-domain>` as a TXT record containing `v=DMARC1`; without it, receivers refuse to send the reports. `dmarc_rua` has no default so the reports stop going to the registrar's collector.

Write that address into `terraform.tfvars` in this directory before the first plan, and keep it there. Every command below reads it from that file, which Terraform loads automatically; a command run without it prompts for the address, fails outright under `-input=false`, and quietly rewrites the record if a different address is typed. The `*.tfvars` rule in `.gitignore` keeps the file out of Git, exactly as it does for `bootstrap/terraform.tfvars`.

```sh
cat > terraform.tfvars <<'EOF'
dmarc_rua = "REPORTS_MAILBOX"
EOF
```

## Apply

From this directory, with Terraform 1.14.7 and an AWS session for the intended account:

```sh
terraform init -lockfile=readonly \
  -backend-config=bucket=talk-to-a-document-tfstate-436136277668-us-east-1 \
  -backend-config=region=us-east-1
terraform plan -out=email.tfplan
terraform apply email.tfplan
terraform output
```

Review the plan before applying. It must show the identity, its MAIL FROM attributes, the configuration set, its event destination and the two reputation alarms created; five records created (three DKIM CNAMEs, the `mail.ursly.io` MX and TXT); and `_dmarc.ursly.io` imported and then updated in place, with only its value and TTL changing. Nothing else at `ursly.io` may be created or changed — the apex TXT record appears only once apex SPF is turned on, and every name from the zone listing above must be absent from the plan. The `import` block in `main.tf` builds the id `Z02814223MLIQXPXE4SZG__dmarc.ursly.io_TXT` from the same locals the record uses; `terraform import aws_route53_record.dmarc` accepts that id if you prefer the command. Terraform ignores the block once the record is in state, so it may stay or be removed after the first apply. Anything else in the plan, and any destroy, means the zone changed: stop and read it again.

If the plan fails with `Cannot import non-existent remote object` for the DMARC record, the registrar's record has been deleted since 2026-09-11. Delete the `import` block and plan again, expecting `_dmarc.ursly.io` to be created rather than imported; the zone listing above confirms which case you are in before you start.

DMARC defaults to `p=quarantine` because that is what the domain already enforces. `p=none` is refused outright, not merely defaulted away from: it is a valid DMARC policy and a downgrade here, and one stale line in `terraform.tfvars` would leave a live domain with no enforcement through a plan that reads exactly like the intended adoption, a single in-place record value. Alignment stays relaxed (`adkim=r; aspf=r`) and is written out so the record states the whole policy: the MAIL FROM subdomain can never satisfy strict SPF alignment against the apex From domain. Move to `reject` once the aggregate reports show only aligned SES traffic, by adding the line to `terraform.tfvars` so it survives the next command:

```sh
printf 'dmarc_policy = "reject"\n' >> terraform.tfvars
terraform plan -out=email.tfplan
terraform apply email.tfplan
```

Registrar nameservers must match the Route 53 zone or none of these records resolve and nothing verifies.

## Verify afterwards

```sh
for name in $(terraform output -json dkim_record_names | jq -r '.[]'); do
  dig +short CNAME "$name"
done
dig +short MX mail.ursly.io
dig +short TXT mail.ursly.io
dig +short TXT _dmarc.ursly.io
aws sesv2 get-email-identity --email-identity ursly.io
```

Each of the three `dig` results must print a `dkim.amazonses.com` target; an empty line means that CNAME has not propagated. `DkimAttributes.Status` and `MailFromAttributes.MailFromDomainStatus` must both read `SUCCESS`, and `VerifiedForSendingStatus` must be `true`. DNS propagation is usually minutes; SES keeps checking for up to 72 hours, after which the status turns `FAILED` and verification has to be restarted.

This configuration fails closed on purpose. While the MAIL FROM MX record does not resolve, SES rejects the send with `MailFromDomainNotVerified` instead of quietly falling back to an `amazonses.com` envelope sender that would break SPF alignment. Do not wire the application to send until the statuses above are green.

## Reputation alarms

SES judges bounce and complaint rates per account and region, not per identity, and this region already sends for `plainledger.ca` and `sstdiamantex.ca`. AWS reviews an account at a 5% bounce or 0.1% complaint rate and can pause sending at 10% and 0.5% — for every identity at once, so a bad `ursly.io` send would stop two unrelated domains. The module therefore alarms on the account-level `AWS/SES` series `Reputation.BounceRate` at `0.05` and `Reputation.ComplaintRate` at `0.001`, averaged over one hour, with missing data treated as not breaching, so the operator hears at the review threshold rather than at the pause.

`alarm_topic_arns` is empty by default: no SNS topic exists in this repository, so the alarms are visible in CloudWatch and page nobody. Name an existing operator-owned topic in `terraform.tfvars` to be notified, for example `alarm_topic_arns = ["arn:aws:sns:us-east-1:436136277668:TOPIC"]`. The variable takes exact topic ARNs in the sending region.

## Production access

Already granted. Production access is an account-and-region setting, not an identity setting: the account was reviewed for transactional mail and may send 50,000 messages per 24 hours at 14 per second to any recipient from us-east-1. What remains is per identity: `ursly.io` stays unverified until its DKIM records publish, and SES refuses to send from an unverified identity. A different account or region would start in the sandbox, limited to verified recipients, 200 messages per day and one per second, and only a production access request that a human files with AWS Support can leave it; nothing in Terraform does that.

## Apex SPF

Nothing exists at the apex today, so `apex_spf_record` cannot collide with another provider. It stays empty by default because SES does not need it: SES puts `mail.ursly.io` on the envelope, and this root publishes that subdomain's own SPF record. An apex record only states who may use `ursly.io` itself as an envelope sender.

Because DMARC here uses relaxed SPF alignment, an SPF pass for any `ursly.io` envelope satisfies DMARC for any `ursly.io` From address. A permissive value is therefore a spoofing hole that leaves `p=quarantine` reading as enforced while every sender on the internet passes. The variable answers with an allowlist rather than a list of forbidden spellings, because mechanism names are case-insensitive and the first match wins (RFC 7208 4.6.1 and 4.6.2): `+ALL` in front of a trailing `-all` passes everyone before the `-all` is ever reached, and so do `ip4:0.0.0.0/0`, `ip6:::/0`, `ptr`, `exists:` with a macro and `a:` or `mx:` naming a host somebody else runs, none of which spell the word `all`. What a value may contain is the bare `a` and `mx` mechanisms, `ip4:` and `ip6:` ranges no wider than /8 and /32, `include:` delegations, and one closing `-all` or `~all`; `redirect=`, `exp=` and qualifiers other than `+` are refused as well, as is anything after the closing `all`. A refused value fails the plan rather than warn, and `tests/email.tftest.hcl` runs each bypass named above against the variable: the two uppercase forms, both address ranges, `ptr`, the macro `exists:` and a foreign `a:`.

A second SPF record at one name breaks SPF outright, so include every system that sends with an `ursly.io` envelope in the single value. Whether the `ursly-agent-production` system in us-west-2 does is not known; find out before choosing `-all`. If no other system does:

```sh
printf 'apex_spf_record = "v=spf1 include:amazonses.com -all"\n' >> terraform.tfvars
terraform plan -out=email.tfplan
terraform apply email.tfplan
```

## Then allow the application to send

Sending permission lives in two operator-owned places, in this order.

First re-apply `bootstrap`, whose state is in S3 under `bootstrap/terraform.tfstate`. Copy `backend.tf.example` to `backend_override.tf` if this checkout does not have it — it is ignored by Git — then initialize against the same bucket:

```sh
cp -n ../../bootstrap/backend.tf.example ../../bootstrap/backend_override.tf
terraform -chdir=../../bootstrap init -lockfile=readonly \
  -backend-config=bucket=talk-to-a-document-tfstate-436136277668-us-east-1 \
  -backend-config=region=us-east-1
```

Add all three values to `bootstrap/terraform.tfvars`, beside the region, account, repository and secret ARN it already holds, taking them from `terraform output` in this directory:

```sh
terraform output   # identity_arn and configuration_set_name
cat >> ../../bootstrap/terraform.tfvars <<'EOF'
ses_identity_arn           = "IDENTITY_ARN_OUTPUT"
ses_configuration_set_name = "CONFIGURATION_SET_NAME_OUTPUT"
ses_from_address           = "no-reply@ursly.io"
EOF
terraform -chdir=../../bootstrap plan -out=bootstrap.tfplan
terraform -chdir=../../bootstrap apply bootstrap.tfplan
```

The expected plan is exactly one change: an in-place update to `aws_iam_policy.runtime_boundary`, adding a single `ses:SendEmail` statement scoped to that identity, that configuration set and that one From address. Anything else, and something outside this handoff has changed: stop and read it. The From address is pinned here, in the operator-owned boundary, and not only in the api role policy, because the GitHub deploy role can rewrite that role policy through `iam:PutRolePolicy`; a boundary it cannot touch is what makes the single sender a real cap. Changing the sender later therefore takes another operator bootstrap apply, on purpose.

What the boundary does not cap is volume or content. The deploy role ships the code the api function runs, so from the moment the identity exists, whoever holds that role can cause mail to go out as exactly that pinned address, up to the account's shared 50,000 messages per 24 hours, and every bounce or complaint it earns lands on the account-and-region reputation `plainledger.ca` and `sstdiamantex.ca` share. The boundary caps who the mail is from, not how much of it there is; the reputation alarms above are what bounds the rest. The deploy role still cannot verify an identity, change DNS, read this state, or take a runtime role's credentials: `iam:UpdateAssumeRolePolicy` is deliberately absent from its policy, because IAM has no condition key for the contents of a trust policy and that action would let it rewrite a runtime role to trust itself and assume it directly.

Then set three variables in the GitHub `production` environment: `SES_IDENTITY_ARN` (the `identity_arn` output), `SES_CONFIGURATION_SET_NAME` (the `configuration_set_name` output) and `SES_FROM_ADDRESS`, the same mailbox passed to bootstrap. They must match the boundary exactly; a mismatch leaves the role policy asking for a permission the boundary denies, and the send fails.

```sh
gh variable set SES_IDENTITY_ARN --env production --body 'IDENTITY_ARN_OUTPUT'
gh variable set SES_CONFIGURATION_SET_NAME --env production --body 'CONFIGURATION_SET_NAME_OUTPUT'
gh variable set SES_FROM_ADDRESS --env production --body 'no-reply@ursly.io'
```

Nothing deploys on a variable change. The `Deploy AWS` run that follows the next successful CI for a push to `main` reads them and gives the api function a `ses:SendEmail` statement pinned to that identity, that configuration set and that single From address, plus the matching `SES_IDENTITY_ARN`, `SES_CONFIGURATION_SET_NAME` and `SES_FROM_ADDRESS` environment variables. Until all of that is done the deployment runs exactly as it does today, with no email permission at all.

## Rolling back

Unwind in the reverse order, so no step leaves the application holding a permission or the domain holding a weaker policy than it had.

1. Remove the three GitHub `production` variables and let a deployment run. Empty values return the api role to its three original statements and drop the SES environment variables from the function.

   ```sh
   gh variable delete SES_IDENTITY_ARN --env production
   gh variable delete SES_CONFIGURATION_SET_NAME --env production
   gh variable delete SES_FROM_ADDRESS --env production
   ```

2. Delete the three `ses_` lines from `bootstrap/terraform.tfvars` and re-apply bootstrap. The expected plan is again one in-place update to `aws_iam_policy.runtime_boundary`, this time removing the statement. After it, no runtime role in the account can send, whatever policy CI writes.

   ```sh
   terraform -chdir=../../bootstrap plan -out=bootstrap.tfplan
   terraform -chdir=../../bootstrap apply bootstrap.tfplan
   ```

3. Only then unwind this root, and release `_dmarc.ursly.io` before you do. This state owns a record that predates it: a destroy would delete the domain's only DMARC record and leave `ursly.io` with no policy at all, weaker than the `p=quarantine` it had before this root existed. `prevent_destroy` refuses that destroy rather than let it happen quietly, so the record is forgotten instead of deleted.

   Reset its value first. Whatever this root wrote last is what the record keeps, and this apply is the last time Terraform can touch it; after the `removed` block below, the only way to change that record is by hand in the Route 53 console. If the domain was moved to `reject`, leaving it there while step 4 deletes the DKIM CNAMEs, the `mail.ursly.io` records and the apex SPF record leaves `ursly.io` stricter than it has ever been with no aligned authentication behind it at all — and the `ursly-agent-production` system behind `www`, `api`, `auth`, `grpc` and `vault`, whose sending is not known, would have unauthenticated `ursly.io` mail rejected where the pre-existing policy only quarantined it. Put back the policy the zone had, and hand reporting back to the registrar's collector:

   ```sh
   cat > terraform.tfvars <<'EOF'
   dmarc_rua    = "dmarc_rua@onsecureserver.net"
   dmarc_policy = "quarantine"
   EOF
   terraform plan -out=email.tfplan   # one in-place change, the DMARC record value
   terraform apply email.tfplan
   ```

   That republishes `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net`, the registrar value read on 2026-09-11; the trailing semicolon it carried is optional and this root does not write one.

   Then forget the record. The edit touches three files, and the commit that carries it has to be green before it is pushed: `deploy.yml` runs only after a successful CI for a push to `main`, which is the mechanism step 1 depends on, so a red CI blocks the rollback it is part of.
   - `infrastructure/terraform/environments/email/main.tf`: delete `resource "aws_route53_record" "dmarc"` and the `import` block above it, and add the `removed` block below. Keep the `dmarc_policy` and `dmarc_rua` variables; they publish nothing once the record is gone, and the contract test still reads them.
   - `infrastructure/terraform/environments/email/tests/email.tftest.hcl`: delete the `override_resource` block and the two assertions naming `aws_route53_record.dmarc`, one in the first run and one in the apex-SPF run.
   - `infrastructure/tests/terraform-contract.test.cjs`: in "transactional email is operator-owned and adds no CI authority", delete the three DMARC checks — the `v=DMARC1` record value, the `dmarcImport` block and the `prevent_destroy` assertion.

   ```hcl
   removed {
     from = aws_route53_record.dmarc
     lifecycle { destroy = false }
   }
   ```

   Run both suites from the repository root before pushing; `terraform validate` alone passes this edit and proves nothing:

   ```sh
   terraform -chdir=infrastructure/terraform/environments/email test
   node --test infrastructure/tests/*.test.cjs
   ```

   ```sh
   terraform plan -out=email.tfplan   # forgets one record, changes nothing in Route 53
   terraform apply email.tfplan
   dig +short TXT _dmarc.ursly.io     # the record must still answer, at p=quarantine
   ```

   `terraform state rm aws_route53_record.dmarc` is not a shortcut for this edit. The resource stays in the configuration, so the next plan tries to create `_dmarc.ursly.io` again and, with `allow_overwrite` at its `false` default, that apply fails against the live record.

4. Destroy the rest. This deletes the identity, the configuration set, its alarms, the three DKIM CNAMEs and the `mail.ursly.io` records, and the apex TXT record if one was published — which returns the apex TXT to the empty state verified on 2026-09-11. The zone is not otherwise restored: `_dmarc.ursly.io` keeps whatever step 3 left there, now outside Terraform, and a policy with no aligned authentication behind it is exactly what step 3 reset the record to survive. Sending stops immediately.

   ```sh
   terraform plan -destroy -out=email.tfplan
   terraform apply email.tfplan
   ```

   Review that plan as carefully as the first one: it must name only this root's own resources, and the `_dmarc` record must no longer be among them.

## What this root does not do

No application code sends mail yet: this is infrastructure and the permission it would need. Publishing SPF, DKIM and DMARC does not buy deliverability either; bounce and complaint rates decide it, which is why the configuration set forwards those events to CloudWatch, alarms on the account's rates and suppresses addresses that hard-bounce or complain, on top of the account-level suppression list.
