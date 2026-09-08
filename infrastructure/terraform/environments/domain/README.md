# Domaine ursly.io

Ce root Terraform est exécuté par l’opérateur autorisé après le déploiement de l’API. Son état `domain/terraform.tfstate` est séparé du déploiement applicatif; le rôle GitHub n’a pas accès à cet état ni aux modifications DNS.

Il réutilise la zone Route 53 et le certificat ACM existants, sans les prendre en charge dans son état. Il crée uniquement le domaine régional API Gateway, son association à l’API et l’alias A à la racine `ursly.io`. Les sous-domaines existants restent gérés séparément. Le certificat couvre aussi les sous-domaines, mais ce root ne configure pas `www`.

Depuis ce dossier, avec Terraform 1.14.7 et une session AWS du compte prévu :

```sh
terraform init -lockfile=readonly \
  -backend-config=bucket=talk-to-a-document-tfstate-436136277668-us-east-1 \
  -backend-config=region=us-east-1
terraform plan -var='api_id=IDENTIFIANT_API_DEPLOYEE' -out=domain.tfplan
terraform apply domain.tfplan
```

Vérifier l’identifiant dans API Gateway ou dans la sortie `public_url` du root `demo`. Examiner le plan avant application. Le certificat doit être `ISSUED` et les NS du registrar doivent correspondre à la zone Route 53.

Après application, vérifier `https://ursly.io/api/health` et exécuter `node infrastructure/scripts/smoke.mjs https://ursly.io` depuis la racine du dépôt. Cette vérification ne valide pas les fournisseurs IA.
