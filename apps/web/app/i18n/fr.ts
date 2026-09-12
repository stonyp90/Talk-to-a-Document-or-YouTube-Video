import type { Dictionary } from "./translate";

/**
 * The terms French writes exactly as English does: product and technology
 * names, and the words the two languages happen to share. Every one of them is
 * a decision, named here so it can be argued with.
 *
 * Anywhere else, an entry whose French equals its English is not a decision but
 * a placeholder — the English copied across while the translation was late —
 * and the page then reads English to a French reader. The tests hold the
 * dictionary to that: identical means listed here, or it means untranslated.
 */
export const IDENTICAL_IN_BOTH: readonly string[] = [
  "YouTube",
  "Conversation",
  "Applications",
  "Guide",
  "Next.js · Expo · TypeScript",
];

/**
 * French translations keyed by the English source string. Quebec French,
 * vouvoiement, typographic apostrophes, and a non-breaking space before
 * two-part punctuation. Terms follow the Office québécois de la langue
 * française: téléverser, clavier, objets connectés, version bêta.
 */
export const french: Dictionary = {
  // Navigation and modes
  Primary: "Principale",
  "Ursly home": "Accueil Ursly",
  "Control mode": "Mode de contrôle",
  "Voice to action": "Voix vers action",
  "Keyboard to action": "Clavier vers action",
  "Motion to action": "Mouvement vers action",
  Voice: "Voix",
  Keyboard: "Clavier",
  Motion: "Mouvement",
  Beta: "Bêta",
  Legacy: "Ancien",
  // Motion to action
  "Your hand is the shortcut.": "Votre main est le raccourci.",
  "Motion to action: start the camera, then swipe to choose a question and wave to ask it.":
    "Mouvement vers action : démarrez la caméra, puis balayez pour choisir une question et saluez pour la poser.",
  "Add a PDF or a captioned YouTube video, then drive it with your hand. Swipe to choose a question, wave to ask it, and type whenever you prefer.":
    "Ajoutez un PDF ou une vidéo YouTube sous-titrée, puis pilotez-la avec la main. Balayez pour choisir une question, saluez pour la poser, et écrivez quand vous préférez.",
  "Add a source, then start the camera and swipe to choose a question. Typing always works too.":
    "Ajoutez une source, démarrez la caméra, puis balayez pour choisir une question. Le clavier fonctionne toujours.",
  "The camera is off. Nothing is recorded or sent.":
    "La caméra est éteinte. Rien n’est enregistré ni envoyé.",
  "Start motion": "Démarrer le mouvement",
  "Stop motion": "Arrêter le mouvement",
  "Starting the camera…": "Démarrage de la caméra…",
  "Camera on. Swipe to choose, wave to ask.":
    "Caméra allumée. Balayez pour choisir, saluez pour demander.",
  "Camera off.": "Caméra éteinte.",
  "Chosen question": "Question choisie",
  "Swipe right": "Balayer vers la droite",
  "Swipe left": "Balayer vers la gauche",
  "Swipe up": "Balayer vers le haut",
  "Swipe down": "Balayer vers le bas",
  "Wave in place": "Saluer sur place",
  "Next question": "Question suivante",
  "Previous question": "Question précédente",
  "Ask it": "La poser",
  "Summarize the source": "Résumer la source",
  "Add a source first, then wave to ask.":
    "Ajoutez d’abord une source, puis saluez pour demander.",
  "Asking: {question}": "Question envoyée : {question}",
  "This browser will not share a camera here. Motion needs a secure connection; voice and typing still work.":
    "Ce navigateur ne partagera pas de caméra ici. Le mouvement exige une connexion sécurisée; la voix et le clavier fonctionnent toujours.",
  "The camera was not allowed. Allow it in your browser, then start motion again.":
    "La caméra n’a pas été autorisée. Autorisez-la dans votre navigateur, puis redémarrez le mouvement.",
  "No camera was found on this device.":
    "Aucune caméra n’a été trouvée sur cet appareil.",
  "The camera could not be started. Check it is not already in use.":
    "La caméra n’a pas pu démarrer. Vérifiez qu’elle n’est pas déjà utilisée.",
  "This browser will not share a camera here. Motion needs a secure connection.":
    "Ce navigateur ne partagera pas de caméra ici. Le mouvement exige une connexion sécurisée.",
  Platform: "Plateforme",
  "How we build": "Notre façon de bâtir",
  Build: "Bâtir",
  // Identical in French on purpose; see IDENTICAL_IN_BOTH above.
  Guide: "Guide",
  // The narrow-screen short forms of "Applications" and "Ouvrir
  // l’application". French abbreviates application as appli.
  Apps: "Applis",
  "Watch the intro": "Voir l’intro",
  Language: "Langue",
  "Skip to workspace": "Aller à l’atelier",
  "Skip to content": "Aller au contenu",
  "The software development lifecycle": "Le cycle de développement logiciel",
  "A new way to build software.": "Une nouvelle façon de bâtir des logiciels.",
  "For tomorrow’s internet.": "Pour l’Internet de demain.",
  "One loop of {count} stages, walked in full before anything ships. Nothing is skipped, and nothing is called done until the loop closes.":
    "Une seule boucle de {count} étapes, parcourue au complet avant que quoi que ce soit ne sorte. Rien n’est sauté, et rien n’est dit terminé tant que la boucle n’est pas bouclée.",
  "What it does today: bring a PDF or a captioned YouTube video and talk to it. How it is built is the rest of this page.":
    "Ce qu’il fait aujourd’hui : apportez un PDF ou une vidéo YouTube sous-titrée et parlez-lui. Comment il est bâti, c’est le reste de cette page.",
  "Open the app": "Ouvrir l’application",
  App: "Appli",
  "Back to the story": "Retour à l’histoire",
  Story: "Histoire",

  // Introduction
  Welcome: "Bienvenue",
  "In {seconds} seconds.": "En {seconds} secondes.",
  "Ursly introduction": "Présentation d’Ursly",
  "The Ursly introduction": "L’introduction d’Ursly",
  "A source, a question, and a conversation that stays grounded in what you brought.":
    "Une source, une question, et une conversation qui reste ancrée dans ce que vous avez apporté.",
  "Skip intro": "Passer l’intro",
  "Play the intro": "Lire l’intro",
  "Intro progress": "Progression de l’intro",
  Chapters: "Chapitres",
  "Previous chapter": "Chapitre précédent",
  "Next chapter": "Chapitre suivant",
  "Continues in {seconds} s": "Suite dans {seconds} s",
  "Skip whenever you like. Ursly is right behind this.":
    "Passez quand vous voulez. Ursly est juste derrière.",
  "Read the intro instead": "Lire l’intro plutôt",
  "The intro is unavailable right now.":
    "L’intro n’est pas disponible pour le moment.",

  // The scenes of the introduction, in the order the film plays them. They are
  // also the transcript shown in the dialog, so anyone who cannot watch reads
  // exactly the same argument. "Not a new website. A new way to use one." is
  // deliberately absent: the platform section below already owns that sentence,
  // and the film must not say it a second, slightly different way.
  "The next generation of internet.": "La nouvelle génération d’internet.",
  "Bring a document or a video.": "Apportez un document ou une vidéo.",
  "Ursly reads it, and answers only from it.":
    "Ursly le lit, et ne répond qu’à partir de lui.",
  "Voice to action.": "Voix vers action.",
  "Say it, and Ursly does it.": "Dites-le, Ursly le fait.",
  "Motion to action.": "Mouvement vers action.",
  "In beta, built for the headsets coming next.":
    "En bêta, pensé pour les casques qui arrivent.",
  "The keyboard still works.": "Le clavier fonctionne toujours.",
  "It is simply no longer the way in.":
    "Ce n’est simplement plus la porte d’entrée.",
  "Nothing ships until the loop closes.":
    "Rien ne sort tant que la boucle n’est pas bouclée.",
  "Concept to production, tested in production, every cycle.":
    "Du concept à la production, testé en production, à chaque cycle.",

  // Landing hero

  // Workspace heading
  "Your source.": "Votre source.",
  "Your questions.": "Vos questions.",
  "Add a PDF or a captioned YouTube video, then talk to it. Say a command, speak your question, or type whenever you prefer.":
    "Ajoutez un PDF ou une vidéo YouTube sous-titrée, puis parlez-lui. Dites une commande, posez votre question à voix haute ou écrivez quand vous préférez.",
  "Add a PDF or a captioned YouTube video, then ask about it by typing. This is the old way in, and it still does everything. Voice is one tap away.":
    "Ajoutez un PDF ou une vidéo YouTube sous-titrée, puis posez vos questions au clavier. C’est l’ancienne porte d’entrée, et elle fait encore tout. La voix est à un geste.",
  Progress: "Progression",
  "Add a source": "Ajouter une source",
  "Ask a question": "Poser une question",
  "You are offline. Ursly will reconnect when your network returns.":
    "Vous êtes hors ligne. Ursly se reconnectera au retour du réseau.",
  "Dismiss notification": "Fermer la notification",
  "Voice to action: the way in. Say a command, or use the controls as usual.":
    "Voix vers action : c’est la porte d’entrée. Dites une commande ou utilisez les contrôles comme d’habitude.",
  "Keyboard to action: the old way in, still complete. Everything works by typing and clicking.":
    "Clavier vers action : l’ancienne porte d’entrée, toujours complète. Tout fonctionne en écrivant et en cliquant.",

  // Source card
  "1. Add a source": "1. Ajouter une source",
  "Your source": "Votre source",
  Extracting: "Extraction",
  "Source ready": "Source prête",
  "Step 1 of 2": "Étape 1 sur 2",
  "Ready · Your answers will use this source":
    "Prête · Vos réponses s’appuieront sur cette source",
  "Change source": "Changer de source",
  "Choose a PDF or a video to get started":
    "Choisissez un PDF ou une vidéo pour commencer",
  "Adding a new source starts a new conversation.":
    "Ajouter une nouvelle source démarre une nouvelle conversation.",
  "We’ll read it for you. Then you can ask about it.":
    "Nous le lisons pour vous. Ensuite, vous pouvez poser vos questions.",
  "Source type": "Type de source",
  "PDF document": "Document PDF",
  "YouTube video": "Vidéo YouTube",
  "Drop a PDF here": "Déposez un PDF ici",
  "or choose one from your device · up to 25 MB, text-based":
    "ou choisissez-en un sur votre appareil · jusqu’à 25 Mo, avec du texte",
  "Choose a PDF": "Choisir un PDF",
  "Choose another PDF": "Choisir un autre PDF",
  "{size} MB · Ready to continue": "{size} Mo · Prêt à continuer",
  "PDF file": "Fichier PDF",
  "YouTube URL": "Adresse YouTube",
  "Paste a link to a captioned video. Watch pages, Shorts, share links and embeds all work.":
    "Collez le lien d’une vidéo sous-titrée. Les pages de lecture, les Shorts, les liens de partage et les intégrations fonctionnent tous.",
  "Reading your source…": "Lecture de votre source…",
  "Continue to questions": "Passer aux questions",
  "Upload progress": "Progression du téléversement",
  "Uploading · {percent}%": "Téléversement · {percent} %",
  "Use a PDF instead": "Utiliser un PDF plutôt",
  "Reading your source. This may take up to a minute. Your questions are next.":
    "Lecture de votre source. Cela peut prendre jusqu’à une minute. Vos questions viennent ensuite.",
  "View source text · {count} characters":
    "Voir le texte de la source · {count} caractères",
  "This source is longer than one conversation can hold. The assistant reads {used} of {total} characters, taken from the opening and the ending. The full text stays available above.":
    "Cette source dépasse ce qu’une conversation peut contenir. L’assistant lit {used} caractères sur {total}, pris au début et à la fin. Le texte complet reste disponible ci-dessus.",
  "Next: ask a question": "Ensuite : posez une question",
  "Use voice or type below. Answers stay anchored to this source.":
    "Utilisez la voix ou écrivez ci-dessous. Les réponses restent ancrées dans cette source.",
  "Reading your source timed out. Check your connection and retry.":
    "La lecture de votre source a expiré. Vérifiez votre connexion et réessayez.",
  "We couldn’t read this source. Please try again.":
    "Nous n’avons pas pu lire cette source. Veuillez réessayer.",

  // Voice commands
  "Speak a command": "Dire une commande",
  "Stop listening": "Arrêter l’écoute",
  "Listening for a command": "À l’écoute d’une commande",
  "Press once, then say a command such as “{first}” or “{second}”.":
    "Appuyez une fois, puis dites une commande comme « {first} » ou « {second} ».",
  "Triggered “{phrase}” · {action}.": "Déclenché « {phrase} » · {action}.",

  // Spoken confirmations: these are read out loud by the browser voice.
  "Opening the YouTube source tab.": "J’ouvre l’onglet source YouTube.",
  "Opening the PDF upload picker.": "J’ouvre le sélecteur de PDF.",
  "Starting voice chat.": "Je démarre la conversation vocale.",
  "Preparing a key-ideas summary.": "Je prépare un résumé des idées clés.",
  "Going back and undoing the last step.":
    "Je reviens en arrière et j’annule la dernière étape.",
  "Moving forward to the next step.": "Je passe à l’étape suivante.",
  "Cancelling the current action.": "J’annule l’action en cours.",
  Say: "Dites",
  "Voice command examples": "Exemples de commandes vocales",
  YouTube: "YouTube",
  Upload: "Téléverser",
  "Let's talk": "Parlons-en",
  "Let’s talk": "Parlons-en",
  "Summarize this": "Résume ceci",
  "switch to YouTube": "passer à YouTube",
  "open the PDF picker": "ouvrir le sélecteur de PDF",
  "try a voice action": "lancer la conversation vocale",
  "ask for a summary": "demander un résumé",
  "undo the last step": "annuler la dernière étape",
  "continue forward": "continuer",
  "stop the current action": "arrêter l’action en cours",
  "Heard:": "Entendu :",
  "Customize commands": "Personnaliser les commandes",
  "Build a trigger": "Créer un déclencheur",
  "The phrases stay on this device. Every action is configurable, including the built-in Back, Next, and Cancel commands.":
    "Les phrases restent sur cet appareil. Chaque action est configurable, y compris les commandes intégrées Retour, Suivant et Annuler.",
  "Trigger word or phrase": "Mot ou phrase déclencheur",
  "e.g. upload": "p. ex. téléverser",
  "When I say it…": "Quand je le dis…",
  "Save trigger": "Enregistrer le déclencheur",
  "Update trigger": "Mettre à jour le déclencheur",
  "No saved triggers yet. Start with “upload” or “YouTube”.":
    "Aucun déclencheur enregistré. Commencez par « téléverser » ou « YouTube ».",
  Edit: "Modifier",
  Remove: "Supprimer",
  "Edit trigger {phrase}": "Modifier le déclencheur {phrase}",
  "Remove trigger {phrase}": "Supprimer le déclencheur {phrase}",
  "Live speech recognition is not available in this browser. The example buttons still preview every action.":
    "La reconnaissance vocale en direct n’est pas offerte dans ce navigateur. Les boutons d’exemple montrent tout de même chaque action.",
  "Start voice chat becomes available after you add a PDF or YouTube source.":
    "La conversation vocale devient disponible après l’ajout d’un PDF ou d’une source YouTube.",
  "For uploads, your browser still asks you to confirm the local file; websites cannot read arbitrary files without that confirmation.":
    "Pour les téléversements, votre navigateur vous demande toujours de confirmer le fichier; un site Web ne peut pas lire vos fichiers sans cette confirmation.",
  "Open the YouTube source tab": "Ouvrir l’onglet source YouTube",
  "Open the PDF upload picker": "Ouvrir le sélecteur de PDF",
  "Start voice chat": "Démarrer la conversation vocale",
  "Ask for a key-ideas summary": "Demander un résumé des idées clés",
  "Go back or undo the last step":
    "Revenir en arrière ou annuler la dernière étape",
  "Go forward to the next step": "Passer à l’étape suivante",
  "Cancel the current action": "Annuler l’action en cours",
  "Voice actions are off. Your saved triggers are ready for next time.":
    "Les commandes vocales sont désactivées. Vos déclencheurs sont prêts pour la prochaine fois.",
  "Voice actions stopped after 8 seconds without speech.":
    "Les commandes vocales se sont arrêtées après 8 secondes sans parole.",
  "Voice actions paused while Ursly is busy with another action.":
    "Les commandes vocales sont en pause pendant qu’Ursly termine une autre action.",
  "Voice actions stopped when this page was hidden.":
    "Les commandes vocales se sont arrêtées quand la page a été masquée.",
  "Add a PDF or YouTube source first, then say “{phrase}” again.":
    "Ajoutez d’abord un PDF ou une source YouTube, puis redites « {phrase} ».",
  "Voice actions are preparing for the next command.":
    "Les commandes vocales se préparent pour la prochaine commande.",
  "Use at least one letter or number in the trigger phrase.":
    "Utilisez au moins une lettre ou un chiffre dans la phrase déclencheur.",
  "This browser does not support speech recognition. Use the example buttons or type instead.":
    "Ce navigateur ne prend pas en charge la reconnaissance vocale. Utilisez les boutons d’exemple ou écrivez.",
  "Create at least one trigger before arming voice actions.":
    "Créez au moins un déclencheur avant d’activer les commandes vocales.",
  "Voice actions could not start. Check microphone permissions and try again.":
    "Les commandes vocales n’ont pas pu démarrer. Vérifiez l’accès au microphone et réessayez.",
  "Voice actions need microphone access. Check the browser permission and try again.":
    "Les commandes vocales ont besoin du microphone. Vérifiez l’autorisation du navigateur et réessayez.",
  "Voice recognition stopped unexpectedly. Press Arm voice actions to try again.":
    "La reconnaissance vocale s’est arrêtée de façon inattendue. Appuyez sur Dire une commande pour réessayer.",
  "Voice actions are reconnecting to the microphone…":
    "Les commandes vocales se reconnectent au microphone…",
  "Voice actions stopped. Press Arm voice actions to restart them.":
    "Les commandes vocales se sont arrêtées. Appuyez sur Dire une commande pour les relancer.",
  "Voice actions stopped after 30 seconds for your privacy.":
    "Les commandes vocales se sont arrêtées après 30 secondes, pour votre confidentialité.",
  "Upload is ready — choose a PDF in the file picker to finish.":
    "Le téléversement est prêt : choisissez un PDF dans le sélecteur pour terminer.",
  "YouTube is ready — dictate or paste a video link next.":
    "YouTube est prêt : dictez ou collez maintenant le lien d’une vidéo.",
  "Your summary request is ready in the question box.":
    "Votre demande de résumé est prête dans la zone de question.",
  "Going back — the source controls are ready.":
    "Retour en arrière : les contrôles de la source sont prêts.",
  "Next step: choose a PDF or paste a YouTube link.":
    "Prochaine étape : choisissez un PDF ou collez un lien YouTube.",
  "Next step: ask your question.": "Prochaine étape : posez votre question.",
  "Cancelled — the current action has been stopped.":
    "Annulé : l’action en cours a été arrêtée.",

  // Conversation card
  "2. Ask a question": "2. Poser une question",
  Ready: "Prêt",
  Preparing: "Préparation",
  Connecting: "Connexion",
  Connected: "Connecté",
  Reconnecting: "Reconnexion",
  Ended: "Terminé",
  "Needs attention": "À vérifier",
  "Listening for your question": "À l’écoute de votre question",
  Answering: "Réponse en cours",
  Listening: "À l’écoute",
  "Hearing you": "Je vous entends",
  "Answering — speak to interrupt":
    "Réponse en cours : parlez pour interrompre",
  Exploring: "Exploration de",
  "Demo simulation: AI replies are simulated; microphone audio is not sent to AI. Use live mode for real answers and voice.":
    "Démonstration : les réponses de l’IA sont simulées et l’audio du microphone n’est pas envoyé à l’IA. Utilisez le mode réel pour de vraies réponses et la voix.",
  "Start Voice Chat": "Démarrer la conversation vocale",
  "Mute microphone": "Couper le micro",
  "Unmute microphone": "Réactiver le micro",
  Stop: "Arrêter",
  "This browser will not share a microphone here, so voice is unavailable. Type your question below instead.":
    "Ce navigateur ne partagera pas de microphone ici; la voix n’est donc pas disponible. Écrivez plutôt votre question ci-dessous.",
  "Microphone muted. Unmute to speak, or keep typing.":
    "Micro coupé. Réactivez-le pour parler, ou continuez d’écrire.",
  "Allow microphone access when prompted, then speak. You can mute or stop at any time, and typing always works.":
    "Autorisez le microphone quand on vous le demande, puis parlez. Vous pouvez couper le micro ou arrêter à tout moment, et l’écriture fonctionne toujours.",
  "Voice chat opens as soon as your source is ready. Typing always works too.":
    "La conversation vocale s’ouvre dès que votre source est prête. L’écriture fonctionne aussi.",
  "Answering in Ursly’s preset voice":
    "Réponse avec la voix par défaut d’Ursly",
  "Talking here teaches Ursly nothing about your voice. Lending it yours is a separate, deliberate step.":
    "Parler ici n’apprend rien à Ursly sur votre voix. Lui prêter la vôtre est une démarche distincte et délibérée.",
  Conversation: "Conversation",
  "What are you curious about?": "Qu’est-ce qui vous intrigue?",
  "Your voice is the shortcut.": "Votre voix est le raccourci.",
  "Good questions start here.": "Les bonnes questions commencent ici.",
  "Start voice chat and speak, type your question below, or choose an idea.":
    "Démarrez la conversation vocale et parlez, écrivez votre question ci-dessous ou choisissez une idée.",
  "Bring a source in with a word, then ask out loud. Nothing starts without your word, and typing always works.":
    "Ajoutez une source d’un mot, puis posez votre question à voix haute. Rien ne démarre sans votre mot, et l’écriture fonctionne toujours.",
  "Add a source, then explore the ideas inside it.":
    "Ajoutez une source, puis explorez les idées qu’elle contient.",
  "Summarize the key ideas": "Résumer les idées clés",
  "Explain this simply": "Expliquer simplement",
  "What should I remember?": "Que devrais-je retenir?",
  You: "Vous",
  "Session update": "Mise à jour de la session",
  "Finding an answer in your source…":
    "Recherche d’une réponse dans votre source…",
  // The live channel
  "Live channel open — answers arrive as they are written":
    "Canal en direct ouvert — les réponses arrivent à mesure qu’elles s’écrivent",
  "Opening the live channel…": "Ouverture du canal en direct…",
  "Reopening the live channel…": "Réouverture du canal en direct…",
  "The live channel is closed; answers still arrive.":
    "Le canal en direct est fermé; les réponses arrivent quand même.",
  "That answer was interrupted. Ask again.":
    "Cette réponse a été interrompue. Reposez votre question.",
  "That is a lot of questions at once. Wait a moment and ask again.":
    "Cela fait beaucoup de questions d’un coup. Attendez un instant et reposez votre question.",
  "Or type instead of speaking": "Ou écrivez au lieu de parler",
  "Your question": "Votre question",
  "Your question (ready when your source is added)":
    "Votre question (prête dès que votre source est ajoutée)",
  "Ask a question…": "Posez une question…",
  "Type what you want to understand…": "Écrivez ce que vous voulez comprendre…",
  Send: "Envoyer",
  "Answers come from your source. Check important details in “View source text”.":
    "Les réponses viennent de votre source. Vérifiez les détails importants dans « Voir le texte de la source ».",
  "Add a PDF or YouTube source before sending so answers stay grounded.":
    "Ajoutez un PDF ou une source YouTube avant d’envoyer, pour que les réponses restent ancrées.",
  "Voice session setup timed out. Check your connection and retry Start Voice Chat.":
    "La préparation de la session vocale a expiré. Vérifiez votre connexion et réessayez Démarrer la conversation vocale.",
  "Microphone access is unavailable. You can type your question instead.":
    "Le microphone n’est pas accessible. Vous pouvez écrire votre question à la place.",
  "That message did not reach the voice session. Please retry.":
    "Ce message n’a pas atteint la session vocale. Veuillez réessayer.",
  "The answer timed out. Check your connection and retry your question.":
    "La réponse a expiré. Vérifiez votre connexion et reposez votre question.",
  "The answer could not be produced.": "La réponse n’a pas pu être produite.",
  "YouTube is not sharing captions for this video right now. Try another captioned video, or use a PDF instead.":
    "YouTube ne partage pas les sous-titres de cette vidéo pour le moment. Essayez une autre vidéo sous-titrée ou un PDF.",
  "That is a lot of requests at once. Wait a moment and try again.":
    "Cela fait beaucoup de demandes à la fois. Patientez un instant et réessayez.",

  // Platform section
  "Not a new website. A new way to use one.":
    "Pas un nouveau site Web. Une nouvelle façon de s’en servir.",
  "Ursly sits between what you mean and what a screen does. You speak; you move; you can still type. It listens, adapts to how you talk, and keeps you, not the model, in charge of what happens next.":
    "Ursly se place entre ce que vous voulez dire et ce que l’écran fait. Vous parlez; vous bougez; vous pouvez encore écrire. Ursly écoute, s’adapte à votre façon de parler et vous laisse, à vous et non au modèle, la maîtrise de la suite.",
  "A human stays in the loop.": "Un humain garde la main.",
  "Every action Ursly takes is one you asked for, can see and can undo. When it is unsure, it asks instead of guessing.":
    "Chaque action qu’Ursly effectue est une action que vous avez demandée, que vous voyez et que vous pouvez annuler. En cas de doute, Ursly vous pose la question au lieu de deviner.",
  "A voice model that learns your voice, with your permission.":
    "Un modèle vocal qui apprend votre voix, avec votre permission.",
  "Ursly is built to tune itself to your accent, your pace and the words you actually use, so it understands you a little better each time. Your recordings stay yours: nothing is kept without your say, and everything can be deleted in one tap.":
    "Ursly est conçu pour se régler sur votre accent, votre débit et les mots que vous employez vraiment, pour vous comprendre un peu mieux à chaque échange. Vos enregistrements vous appartiennent : rien n’est conservé sans votre consentement et tout peut être supprimé d’un seul geste.",
  "Voice first. Movement works too. Keyboard still here.":
    "La voix d’abord. Le mouvement aussi. Le clavier toujours là.",
  "Voice to action is how you use Ursly today. Motion to action works today too, in beta: start the camera and drive the page with five movements. It reads movement, not fingers, and nothing is recorded or sent. It is built for VR and AR headsets, and it runs in a browser now. The keyboard is the old way in: it still does everything, we keep it and support it, and no one is left out. It is simply no longer where you start.":
    "La commande vocale, c’est la façon d’utiliser Ursly aujourd’hui. Le mouvement vers action fonctionne lui aussi dès maintenant, en version bêta : démarrez la caméra et pilotez la page avec cinq mouvements. Il lit le mouvement, pas les doigts, et rien n’est enregistré ni envoyé. Il est pensé pour les casques de réalité virtuelle et augmentée, et il fonctionne déjà dans un navigateur. Le clavier est l’ancienne porte d’entrée : il fait encore tout, nous le gardons et le prenons en charge, et personne n’est laissé de côté. Il n’est simplement plus le point de départ.",
  "A simple site today. Every surface tomorrow.":
    "Un site simple aujourd’hui. Toutes les surfaces demain.",
  "Talking to a document is the first surface. The same platform is designed to drive connected objects, 3D objects and interfaces that do not exist yet, without changing how you ask.":
    "Converser avec un document est la première surface. La même plateforme est conçue pour piloter des objets connectés, des objets 3D et des interfaces qui n’existent pas encore, sans changer votre façon de demander.",
  "What is true today, next and later":
    "Ce qui est vrai aujourd’hui, ensuite et plus tard",
  Today: "Aujourd’hui",
  Next: "Ensuite",
  Later: "Plus tard",
  "Talk to a PDF or a captioned YouTube video. Say “upload”, “summarize” or “next” to drive the page. Or start the camera and drive it with five movements, in beta. The keyboard still does all of it, for whoever wants it.":
    "Conversez avec un PDF ou une vidéo YouTube sous-titrée. Dites « téléverser », « résume » ou « suivant » pour piloter la page. Ou démarrez la caméra et pilotez-la avec cinq mouvements, en version bêta. Le clavier fait encore tout cela, pour qui le souhaite.",
  "Voice profiles that adapt to each speaker, with consent and one-tap deletion. Motion to action on VR and AR headsets.":
    "Des profils vocaux qui s’adaptent à chaque personne, avec consentement et suppression d’un seul geste. Le mouvement vers action sur les casques de réalité virtuelle et augmentée.",
  "Connected objects, 3D objects and other surfaces. Whole industries, not only websites.":
    "Objets connectés, objets 3D et autres surfaces. Des industries entières, pas seulement des sites Web.",
  "Try it now": "Essayez-le maintenant",
  "No dates. We publish what ships, and we revise this as we learn. Not on the list: replacing your keyboard, or acting without asking.":
    "Sans dates. Nous publions ce qui est livré et nous révisons ce plan à mesure que nous apprenons. Pas au programme : remplacer votre clavier, ou agir sans demander.",
  "Open source": "Code source ouvert",
  "Tests and CI on every change":
    "Tests et intégration continue à chaque changement",
  "Signed builds and release notes": "Versions signées et notes de version",
  "Watch the intro again": "Revoir l’intro",
  "Less scrolling. More understanding. On every surface that comes next.":
    "Moins défiler. Mieux comprendre. Sur chaque surface à venir.",

  // How it works
  "A little guidance": "Un peu d’accompagnement",
  "From information to understanding.": "De l’information à la compréhension.",
  "Bring your source": "Apportez votre source",
  "Choose a text-based PDF up to 25 MB or a captioned YouTube video, then check the extracted text in the preview.":
    "Choisissez un PDF avec du texte, jusqu’à 25 Mo, ou une vidéo YouTube sous-titrée, puis vérifiez le texte extrait dans l’aperçu.",
  "Start talking": "Commencez à parler",
  "Select Start Voice Chat, allow the microphone, and ask out loud. Interrupt or mute whenever you want. The keyboard is still there, it is simply no longer the way in.":
    "Choisissez Démarrer la conversation vocale, autorisez le microphone et posez votre question à voix haute. Interrompez ou coupez le micro quand vous voulez. Le clavier est toujours là, il n’est simplement plus la porte d’entrée.",
  "Go a little deeper": "Allez un peu plus loin",
  "Use a suggestion or ask a follow-up in your own words. Keep the source nearby to check important details.":
    "Utilisez une suggestion ou posez une question de suivi dans vos mots. Gardez la source à portée pour vérifier les détails importants.",
  "Having trouble with a source or your microphone?":
    "Un problème avec une source ou votre microphone?",
  "Scanned PDFs need a text layer before upload. YouTube captions must be available, and some videos may be blocked by YouTube. For voice, allow microphone access in your browser. If voice cannot connect, the keyboard is right there and answers every question about an extracted source.":
    "Les PDF numérisés doivent contenir une couche de texte avant le téléversement. Les sous-titres YouTube doivent être disponibles, et certaines vidéos peuvent être bloquées par YouTube. Pour la voix, autorisez le microphone dans votre navigateur. Si la voix ne se connecte pas, le clavier est juste là et répond à toutes vos questions sur une source extraite.",

  // Sign-in and the spending limit
  "Sign in to keep going": "Connectez‑vous pour continuer",
  "Reading a source and answering out loud runs on a paid model. Signing in ties that spending to an account, with a limit, instead of leaving it open to everyone.":
    "Lire une source et répondre à voix haute repose sur un modèle payant. La connexion rattache cette dépense à un compte, avec une limite, plutôt que de la laisser ouverte à tous.",
  "Email address": "Adresse courriel",
  "you@example.com": "vous@exemple.com",
  "We send a one-time code. There is no password to remember.":
    "Nous envoyons un code à usage unique. Aucun mot de passe à retenir.",
  "Send me a code": "Envoyez‑moi un code",
  "Sending…": "Envoi…",
  "Your code": "Votre code",
  "Check {email} for the code. It expires shortly.":
    "Le code vous attend à {email}. Il expire sous peu.",
  "Sign in": "Se connecter",
  "Checking…": "Vérification…",
  "Use another address": "Utiliser une autre adresse",
  "Sign out": "Se déconnecter",
  "Something went wrong. Please try again.":
    "Une erreur est survenue. Veuillez réessayer.",
  // What the server answers, translated where the reader actually reads it.
  "Sign in to continue. This feature runs on a paid model, so it is for signed-in readers.":
    "Connectez‑vous pour continuer. Cette fonction repose sur un modèle payant ; elle est réservée aux personnes connectées.",
  "You have reached your usage limit for now. It resets shortly.":
    "Vous avez atteint votre limite d’utilisation pour l’instant. Elle se réinitialise sous peu.",
  "Enter your email address.": "Saisissez votre adresse courriel.",
  "Enter a valid email address.": "Saisissez une adresse courriel valide.",
  "That email address is too long.": "Cette adresse courriel est trop longue.",
  "An email address cannot contain spaces.":
    "Une adresse courriel ne peut pas contenir d’espaces.",
  "Enter the code exactly as it appears in the email.":
    "Saisissez le code exactement comme il apparaît dans le courriel.",
  "That code is not valid. Check it and try again.":
    "Ce code n’est pas valide. Vérifiez‑le et réessayez.",
  "That code is not valid. Ask for a new one.":
    "Ce code n’est pas valide. Demandez‑en un nouveau.",
  "That code has expired. Ask for a new one.":
    "Ce code a expiré. Demandez‑en un nouveau.",
  "Too many attempts. Ask for a new code.":
    "Trop de tentatives. Demandez un nouveau code.",
  "The code could not be sent. Please retry.":
    "Le code n’a pas pu être envoyé. Veuillez réessayer.",
  "The sign-in could not be completed.":
    "La connexion n’a pas pu être menée à terme.",
  "The sign-out could not be completed.":
    "La déconnexion n’a pas pu être menée à terme.",
  // The story, and the invitation that closes it
  "Your turn": "À votre tour",
  "That is the story. Now bring a document.":
    "Voilà l’histoire. Apportez maintenant un document.",
  "A PDF or a captioned YouTube video, a question out loud, and an answer that stays anchored to what you brought.":
    "Un PDF ou une vidéo YouTube sous-titrée, une question à voix haute, et une réponse qui reste ancrée dans ce que vous avez apporté.",
  "Three steps, about a minute. Nothing to install.":
    "Trois étapes, environ une minute. Rien à installer.",
  // Applications
  Applications: "Applications",
  "Your next insight, wherever you go.":
    "Votre prochain déclic, où que vous soyez.",
  "Try Ursly on Android, explore the iOS Simulator build, or look inside the code.":
    "Essayez Ursly sur Android, explorez la version pour le simulateur iOS ou regardez le code de l’intérieur.",
  "Release notes & installation": "Notes de version et installation",
  "Android preview": "Aperçu Android",
  "Take Ursly with you.": "Emportez Ursly avec vous.",
  "Download the signed APK for Android 7.0 or later. Installation requires allowing apps from your browser.":
    "Téléchargez l’APK signé pour Android 7.0 ou une version plus récente. L’installation exige d’autoriser les applications provenant de votre navigateur.",
  "Download Android APK": "Télécharger l’APK Android",
  "Preview {version} · APK": "Aperçu {version} · APK",
  "iOS Simulator preview": "Aperçu simulateur iOS",
  "Explore the iOS experience.": "Découvrez l’expérience iOS.",
  "For the iOS Simulator in Xcode on an Apple silicon Mac. This archive cannot be installed on an iPhone.":
    "Pour le simulateur iOS dans Xcode, sur un Mac à puce Apple. Cette archive ne peut pas être installée sur un iPhone.",
  "Download iOS Simulator build":
    "Télécharger la version pour le simulateur iOS",
  "Preview {version} · ARM64 archive": "Aperçu {version} · archive ARM64",
  "Public repository": "Dépôt public",
  "See how it’s made.": "Voyez comment c’est fait.",
  "Explore the source, architecture, development setup, and tests. Contributions and thoughtful feedback are welcome.":
    "Explorez le code source, l’architecture, l’environnement de développement et les tests. Les contributions et les commentaires réfléchis sont bienvenus.",
  "View on GitHub": "Voir sur GitHub",
  // Identical in French on purpose; see IDENTICAL_IN_BOTH above.
  "Next.js · Expo · TypeScript": "Next.js · Expo · TypeScript",
  "These are evaluation builds. Review the {limitations} before downloading. {checksums}.":
    "Ce sont des versions d’évaluation. Consultez les {limitations} avant de télécharger. {checksums}.",
  "known limitations and installation instructions":
    "limites connues et instructions d’installation",
  "Verify download checksums": "Vérifier les sommes de contrôle",

  // Footer
  "Ursly · Made for your next “aha”.":
    "Ursly · Conçu pour votre prochain déclic.",
  Pricing: "Tarifs",
  Price: "Prix",
  "How it works": "Comment ça marche",
  "Applications & GitHub": "Applications et GitHub",
  // Voice to action: listening, dictation and spoken search
  Speak: "Parler",
  Heard: "Entendu",
  "Send it": "Envoyer",
  Clear: "Effacer",
  "Press Speak, then ask your question out loud. Say “summarize this”, or just talk.":
    "Appuyez sur Parler, puis posez votre question à voix haute. Dites « résume ça », ou parlez simplement.",
  "Press Speak, then say a command such as “upload” or “YouTube”.":
    "Appuyez sur Parler, puis dites une commande comme « téléverse » ou « YouTube ».",
  "Heard “{spoken}” · {action}.": "Entendu « {spoken} » · {action}.",
  "Add a PDF or YouTube source first, then say it again.":
    "Ajoutez d’abord un PDF ou une vidéo YouTube, puis redites-le.",
  "Stopped listening.": "Écoute arrêtée.",
  "Cancelled. Nothing was sent.": "Annulé. Rien n’a été envoyé.",
  "Listening stopped when this page was hidden.":
    "L’écoute s’est arrêtée quand cette page a été masquée.",
  "Voice needs microphone access. Allow it in your browser, then press Speak again.":
    "La voix a besoin du microphone. Autorisez-le dans votre navigateur, puis appuyez de nouveau sur Parler.",
  "This browser does not recognise speech. The buttons below do the same things.":
    "Ce navigateur ne reconnaît pas la parole. Les boutons ci-dessous font la même chose.",
  "The microphone dropped out. Press Speak to pick it back up.":
    "Le microphone s’est interrompu. Appuyez sur Parler pour le reprendre.",
  "Start live voice chat": "Démarrer la conversation vocale en direct",
  "Send what I just said": "Envoyer ce que je viens de dire",
  "Stop listening or stop the answer": "Arrêter l’écoute ou arrêter la réponse",
  "Keep trigger phrases to {max} characters or fewer.":
    "Limitez les phrases déclencheuses à {max} caractères.",
  "“{phrase}” is already saved.": "« {phrase} » est déjà enregistrée.",
  "You can save up to {max} voice triggers.":
    "Vous pouvez enregistrer jusqu’à {max} déclencheurs vocaux.",
  "Saved “{phrase}”. Press Speak and say it.":
    "« {phrase} » est enregistrée. Appuyez sur Parler et dites-la.",
  "No saved triggers. The built-in wordings still work.":
    "Aucun déclencheur enregistré. Les formulations intégrées fonctionnent toujours.",
  "The phrases stay on this device. Every action is configurable, and the built-in wordings keep working alongside yours.":
    "Les phrases restent sur cet appareil. Chaque action est configurable, et les formulations intégrées continuent de fonctionner avec les vôtres.",
  "Live speech recognition is not available in this browser. The example buttons still run every action.":
    "La reconnaissance vocale en direct n’est pas offerte dans ce navigateur. Les boutons d’exemple exécutent quand même chaque action.",

  // Voice to action: finding a video without spelling a link
  "YouTube is ready — say the artist or title, or paste a link.":
    "YouTube est prêt — dites l’artiste ou le titre, ou collez un lien.",
  "Say the artist or the title, or paste a link. Watch pages, Shorts, share links and embeds all work.":
    "Dites l’artiste ou le titre, ou collez un lien. Les pages de visionnement, les Shorts, les liens de partage et les intégrations fonctionnent tous.",
  "Searching for “{query}”…": "Recherche de « {query} »…",
  "Opening “{title}”.": "Ouverture de « {title} ».",
  "Nothing captioned found for “{query}”. Try other words.":
    "Aucune vidéo sous-titrée trouvée pour « {query} ». Essayez d’autres mots.",
  "Not the one? Also found": "Ce n’est pas la bonne ? Aussi trouvé",
  "The video search timed out. Try again, or paste a link.":
    "La recherche de vidéos a expiré. Réessayez, ou collez un lien.",
  "The video search failed. Paste a link instead.":
    "La recherche de vidéos a échoué. Collez plutôt un lien.",

  // Conversation: reading, stopping and reusing an answer
  Copy: "Copier",
  Copied: "Copié",
  "Try again": "Réessayer",
  "Jump to latest": "Aller au plus récent",
  "Enter sends · Shift + Enter starts a new line":
    "Entrée envoie · Maj + Entrée insère un saut de ligne",
  "Copying is blocked in this browser. Select the text instead.":
    "La copie est bloquée dans ce navigateur. Sélectionnez plutôt le texte.",
  "Summarizing the key ideas.": "Résumé des idées clés en cours.",
  "Say your question first, then say “send it”.":
    "Dites d’abord votre question, puis dites « envoie ».",
  "Stopped.": "Arrêté.",
  // The apps, offered from the top menu
  "Get the app": "Obtenir l’appli",
  "Android APK": "APK Android",
  "Android 7.0 or later": "Android 7.0 ou plus récent",
  "iOS Simulator build": "Version pour le simulateur iOS",
  "Xcode Simulator, Apple silicon": "Simulateur Xcode, puce Apple",
  "All builds and instructions": "Toutes les versions et les instructions",
  "Release notes": "Notes de version",
  "Ask your question out loud, or say a command. It sends when you pause.":
    "Posez votre question à voix haute, ou dites une commande. L’envoi se fait quand vous marquez une pause.",
  "Say “upload”, or say “YouTube” and the artist or title you want.":
    "Dites « téléverse », ou dites « YouTube » suivi de l’artiste ou du titre voulu.",
  "Signed in as {email}": "Connecté en tant que {email}",
  "Your session has ended. Sign in again to pick up where you left off.":
    "Votre session est terminée. Connectez-vous de nouveau pour reprendre où vous étiez.",
  "You have used this account's allowance for now. It reopens shortly.":
    "Vous avez utilisé l’allocation de ce compte pour l’instant. Elle se rouvrira sous peu.",

  // Lending a voice. Everything below is said while a microphone is open or
  // just after, so it stays literal: what is happening, what is kept, and what
  // is not.
  "How Ursly answers": "Comment Ursly répond",
  "Ursly answers in a preset voice, and that asks nothing of you. You can lend it yours instead.":
    "Ursly répond avec une voix par défaut, et cela ne vous demande rien. Vous pouvez plutôt lui prêter la vôtre.",
  "Lend Ursly your voice": "Prêter votre voix à Ursly",
  "Ursly starts recording only after you press this, and keeps the recording only if you approve it.":
    "Ursly n’enregistre qu’après votre appui sur ce bouton, et ne conserve l’enregistrement que si vous l’approuvez.",
  "Ursly is recording your voice": "Ursly enregistre votre voix",
  "Ursly keeps this recording only if you approve it, so it can learn your voice. It has not been sent anywhere.":
    "Ursly ne conserve cet enregistrement que si vous l’approuvez, pour pouvoir apprendre votre voix. Il n’a été envoyé nulle part.",
  "Recorded so far: {seconds} s. That is enough to keep.":
    "Enregistré jusqu’ici : {seconds} s. C’est assez pour le conserver.",
  "Recorded so far: {seconds} s. Keep talking — Ursly needs at least {minimum} s.":
    "Enregistré jusqu’ici : {seconds} s. Continuez de parler — Ursly a besoin d’au moins {minimum} s.",
  "Keep the recording": "Conserver l’enregistrement",
  "Discard it": "Le supprimer",
  "Recording discarded. Nothing was kept.":
    "Enregistrement supprimé. Rien n’a été conservé.",
  "Ursly kept {seconds} seconds of your voice, in this browser and for as long as this page is open. Nothing was sent anywhere, and Ursly still answers in its preset voice: lending it a voice for real is a separate, deliberate step.":
    "Ursly a conservé {seconds} secondes de votre voix, dans ce navigateur et tant que cette page reste ouverte. Rien n’a été envoyé nulle part, et Ursly répond toujours avec sa voix par défaut : lui prêter une voix pour de bon est une démarche distincte et délibérée.",
  "Delete the recording": "Supprimer l’enregistrement",
  "Voice sample deleted. Ursly answers in its preset voice again.":
    "Échantillon vocal supprimé. Ursly répond de nouveau avec sa voix par défaut.",
  "The microphone handed back no audio, so nothing was kept. Lend your voice again to try once more.":
    "Le microphone n’a rendu aucun son, donc rien n’a été conservé. Prêtez votre voix de nouveau pour réessayer.",
  "Ursly could not open the microphone. Check the microphone permission in your browser and try again.":
    "Ursly n’a pas pu ouvrir le microphone. Vérifiez l’autorisation du microphone dans votre navigateur, puis réessayez.",
};
