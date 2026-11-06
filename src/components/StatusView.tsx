// 불러오는 중, 오류 화면
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

// 앱 색과 스플래시(app.json 의 expo-splash-screen)와 같은 값. 스플래시가 사라진 뒤 같은 모습으로 이어지게 한다
const BRAND = '#F7585C';
const MARK_WIDTH = 160; // app.json 의 imageWidth 와 같게

// brand: 앱을 켤 때의 첫 로딩. 스플래시와 같은 산호색 바탕 · 해 말풍선 기호 · 천천히 숨 쉬는 움직임
// 그 밖(캐릭터 화면 등)은 화면 머리줄을 그대로 두고 산호색 도는 원만 보여 준다
export function Loading({ brand = false }: { brand?: boolean }) {
  if (!brand) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={BRAND} />
      </View>
    );
  }
  return <BrandLoading />;
}

function BrandLoading() {
  const breath = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1100, easing: ease, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1100, easing: ease, useNativeDriver: true }),
      ]),
    );
    const dotting = Animated.loop(
      Animated.stagger(
        180,
        dots.map((d) =>
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: 360, easing: ease, useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: 360, easing: ease, useNativeDriver: true }),
          ]),
        ),
      ),
    );
    breathing.start();
    dotting.start();
    return () => {
      breathing.stop();
      dotting.stop();
    };
  }, [breath, dots]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glow = breath.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.32] });

  return (
    <View style={styles.brand}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      {/* 기호 뒤 흰 빛무리가 같이 숨 쉰다 */}
      <Animated.View style={[styles.glow, { opacity: glow, transform: [{ scale }] }]} />
      <Animated.Image
        source={require('../../assets/splash-icon.png')}
        style={[styles.mark, { transform: [{ scale }] }]}
        resizeMode="contain"
        accessibilityLabel="하루친구"
      />
      <View style={styles.footer}>
        <Text style={styles.word}>하루친구</Text>
        <View style={styles.dots}>
          {dots.map((d, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                  transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export function ErrorView({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>연결하지 못했어요</Text>
      <Text style={styles.message}>{message}</Text>
      {retry ? (
        <Pressable style={styles.button} onPress={retry}>
          <Text style={styles.buttonText}>다시 시도</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#fff' },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND },
  glow: { position: 'absolute', width: MARK_WIDTH * 1.9, height: MARK_WIDTH * 1.9, borderRadius: MARK_WIDTH, backgroundColor: '#fff' },
  mark: { width: MARK_WIDTH, height: MARK_WIDTH },
  footer: { position: 'absolute', bottom: 72, alignItems: 'center', gap: 10 },
  word: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 2, opacity: 0.92 },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700' },
  message: { fontSize: 14, color: '#5B6270', textAlign: 'center' },
  button: { backgroundColor: BRAND, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
