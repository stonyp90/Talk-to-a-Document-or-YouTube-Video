# Activer les services d’Ursly

Le code et les comptes fournisseurs sont deux étapes distinctes. Un déploiement réussi ne valide ni le quota OpenAI ni les conversations réelles.

## OpenAI

1. Créer un compte ou se connecter à [OpenAI Platform](https://platform.openai.com/).
2. Configurer la [facturation API](https://platform.openai.com/settings/organization/billing/overview). L’abonnement ChatGPT ne remplace pas la facturation API.
3. Créer une [clé API de projet](https://platform.openai.com/api-keys). Vérifier les limites et l’accès aux modèles utilisés : `gpt-4.1-mini` et `gpt-realtime`.
4. En local, renseigner `OPENAI_API_KEY` dans `.env.local`, puis passer `PROVIDER_MODE=live` et relancer `docker compose --env-file .env.local up -d --build web`.
5. Sur AWS, enregistrer la clé dans le secret **`ursly/openai`**, région **us-east-1**, compte **436136277668**. Une clé dédiée restreinte à Responses et Realtime y a été configurée et testée le 8 septembre 2026. Utiliser une chaîne brute ou un objet JSON contenant `OPENAI_API_KEY`. Le backend lit ce secret; ne mettre aucune clé dans les variables `EXPO_PUBLIC_*` ou `NEXT_PUBLIC_*`.
6. Lancer `npm run demo:check -- http://localhost:3100` (adapter le port), puis effectuer une conversation vocale réelle. Le contrôle vérifie PDF, réponse texte et émission d’un jeton; il ne remplace pas le test audio.

Avant d’ajouter une clé à un backend public, ajouter le contrôle d’accès applicatif et les limites d’utilisation nécessaires : les routes actuelles de démonstration sont publiques. La limitation de débit AWS ne constitue pas une authentification.

Ne copier les clés ni dans Git, ni dans une issue, ni dans la conversation. Sources : [gestion des clés](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key), [facturation API distincte de ChatGPT](https://help.openai.com/en/articles/9039756-billing-settings-in-chatgpt-vs-platform).

## YouTube

L’intégration actuelle utilise un service de récupération de sous-titres publics. Elle ne consomme **pas** de clé Google ni de jeton OAuth Google. Une inscription Google ne suffit donc pas à résoudre un blocage réseau de ce service.

Pour préparer une intégration officielle à vos propres vidéos :

1. Se connecter à [Google Cloud Console](https://console.cloud.google.com/) et créer ou sélectionner un projet.
2. Activer [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com).
3. Configurer Google Auth Platform et un client OAuth pour l’application. Cette intégration OAuth et son écran de connexion restent à implémenter dans Ursly; aucune URL de redirection n’est actuellement disponible.
4. Autoriser un compte ayant le droit de modifier les vidéos concernées. L’API officielle de téléchargement des sous-titres exige ce droit : une clé API seule ne donne pas accès aux sous-titres de toutes les vidéos publiques.

Pour des vidéos publiques tierces, il faut valider le service de transcription compatible avec `TRANSCRIPT_SERVICE_URL` depuis l’hébergement AWS. Ne pas annoncer ce parcours opérationnel avant un essai réel. Le mode `TRANSCRIPT_MODE=mock` reste uniquement un scénario de développement déterministe.

Sources : [démarrage YouTube Data API](https://developers.google.com/youtube/v3/getting-started), [permissions de téléchargement des sous-titres](https://developers.google.com/youtube/v3/docs/captions/download).

## Vérifications avant une démo réelle

- Déploiement et contrôles HTTP/PDF réussis.
- Clé OpenAI configurée, modèles accessibles, quota suffisant et contrôle d’accès en place.
- Réponse texte et conversation audio réelles, y compris reconnexion et refus du micro.
- URL YouTube réellement traitée depuis AWS, ou limitation explicitement annoncée.
- APK construit avec l’URL HTTPS déployée et testé sur téléphone; build iOS signé pour appareil. La release `v0.1.0-demo.1` utilise encore le backend local.
