# Déploiement vérifié — 8 septembre 2026

L’application web et son backend sont déployés sur **https://ursly.io** dans AWS `us-east-1`, compte `436136277668`.

- Route 53 : délégation NS AWS vérifiée; alias du domaine vers API Gateway.
- HTTPS : certificat ACM existant, domaine régional et association au stage `$default`.
- Exécution : deux images Lambda, dépôt ECR avec tags immuables, stockage temporaire S3 privé.
- GitHub Actions : accès OIDC limité à ce dépôt et à l’environnement `production`, avec identifiants immuables du dépôt dans la relation de confiance. Aucune clé AWS permanente ajoutée à GitHub.
- États Terraform séparés pour le bootstrap, l’application et le domaine, stockés dans S3 avec chiffrement et versionnement.

## Preuves observées

La [validation CI](https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video/actions/runs/34227614084) et le [premier déploiement réussi](https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video/actions/runs/34227995926) concernent la révision `da64665a02fe409dd223f2dc4a3b87d33baf53e9`. Les exécutions suivantes peuvent déployer une révision ultérieure; consulter GitHub Actions pour la version courante.

Le contrôle `node infrastructure/scripts/smoke.mjs https://ursly.io` a réussi : santé HTTP, page HTML, formulaire S3 signé, envoi d’un PDF réel, extraction exacte du texte et rejet d’une seconde extraction après consommation du fichier. Les contrôles locaux ont également réussi : 75 tests unitaires et 64 scénarios BDD / 361 étapes.

## Ce qui reste bloqué

**Ce déploiement n’est pas une validation complète de production.**

- Le secret `ursly/openai` existe sans valeur et la clé locale n’a pas encore été renseignée. Les appels OpenAI, le quota, les jetons Realtime et l’audio réel restent à valider. Le champ `mode: live` de `/api/health` indique une configuration, pas l’accès effectif au fournisseur.
- YouTube refuse la récupération depuis AWS : l’essai réel de `UF8uR6Z6KLc` retourne `CLOUD_BLOCKED` / HTTP 403 côté service. L’inscription Google seule ne corrige pas ce blocage.
- Les routes de démonstration restent publiques. Ajouter une authentification et des limites par utilisateur avant d’activer un fournisseur payant pour une utilisation publique.
- L’APK de la release `v0.1.0-demo.1` utilise le backend local. Un nouveau build mobile configuré pour HTTPS et des essais sur téléphones physiques restent nécessaires; un build iOS Simulator n’est pas un IPA pour iPhone.
- Les dépendances mobiles comportent encore les problèmes décrits dans `SECURITY-REVIEW.md`.

Suivre [SERVICE-SETUP.md](SERVICE-SETUP.md) pour l’inscription, la configuration des clés et les limites de l’intégration YouTube.
