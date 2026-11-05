// 카메라 화면. 미리보기와 촬영 버튼을 보여 주고, 찍은 사진을 대화 화면으로 넘긴다.
// 글자 읽기(/api/ocr)는 대화 화면이 한다. 카메라 권한은 대화 화면이 이 화면을 열기 전에 확인한다.
import { CameraView } from 'expo-camera';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { putPhoto } from '@/lib/photoInbox';

export default function CameraScreen() {
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async () => {
    if (!camera.current || !ready || taking) return;
    setTaking(true);
    setError(null);
    try {
      // 백엔드는 5MB 넘는 사진을 받지 않아서 조금 압축해 찍는다
      const picture = await camera.current.takePictureAsync({ quality: 0.6 });
      putPhoto({ uri: picture.uri });
      router.back();
    } catch (e) {
      setError(`사진을 찍지 못했어요: ${String((e as Error).message ?? e)}`);
      setTaking(false);
    }
  };

  const off = !ready || taking;

  return (
    <View style={styles.frame}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} style={styles.close} accessibilityLabel="닫기">
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
        {/* 안내 문구는 임시 초안 */}
        <Text style={styles.guide}>일정표 글자가 화면을 가득 채우게 맞춰 주세요</Text>
        <View style={styles.bottom}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={take}
            disabled={off}
            style={[styles.shutter, off && styles.shutterOff]}
            accessibilityLabel="사진 찍기"
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12 },
  close: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  closeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  guide: {
    alignSelf: 'center',
    color: '#fff',
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bottom: { alignItems: 'center', gap: 12, paddingBottom: 24 },
  error: { color: '#fff', backgroundColor: 'rgba(217,61,66,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterOff: { opacity: 0.4 },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
});
