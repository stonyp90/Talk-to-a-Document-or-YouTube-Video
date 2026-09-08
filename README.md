# Ursly — Talk to a Source

Ursly permet de poser des questions sur un **document PDF ou une vidéo YouTube**, par écrit ou à la voix. L’application extrait le texte de la source, le présente à l’utilisateur et l’utilise comme contexte pour les réponses de l’IA.

Le dépôt contient une **application web**, une **application mobile Android/iOS** et leur **backend commun**. Le nom technique du projet Expo est `talk-to-a-source`.

Pour créer les comptes fournisseurs et activer les services réels, suivre le [guide OpenAI et YouTube](SERVICE-SETUP.md).

La version web est déployée sur **https://ursly.io**. Les tests effectués et les blocages OpenAI/YouTube sont détaillés dans le [rapport de déploiement](DEPLOYMENT.md); le déploiement ne signifie pas que tous les services réels sont activés.

## Télécharger la préversion Android

La [release v0.1.0-demo.1](https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video/releases/tag/v0.1.0-demo.1) contient l’APK ARM64 testé, ses sommes SHA-256 et les instructions d’installation. Elle nécessite le backend Docker local et les transferts de ports ADB. C’est une **préversion de démonstration locale**, avec les limites détaillées dans les notes de release.

## Ce que fait l’application

- Importer un PDF jusqu’à **25 Mo** et consulter son texte extrait.
- Coller une URL YouTube pour récupérer les sous-titres disponibles.
- Poser des questions par écrit à partir de la source sélectionnée.
- Démarrer une conversation vocale avec transcription, contrôle du micro et arrêt de session.
- Continuer par écrit lorsque la voix est indisponible.
- Utiliser le mobile en anglais par défaut, avec une option français.

Deux modes permettent de travailler : **`mock`**, sans clé ni appel OpenAI, et **`live`**, avec les services réels. Le mode simulé permet de développer les parcours; il ne produit pas de véritable conversation audio.

> Le projet est utilisable en développement local. Un build réussi ne signifie pas que la production ou les conversations vocales sur téléphone ont été validées. Les points restant à vérifier sont détaillés dans [l’audit des exigences](REQUIREMENTS-AUDIT.md) et [le rapport de sécurité](SECURITY-REVIEW.md).

## Technologies

| Partie               | Technologies                                                         | Rôle                                                     |
| -------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| Web et API           | Next.js 16, React 19, TypeScript                                     | Interface web et routes serveur dans la même application |
| Mobile               | Expo SDK 54, React Native 0.81                                       | Application native Android et iOS                        |
| Conversation vocale  | OpenAI Realtime, WebRTC, `react-native-webrtc`                       | Audio et événements de transcription en temps réel       |
| Réponses écrites     | API OpenAI                                                           | Réponses utilisant le texte de la source                 |
| Documents            | `pdf-parse`, PDF.js, `@napi-rs/canvas`                               | Extraction du texte des PDF côté serveur                 |
| YouTube              | Python, `youtube-transcript-api`                                     | Service séparé de récupération des sous-titres           |
| Stockage             | MinIO en local, S3 sur AWS                                           | Téléversement direct des PDF par URL/formulaire signé    |
| Environnement local  | Docker Compose, Node.js 22                                           | Services reproductibles et outillage de développement    |
| Infrastructure       | Terraform, Lambda, API Gateway, ECR, S3, Secrets Manager             | Infrastructure AWS décrite dans le dépôt                 |
| Qualité et livraison | Vitest, Playwright, Cucumber, Maestro, Gitleaks, GitHub Actions, EAS | Tests, détection de secrets et builds                    |

### Organisation du dépôt

```text
apps/
  web/                    Interface Next.js et routes API
  mobile/                 Client Expo, avec son propre package-lock.json
packages/
  core/                   Modèles métier, règles et cas d’utilisation
  adapters/               Accès aux services externes et au stockage
services/transcript/      Service Python pour YouTube
infrastructure/terraform/ Infrastructure AWS
scripts/                  Outils de développement, simulateurs et sécurité
features/                 Scénarios d’acceptation Gherkin
tests/                   Tests d’architecture, BDD et navigateur
```

Le cœur métier est séparé des interfaces et des fournisseurs externes. Les clients appellent le backend Next.js; les clés permanentes restent côté serveur. Pour la voix, le backend crée un jeton éphémère que le client utilise pour se connecter directement à OpenAI. Voir [ARCHITECTURE.md](ARCHITECTURE.md).

## Démarrer le développement web

### 1. Prérequis

- **Git** pour récupérer le dépôt.
- **Docker Desktop**, démarré, avec Docker Compose.
- **Node.js 22** et npm pour les commandes et tests locaux.

Aucun compte AWS, compte Expo ou secret OpenAI n’est nécessaire pour le démarrage en mode simulé. Python et MinIO tournent dans Docker.

### 2. Préparer le projet

Depuis la racine du dépôt :

```bash
# À faire une seule fois : ne pas écraser une configuration existante.
cp .env.example .env.local
npm ci
```

Conserver les valeurs par défaut de `.env.local` pour commencer :

```dotenv
PROVIDER_MODE=mock
TRANSCRIPT_MODE=mock
OPENAI_API_KEY=
```

### 3. Lancer les services avec rechargement automatique

```bash
docker compose --env-file .env.local --profile dev up --build dev
```

Ouvrir **[http://localhost:3000](http://localhost:3000)**. Les modifications du code web sont rechargées automatiquement. Cette commande affiche les journaux dans le terminal; `Ctrl+C` arrête le service de développement au premier plan.

| Service                | Adresse locale                                                |
| ---------------------- | ------------------------------------------------------------- |
| Application web et API | [localhost:3000](http://localhost:3000)                       |
| Santé de l’API         | [localhost:3000/api/health](http://localhost:3000/api/health) |
| Service de sous-titres | [localhost:3010/health](http://localhost:3010/health)         |
| API de stockage MinIO  | `http://localhost:9002`                                       |
| Console MinIO          | [localhost:9003](http://localhost:9003)                       |

Les identifiants MinIO de démonstration sont `local-minio` / `local-minio-password`. Ils servent uniquement au stockage local. Les ports Compose sont limités à `127.0.0.1`.

### 4. Essayer un parcours

1. Importer un PDF contenant du texte, ou saisir une URL YouTube en mode simulé.
2. Vérifier le texte extrait affiché par l’application.
3. Poser une question par écrit : le mode `mock` renvoie une réponse déterministe.
4. Démarrer puis arrêter une session vocale simulée pour tester les contrôles.

### Tester le build de production local

Arrêter le service `dev` avant de lancer `web` : ils utilisent le même port.

```bash
docker compose --env-file .env.local stop dev
docker compose --env-file .env.local up --build -d --wait web
```

Ce mode compile l’application et sert son build; les changements nécessitent une reconstruction. Pour revenir au développement :

```bash
docker compose --env-file .env.local stop web
docker compose --env-file .env.local --profile dev up --build dev
```

Pour arrêter l’ensemble des services sans supprimer les données MinIO :

```bash
docker compose --env-file .env.local --profile dev down
```

## Activer les services réels

Modifier **uniquement le fichier local `.env.local`** :

```dotenv
PROVIDER_MODE=live
OPENAI_API_KEY=<votre-cle-locale>
TRANSCRIPT_MODE=live
```

Relancer ensuite la commande Compose du mode choisi pour appliquer l’environnement. `PROVIDER_MODE` active les réponses OpenAI réelles; `TRANSCRIPT_MODE` contrôle indépendamment la récupération réelle des sous-titres YouTube. Les appels OpenAI nécessitent un compte avec accès aux modèles et peuvent être facturés.

Ne jamais placer de secret dans une variable `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*` : ces valeurs sont destinées aux clients. Ne pas ajouter `.env.local` à Git.

Les PDF numérisés sans couche texte nécessiteraient de l’OCR, qui n’est pas implémenté. Le contexte de conversation est actuellement limité à **60 000 caractères**. La récupération YouTube dépend de la disponibilité des sous-titres et peut être bloquée depuis certaines adresses cloud. Le chat écrit transmet la question et la source, sans historique multi-tour au backend.

## Développer l’application Android et iOS

Le mobile utilise le même backend : laisser les services Compose en marche. Son installation npm est **séparée** de celle de la racine.

Prérequis supplémentaires : **Xcode sur macOS et un simulateur iOS**, ou **Android Studio, un SDK Android et un émulateur configuré**.

```bash
cd apps/mobile
npm ci
npm run typecheck
npm test

# Choisir la plateforme :
npm run ios
# ou
npm run android
```

Ces commandes compilent et installent un client natif de développement. **Expo Go ne convient pas**, car il ne contient pas le module WebRTC utilisé ici. Une fois le client installé, démarrer les sessions suivantes avec :

```bash
npm start
```

L’API par défaut est `http://localhost:3000`. Elle est accessible directement depuis le simulateur iOS. Sur Android, ouvrir un autre terminal et transférer les ports de l’API et du stockage vers l’émulateur :

```bash
adb devices
adb -s <identifiant-emulateur> reverse tcp:3000 tcp:3000
adb -s <identifiant-emulateur> reverse tcp:9002 tcp:9002
```

Le second port est nécessaire pour les PDF : le client doit pouvoir atteindre l’adresse MinIO figurant dans le formulaire signé.

Pour une autre API, définir son adresse **avant** de lancer Metro ou de construire l’application :

```bash
EXPO_PUBLIC_API_URL=https://votre-api.example npm start
```

Sur un téléphone physique, `localhost` désigne le téléphone. Utiliser un backend HTTPS accessible ainsi qu’une adresse de stockage accessible; changer seulement l’URL API ne suffit pas pour les téléversements. La configuration Docker par défaut reste réservée au Mac local.

Si le chemin du dépôt contient des espaces et pose problème à Xcode, un constructeur de release pour simulateur est fourni. Depuis la racine :

```bash
bash scripts/mobile/build-ios-isolated.sh
```

Ce script affiche le chemin du `.app` à installer et ne nécessite pas Metro. Les commandes d’installation, les contrôles audio et les détails Android sont dans le [guide mobile](apps/mobile/README.md). Pour les builds cloud et la signature, suivre le [guide EAS](apps/mobile/EAS.md). Un build iOS Simulator ne s’installe pas sur un iPhone.

## Vérifier ses changements

Depuis la racine :

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Pour les parcours navigateur, démarrer le service `web` avec les fournisseurs `mock`, puis :

```bash
npx playwright install chromium
npm run test:e2e
```

Les scénarios Cucumber nécessitent aussi les services locaux. Les prérequis supplémentaires des scénarios d’infrastructure et de sécurité sont expliqués dans le [guide BDD](tests/bdd/README.md). Les scénarios `@external` exigent les fournisseurs ou environnements externes et ne sont pas validés par les mocks.

Les étapes non définies ou en attente font échouer la suite : elles ne constituent pas des tests réussis.

```bash
npm run test:gherkin -- --tags 'not @external'
```

Pour le mobile :

```bash
npm run typecheck --prefix apps/mobile
npm test --prefix apps/mobile
```

Avant publication, installer Gitleaks 8.30.1 et lancer le contrôle de secrets :

```bash
npm run security:secrets
```

Le contrôle examine l’historique Git et les fichiers destinés à la publication. GitHub Actions comprend également ce contrôle. Consulter [SECURITY-REVIEW.md](SECURITY-REVIEW.md) pour les limites de l’audit et les dépendances à corriger.

## Dépannage rapide

| Problème                                           | Vérification                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Port 3000 déjà utilisé                             | Arrêter l’ancien `web` ou `dev`. Ne pas lancer les deux simultanément.                                      |
| Aucun son en mode local                            | `mock` ne produit pas de son. Pour la voix réelle, activer `live`, configurer la clé et autoriser le micro. |
| Mobile incapable de joindre l’API                  | Vérifier `/api/health`, l’adresse `EXPO_PUBLIC_API_URL` et les transferts `adb reverse` sur Android.        |
| PDF Android impossible à envoyer                   | Vérifier aussi le transfert du port 9002. Ne pas modifier une URL déjà signée.                              |
| Les changements de variables ne sont pas appliqués | Relancer Compose; pour une variable publique mobile, redémarrer Metro ou reconstruire le binaire.           |
| Sous-titres YouTube indisponibles                  | Essayer une vidéo avec sous-titres, vérifier `TRANSCRIPT_MODE` et consulter les journaux du service.        |

```bash
docker compose --env-file .env.local ps
docker compose --env-file .env.local logs --tail=100 dev transcript
# En mode build local, remplacer « dev » par « web ».
```

Pour travailler avec une seconde instance, les ports et le nom du projet sont configurables via `COMPOSE_PROJECT_NAME`, `WEB_PORT`, `TRANSCRIPT_PORT`, `OBJECT_STORE_PORT` et `OBJECT_STORE_CONSOLE_PORT`. Adapter également `APP_ORIGIN`, `OBJECT_STORE_PUBLIC_ENDPOINT` et l’URL utilisée par les clients. Pour les tests, voir les variables dans le guide BDD.

## Préparer une démo avec les services réels

Suivre [DEMO-READINESS.md](DEMO-READINESS.md) pour l’accès OpenAI, les contrôles réels et les limites connues. Après configuration du backend en mode `live` :

```bash
npm run demo:check -- http://localhost:3100
```

Cette commande échoue en mode simulé. Elle vérifie PDF, réponse textuelle et émission d’un jeton vocal réel; l’audio, YouTube et les appareils physiques restent à tester séparément.

## Déploiement et documentation complémentaire

L’infrastructure Terraform prévoit une image Next.js dans **ECR**, exécutée par **Lambda** derrière **API Gateway**, une Lambda de sous-titres, du stockage **S3** et **Secrets Manager**. GitHub Actions s’authentifie auprès d’AWS avec **OIDC**, sans clé AWS permanente dans le dépôt.

Lambda est le choix par défaut pour cette démo intermittente : le service ne nécessite pas de tâche ECS allumée en permanence. Le coût dépend aussi du trafic, du stockage et des fournisseurs IA.

Avant une ouverture publique, ajouter l’authentification et les quotas des API et traiter les points du rapport de sécurité. La présence de cette infrastructure dans le dépôt ne prouve pas son déploiement.

- [Architecture et règles de dépendance](ARCHITECTURE.md)
- [Configuration et déploiement Terraform](infrastructure/terraform/README.md)
- [Développement natif](apps/mobile/README.md) et [builds Expo EAS](apps/mobile/EAS.md)
- [Vérification mobile en production](apps/mobile/PRODUCTION-VERIFICATION.md)
- [Couverture des exigences](REQUIREMENTS-AUDIT.md) et [revue de sécurité](SECURITY-REVIEW.md)
- [Scénario de démonstration](WALKTHROUGH.md)

Le projet a été développé avec une assistance IA pour la décomposition des exigences, la conception, l’implémentation, le débogage, les tests et la revue. Les rapports de vérification distinguent les résultats effectivement observés des fonctionnalités restant à valider.
