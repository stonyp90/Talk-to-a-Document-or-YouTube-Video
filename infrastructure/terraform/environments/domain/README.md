# ursly.io domain

An authorized operator runs this Terraform root after deploying the API. Its `domain/terraform.tfstate` state is separate from the application deployment. The GitHub role cannot access this state or change DNS.

It reuses the existing Route 53 zone and ACM certificate without managing them in this state. It creates only the regional API Gateway domain, its API mapping, and the apex A alias for `ursly.io`. Existing subdomains are managed separately. The certificate also covers subdomains, but this root does not configure `www`.

From this directory, with Terraform 1.14.7 and an AWS session for the intended account:

```sh
terraform init -lockfile=readonly \
  -backend-config=bucket=talk-to-a-document-tfstate-436136277668-us-east-1 \
  -backend-config=region=us-east-1
terraform plan -var='api_id=DEPLOYED_API_ID' -out=domain.tfplan
terraform apply domain.tfplan
```

Verify the API ID in API Gateway or the `demo` root's `public_url` output. Review the plan before applying. The certificate must be `ISSUED`, and registrar nameservers must match the Route 53 zone.

After applying, check `https://ursly.io/api/health` and run `node infrastructure/scripts/smoke.mjs https://ursly.io` from the repository root. This does not validate AI providers.
