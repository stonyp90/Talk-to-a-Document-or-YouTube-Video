import React, { useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { ApiClient, apiOrigin, IngestedSource, Turn, updateTranscript } from './src/client';
import { NativeVoice, VoiceStatus } from './src/voice';

const api = new ApiClient(apiOrigin(Platform.OS, process.env.EXPO_PUBLIC_API_URL));
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please retry.';
function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
export default function App() {
  const [url, setUrl] = useState('');
  const [source, setSource] = useState<IngestedSource>();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<VoiceStatus>('ended');
  const [muted, setMuted] = useState(false);
  const [mock, setMock] = useState(false);
  const voice = useRef<NativeVoice | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') voice.current?.stop(); });
    return () => { listener.remove(); voice.current?.stop(); };
  }, []);
  function stop() { voice.current?.stop(); voice.current = null; setMuted(false); }
  async function ingest(kind: 'pdf' | 'youtube') {
    if (busy) return;
    setBusy(true); setError(''); stop();
    try {
      let result: IngestedSource;
      if (kind === 'pdf') {
        const selection = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
        if (selection.canceled) return;
        result = await api.pdf(selection.assets[0]);
      } else result = await api.youtube(url);
      setSource(result); setTurns([]); setExpanded(false); setMock(false);
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  async function ask() {
    if (!source || !question.trim() || busy) return;
    const submitted = question.trim();
    setBusy(true); setError('');
    try {
      const answer = await api.ask(source, submitted);
      const id = String(++sequence.current);
      setTurns(previous => [...previous, { id: id + 'u', role: 'user', text: submitted }, { id: id + 'a', role: 'assistant', text: answer }]);
      setQuestion('');
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  function startVoice() {
    if (!source) return;
    stop(); setError(''); setMock(false);
    voice.current = new NativeVoice(api, source, setStatus, event => {
      if (event.type === 'mock.ready') setMock(true);
      else setTurns(previous => updateTranscript(previous, event));
    }, setError);
    void voice.current.start();
  }
  const active = ['connecting', 'connected', 'reconnecting'].includes(status);
  return <SafeAreaProvider><SafeAreaView style={styles.screen}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>YOUR SOURCES. YOUR QUESTIONS.</Text>
      <Text style={styles.title}>Talk to a source</Text>
      <Text style={styles.subtitle}>Bring a PDF or YouTube video. Explore it through conversation.</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>1. Add your source</Text>
        <Button label="Choose PDF" onPress={() => void ingest('pdf')} disabled={busy} />
        <Text style={styles.hint}>PDF · up to 25 MB · selectable text</Text>
        <TextInput accessibilityLabel="YouTube URL" placeholder="Paste a YouTube URL" placeholderTextColor="#667085" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} editable={!busy} />
        <Button label="Load YouTube" onPress={() => void ingest('youtube')} disabled={busy || !url.trim()} />
        {busy && <Text accessibilityLiveRegion="polite">Working…</Text>}
      </View>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error} You can retry or use text chat.</Text>}
      {source && <>
        <View style={styles.card}>
          <Text style={styles.heading}>{source.sourceName}</Text>
          <Text style={styles.hint}>{source.characters.toLocaleString()} characters ready</Text>
          <Button label={expanded ? 'Collapse preview' : 'Expand preview'} onPress={() => setExpanded(!expanded)} />
          <Text selectable>{expanded ? source.text : source.text.slice(0, 240) + (source.text.length > 240 ? '…' : '')}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>2. Let’s talk</Text>
          <Text accessibilityLiveRegion="polite">Voice: {status}</Text>
          {mock && <Text style={styles.hint}>Demo session: audio is simulated. Ask through text below.</Text>}
          {!active && <Button label="Start Voice Chat" onPress={startVoice} disabled={busy} />}
          {active && <View style={styles.row}>
            <Button label={muted ? 'Unmute' : 'Mute'} onPress={() => { voice.current?.setMuted(!muted); setMuted(!muted); }} disabled={status !== 'connected'} />
            <Button label="Stop" onPress={stop} />
          </View>}
          {active && <Button label="Use text chat" onPress={stop} />}
          <Text style={styles.hint}>Text chat is always available, including when microphone access is denied.</Text>
          {turns.map(turn => <View key={turn.id} style={[styles.turn, turn.role === 'user' && styles.userTurn]}><Text style={styles.role}>{turn.role === 'user' ? 'You' : 'Assistant'}</Text><Text selectable>{turn.text}</Text></View>)}
          <TextInput accessibilityLabel="Your question" placeholder="Ask about your source…" placeholderTextColor="#667085" value={question} onChangeText={setQuestion} multiline style={styles.input} editable={!busy} />
          <Button label="Send question" onPress={() => void ask()} disabled={busy || !question.trim()} />
        </View>
      </>}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6f2' }, content: { padding: 22, gap: 18 },
  eyebrow: { fontSize: 11, letterSpacing: 1.8, color: '#426655', fontWeight: '700' },
  title: { fontSize: 36, fontWeight: '700', color: '#193d32' }, subtitle: { fontSize: 17, lineHeight: 25, color: '#53665e' },
  card: { padding: 18, gap: 14, borderRadius: 20, backgroundColor: '#fff' }, heading: { fontSize: 20, fontWeight: '600', color: '#193d32' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#aab9b1', borderRadius: 12, padding: 14, color: '#172b23', backgroundColor: '#fff' },
  button: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#235c46', borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' }, disabled: { opacity: 0.4 },
  hint: { fontSize: 13, lineHeight: 19, color: '#52665b' }, error: { color: '#a12020', padding: 12, backgroundColor: '#fff0ee', borderRadius: 12 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' }, turn: { padding: 14, borderRadius: 12, backgroundColor: '#f1f3f0', gap: 6 },
  userTurn: { backgroundColor: '#e5f1e9' }, role: { fontSize: 12, fontWeight: '700', color: '#426655' },
});
