// 글자를 쓰고 완료(↵)나 쉼표를 누르면 태그가 되는 입력칸. 태그의 × 로 뺀다. 웹 캐릭터 화면의 관심사 칸과 같은 방식.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
  max: number; // 태그 개수 상한(백엔드와 같게)
  maxLength: number; // 태그 하나의 글자 수 상한(백엔드와 같게)
  placeholder?: string;
  // 아직 태그가 되지 않은 입력칸 글자가 바뀔 때. 저장할 때 withPending 으로 합치려고 밖에 알린다
  onDraftChange?: (draft: string) => void;
};

// 입력칸에 쓰다 만 글이 있으면 태그로 더한 목록. 완료(↵)나 쉼표 없이 바로 저장해도 쓰던 글이 빠지지 않게 한다
export function withPending(tags: string[], draft: string, max: number, maxLength: number): string[] {
  const t = draft.trim().slice(0, maxLength);
  // 이미 태그가 된 글이면 다시 넣지 않는다(입력칸에서 손을 뗄 때와 저장이 겹쳐도 두 번 들어가지 않게)
  return t && tags.length < max && !tags.includes(t) ? [...tags, t] : tags;
}

export function TagInput({ tags, onChange, max, maxLength, placeholder, onDraftChange }: Props) {
  const [draft, setDraftState] = useState('');
  const full = tags.length >= max;
  const setDraft = (text: string) => {
    setDraftState(text);
    onDraftChange?.(text);
  };

  const add = (words: string[]) => {
    const next = [...tags];
    for (const w of words) {
      const t = w.trim().slice(0, maxLength);
      if (t && next.length < max) next.push(t);
    }
    if (next.length !== tags.length) onChange(next);
  };

  // 쉼표가 들어오면 쉼표 앞까지를 태그로 만들고, 뒤에 남은 글자는 입력칸에 둔다
  const onChangeText = (text: string) => {
    const parts = text.split(/[,，]/);
    if (parts.length > 1) {
      add(parts.slice(0, -1));
      setDraft(parts[parts.length - 1]);
    } else {
      setDraft(text);
    }
  };

  const commit = () => {
    add([draft]);
    setDraft('');
  };

  return (
    <View style={styles.box}>
      {tags.map((t, i) => (
        <View key={`${t}-${i}`} style={styles.tag}>
          <Text style={styles.tagText}>{t}</Text>
          <Pressable
            onPress={() => onChange(tags.filter((_, j) => j !== i))}
            hitSlop={8}
            accessibilityLabel={`${t} 빼기`}
          >
            <Text style={styles.remove}>×</Text>
          </Pressable>
        </View>
      ))}
      {full ? null : (
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={onChangeText}
          onSubmitEditing={commit}
          onBlur={commit}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder={placeholder}
          maxLength={maxLength}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E6E8EC',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFE9E9',
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
  },
  tagText: { color: '#D93D42', fontSize: 13, fontWeight: '600' },
  remove: { color: '#D93D42', fontSize: 15, paddingHorizontal: 2, opacity: 0.7 },
  input: { flexGrow: 1, minWidth: 120, fontSize: 15, paddingVertical: 4, paddingHorizontal: 4 },
});
