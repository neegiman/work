export const POSTURE_IMAGES = Object.freeze({
  plank: Object.freeze([
    Object.freeze({ src: new URL('./assets/postures/plank-static-v1.png', import.meta.url).href, phase: '기본 자세', alt: '초록색 운동복을 입은 사람이 팔꿈치와 발끝으로 지지하며 몸을 일직선으로 유지하는 플랭크 기본자세' }),
  ]),
  pushup: Object.freeze([
    Object.freeze({ src: new URL('./assets/postures/pushup-start-static-v1.png', import.meta.url).href, phase: '시작 자세', alt: '손바닥과 발끝으로 바닥을 지지하고 팔을 펴서 몸을 일직선으로 유지하는 팔굽혀펴기 시작 자세' }),
    Object.freeze({ src: new URL('./assets/postures/pushup-bottom-static-v1.png', import.meta.url).href, phase: '내려간 자세', alt: '손바닥과 발끝의 지지를 유지하며 팔꿈치를 굽혀 가슴을 바닥 가까이 낮춘 팔굽혀펴기 자세' }),
  ]),
});

export function postureImage(exercise, depth = 0) {
  const images = POSTURE_IMAGES[exercise];
  if (!images) throw new RangeError('Unknown posture image');
  return images[exercise === 'pushup' && Number(depth) >= 0.5 ? 1 : 0];
}

export function createPostureImageLoader(load) {
  const requests = new Map();
  return src => {
    if (!requests.has(src)) {
      const pending = Promise.resolve().then(() => load(src));
      requests.set(src, pending);
      pending.catch(() => { if (requests.get(src) === pending) requests.delete(src); });
    }
    return requests.get(src);
  };
}
