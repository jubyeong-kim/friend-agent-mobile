// 카메라 화면에서 찍은 사진을 대화 화면으로 넘겨주는 작은 보관함.
// 카메라 화면이 사진을 넣고 닫히면, 대화 화면이 다시 보일 때 꺼내 글자를 읽는다.
import type { PhotoFile } from './api';

let pending: PhotoFile | null = null;

export function putPhoto(photo: PhotoFile) {
  pending = photo;
}

export function takePhoto(): PhotoFile | null {
  const photo = pending;
  pending = null;
  return photo;
}
