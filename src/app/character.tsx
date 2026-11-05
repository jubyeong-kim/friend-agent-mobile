// 캐릭터 화면. 값의 목록(아바타, 관계, 말투, 성격)은 백엔드 /api/config 의 options 에서 받아 온다.
import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { ErrorView, Loading } from '@/components/StatusView';
import { TagInput, withPending } from '@/components/TagInput';
import { api, type Character } from '@/lib/api';
import { useSession } from '@/lib/session';

const MAX_TRAITS = 3;
// 관심사 상한. 백엔드 app/persona.py 의 LIMITS(tags 6, tag 20)와 같게 둔다. 넘치면 백엔드도 자른다
const MAX_INTERESTS = 6;
const MAX_INTEREST_LENGTH = 20;

export default function CharacterScreen() {
  const session = useSession();
  const headerHeight = useHeaderHeight();
  const [character, setCharacter] = useState<Character | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingInterest = useRef(''); // 관심사 입력칸에 쓰다 만 글

  useEffect(() => {
    if (session.status !== 'ready') return;
    api<{ character: Character }>('/api/character')
      .then((r) => setCharacter(r.character))
      .catch((e) => setError(String(e.message ?? e)));
  }, [session.status]);

  if (session.status === 'loading') return <Loading />;
  if (session.status === 'error') return <ErrorView message={session.message} retry={session.retry} />;
  if (error && !character) return <ErrorView message={error} />;
  if (!character) return <Loading />;

  const options = session.config.options;
  const set = (patch: Partial<Character>) => setCharacter({ ...character, ...patch });
  const toggleTrait = (t: string) => {
    const has = character.traits.includes(t);
    if (!has && character.traits.length >= MAX_TRAITS) return;
    set({ traits: has ? character.traits.filter((x) => x !== t) : [...character.traits, t] });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // 완료(↵)나 쉼표 없이 저장을 눌러도 입력칸에 쓰던 관심사가 빠지지 않게 합친다
      const interests = withPending(character.interests, pendingInterest.current, MAX_INTERESTS, MAX_INTEREST_LENGTH);
      await api('/api/character', { method: 'PUT', body: { ...character, interests } });
      await session.refreshMe();
      router.replace('/');
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const choices = (key: 'avatar' | 'relationship' | 'speech' | 'emoji') =>
    options[key].map((v) => <Chip key={v} label={v} selected={character[key] === v} onPress={() => set({ [key]: v })} />);

  return (
    // 아래쪽 입력칸(직업, 관심사)이 키보드에 가리지 않게 한다. 기본 헤더 아래에 있으니 헤더 높이만큼 보정한다(Expo 키보드 문서)
    <KeyboardAvoidingView style={styles.screen} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.form}>
        <Text style={styles.label}>이름</Text>
        <TextInput style={styles.input} value={character.name} onChangeText={(name) => set({ name })} maxLength={20} />

        <Text style={styles.label}>모습</Text>
        <View style={styles.row}>{choices('avatar')}</View>

        <Text style={styles.label}>나와의 관계</Text>
        <View style={styles.row}>{choices('relationship')}</View>

        <Text style={styles.label}>성격 (최대 {MAX_TRAITS}개)</Text>
        <View style={styles.row}>
          {options.traits.map((t) => (
            <Chip key={t} label={t} selected={character.traits.includes(t)} onPress={() => toggleTrait(t)} />
          ))}
        </View>

        <Text style={styles.label}>말투</Text>
        <View style={styles.row}>{choices('speech')}</View>

        <Text style={styles.label}>이모지</Text>
        <View style={styles.row}>{choices('emoji')}</View>

        <Text style={styles.label}>직업</Text>
        <TextInput style={styles.input} value={character.job} onChangeText={(job) => set({ job })} maxLength={30} />

        <Text style={styles.label}>관심사 (최대 {MAX_INTERESTS}개)</Text>
        <TagInput
          tags={character.interests}
          onChange={(interests) => set({ interests })}
        onDraftChange={(draft) => {
          pendingInterest.current = draft;
        }}
          max={MAX_INTERESTS}
          maxLength={MAX_INTEREST_LENGTH}
          placeholder="예: 등산, 재즈"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.save, saving && styles.saveOff]} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? '저장 중…' : '저장하고 대화하기'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  form: { padding: 16, gap: 8, backgroundColor: '#fff' },
  label: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: { borderWidth: 1, borderColor: '#E6E8EC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  error: { color: '#D93D42', fontSize: 13, marginTop: 8 },
  save: { backgroundColor: '#F7585C', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  saveOff: { opacity: 0.5 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
