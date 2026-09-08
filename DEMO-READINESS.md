# État de préparation de la démo — 8 septembre 2026

**La démo complète avec services réels n’est pas encore prête.** Le parcours local simulé est opérationnel; il ne prouve pas le fonctionnement OpenAI ou YouTube réel.

| Contrôle                                    | Résultat observé                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Serveur local `http://localhost:3100`       | Disponible, mode `mock`                                                                   |
| PDF réel                                    | Upload signé MinIO, extraction exacte et rejet d’une seconde extraction : validés         |
| Web                                         | 18 tests navigateur réussis, dont gestion des erreurs et des réponses tardives            |
| Android local                               | APK actuel installé; réponse écrite et démarrage/mute/arrêt de session simulée validés    |
| iOS Simulator                               | Bundle actuel installé; réponse écrite et démarrage/mute/arrêt de session simulée validés |
| Compte Expo                                 | Session CLI disponible pour `stonyp90`                                                    |
| Clé OpenAI pour Ursly                       | Absente de l’environnement serveur et des fichiers de configuration examinés              |
| Quota et accès aux modèles OpenAI           | Non vérifiés, faute de clé API                                                            |
| Jeton éphémère Realtime réel                | Non émis ni vérifié, faute de clé API                                                     |
| Audio OpenAI réel                           | Non validé                                                                                |
| YouTube réel                                | Deux vidéos testées par le service Python : HTTP 403 `CLOUD_BLOCKED`                      |
| Téléphones physiques et production publique | Non certifiés par ces vérifications locales                                               |

## Fournir l’accès manquant

Placer la clé dans `.env.local` à la racine, déjà exclu de Git, sans la publier dans la conversation. Le fichier a été préparé avec les ports locaux utilisés par les deux simulateurs. Ne pas l’écraser si une clé y a déjà été ajoutée.

```dotenv
OPENAI_API_KEY=<clé-du-projet-OpenAI>
PROVIDER_MODE=live
```

Les identifiants AWS et la connexion Expo ne remplacent pas une clé API OpenAI. Un abonnement ChatGPT ne constitue pas une preuve de crédit disponible pour cette application API. Ne déclarer l’accès prêt qu’après des appels réels réussis et la vérification des limites du projet concerné.

Relancer le backend après configuration :

```bash
docker compose --env-file .env.local up -d --wait web
npm run demo:check -- http://localhost:3100
```

`demo:check` refuse le mode simulé, teste un PDF réel, demande une réponse textuelle ancrée dans la source et vérifie la présence et l’expiration d’un jeton vocal réel. Il n’affiche jamais ce jeton. Les appels en mode réel peuvent être facturés. Un succès ne certifie pas le quota restant ni l’audio de bout en bout.

Terminer ensuite par une conversation entendue et parlée : source PDF, question orale, réponse audible, transcription, interruption, mute, arrêt, reprise après perte réseau et passage anglais/français. Répéter sur les plateformes qui seront montrées pendant la démo.

## Point YouTube séparé

Le service réel a été testé directement sans modifier la configuration de démonstration en cours. Les deux appels ont été bloqués par YouTube depuis ce réseau. `TRANSCRIPT_MODE=live` ne corrige pas ce blocage. Il faut un service de sous-titres compatible et accessible, ou un accès réseau fonctionnel, puis vérifier les vidéos exactes de la démo. Garder le parcours PDF comme solution de repli, en annonçant explicitement la limitation YouTube.

## Conditions de démonstration locale

- Garder Docker démarré et le Mac disponible.
- Android : maintenir `adb reverse` pour les ports 3100 et 9002.
- iOS Simulator : utiliser l’API locale sur le port 3100.
- Ces builds locaux ne sont pas des distributions fonctionnelles pour téléphones autonomes.
- Avant exposition publique, traiter l’authentification, les quotas et les points de [SECURITY-REVIEW.md](SECURITY-REVIEW.md).
