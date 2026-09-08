import { Language, TranslationKey, translate, samples } from './src/i18n';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { ApiClient, apiOrigin, IngestedSource, Turn, updateTranscript } from './src/client';
import { NativeVoice, VoiceStatus } from './src/voice';
import { Brand, Orbit, palette as c, Reveal, serif, SourceIcon, Touch, useMotion, Wave } from './src/design';

const api = new ApiClient(apiOrigin(Platform.OS, process.env.EXPO_PUBLIC_API_URL));
function messageOf(error: string, t: (key: TranslationKey) => string) {
  const message = error;
  if (/valid YouTube URL/i.test(message)) return t("Ce lien ne semble pas être un lien YouTube. Vérifiez-le et réessayez.");
  if (/No captions/i.test(message)) return t("Cette vidéo ne propose pas de sous-titres. Essayez une autre vidéo ou un PDF.");
  if (/blocked/i.test(message)) return t("Les sous-titres sont temporairement inaccessibles. Essayez un PDF ou réessayez plus tard.");
  if (/25 MB/i.test(message)) return t("Choisissez un PDF de moins de 25 Mo.");
  if (/network|fetch|timed out|aborted/i.test(message)) return t("La connexion n’a pas abouti. Votre source est conservée : vous pouvez réessayer.");
  return (message && message !== 'unknown' ? message : '') || t("Un problème est survenu. Vous pouvez réessayer.");
}

export default function App() {
  const motion = useMotion();
  const [language, setLanguage] = useState<Language>('en');
  const t = (key: TranslationKey) => translate(language, key);
  const suggestions = (['Résumer l’essentiel', 'Expliquer simplement', 'Les idées à retenir'] as const).map(t);
  const statuses = { ended: t('À votre rythme'), connecting: t('Connexion…'), connected: t('Session active'), reconnecting: t('Reconnexion…'), error: t('Connexion interrompue') };
  const sampleText = samples[language];
  const [screen, setScreen] = useState<'home' | 'conversation'>('home');
  const [tab, setTab] = useState<'chat' | 'source'>('chat');
  const [sheet, setSheet] = useState<'youtube' | 'about' | null>(null);
  const [url, setUrl] = useState('');
  const [source, setSource] = useState<IngestedSource>();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'youtube' | 'chat' | null>(null);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<VoiceStatus>('ended');
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<'mock' | 'live' | 'unknown'>('unknown');
  const voice = useRef<NativeVoice | null>(null);
  const operation = useRef(0);
  const sequence = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const composer = useRef<TextInput>(null);
  const active = ['connecting', 'connected', 'reconnecting'].includes(status);

  useEffect(() => {
    let mounted = true;
    void api.request('/api/health', { method: 'GET' }).then(response => response.json()).then(health => {
      if (mounted && (health.mode === 'mock' || health.mode === 'live')) setMode(health.mode);
    }).catch(() => {});
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') { voice.current?.stop(); setMuted(false); } });
    return () => { mounted = false; operation.current++; listener.remove(); voice.current?.stop(); };
  }, []);

  function stop() { voice.current?.stop(); voice.current = null; setMuted(false); }
  function installSource(result: IngestedSource) {
    stop(); setSource(result); setTurns([]); setQuestion(''); setExpanded(false); setError(''); setTab('chat'); setSheet(null); setScreen('conversation');
  }
  async function ingest(kind: 'pdf' | 'youtube') {
    if (busy) return;
    const current = ++operation.current;
    setBusy(kind); setError(''); stop(); Keyboard.dismiss();
    try {
      let result: IngestedSource;
      if (kind === 'pdf') {
        const selection = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
        if (selection.canceled) return;
        result = await api.pdf(selection.assets[0]);
      } else result = await api.youtube(url);
      if (current === operation.current) installSource(result);
    } catch (caught) { if (current === operation.current) setError(caught instanceof Error ? caught.message : 'unknown'); }
    finally { if (current === operation.current) setBusy(null); }
  }
  async function ask() {
    if (!source || !question.trim() || busy) return;
    const current = operation.current;
    const submitted = question.trim();
    setBusy('chat'); setError(''); Keyboard.dismiss();
    try {
      const answer = await api.ask(source, submitted);
      if (current !== operation.current) return;
      const id = String(++sequence.current);
      setTurns(previous => [...previous, { id: id + 'u', role: 'user', text: submitted }, { id: id + 'a', role: 'assistant', text: answer }]);
      setQuestion('');
    } catch (caught) { if (current === operation.current) setError(caught instanceof Error ? caught.message : 'unknown'); }
    finally { if (current === operation.current) setBusy(null); }
  }
  function startVoice() {
    if (!source || busy) return;
    stop(); setError(''); Keyboard.dismiss();
    voice.current = new NativeVoice(api, source, setStatus, event => {
      if (event.type === 'mock.ready') setMode('mock');
      else setTurns(previous => updateTranscript(previous, event));
    }, caught => setError(caught));
    void voice.current.start();
  }
  function trySample() {
    operation.current++;
    installSource({ kind: 'pdf', sourceName: t("Le pouvoir des petites pauses"), text: sampleText, characters: sampleText.length });
  }
  const notice = error ? <Reveal motion={motion} style={s.error}><Text accessibilityRole="alert" style={s.errorText}>{messageOf(error, t)}</Text><Touch label={t("Fermer le message")} motion={motion} onPress={() => setError('')}><Text style={s.errorText}>×</Text></Touch></Reveal> : null;

  return <SafeAreaProvider><StatusBar barStyle="dark-content" /><SafeAreaView style={s.screen} edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {screen === 'home' ? <ScrollView key="home" contentContainerStyle={s.homeContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.header}><Brand /><Touch label={t("À propos d’Ursly")} onPress={() => setSheet('about')} motion={motion} style={s.infoButton}><Text style={s.tabLabel}>{language.toUpperCase()}</Text></Touch></View>
        <Reveal motion={motion} style={s.hero}>
          <View style={s.rowBetween}><Text style={s.heroEyebrow}>{t("UN PEU PLUS DE CLARTÉ")}</Text><View style={s.smallDot} /></View>
          <View style={s.heroMain}><Text style={s.heroTitle}>{t("Vos idées.")}{ '\n' }<Text style={{ color: c.lime }}>{t("Plus claires.")}</Text></Text><View style={s.heroArt}><Orbit motion={motion} /></View></View>
          <Text style={s.heroDescription}>{t("Un document. Une vidéo.")}{ '\n' }{t("Et la conversation commence.")}</Text>
          <View style={s.heroFooter}><View style={s.heroLine} /><Text style={s.heroFooterText}>{t("Moins défiler. Mieux comprendre.")}</Text></View>
        </Reveal>
        <Reveal motion={motion} delay={70}>
          <View style={s.sectionHeading}><Text style={s.heading}>{t("On explore quoi ?")}</Text><Text style={s.sectionNote}>{t("À vous de choisir")}</Text></View>
          <View style={s.importRow}>
            <Touch label={t("Importer un PDF")} onPress={() => void ingest('pdf')} motion={motion} disabled={!!busy} style={[s.importCard, { backgroundColor: c.peach }]}>
              <View style={s.importInner}><View style={s.rowBetween}><View style={s.iconTile}><SourceIcon kind="pdf" /></View><Text style={s.diagonalArrow}>↗</Text></View><View><Text style={s.importTitle}>{t("Un document")}</Text><Text style={s.importCaption}>{t("PDF · jusqu’à 25 Mo")}</Text></View></View>
            </Touch>
            <Touch label={t("Ajouter une vidéo YouTube")} onPress={() => { setError(''); setSheet('youtube'); }} motion={motion} disabled={!!busy} style={[s.importCard, { backgroundColor: c.lavender }]}>
              <View style={s.importInner}><View style={s.rowBetween}><View style={s.iconTile}><SourceIcon kind="youtube" /></View><Text style={s.diagonalArrow}>↗</Text></View><View><Text style={s.importTitle}>{t("Une vidéo")}</Text><Text style={s.importCaption}>{t("Collez un lien YouTube")}</Text></View></View>
            </Touch>
          </View>
        </Reveal>
        {busy && <View style={s.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={c.ink} /><Text style={s.body}>{t("On prépare votre source…")}</Text></View>}
        {notice}
        {source ? <Reveal motion={motion} delay={100}><Touch label={t("Reprendre la conversation")} onPress={() => setScreen('conversation')} motion={motion} disabled={!!busy} style={s.resume}><View style={s.resumeInner}><View style={s.resumeIcon}><SourceIcon kind={source.kind} /></View><View style={s.flex}><Text style={s.eyebrow}>{t("ON REPREND ?")}</Text><Text numberOfLines={2} style={s.resumeTitle}>{source.sourceName}</Text></View><Text style={s.diagonalArrow}>→</Text></View></Touch></Reveal> :
          <Reveal motion={motion} delay={140}><Touch label={t("Essayer avec un texte de découverte")} onPress={trySample} motion={motion} disabled={!!busy} style={s.sample}><View style={s.resumeInner}><View style={s.sampleStar}><Text style={s.star}>✦</Text></View><View style={s.flex}><Text style={s.sampleTitle}>{t("Juste pour essayer")}</Text><Text style={s.caption}>{t("Découvrez Ursly avec un court texte.")}</Text></View><Text style={s.diagonalArrow}>→</Text></View></Touch></Reveal>}
        <Reveal motion={motion} delay={180} style={s.how}><Text style={s.eyebrow}>{t("UNE NOUVELLE FAÇON D’APPRENDRE")}</Text><View style={s.steps}>{[['01', t("Ajoutez")], ['02', t("Questionnez")], ['03', t("Comprenez")]].map(([number, label]) => <View key={number} style={s.step}><Text style={s.stepNumber}>{number}</Text><Text style={s.stepText}>{label}</Text></View>)}</View></Reveal>
        <Text style={s.signature}>{t("Faites de la place aux déclics.")}</Text>
        {mode === 'mock' && <Text style={s.demoFootnote}>{t("Espace de démonstration · réponses et audio simulés")}</Text>}
      </ScrollView> : <>
        <View style={s.workspaceHeader}><Touch label={t("Retour aux sources")} onPress={() => { stop(); setScreen('home'); Keyboard.dismiss(); }} motion={motion} disabled={!!busy}><Text style={s.back}>‹ <Text style={s.backLabel}>{t("Sources")}</Text></Text></Touch><Brand small /><Touch label={t("À propos d’Ursly")} onPress={() => setSheet('about')} motion={motion} style={{ width: 84 }}><Text style={s.tabLabel}>{language.toUpperCase()}</Text></Touch></View>
        <View style={s.tabs}>{(['chat', 'source'] as const).map(value => <Touch key={value} label={value === 'chat' ? t("Conversation") : t("La source")} onPress={() => { setTab(value); Keyboard.dismiss(); }} selected={tab === value} motion={motion} style={[s.tab, tab === value && s.tabSelected]}><Text style={[s.tabLabel, tab === value && { color: c.ink }]}>{value === 'chat' ? t("Conversation") : t("La source")}</Text></Touch>)}</View>
        <ScrollView key={tab} ref={scroll} contentContainerStyle={s.chatContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          onContentSizeChange={() => { if (tab === 'chat' && turns.length) scroll.current?.scrollToEnd({ animated: motion }); }}>
          {source && <Reveal motion={motion} style={s.sourceSummary}><View style={s.sourceBadge}><SourceIcon kind={source.kind} /></View><View style={s.flex}><Text style={s.eyebrow}>{source.kind === 'youtube' ? t("VIDÉO YOUTUBE") : t("VOTRE DOCUMENT")}</Text><Text style={s.sourceName} numberOfLines={tab === 'chat' ? 2 : undefined}>{source.sourceName}</Text><Text style={s.caption}>{source.characters.toLocaleString(language === 'en' ? 'en-CA' : 'fr-CA')}{language === 'en' ? ' characters · ready to explore' : ' caractères · prêt à explorer'}</Text></View></Reveal>}
          {tab === 'source' ? <Reveal motion={motion} delay={60} style={s.readingCard}><Text style={s.readingTitle}>{t("Tout commence ici.")}</Text><Text style={s.readingHint}>{t("Le texte de votre source, à garder sous les yeux.")}</Text><Text selectable style={s.sourceText}>{expanded ? source?.text : (source?.text.slice(0, 600) ?? '') + ((source?.text.length ?? 0) > 600 ? '…' : '')}</Text>{(source?.text.length ?? 0) > 600 && <Touch label={expanded ? t("Réduire le texte") : t("Lire tout le texte")} motion={motion} onPress={() => setExpanded(!expanded)} style={s.outline}><Text style={s.buttonInk}>{expanded ? t("Réduire le texte ↑") : t("Lire tout le texte ↓")}</Text></Touch>}<Touch label={t("Poser une question sur cette source")} motion={motion} onPress={() => setTab('chat')} style={s.primary}><Text style={s.buttonInk}>{t("Parlons-en →")}</Text></Touch></Reveal> : <>
            <Reveal motion={motion} delay={65} style={s.voiceCard}>
              <View style={s.rowBetween}><View style={s.flex}><Text style={s.voiceEyebrow}>{t("LE PLAISIR DE COMPRENDRE")}</Text><Text style={s.voiceTitle}>{active ? t("On en parle.") : t("À voix haute.")}</Text></View><Wave motion={motion && active && !muted} color={c.coral} large /></View>
              <View style={s.statusRow}><View style={[s.statusDot, { backgroundColor: status === 'error' ? c.coral : active ? c.lime : c.lilac }]} /><Text accessibilityLiveRegion="polite" style={s.statusText}>{muted ? t("Micro coupé") : statuses[status]}</Text>{(status === 'connecting' || status === 'reconnecting') && <ActivityIndicator size="small" color={c.lime} />}</View>
              {active ? <><View style={s.voiceButtons}><Touch label={muted ? t("Réactiver le micro") : t("Couper le micro")} motion={motion} onPress={() => { voice.current?.setMuted(!muted); setMuted(!muted); }} disabled={status !== 'connected'} style={s.secondaryDark}><Text style={s.buttonLight}>{muted ? t("Réactiver") : t("Muet")}</Text></Touch><Touch label={t("Arrêter la session")} motion={motion} onPress={stop} style={s.primary}><Text style={s.buttonInk}>{t("■  Terminer")}</Text></Touch></View><Touch label={t("Continuer par écrit")} motion={motion} onPress={() => { stop(); composer.current?.focus(); }}><Text style={s.textLinkLight}>{t("Continuer par écrit")}</Text></Touch></> :
                <Touch label={t("Démarrer la conversation vocale")} motion={motion} onPress={startVoice} disabled={!!busy} style={s.primary}><View style={s.buttonRow}><Wave motion={false} /><Text style={s.buttonInk}>{t("Parlons-en")}</Text><Text style={s.arrow}>↗</Text></View></Touch>}
              {mode === 'mock' && <Text style={s.demoNotice}>{t("Mode démo · la voix et les réponses sont simulées.")}</Text>}
            </Reveal>
            {notice}
            {!turns.length && <Reveal motion={motion} delay={100} style={s.conversationEmpty}><Text style={s.emptyTitle}>{t("La bonne question,")}{ '\n' }{t("c’est la vôtre.")}</Text><Text style={s.emptyCaption}>{t("Un détail à éclaircir, une idée à creuser…")}</Text><View style={s.suggestions}>{suggestions.map((prompt, index) => <Touch key={prompt} label={prompt} motion={motion} disabled={!!busy} onPress={() => { setQuestion(prompt); composer.current?.focus(); }} style={s.suggestion}><View style={s.suggestionInner}><Text style={[s.suggestionSymbol, { color: ['#A9513A', '#71608D', '#536C39'][index] }]}>{['✦', '≈', '↗'][index]}</Text><Text style={s.suggestionText}>{prompt}</Text><Text style={s.suggestionArrow}>+</Text></View></Touch>)}</View></Reveal>}
            {turns.map(turn => <Reveal key={turn.id} motion={motion} style={[s.message, turn.role === 'user' ? s.userMessage : s.assistantMessage]}><View style={s.messageHeader}>{turn.role === 'assistant' && <View style={s.miniBrand}><Wave motion={false} color={c.coral} /></View>}<Text style={s.messageRole}>{turn.role === 'user' ? t("VOUS") : 'URSLY'}</Text></View><Text selectable style={s.messageText}>{turn.text}</Text></Reveal>)}
            {busy === 'chat' && <View style={s.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={c.coral} /><Text style={s.caption}>{t("Ursly prépare une réponse…")}</Text></View>}
          </>}
        </ScrollView>
        {tab === 'chat' && <View style={s.composerWrap}><View style={s.composer}><TextInput ref={composer} accessibilityLabel={t("Votre question")} placeholder={t("Et vous, qu’en pensez-vous ?")} placeholderTextColor={c.muted} value={question} onChangeText={setQuestion} multiline style={s.questionInput} editable={!busy} /><Touch label={t("Envoyer la question")} motion={motion} onPress={() => void ask()} disabled={!!busy || !question.trim()} style={s.send}>{busy === 'chat' ? <ActivityIndicator color={c.ink} /> : <Text style={s.sendArrow}>↑</Text>}</Touch></View><Text style={s.composerHint}>{t("Ancré dans votre source. À explorer avec votre regard.")}</Text></View>}
      </>}
    </KeyboardAvoidingView>
    <Modal visible={sheet !== null} transparent animationType={motion ? 'slide' : 'none'} onRequestClose={() => { if (!busy) setSheet(null); }}>
      <KeyboardAvoidingView style={s.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Fermer la fenêtre")} style={s.scrim} disabled={!!busy} onPress={() => setSheet(null)} />
        <SafeAreaView style={s.sheet} edges={['bottom']}><ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 18, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><View style={s.sheetHandle} /><View style={s.rowBetween}><Text style={s.sheetTitle}>{sheet === 'youtube' ? t("Une vidéo, des idées.") : t("Enchanté, nous c’est Ursly.")}</Text><Touch label={t("Fermer")} onPress={() => setSheet(null)} motion={motion} disabled={!!busy}><Text style={s.close}>×</Text></Touch></View>
          {sheet === 'about' && <View style={{ gap: 10 }}><Text style={s.aboutTitle}>{t('Langue de l’application')}</Text><View style={{ flexDirection: 'row', gap: 8 }}>{(['en', 'fr'] as const).map(value => <Touch key={value} label={value === 'en' ? 'English' : 'Français'} selected={language === value} motion={motion} onPress={() => setLanguage(value)} style={[s.tab, { backgroundColor: language === value ? c.lavender : c.white }]}><Text style={s.tabLabel}>{value === 'en' ? 'English' : 'Français'}{language === value ? ' ✓' : ''}</Text></Touch>)}</View></View>}
          {sheet === 'youtube' ? <><Text style={s.sheetCaption}>{t("Collez un lien YouTube avec des sous-titres.")}{ '\n' }{t("On s’occupe du texte, vous gardez la curiosité.")}</Text><TextInput accessibilityLabel={t("Lien YouTube")} placeholder="https://youtube.com/watch?v=…" placeholderTextColor={c.muted} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={() => { if (url.trim()) void ingest('youtube'); }} style={s.urlInput} editable={!busy} />{notice}<Touch label={t("Charger la vidéo")} motion={motion} onPress={() => void ingest('youtube')} disabled={!!busy || !url.trim()} style={s.primary}><View style={s.buttonRow}>{busy === 'youtube' && <ActivityIndicator color={c.ink} />}<Text style={s.buttonInk}>{busy === 'youtube' ? t("Préparation en cours…") : t("Explorer cette vidéo →")}</Text></View></Touch></> : <><Text style={s.sheetCaption}>{t("Vos documents et vos vidéos ont des choses à vous dire. Ursly vous aide à les explorer, une question à la fois.")}</Text><View style={s.aboutNote}><Text style={s.aboutTitle}>{t("Votre curiosité fait le reste.")}</Text><Text style={s.body}>{t("Importez une source, retrouvez son texte et échangez à l’écrit ou à la voix. L’historique de cet espace reste dans la session en cours.")}</Text></View><Text style={s.caption}>{mode === 'mock' ? t("Cet espace utilise des réponses, des sous-titres et de l’audio de démonstration.") : t("La voix nécessite un accès au microphone et un service connecté.")}</Text><Text style={s.caption}>{t("Les animations respectent les préférences d’accessibilité de votre appareil.")}</Text></>}
        </ScrollView></SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView></SafeAreaProvider>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.paper }, flex: { flex: 1 },
  homeContent: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 25, gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 },
  infoButton: { borderRadius: 24, backgroundColor: '#EEE9E1', width: 45, height: 45 }, infoLetter: { fontFamily: serif, fontSize: 20, color: c.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  hero: { backgroundColor: c.ink, borderRadius: 29, padding: 23, overflow: 'hidden' },
  heroEyebrow: { color: '#D4CBDC', fontSize: 10, letterSpacing: 1.6, fontWeight: '700' }, smallDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.lime },
  heroMain: { flexDirection: 'row', alignItems: 'center', minHeight: 156, marginTop: 8 },
  heroTitle: { fontFamily: serif, fontSize: 37, lineHeight: 43, letterSpacing: -1.7, color: c.paper, flex: 1, zIndex: 1 },
  heroArt: { width: 113, height: 142, justifyContent: 'center', alignItems: 'center', transform: [{ scale: 0.78 }], marginRight: -7 },
  heroDescription: { color: '#E3DDE6', fontSize: 15, lineHeight: 22, marginTop: -3 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }, heroLine: { width: 22, height: 1, backgroundColor: c.coral }, heroFooterText: { color: '#CDC3D4', fontSize: 11 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 13 }, heading: { fontSize: 21, fontWeight: '700', letterSpacing: -0.6, color: c.ink }, sectionNote: { fontSize: 11, color: c.muted },
  importRow: { flexDirection: 'row', gap: 12 }, importCard: { flex: 1, borderRadius: 23 }, importInner: { width: '100%', padding: 3, gap: 22 },
  iconTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF70', alignItems: 'center', justifyContent: 'center' }, diagonalArrow: { fontSize: 24, color: c.ink, fontWeight: '300' },
  importTitle: { fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.4 }, importCaption: { marginTop: 6, color: '#615767', fontSize: 11, lineHeight: 16 },
  sample: { backgroundColor: c.white, borderRadius: 21, borderWidth: 1, borderColor: c.line }, resumeInner: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 12 },
  sampleStar: { width: 39, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EDF0DF' }, star: { fontSize: 27, color: '#677C4A' },
  sampleTitle: { fontSize: 14, fontWeight: '700', color: c.ink, marginBottom: 4 }, caption: { fontSize: 12, color: c.muted, lineHeight: 18 },
  how: { paddingHorizontal: 2, paddingTop: 1 }, eyebrow: { fontSize: 9, letterSpacing: 1.3, color: c.muted, fontWeight: '700' },
  steps: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16 }, step: { flexDirection: 'row', alignItems: 'center', gap: 6 }, stepNumber: { fontFamily: serif, color: '#948391', fontSize: 17 }, stepText: { fontSize: 11, color: c.ink },
  signature: { color: '#7A707A', fontFamily: serif, fontStyle: 'italic', fontSize: 16, textAlign: 'center', paddingTop: 3 }, demoFootnote: { textAlign: 'center', fontSize: 10, color: c.muted, marginTop: -12 },
  resume: { backgroundColor: c.lavender, borderRadius: 22 }, resumeIcon: { width: 40, height: 43, alignItems: 'center', justifyContent: 'center' }, resumeTitle: { fontSize: 14, fontWeight: '600', color: c.ink, marginTop: 4 },
  loading: { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, body: { fontSize: 14, lineHeight: 22, color: c.muted },
  error: { paddingLeft: 15, borderRadius: 16, backgroundColor: c.errorBg, flexDirection: 'row', alignItems: 'center' }, errorText: { flex: 1, fontSize: 13, lineHeight: 20, color: c.error },
  workspaceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8 }, back: { color: c.ink, fontSize: 28 }, backLabel: { fontSize: 13, fontWeight: '600' },
  tabs: { marginHorizontal: 22, padding: 4, borderRadius: 18, backgroundColor: '#EEEAE4', flexDirection: 'row', gap: 3 }, tab: { flex: 1, borderRadius: 14 }, tabSelected: { backgroundColor: c.white, shadowColor: '#302837', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }, tabLabel: { color: c.muted, fontSize: 13, fontWeight: '600' },
  chatContent: { padding: 22, gap: 18, paddingBottom: 28 }, sourceSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 20, backgroundColor: c.lavender }, sourceBadge: { backgroundColor: '#F8F4FD', width: 44, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, sourceName: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: c.ink, marginVertical: 3 },
  voiceCard: { backgroundColor: c.ink, borderRadius: 25, padding: 21, gap: 15 }, voiceEyebrow: { color: '#C9BECF', fontSize: 8, letterSpacing: 1.1, fontWeight: '700' }, voiceTitle: { fontFamily: serif, color: c.paper, fontSize: 33, letterSpacing: -0.8, marginTop: 7 }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, statusDot: { height: 6, width: 6, borderRadius: 4 }, statusText: { fontSize: 12, color: '#E1D9E8' }, voiceButtons: { flexDirection: 'row', gap: 10 }, secondaryDark: { flex: 1, borderWidth: 1, borderColor: '#6D6576', borderRadius: 16 },
  primary: { backgroundColor: c.coral, borderRadius: 17, flexGrow: 1 }, buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, buttonInk: { color: c.ink, fontSize: 15, fontWeight: '700' }, buttonLight: { color: c.paper, fontSize: 14, fontWeight: '600' }, arrow: { fontSize: 23, color: c.ink, marginLeft: 6 }, textLinkLight: { color: '#E1D9E8', fontSize: 13, textDecorationLine: 'underline' }, demoNotice: { color: '#D1C4D5', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  conversationEmpty: { paddingVertical: 8 }, emptyTitle: { fontFamily: serif, fontSize: 27, color: c.ink, lineHeight: 34, letterSpacing: -0.5 }, emptyCaption: { fontSize: 13, color: c.muted, marginTop: 8, lineHeight: 19 }, suggestions: { gap: 8, marginTop: 18 }, suggestion: { backgroundColor: c.white, borderWidth: 1, borderColor: c.line, borderRadius: 15 }, suggestionInner: { flexDirection: 'row', gap: 11, alignItems: 'center', width: '100%' }, suggestionSymbol: { fontSize: 23, width: 25, textAlign: 'center' }, suggestionText: { flex: 1, fontSize: 13, color: c.ink }, suggestionArrow: { color: c.muted, fontSize: 18 },
  message: { borderRadius: 21, padding: 18, gap: 10 }, userMessage: { backgroundColor: c.lavender, marginLeft: 26, borderBottomRightRadius: 6 }, assistantMessage: { backgroundColor: c.white, borderWidth: 1, borderColor: c.line, marginRight: 12, borderBottomLeftRadius: 6 }, messageHeader: { flexDirection: 'row', gap: 7, alignItems: 'center' }, messageRole: { color: '#75677E', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 }, miniBrand: { height: 18, width: 23, transform: [{ scale: 0.65 }] }, messageText: { color: c.ink, fontSize: 15, lineHeight: 24 },
  composerWrap: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 5, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.paper }, composer: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderColor: '#DCD3CB', borderRadius: 23, backgroundColor: c.white, padding: 6 }, questionInput: { flex: 1, color: c.ink, fontSize: 14, padding: 11, paddingTop: 13, minHeight: 46, maxHeight: 124 }, send: { backgroundColor: c.coral, borderRadius: 18, width: 46, height: 46 }, sendArrow: { fontSize: 25, color: c.ink, fontWeight: '500' }, composerHint: { color: c.muted, fontSize: 9, textAlign: 'center', marginTop: 7 },
  readingCard: { backgroundColor: c.white, padding: 21, borderRadius: 24, gap: 17 }, readingTitle: { fontFamily: serif, color: c.ink, fontSize: 27 }, readingHint: { color: c.muted, fontSize: 13, lineHeight: 20 }, sourceText: { color: c.ink, fontSize: 16, lineHeight: 28 }, outline: { borderWidth: 1, borderColor: c.line, borderRadius: 15 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#201A2B80' }, sheet: { padding: 24, gap: 18, backgroundColor: c.paper, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '90%' }, sheetHandle: { alignSelf: 'center', backgroundColor: '#CFC7C0', width: 34, height: 4, borderRadius: 3 }, sheetTitle: { flex: 1, fontFamily: serif, fontSize: 26, color: c.ink }, close: { color: c.ink, fontSize: 26 }, sheetCaption: { color: c.muted, fontSize: 14, lineHeight: 22 }, urlInput: { backgroundColor: c.white, borderColor: '#C9C0D0', borderWidth: 1, borderRadius: 17, padding: 17, fontSize: 14, color: c.ink, minHeight: 54 }, aboutNote: { backgroundColor: c.lavender, padding: 18, borderRadius: 20, gap: 9 }, aboutTitle: { color: c.ink, fontWeight: '700', fontSize: 17 },
});
