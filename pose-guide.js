import { POSTURE_GUIDES, getPosture } from './posture-data.js?v=20261020-3d';
import { postureImage, createPostureImageLoader } from './posture-images.js?v=20261021-static-postures';

export function createPoseGuide() {
  const $ = id => document.getElementById(id);
  const dialog = $('pose-dialog'), button = $('pose-open-button'), stage = $('pose-stage'), image = $('pose-image');
  let guide = null, viewer = null, modulePromise, epoch = 0, previousOverflow = '';
  let mode = 'image', depth = 0, threeReady = false;
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
  function playback({ playing, depth: nextDepth, phase }) {
    depth = nextDepth;
    $('pose-play-label').textContent = playing ? '동작 멈추기' : '동작 재생';
    $('pose-play-button').setAttribute('aria-pressed', String(playing));
    $('pose-play-icon').setAttribute('href', playing ? '#i-pause' : '#i-play');
    $('pose-phase').textContent = phase;
    $('pose-top-button').setAttribute('aria-pressed', String(!playing && depth < 0.5));
    $('pose-bottom-button').setAttribute('aria-pressed', String(!playing && depth >= 0.5));
  }
  function fallbackImage() {
    $('pose-render-mode').textContent = '측면 그림';
    status('자세 이미지를 불러오지 못했어요. 자세 이미지를 다시 누르면 재시도해요.');
    image.hidden = true;
    const old = stage.querySelector('svg'); old?.remove();
    const pose = getPosture(guide.id, depth);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 420 250'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${guide.name} 측면 자세 그림`);
    const point = position => `${210 + position[0] * 125},${194 - position[1] * 125}`;
    const limbs = pose.sides[1];
    const paths = [[limbs.hand, limbs.wrist, limbs.elbow, limbs.shoulder, limbs.hip, limbs.knee, limbs.ankle, limbs.toe]];
    svg.innerHTML = `<rect x="20" y="199" width="380" height="8" rx="4" fill="#d9e4cf"/><polyline points="${paths[0].map(point).join(' ')}" fill="none" stroke="#78956e" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${210 + pose.head[0] * 125}" cy="${194 - pose.head[1] * 125}" r="18" fill="#d9c5af"/>`;
    stage.append(svg);
    playback({ playing: false, depth, phase: guide.id === 'plank' ? '기본 자세' : depth ? '내려간 자세' : '시작 자세' });
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
    document.querySelectorAll('[data-pose-view]').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.poseView === 'angle')));
  }

  function displayControls() {
    const is3D = mode === '3d';
    stage.dataset.mode = mode;
    $('pose-image-button').setAttribute('aria-pressed', String(!is3D));
    $('pose-3d-button').setAttribute('aria-pressed', String(is3D));
    $('pose-view-controls').hidden = !is3D;
    $('pose-motion-controls').hidden = guide.id !== 'pushup';
    $('pose-motion-controls').dataset.mode = mode;
    $('pose-play-button').hidden = !is3D;
    $('pose-play-button').disabled = !threeReady;
    document.querySelectorAll('[data-pose-view]').forEach(element => { element.disabled = !threeReady; });
    $('pose-interaction-hint').textContent = is3D
      ? '좌우로 드래그해 돌려보세요 · 키보드 방향키로도 조절할 수 있어요'
      : guide.id === 'pushup' ? '시작 자세와 내려간 자세를 비교해 보세요.' : '팔꿈치의 위치와 몸의 정렬을 확인하세요.';
    $('pose-model-note').textContent = is3D
      ? '자세 이해를 돕는 단순화된 모델입니다. 초록색 점선과 번호로 정렬 포인트를 확인하세요.'
      : '자세 이해를 돕는 정지 이미지입니다. 설명과 함께 몸의 정렬과 지지점을 확인하세요.';
    const canvas = stage.querySelector('canvas');
    if (canvas) canvas.hidden = !is3D;
  }

  async function renderSelected() {
    const currentEpoch = ++epoch, currentGuide = guide, selectedDepth = depth >= 0.5 ? 1 : 0;
    threeReady = false;
    viewer?.setActive(false);
    stage.querySelector('svg')?.remove();
    image.hidden = true;
    displayControls();
    if (mode === 'image') {
      const selected = postureImage(currentGuide.id, selectedDepth);
      $('pose-render-mode').textContent = '정지 자세';
      playback({ playing: false, depth: selectedDepth, phase: selected.phase });
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
      return;
    }

    $('pose-render-mode').textContent = 'INTERACTIVE 3D';
    status('3D 모델을 준비하고 있어요…');
    try {
      const module = await (modulePromise ||= import('./pose-viewer.js?v=20261020-athlete'));
      if (!dialog.open || currentEpoch !== epoch) return;
      viewer ||= module.createPoseViewer(stage, {
        onPlayback: playback,
        onStatus: message => { if (dialog.open && mode === '3d') status(message); },
      });
      stage.querySelector('canvas').hidden = false;
      viewer.setExercise(currentGuide.id);
      if (currentGuide.id === 'pushup') viewer.setDepth(selectedDepth);
      threeReady = true;
      displayControls();
      viewer.setActive(true);
      status('');
    } catch {
      if (!dialog.open || currentEpoch !== epoch) return;
      modulePromise = undefined;
      if (!viewer) stage.querySelectorAll('canvas').forEach(canvas => canvas.remove());
      mode = 'image';
      await renderSelected();
      if (dialog.open && mode === 'image') status('3D를 열 수 없어 자세 이미지로 안내해요.');
    }
  }

  async function open() {
    if (!guide || dialog.open) return;
    mode = 'image'; depth = 0;
    fillGuide();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    await renderSelected();
  }
  button.addEventListener('click', open);
  $('pose-close-button').addEventListener('click', () => dialog.close());
  $('pose-done-button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    epoch++; threeReady = false; viewer?.setActive(false); document.body.style.overflow = previousOverflow;
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  document.querySelectorAll('[data-pose-view]').forEach(element => element.addEventListener('click', () => {
    if (!threeReady) return;
    viewer?.setView(element.dataset.poseView);
    document.querySelectorAll('[data-pose-view]').forEach(other => other.setAttribute('aria-pressed', String(other === element)));
  }));
  $('pose-image-button').addEventListener('click', () => { mode = 'image'; renderSelected(); });
  $('pose-3d-button').addEventListener('click', () => { mode = '3d'; renderSelected(); });
  $('pose-play-button').addEventListener('click', () => viewer?.togglePlayback());
  function selectDepth(value) {
    depth = value;
    if (mode === '3d' && threeReady) viewer.setDepth(value);
    else renderSelected();
  }
  $('pose-top-button').addEventListener('click', () => selectDepth(0));
  $('pose-bottom-button').addEventListener('click', () => selectDepth(1));
  return {
    setExercise(exercise) {
      guide = POSTURE_GUIDES[exercise.id] || null;
      button.hidden = !guide;
      if (guide) button.setAttribute('aria-label', `${guide.name} 자세 보기`);
    },
  };
}
