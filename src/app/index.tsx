// 대화 화면. 캐릭터가 없으면 캐릭터 화면으로 보낸다(백엔드도 캐릭터가 있어야 대화 기록을 돌려준다).
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Link, Redirect, router, Stack, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorView, Loading } from '@/components/StatusView';
import {
  api,
  streamChat,
  type Character,
  type ChatEvent,
  type Credits,
  type MemoryEvent,
  type Message,
  NoCreditsError,
  type Products,
  type PhotoFile,
  readPhoto,
  type ReminderEvent,
} from '@/lib/api';
import { takePhoto } from '@/lib/photoInbox';
import { useSession } from '@/lib/session';
import { dateLabel, parseTime, sameDay, timeLabel } from '@/lib/time';

// 사진에서 읽은 글 앞에 붙이는 문장. 같은 백엔드의 웹 화면과 같다.
const OCR_PREFIX = '사진에서 읽은 글이야. 여기 있는 일정 중에 알려 줘야 할 게 있으면 약속으로 저장해 줘.';

// 답 아래에 붙일 메모 문구. 같은 백엔드의 웹 화면과 같은 말을 쓴다.
function notesFrom(event: ChatEvent): string[] {
  if (event.type === 'reminder') {
    const e = event as ReminderEvent;
    return [(e.action === 'cancel_reminder' ? '🗑 ' : '⏰ ') + e.summary];
  }
  if (event.type === 'memory') {
    const e = event as MemoryEvent;
    return [
      ...(e.added ?? []).map((m) => `🧠 기억함: ${m}`),
      ...(e.updated ?? []).map((m) => `🧠 기억 수정: ${m}`),
      ...(e.removed ?? []).map((m) => `🧠 잊음: ${m}`),
    ];
  }
  return [];
}

export default function ChatScreen() {
  const session = useSession();
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'error') return <ErrorView message={session.message} retry={session.retry} />;
  if (!session.me.has_character) return <Redirect href="/character" />;
  return <Chat ocrEnabled={session.config.ocr_enabled === true} />;
}

function Chat({ ocrEnabled }: { ocrEnabled: boolean }) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false); // 사진 글자를 읽는 중
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // 크레딧이 없어 보내지 못했을 때 안내(서버 문구)
  const [balance, setBalance] = useState<number | null>(null); // 남은 크레딧. 크레딧 API 가 없는 백엔드면 null
  const [lowCredits, setLowCredits] = useState<number | null>(null); // 이만큼 이하면 「얼마 남지 않았어요」 띠
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [, requestCameraPermission, getCameraPermission] = useCameraPermissions();

  // 잔액을 다시 읽는다. 크레딧 API 가 없거나 실패하면 배지와 띠를 숨긴 채 둔다
  const refreshCredits = useCallback(async () => {
    try {
      setBalance((await api<Credits>('/api/credits')).balance);
    } catch {
      setBalance(null);
    }
  }, []);

  // 사진을 /api/ocr 로 읽어 입력창에 넣는다. 바로 보내지 않고, 사용자가 읽은 글을 확인하고 고친 뒤 보낸다
  const readAndFill = useCallback(async (photo: PhotoFile) => {
    setReading(true);
    setError(null);
    try {
      const text = await readPhoto(photo);
      setInput(`${OCR_PREFIX}\n${text}`);
    } catch (e) {
      Alert.alert('사진에서 글자를 읽지 못했어요', String((e as Error).message ?? e));
    } finally {
      setReading(false);
    }
  }, []);

  // 카메라 화면에서 돌아왔을 때 찍은 사진이 있으면 읽는다
  useFocusEffect(
    useCallback(() => {
      const photo = takePhoto();
      if (photo) readAndFill(photo);
    }, [readAndFill]),
  );

  const pickFromLibrary = async () => {
    // 사진첩에서 고를 때는 권한을 묻지 않는다(SDK 58 문서). 백엔드가 5MB 넘는 사진을 받지 않아 조금 압축한다
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled) return;
    const asset = result.assets[0];
    await readAndFill({ uri: asset.uri });
  };

  const openCamera = async () => {
    // 폰 설정에서 권한을 바꾸고 돌아왔을 수 있어, 누를 때마다 지금 상태를 다시 읽는다
    let permission = await getCameraPermission();
    if (!permission.granted && permission.canAskAgain) {
      permission = await requestCameraPermission();
    }
    if (!permission?.granted) {
      // 안내 문구는 임시 초안
      Alert.alert('카메라를 쓸 수 없어요', '카메라 권한이 꺼져 있어요. 설정에서 카메라를 허용하면 일정표를 바로 찍을 수 있어요.', [
        { text: '취소', style: 'cancel' },
        { text: '설정 열기', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    router.push('/camera');
  };

  const choosePhoto = () =>
    Alert.alert('사진으로 약속 만들기', undefined, [
      { text: '사진첩에서 고르기', onPress: pickFromLibrary },
      { text: '카메라로 찍기', onPress: openCamera },
      { text: '취소', style: 'cancel' },
    ]);

  useEffect(() => {
    (async () => {
      try {
        const [c, history] = await Promise.all([
          api<{ character: Character }>('/api/character'),
          api<Message[]>('/api/messages'),
        ]);
        setCharacter(c.character);
        setMessages(history.map(({ id, role, content, created_at }) => ({ id, role, content, created_at })));
      } catch (e) {
        setError(String((e as Error).message ?? e));
      }
    })();
    refreshCredits();
    // 띠 기준도 서버 값을 쓴다(웹과 같음). 못 읽으면 띠를 안 보여 준다
    api<Products>('/api/products')
      .then((p) => setLowCredits(p.low_credits))
      .catch(() => setLowCredits(null));
  }, [refreshCredits]);

  // 마지막 메시지(답을 받는 중인 메시지)의 글자를 이어 붙인다
  const appendToLast = (text: string) =>
    setMessages((prev) => {
      const next = prev.slice();
      const last = next[next.length - 1];
      next[next.length - 1] = { ...last, content: last.content + text };
      return next;
    });

  // 마지막 메시지(지금 받고 있는 답)에 메모를 붙인다
  const addNotesToLast = (notes: string[]) =>
    setMessages((prev) => {
      const next = prev.slice();
      const last = next[next.length - 1];
      next[next.length - 1] = { ...last, notes: [...(last.notes ?? []), ...notes] };
      return next;
    });

  // 답이 끝나면(done) 답 말풍선에 시각을 단다. 서버도 답을 다 만든 뒤 저장하므로 지난 대화의 시각과 비슷하다
  const stampLast = () =>
    setMessages((prev) => {
      const next = prev.slice();
      next[next.length - 1] = { ...next[next.length - 1], created_at: new Date().toISOString() };
      return next;
    });

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setError(null);
    setNotice(null);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, created_at: new Date().toISOString() },
      { role: 'assistant', content: '' },
    ]);
    try {
      await streamChat(text, (event) => {
        if (event.type === 'delta') appendToLast(String(event.text));
        if (event.type === 'done') stampLast();
        if (event.type === 'error') setError(String(event.message));
        const notes = notesFrom(event);
        if (notes.length) addNotesToLast(notes);
      });
      refreshCredits();
    } catch (e) {
      if (e instanceof NoCreditsError) {
        // 서버에 저장되지 않았으니 방금 넣은 두 말풍선을 지우고, 보낸 글은 입력창에 되돌린다(웹과 같음)
        setMessages((prev) => prev.slice(0, -2));
        setInput(text);
        setNotice(e.message);
        if (e.balance !== null) setBalance(e.balance);
      } else {
        setError(String((e as Error).message ?? e));
      }
    } finally {
      setBusy(false);
    }
  };

  const low = balance !== null && lowCredits !== null && balance <= lowCredits;

  return (
    // 헤더를 화면 안에 직접 그린다. iOS 26부터 기본 헤더가 화면 위에 겹쳐 배치되어 대화 목록 윗부분을 가리기 때문이다.
    <SafeAreaView style={styles.frame} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, title: character ? `${character.avatar} ${character.name}` : '하루친구' }} />
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {balance !== null ? (
            <Text style={styles.creditBadge} numberOfLines={1}>
              크레딧 {balance}
            </Text>
          ) : null}
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {character ? `${character.avatar} ${character.name}` : '하루친구'}
        </Text>
        <View style={[styles.headerSide, styles.headerRight]}>
          <Link href="/character" style={styles.headerLink}>
            캐릭터
          </Link>
        </View>
      </View>
      {/* Android 도 padding 을 준다. Expo 앱은 edge-to-edge 라 키보드가 떠도 창이 줄지 않아, 안 주면 입력창이 키보드에 가린다 */}
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? <Text style={styles.empty}>첫 메시지를 보내 보세요.</Text> : null}
          {messages.map((m, i) => {
            const mine = m.role === 'user';
            const at = parseTime(m.created_at);
            // 날짜가 바뀌는 곳(또는 첫 메시지) 위에 가운데 날짜 줄을 넣는다
            const prevAt = parseTime(messages.slice(0, i).reverse().find((p) => p.created_at)?.created_at);
            const newDay = at !== null && (prevAt === null || !sameDay(prevAt, at));
            const time = at ? <Text style={styles.time}>{timeLabel(at)}</Text> : null;
            return (
              <Fragment key={m.id ?? `local-${i}`}>
                {newDay ? <Text style={styles.dateLine}>{dateLabel(at)}</Text> : null}
                <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                  {mine ? time : null}
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Text style={mine ? styles.mineText : styles.theirsText}>{m.content || '…'}</Text>
                  </View>
                  {mine ? null : time}
                </View>
                {m.notes?.length ? (
                  <View style={styles.notes}>
                    {m.notes.map((n, j) => (
                      <Text key={j} style={styles.note}>
                        {n}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Fragment>
            );
          })}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        {low ? (
          <View style={styles.lowBand}>
            <Text style={styles.lowText}>크레딧이 얼마 남지 않았어요 ({balance}개)</Text>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          {ocrEnabled ? (
            <Pressable
              style={[styles.photo, (busy || reading) && styles.sendOff]}
              onPress={choosePhoto}
              disabled={busy || reading}
              accessibilityLabel="사진에서 글자 읽기"
            >
              <Text style={styles.photoText}>📷</Text>
            </Pressable>
          ) : null}
          {/* 사진에서 읽은 글을 고치기 쉽게 여러 줄 입력창으로 둔다. 줄바꿈이 되므로 보내기는 버튼으로 한다 */}
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={reading ? '사진에서 글자를 읽는 중…' : '메시지 보내기'}
            editable={!busy && !reading}
            multiline
          />
          <Pressable
            style={[styles.send, (busy || reading || !input.trim()) && styles.sendOff]}
            onPress={send}
            disabled={busy || reading}
          >
            <Text style={styles.sendText}>{busy ? '…' : '보내기'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, backgroundColor: '#FAFAFB' },
  header: { flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#E6E8EC', backgroundColor: '#fff' },
  headerSide: { width: 84 },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1F2430' },
  list: { padding: 16, gap: 8 },
  empty: { textAlign: 'center', color: '#5B6270', marginTop: 24 },
  // 말풍선과 시각을 한 줄에 놓는다. 내 말은 오른쪽(시각이 왼쪽), 답은 왼쪽(시각이 오른쪽)
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
  mine: { backgroundColor: '#F7585C' },
  theirs: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6E8EC' },
  time: { color: '#8A909C', fontSize: 11, marginBottom: 2 },
  dateLine: { alignSelf: 'center', color: '#5B6270', fontSize: 12, backgroundColor: '#EEF0F3', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginVertical: 6, overflow: 'hidden' },
  mineText: { color: '#fff', fontSize: 15 },
  theirsText: { color: '#1F2430', fontSize: 15 },
  notes: { alignSelf: 'flex-start', maxWidth: '82%', marginTop: -4, paddingHorizontal: 4, gap: 2 },
  note: { color: '#8A909C', fontSize: 12 },
  error: { color: '#D93D42', fontSize: 13, marginTop: 8 },
  notice: { alignSelf: 'stretch', color: '#8A5A00', backgroundColor: '#FFF4D6', fontSize: 14, marginTop: 8, padding: 10, borderRadius: 10 },
  creditBadge: { alignSelf: 'flex-start', color: '#5B6270', fontSize: 12, backgroundColor: '#F1F2F5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  lowBand: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFF4D6', borderTopWidth: 1, borderColor: '#F3E2B3' },
  lowText: { color: '#8A5A00', fontSize: 13, textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderColor: '#E6E8EC', backgroundColor: '#fff' },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: '#E6E8EC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  photo: { height: 42, width: 42, borderRadius: 10, backgroundColor: '#F1F2F5', alignItems: 'center', justifyContent: 'center' },
  photoText: { fontSize: 20 },
  send: { height: 42, backgroundColor: '#F7585C', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  sendOff: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '700' },
  headerLink: { color: '#D93D42', fontWeight: '700', fontSize: 15, paddingHorizontal: 8 },
});
