# Audit de conformité au cahier des charges — Ursly

Date : 8 septembre 2026. Référence : **Talk to a Document.pdf**, 5 pages, titre « Full-Stack Developer Take-Home Assessment ».

**Verdict : la conformité complète n’est pas démontrée. Le projet n’est pas encore prêt à être remis comme satisfaisant toutes les exigences du document.**

L’audit porte sur le code local actuel et les preuves accessibles. Le document est utilisé comme référentiel, sans exécuter ses consignes de soumission, de publication ou de communication. Aucune modification fonctionnelle n’a été faite pendant cet audit.

## Périmètre exact

Le livrable obligatoire est une **application web mobile-first publiquement accessible**. Les applications Expo Android/iOS, la marque Ursly, les animations, le domaine AWS et le bilinguisme proviennent des demandes supplémentaires de la conversation. Ils ne remplacent pas les exigences web du PDF.

Le document autorise une démonstration **locale de vrais sous-titres YouTube** si l’hébergement cloud est bloqué. Un texte YouTube simulé ne satisfait pas cette exception. La récupération YouTube dans le cloud est un bonus, pas une condition obligatoire. Le PDF, lui, doit fonctionner sur l’application déployée.

L’authentification utilisateur persistante, une base de données durable, le découpage du texte, la synthèse et la gestion de citations ne sont pas exigés. La stack Next.js/React/TypeScript est recommandée, pas imposée. Ne pas ajouter ces obligations pour déclarer le projet conforme.

## Méthode et niveaux de preuve

- **Validé localement** : code présent et comportement local testé. Ne vaut pas preuve de déploiement.
- **Partiel** : une partie existe, mais une limite ou une preuve obligatoire manque.
- **Non validé** : intégration présente mais fonctionnement réel non démontré.
- **Non livré / non accessible** : livrable demandé non disponible dans les éléments accessibles.
- **Conforme au niveau du code ou de la documentation** : inspection positive ; les limites de vérification sont précisées.

Pas de pourcentage global : une interface terminée ne compense pas l’absence de voix réelle ou d’application publique.

## Matrice des exigences fonctionnelles et techniques

| ID | Exigence du PDF | Pages | État | Preuve et réserve |
| --- | --- | --- | --- | --- |
| F01 | Application web permettant d’ajouter PDF et URL YouTube | 1, 3 | Validé localement | `apps/web/app/page.tsx` propose les deux sources ; parcours navigateur exécutés. Les binaires natifs ne constituent pas le livrable web. |
| F02 | PDF jusqu’à 25 MB | 1 | Partiel | `packages/core/src/domain/ingestion.ts:1` autorise 25 × 1024 × 1024 octets ; validations de taille/type testées. Le parcours de conversation ajoute une limite distincte de 60 000 caractères, voir F08. Le cas maximum déployé reste à vérifier. |
| F03 | Extraction PDF côté serveur | 3 | Validé localement | `packages/adapters/src/ingestion.ts` utilise `pdf-parse`, parcourt toutes les pages et ferme le parseur. Le PDF fourni a été envoyé au serveur local : 5 729 caractères, éléments de la première et de la dernière page présents. Les tests de PDF réel et corrompu passent. |
| F04 | Import PDF fonctionnel dans l’application déployée | 1 | Non validé — bloquant | `https://ursly.io/api/health` échoue avec `ENOTFOUND`. Les tests locaux MinIO/PDF ne prouvent pas l’import sur AWS. |
| F05 | Récupérer le vrai transcript/captions d’une vidéo YouTube | 1–2 | Partiel — bloquant | Adaptateur présent, mais l’essai réel local sur `dQw4w9WgXcQ` retourne HTTP 403 `CLOUD_BLOCKED`, zéro caractère. Le chemin de test habituel est simulé. Il faut au moins une démonstration locale réelle réussie. Ce constat ne signifie pas que toutes les vidéos sont impossibles à récupérer. |
| F06 | Récupération YouTube côté serveur | 3 | Conforme au niveau du code | `packages/adapters/src/providers.ts` appelle le service Python ; `services/transcript/app.py` utilise `youtube-transcript-api`. Aucun scraping de captions côté navigateur. |
| F07 | Afficher le texte extrait en aperçu/repliable | 2 | Validé localement | Web : `<details>` et texte complet, `apps/web/app/page.tsx:574`. Natif : onglet source et lecture développable. Parcours PDF/preview et source natifs vérifiés. |
| F08 | Rendre le texte extrait disponible comme contexte de session | 2 | Partiel — écart confirmé | Le texte est inclus intégralement dans les instructions **jusqu’à 60 000 caractères**. `packages/core/src/domain/ingestion.ts:85` et `apps/web/src/validation.ts` refusent au-delà. Test HTTP : 60 000 → 200 mock ; 60 001 → 400. Cette limite supplémentaire n’est pas prévue par le PDF : un document bien inférieur à 25 MB peut être extrait puis refusé pour la conversation. |
| F09 | Aucun chunking, résumé ou traitement de citations requis | 2 | Conforme au périmètre | Pas d’obligation supplémentaire inventée. La limite F08 doit être résolue ou explicitement acceptée ; le document n’impose pas une technique particulière pour y répondre. |
| F10 | Bouton « Start Voice Chat » établissant une session réelle | 2 | Partiel — bloquant | Libellé exact présent sur le web, `apps/web/app/page.tsx:608`. Le code de session existe, mais seul le mode simulé et la gestion des erreurs ont été vérifiés, pas une session OpenAI réelle. |
| F11 | Utiliser OpenAI Realtime via WebRTC | 3 | Conforme au niveau du code ; réel non validé | `apps/web/src/lib/realtimeClient.ts` crée le peer et le canal de données ; `packages/adapters/src/openai.ts` configure Realtime. Les tests de transport utilisent un environnement simulé. |
| F12 | Parler au micro et entendre les réponses du modèle | 1–3 | Non validé — bloquant | Capture micro et lecture audio présentes dans le client web ; media natif présent. Aucune preuve d’un échange vocal réel avec OpenAI, ni sur navigateur mobile réel ni sur téléphone. |
| F13 | Transcription textuelle en temps réel | 2 | Partiel | Gestion des événements delta/completion implémentée et testée. La production des événements à partir d’une conversation réellement parlée n’a pas été validée. |
| F14 | Repli vers un chat texte si le micro est indisponible | 2 | Partiel | Interface et route `/api/text-chat` présentes ; comportement local et cas de permission couverts par les tests existants. Réponse d’un vrai modèle non démontrée. Le mode texte hors session ne transmet pas les anciens tours au modèle, voir réserves. |
| F15 | Design mobile-first autour de 390 px | 2 | Validé localement | Tests Playwright à 390 × 844 : upload, aperçu, textes longs et absence de débordement. Le projet de test est Chromium avec viewport iPhone ; cela ne constitue pas un test Safari iOS physique. |
| F16 | Contrôles micro/session clairs : démarrer, arrêter, couper/rétablir le micro | 2 | Validé localement, effets réels non validés | Contrôles présents, changement d’état et arrêt des pistes couverts en simulation. À reprendre avec le vrai micro et le vrai son. |
| F17 | État visuel de connexion et déroulement de la conversation | 2 | Validé localement | États connecté/reconnexion/erreur/terminé, messages et maintien de la source testés. La panne DNS réelle est affichée dans les deux nouveaux builds natifs. |
| F18 | Clés API jamais exposées au client | 2 | Conforme à la séparation de code ; audit production incomplet | Clé persistante lue côté serveur par `packages/adapters/src/secrets.ts`, imports client séparés ; mécanisme de test de fuite par valeurs sentinelles dans `infrastructure/scripts/check-client-secrets.mjs`. Pas de preuve d’un client public live à inspecter. Cet audit n’a pas refait une compilation de production avec sentinelles. |
| F19 | Connexions Realtime avec tokens éphémères ou backend authentifié | 2 | Web conforme au niveau du code ; réel non validé | Le navigateur utilise le secret éphémère dans son appel OpenAI (`apps/web/src/lib/realtimeClient.ts:137`). Voir réserve séparée pour la route du compagnon natif, qui ne vérifie pas un credential client. |
| F20 | Émission de tokens éphémères depuis le backend | 3 | Présent dans le code ; réel non validé | `packages/adapters/src/openai.ts:46` appelle `/v1/realtime/client_secrets` avec la clé serveur et retourne la valeur éphémère. En configuration locale actuelle, la valeur `mock_*` n’est pas un token OpenAI. |
| F21 | Stockage mémoire ou léger suffisant ; pas d’authentification utilisateur persistante imposée | 3 | Conforme au périmètre | Historique en mémoire de session, fichiers temporaires dans stockage objet avec nettoyage. L’absence de comptes utilisateurs ou de base permanente n’est pas une non-conformité au PDF. |
| F22 | Stack recommandée Next.js/React/TypeScript et backend Node | 2–3 | Conforme | `apps/web`, routes API, manifests et types présents. Le service Python de sous-titres est un composant complémentaire ; la recommandation de stack n’est pas une restriction exclusive. |

## Livrables et documentation

| ID | Exigence | Pages | État | Preuve et travail restant |
| --- | --- | --- | --- | --- |
| D01 | Frontend et backend complets, application publiquement hébergée et prête à démontrer | 3 | Partiel — bloquant | Code local présent. Domaine public sans endpoint utilisable. Il faut publier l’application web, configurer le mode live et vérifier PDF + Realtime depuis son URL. |
| D02 | README : installation, exécution et configuration d’environnement | 2, 4 | Documentation présente | `README.md`, `.env.example`, documentation mobile et Terraform. Distingue les modes simulés/réels. Installation entièrement neuve non refaite dans cet audit. |
| D03 | README : vue technique et compromis | 2 | Conforme au niveau de la documentation | Modules, extraction, WebRTC, stockage temporaire et compromis YouTube expliqués ; liens vers `ARCHITECTURE.md`. |
| D04 | Expliquer la limitation cloud YouTube si démonstration locale | 1–2 | Explication présente, démonstration manquante | `README.md:83` décrit le blocage et précise qu’un mock n’est pas une preuve. Il manque une vraie récupération locale réussie, puis sa démonstration. |
| D05 | Vidéo de démonstration de 10–15 minutes | 3–4 | Non livrée dans les éléments accessibles — bloquant | `WALKTHROUGH.md` est explicitement un **script** de 12 minutes. Aucune vidéo finale ou URL de remise identifiée. Une capture d’écran ou un test automatique ne remplace pas la vidéo. |
| D06 | Vidéo : import, texte extrait, conversation vocale réelle | 3 | Non livré | Parcours prévu dans le script, mais pas d’enregistrement de voix réelle. |
| D07 | Vidéo : framework/rationale, backend/hébergement, intégration Realtime | 3–4 | Préparé, non livré | Explications écrites et plan de narration disponibles ; enregistrement manquant. |
| D08 | Vidéo : bibliothèques, outils et accélérateurs utilisés | 4 | Préparé, non livré | Dépendances et note d’usage IA présentes ; discussion enregistrée non identifiée. |
| D09 | Dépôt GitHub publiquement accessible | 4 | Non vérifiable / non livré dans le dossier accessible — bloquant | `git remote -v` ne retourne aucun remote ; aucune URL de dépôt public de remise identifiée. Cela ne prouve pas qu’aucun dépôt externe n’existe, mais empêche de valider cette exigence. |
| D10 | Code frontend/backend propre et modulaire dans le dépôt | 4 | Présent localement | Séparation `apps/web`, `apps/mobile`, `packages/core`, `packages/adapters`, infrastructure. Nombreuses modifications et nouveaux fichiers non commités : la présence dans une révision publique reste à prouver. |
| D11 | Dépendances nécessaires fournies | 4 | Conforme localement | Manifests et lockfiles présents : Next.js, React, `pdf-parse`, dépendances de sous-titres et WebRTC natif. |
| D12 | Tests unitaires ou d’intégration pertinents | 4 | Validé localement | Exécutés dans cet audit : 78 unitaires racine, 18 mobiles, 13 parcours web ciblés ; tous passent. Ils ne valident pas les services live. |
| D13 | Mention de l’aide d’outils IA : où et comment | 5 | Conforme au niveau de la documentation | `README.md:135` décrit décomposition des exigences, scaffolding, revue et débogage. |
| D14 | Remise dans les 7 jours ouvrables ou délai discuté | 4 | Non vérifiable | Date officielle de réception et éventuel accord de prolongation non fournis. La date du fichier ne suffit pas pour calculer l’échéance. Aucune communication externe envoyée. |

## Script d’évaluation du document

| Étape page 5 | Résultat de l’audit |
| --- | --- |
| 1. Coller une URL avec captions et confirmer l’ingestion | **Non validé en réel** : essai local 403 ; simulation seule réussie. |
| 2. Importer un PDF et confirmer le texte intégral | **Validé localement sur le PDF fourni et les fixtures multi-pages** ; **non validé sur l’application publique**. Pas de certification de tous les PDF possibles. |
| 3. Sur mobile, parler, interrompre et enchaîner naturellement | **Non validé en réel**. Le code web gère VAD/événements d’interruption ; tests avec événements simulés. |
| 4. Réseau dégradé : stabilité | **Partiel** : 4 tests web de transport injecté passent (reprise, arrêt, panne, délai de reprise), panne DNS réelle gérée en natif. Aucune conversation audio réelle sous réseau mobile dégradé testée. |
| 5. Structure, environnement et secrets | **Revue du code positive sur les frontières principales**, avec réserve d’authentification du chemin natif et absence de preuve de déploiement live. |

## Écarts et réserves à traiter

1. **Publier le web et démontrer l’import PDF sur l’URL publique.** DNS AWS ne signifie pas que l’application est hébergée. Le contrôle HTTPS échoue encore dans cet audit.
2. **Configurer et vérifier une vraie conversation OpenAI Realtime.** Enregistrer micro, sortie audio, transcript, interruption et question de suivi ; tester aussi le repli texte sans permission micro et la perte de réseau. Les mocks et les noms de tests contenant « live client » ne constituent pas une connexion au fournisseur réel.
3. **Réussir une ingestion YouTube réelle, au minimum localement.** L’exception du PDF porte sur le lieu d’exécution, pas sur l’authenticité du transcript.
4. **Traiter la limite de 60 000 caractères.** Elle est visible dans le code et reproduite par requête ; elle n’apparaît pas dans le cahier des charges. Prévoir une stratégie compatible avec le besoin et les limites du modèle, ou obtenir une acceptation explicite de cette restriction. Ne pas simplement retirer la validation sans vérifier les limites du fournisseur.
5. **Livrer le dépôt public et la vidéo de 10–15 minutes.** Le script de narration ne remplace pas le livrable enregistré.

Réserves supplémentaires, à ne pas confondre avec des obligations ajoutées au PDF :

- **Compagnon natif et authentification Realtime** : `apps/mobile/src/voice.ts:19` demande une session mais n’utilise pas son secret éphémère. Il transmet ensuite le SDP à `/api/realtime/connect` via `apps/mobile/src/client.ts:75`. Cette route (`apps/web/app/api/realtime/connect/route.ts:10`) valide le corps mais ne vérifie aucun token côté client avant l’appel serveur authentifié à OpenAI. L’authentification du serveur auprès d’OpenAI n’est pas un contrôle d’accès à cette route. Le navigateur requis par le PDF utilise, lui, effectivement le token éphémère. Harmoniser le chemin natif ou sécuriser explicitement la route ; ne pas déduire de « pas d’auth utilisateur persistante requise » qu’aucune autorisation éphémère n’est nécessaire.
- **Chat texte hors session** : l’historique est affiché, mais seuls `source` et la question courante sont transmis (`apps/web/app/page.tsx:376`, `packages/adapters/src/openai.ts:130`). Une relance ambiguë peut donc perdre le contexte des anciens tours. Le PDF n’impose pas explicitement la mémoire multi-tour pour le repli texte ; c’est une réserve de qualité et de continuité, pas une nouvelle condition absolue.
- **PDF scannés et chiffrés** : pas d’OCR ni de déchiffrement général. Les erreurs d’extraction sont gérées. Le PDF ne demande pas explicitement l’OCR ; ne pas classer son absence comme obligation non respectée.
- **URL YouTube** : les formes watch et youtu.be sont prises en charge ; Shorts/embed ne le sont pas dans le parseur actuel. Limitation à documenter, sans prétendre que le cahier des charges détaille ces formats.
- **Applications natives supplémentaires** : les nouveaux builds Android et iOS Simulator passent les parcours bilingues et les tests d’affichage d’erreurs. Pas de build iPhone physique signé ni de preuve audio/cellulaire réelle. Ces lacunes concernent les demandes additionnelles de la conversation ; le PDF exige un web fonctionnel sur mobile, pas une livraison App Store.
- **Documentation historique** : les rapports et descriptions de tests BDD consignent différents états successifs. Une ligne « passed » dans un ancien rapport ne remplace pas la preuve de la version et de l’environnement actuels ; les scénarios pending ne sont pas des succès.

## Critères d’évaluation — sans note inventée

- **Product Polish (Mobile)** : mise en page web à 390 px et états testés ; expérience vocale mobile réelle encore inconnue. Les animations natives ne prouvent pas le niveau du web évalué.
- **Ingestion Quality** : extraction PDF réelle locale et cas d’erreur couverts ; PDF public et captions réels restent bloquants.
- **Code Quality** : séparation modulaire, TypeScript, documentation et tests présents ; publication du code et revue de l’autorisation native à compléter.
- **System Design** : frontières frontend/core/adapters/infrastructure identifiables ; architecture de déploiement décrite, mais fonctionnement et exploitation publics non établis.

Les niveaux 1 à 4 du document sont des critères de jugement. Une note globale « 4/4 » ou « exceptionnel » ne peut pas être certifiée à partir de tests locaux seuls.

## Preuves exécutées pendant cet audit

- Lecture textuelle et visuelle des **5 pages** du PDF original.
- `npm test -- --reporter=json ...` : **78/78**, aucun échec.
- Tests mobiles : **18/18** ; TypeScript mobile valide.
- Playwright ciblé, `E2E_BASE_URL=http://localhost:3100`, `home.spec.ts`, `responsive-edge.spec.ts`, `webrtc-transport.spec.ts`, un worker : **13/13**, 19,5 secondes. API locale en mode **mock**, extraction PDF et stockage réels, transport Realtime simulé.
- Import local du PDF de spécification : **5 729 caractères**, première et dernière pages représentées, pas de résumé appliqué par l’extracteur.
- Requêtes de session : **60 000 caractères → 200 en mock**, **60 001 → 400**.
- Service de captions exécuté explicitement en **live** pour le test : **403 CLOUD_BLOCKED**, zéro caractère. La configuration du service existant n’a pas été modifiée.
- `node apps/mobile/scripts/check-production.mjs https://ursly.io` : **échec ENOTFOUND**.
- `git remote -v` : aucune entrée.

Les sorties de cette passe se trouvent dans `tmp/pdfs/requirements-audit/`. Les tests natifs et leurs limites sont détaillés dans `apps/mobile/PRODUCTION-VERIFICATION.md`. Les tests de build, BDD complets et scans canary antérieurs n’ont pas été réexécutés ici ; aucune nouvelle réussite n’est revendiquée pour ces contrôles.
