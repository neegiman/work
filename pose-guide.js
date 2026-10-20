import { POSTURE_GUIDES, getPosture } from './posture-data.js?v=20261020-3d';

export function createPoseGuide() {
  const $ = id => document.getElementById(id);
  const dialog = $('pose-dialog'), button = $('pose-open-button');
  let guide = null, viewer = null, modulePromise, epoch = 0, failed = false, previousOverflow = '';

  function status(message) {
    $('pose-status').textContent = message;
    $('pose-status').hidden = !message;
  }
  function playback({ playing, depth, phase }) {
    $('pose-play-label').textContent = playing ? '동작 멈추기' : '동작 재생';
    $('pose-play-button').setAttribute('aria-pressed', String(playing));
    $('pose-play-icon').setAttribute('href', playing ? '#i-pause' : '#i-play');
    $('pose-phase').textContent = phase;
    $('pose-top-button').setAttribute('aria-pressed', String(!playing && depth < 0.5));
    $('pose-bottom-button').setAttribute('aria-pressed', String(!playing && depth >= 0.5));
  }
  function fallback(depth = 0) {
    $('pose-render-mode').textContent = '측면 그림';
    status('이 기기에서는 3D를 표시할 수 없어 측면 그림으로 안내해요.');
    $('pose-play-button').disabled = true;
    document.querySelectorAll('[data-pose-view]').forEach(element => { element.disabled = true; });
    $('pose-stage').querySelector('canvas')?.remove();
    const old = $('pose-stage').querySelector('svg'); old?.remove();
    const pose = getPosture(guide.id, depth);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 420 250'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${guide.name} 측면 자세 그림`);
    const point = position => `${210 + position[0] * 125},${194 - position[1] * 125}`;
    const limbs = pose.sides[1];
    const paths = [[limbs.hand, limbs.wrist, limbs.elbow, limbs.shoulder, limbs.hip, limbs.knee, limbs.ankle, limbs.toe]];
    svg.innerHTML = `<rect x="20" y="199" width="380" height="8" rx="4" fill="#d9e4cf"/><polyline points="${paths[0].map(point).join(' ')}" fill="none" stroke="#78956e" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${210 + pose.head[0] * 125}" cy="${194 - pose.head[1] * 125}" r="18" fill="#d9c5af"/>`;
    $('pose-stage').prepend(svg);
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
    $('pose-motion-controls').hidden = guide.id !== 'pushup';
    $('pose-phase').textContent = guide.id === 'plank' ? '기본 자세' : '시작 자세';
    document.querySelectorAll('[data-pose-view]').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.poseView === 'angle')));
  }
  async function open() {
    if (!guide) return;
    const currentEpoch = ++epoch;
    fillGuide();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    if (failed) { fallback(); return; }
    status('3D 모델을 준비하고 있어요…');
    try {
      const module = await (modulePromise ||= import('./pose-viewer.js?v=20261020-athlete'));
      if (!dialog.open || currentEpoch !== epoch) return;
      viewer ||= module.createPoseViewer($('pose-stage'), { onPlayback: playback, onStatus: status });
      $('pose-render-mode').textContent = 'INTERACTIVE 3D';
      viewer.setExercise(guide.id); viewer.setActive(true);
      status('');
    } catch {
      if (!dialog.open || currentEpoch !== epoch) return;
      failed = true; fallback();
    }
  }
  button.addEventListener('click', open);
  $('pose-close-button').addEventListener('click', () => dialog.close());
  $('pose-done-button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    epoch++; viewer?.setActive(false); document.body.style.overflow = previousOverflow;
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  document.querySelectorAll('[data-pose-view]').forEach(element => element.addEventListener('click', () => {
    viewer?.setView(element.dataset.poseView);
    document.querySelectorAll('[data-pose-view]').forEach(other => other.setAttribute('aria-pressed', String(other === element)));
  }));
  $('pose-play-button').addEventListener('click', () => viewer?.togglePlayback());
  $('pose-top-button').addEventListener('click', () => failed ? fallback(0) : viewer?.setDepth(0));
  $('pose-bottom-button').addEventListener('click', () => failed ? fallback(1) : viewer?.setDepth(1));
  return {
    setExercise(exercise) {
      guide = POSTURE_GUIDES[exercise.id] || null;
      button.hidden = !guide;
      if (guide) button.setAttribute('aria-label', `${guide.name} 3D 자세 보기`);
    },
  };
}
