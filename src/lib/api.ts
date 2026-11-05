// 백엔드(friend-agent-template)와 주고받는 코드. 백엔드 주소는 EXPO_PUBLIC_API_URL 에서 읽는다.
import { fetch as streamingFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

let token: string | null = null;

// 로그인하면 Supabase 토큰을 넣어 둔다. 백엔드가 AUTH=none 이면 토큰 없이 부른다.
export function setToken(value: string | null) {
  token = value;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function requireUrl() {
  if (!API_URL) {
    throw new Error('백엔드 주소가 비어 있습니다. .env 의 EXPO_PUBLIC_API_URL 을 확인하세요.');
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  requireUrl();
  const response = await fetch(API_URL + path, {
    method: options.method ?? 'GET',
    headers: headers(),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    throw new Error(`${path} 요청 실패: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

// /api/chat 은 한 줄에 이벤트 하나(JSON)씩 흘려보낸다. 답 글자는 delta, 끝나면 done, 실패하면 error.
// reminder 는 답 글자보다 먼저(도구를 실행한 직후), memory 는 답 글자가 다 온 뒤에 온다.
export type MemoryEvent = { type: 'memory'; added: string[]; updated: string[]; removed: string[] };
export type ReminderEvent = { type: 'reminder'; action: 'create_reminder' | 'cancel_reminder'; summary: string };

export type ChatEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; message_id: number }
  | { type: 'error'; message: string }
  | MemoryEvent
  | ReminderEvent
  | { type: string; [key: string]: unknown };

// 크레딧이 없어 /api/chat 이 402 로 거절했을 때. 서버는 이 메시지를 저장하지 않는다.
// 본문: {"error": "insufficient_credits", "message": 안내 문구, "balance": 잔액}
export class NoCreditsError extends Error {
  balance: number | null;
  constructor(message: string, balance: number | null) {
    super(message);
    this.balance = balance;
  }
}

export async function streamChat(message: string, onEvent: (event: ChatEvent) => void) {
  requireUrl();
  // 앱에서 응답을 조금씩 읽으려면 expo/fetch 를 쓴다. React Native 기본 fetch 는 스트리밍을 읽지 못한다.
  const response = await streamingFetch(API_URL + '/api/chat', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ message }),
  });
  if (response.status === 402) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; balance?: number };
    throw new NoCreditsError(body.message ?? '보내지 못했어요.', typeof body.balance === 'number' ? body.balance : null);
  }
  if (!response.ok || !response.body) {
    throw new Error(`/api/chat 요청 실패: ${response.status} ${await response.text()}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as ChatEvent);
      newline = buffer.indexOf('\n');
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as ChatEvent);
}

// 백엔드 응답 모양
export type Config = {
  env: string;
  auth: 'none' | 'supabase';
  storage: string;
  supabase_url: string;
  supabase_publishable_key: string;
  options: Record<string, string[]>;
  ocr_enabled?: boolean; // 백엔드에서 사진 글자 읽기(/api/ocr)가 켜졌는지
};

// 사진 한 장을 /api/ocr 로 보내 읽은 글을 받는다. 사진은 multipart 폼의 photo 칸으로 보낸다.
// Content-Type 은 직접 적지 않는다. FormData 가 경계 문자열이 든 값을 만들어야 백엔드가 사진을 찾는다.
export type PhotoFile = { uri: string }; // 폰 안의 사진 파일 주소(file://…)

export async function readPhoto(photo: PhotoFile): Promise<string> {
  requireUrl();
  const form = new FormData();
  // SDK 58 은 전역 fetch 가 expo/fetch 라서 React Native 식 { uri, name, type } 을 받지 않는다.
  // expo-file-system 의 File 로 넣으면 파일 이름과 종류(image/jpeg 등)가 함께 간다.
  form.append('photo', new File(photo.uri) as unknown as Blob);
  const response = await fetch(API_URL + '/api/ocr', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    const body = await response.text();
    let detail = body;
    try {
      detail = (JSON.parse(body) as { detail?: string }).detail ?? body;
    } catch {
      // JSON 이 아니면 본문 그대로
    }
    throw new Error(`/api/ocr 요청 실패: ${response.status} ${detail}`);
  }
  return ((await response.json()) as { text: string }).text;
}

export type Me = { id: string; anonymous: boolean; email: string | null; has_character: boolean };

export type Character = {
  name: string;
  gender: string;
  age_group: string;
  job: string;
  relationship: string;
  traits: string[];
  speech: string;
  emoji: string;
  interests: string[];
  avoid: string[];
  memo: string;
  avatar: string;
};

// /api/credits 의 잔액, /api/products 의 「얼마 남지 않았어요」 기준. 크레딧이 없는 백엔드(production 등)에는 이 API 가 없다.
export type Credits = { balance: number };
export type Products = { low_credits: number };

// notes: 그 차례의 memory · reminder 이벤트로 받은 메모. 백엔드가 저장하지 않으므로 지난 대화에는 없다.
// created_at: 지난 대화는 /api/messages 의 서버 시각(시간대 포함 ISO), 새 메시지는 폰 시각.
export type Message = { id?: number; role: 'user' | 'assistant'; content: string; notes?: string[]; created_at?: string };
