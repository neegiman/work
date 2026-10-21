import { POSTURE_GUIDES, getPosture } from './posture-data.js?v=20261021-reference-3d2';
import { postureImage, createPostureImageLoader } from './posture-images.js?v=20261021-static-postures';

export function createPoseGuide() {
  const $ = id => document.getElementById(id);
  const dialog = $('pose-dialog'), button = $('pose-open-button'), stage = $('pose-stage'), image = $('pose-image');
  let guide = null, depth = 0, epoch = 0, previousOverflow = '';
  const loadImage = createPostureImageLoader(src => new Promise((resolve, reject) => {
    const loaded = new Image();
    loaded.decoding = 'async';
    loaded.onload = () => resolve(loaded);
    loaded.onerror = () => reject(new Error('Posture image failed to load'));
    loaded.src = src;
  }));

  function status(message) {
    $('pose-status').textContent = message;
    $('pose-status').hidden = !message;
  }
  function fallbackImage() {
    $('pose-render-mode').textContent = '측면 그림';
    status('자세 이미지를 불러오지 못했어요. 아래 버튼으로 다시 불러올 수 있어요.');
    $('pose-retry-button').hidden = false;
    image.hidden = true;
    const pose = getPosture(guide.id, depth);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 420 250'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${guide.name} 측면 자세 그림`);
    const point = position => `${210 + position[0] * 125},${194 - position[1] * 125}`;
    const limbs = pose.sides[1];
    const path = [limbs.hand, limbs.wrist, limbs.elbow, limbs.shoulder, limbs.hip, limbs.knee, limbs.ankle, limbs.toe];
    svg.innerHTML = `<rect x="20" y="199" width="380" height="8" rx="4" fill="#d9e4cf"/><polyline points="${path.map(point).join(' ')}" fill="none" stroke="#78956e" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${210 + pose.head[0] * 125}" cy="${194 - pose.head[1] * 125}" r="18" fill="#d9c5af"/>`;
    stage.append(svg);
  }
  function fillGuide() {
    $('pose-title').textContent = `${guide.name} 기본자세`;
    $('pose-subtitle').textContent = guide.subtitle;
    $('pose-cues').replaceChildren();
    for (const [title, detail] of guide.cues) {
      const item = document.createElement('li');
      const heading = document.createElement('strong'); heading.textContent = title;
      const text = document.createElement('p'); text.textContent = detail;
      item.append(heading, text); $('pose-cues').append(item);
    }
    $('pose-source').textContent = guide.source.name;
    $('pose-source').href = guide.source.url;
    $('pose-motion-controls').hidden = guide.id !== 'pushup';
    $('pose-interaction-hint').textContent = guide.id === 'pushup'
      ? '시작 자세와 내려간 자세를 비교해 보세요.' : '팔꿈치의 위치와 몸의 정렬을 확인하세요.';
  }

  async function renderSelected() {
    const currentEpoch = ++epoch;
    const selected = postureImage(guide.id, depth);
    stage.querySelector('svg')?.remove();
    image.hidden = true;
    $('pose-retry-button').hidden = true;
    $('pose-render-mode').textContent = '자세 이미지';
    $('pose-phase').textContent = selected.phase;
    $('pose-top-button').setAttribute('aria-pressed', String(depth === 0));
    $('pose-bottom-button').setAttribute('aria-pressed', String(depth === 1));
    status('자세 이미지를 불러오고 있어요…');
    try {
      await loadImage(selected.src);
      if (!dialog.open || currentEpoch !== epoch) return;
      image.alt = selected.alt;
      image.src = selected.src;
      image.hidden = false;
      status('');
    } catch {
      if (dialog.open && currentEpoch === epoch) fallbackImage();
    }
  }
  async function open() {
    if (!guide || dialog.open) return;
    depth = 0;
    fillGuide();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.scrollTop = 0;
    await renderSelected();
  }
  button.addEventListener('click', open);
  $('pose-close-button').addEventListener('click', () => dialog.close());
  $('pose-done-button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { epoch++; document.body.style.overflow = previousOverflow; });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  function selectDepth(value) { depth = value; renderSelected(); }
  $('pose-top-button').addEventListener('click', () => selectDepth(0));
  $('pose-bottom-button').addEventListener('click', () => selectDepth(1));
  $('pose-retry-button').addEventListener('click', renderSelected);
  return {
    setExercise(exercise) {
      guide = POSTURE_GUIDES[exercise.id] || null;
      button.hidden = !guide;
      if (guide) button.setAttribute('aria-label', `${guide.name} 자세 보기`);
    },
  };
}
