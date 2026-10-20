import { IntervalTimer, normalizeConfig, clock } from './timer.js';
import { loadPreferences, savePreferences, currentExercise } from './preferences.js';
import { ScreenAwake } from './screen-awake.js';

const $ = (id) => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { /* Work without persistence if storage is blocked. */ }
const preferences = loadPreferences(storage);
let config = { ...currentExercise(preferences).config };
let sound = preferences.sound;
const timer = new IntervalTimer(config);
const circumference = 2 * Math.PI * 146;
let audioContext;
let toastTimeout;
let lastSecond;
let lastStateKey;
let lastCompleted = false;
const screenAwake = new ScreenAwake({
  request: window.isSecureContext && navigator.wakeLock ? () => navigator.wakeLock.request('screen') : undefined,
  visible: () => document.visibilityState === 'visible',
  onStatus: renderAwake,
});

function save() {
  currentExercise(preferences).config = { ...config };
  preferences.sound = sound;
  const saved = savePreferences(storage, preferences);
  $('exercise-save-note').textContent = saved ? '운동별 설정이 이 기기에 자동 저장돼요.' : '브라우저 저장 공간을 사용할 수 없어 이번에만 적용돼요.';
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 2800);
}

function announce(message) { $('announcement').textContent = message; }

function unlockAudio() {
  if (!sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audioContext ||= new Audio();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch { /* Audio support is optional. */ }
}

function beep(kind = 'tick') {
  if (!sound || !audioContext || audioContext.state !== 'running') return;
  try {
    const time = audioContext.currentTime;
    const notes = kind === 'complete' ? [660, 830, 990] : kind === 'change' ? [740, 990] : [640];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = time + index * 0.15;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.17);
    });
  } catch { /* Audio never blocks the clock. */ }
}

function syncWakeLock(force = false) {
  return screenAwake.sync(preferences.keepAwake && timer.state !== 'complete', { force });
}

function renderAwake(status) {
  const labels = { active: '켜짐', requesting: '요청 중', unsupported: '지원 안 됨', blocked: '재시도', interrupted: '재연결 중', hidden: '대기', off: timer.state === 'complete' && preferences.keepAwake ? '운동 완료' : '꺼짐' };
  $('awake-status').textContent = labels[status];
  $('awake-button').dataset.status = status;
  $('awake-button').setAttribute('aria-pressed', String(preferences.keepAwake));
  $('awake-button').setAttribute('aria-label', !preferences.keepAwake ? '화면 켜짐 유지 켜기' : ['blocked', 'interrupted'].includes(status) ? '화면 켜짐 유지 다시 시도' : '화면 켜짐 유지 끄기');
}

function buildExercisePicker() {
  $('exercise-select').replaceChildren();
  for (const exercise of preferences.exercises) {
    const option = document.createElement('option');
    option.value = exercise.id;
    option.textContent = exercise.name;
    $('exercise-select').append(option);
  }
  $('exercise-select').value = preferences.activeExercise;
}

function buildDial() {
  for (let index = 0; index < 60; index++) {
    const angle = (index * 6 - 90) * Math.PI / 180;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const inner = index % 5 === 0 ? 158 : 161;
    line.setAttribute('x1', 170 + Math.cos(angle) * inner);
    line.setAttribute('y1', 170 + Math.sin(angle) * inner);
    line.setAttribute('x2', 170 + Math.cos(angle) * 165);
    line.setAttribute('y2', 170 + Math.sin(angle) * 165);
    $('dial-ticks').append(line);
  }
}

function buildRoutine() {
  for (const field of ['work', 'rest', 'sets']) {
    $(`${field}-input`).value = config[field];
    $(`${field}-input`).style.width = `${Math.max(38, String(config[field]).length * 15)}px`;
  }
  $('prepare-toggle').setAttribute('aria-checked', String(!!config.prepare));
  $('routine-label').textContent = currentExercise(preferences).name;
  $('exercise-select').value = preferences.activeExercise;
  const total = timer.totalMs / 1000;
  $('total-duration').innerHTML = `${Math.floor(total / 60)}<small>분</small> ${String(total % 60).padStart(2, '0')}<small>초</small>`;
  $('routine-formula').innerHTML = `${config.work}초 유지 × ${config.sets}세트 <span>·</span> ${config.sets === 1 ? '휴식 없이 진행' : config.rest ? `세트 간 ${config.rest}초 휴식` : '휴식 없이 진행'}`;
  $('total-sets').textContent = String(config.sets).padStart(2, '0');
  $('set-track').replaceChildren();
  for (let index = 0; index < config.sets; index++) {
    const dot = document.createElement('span');
    dot.className = 'set-dot';
    dot.dataset.set = String(index + 1);
    dot.setAttribute('aria-label', `${index + 1}세트 대기`);
    $('set-track').append(dot);
  }
  $('cycle-strip').replaceChildren();
  timer.phases.forEach((phase, index) => {
    const step = document.createElement('div');
    step.className = `cycle-step ${phase.type}`;
    step.dataset.index = String(index);
    const number = phase.type === 'work' ? String(phase.set).padStart(2, '0') : phase.type === 'rest' ? '↗' : '↳';
    const name = phase.type === 'work' ? '세트' : phase.type === 'rest' ? '휴식' : '준비';
    step.innerHTML = `<strong>${number}</strong><span>${name}<br><small>${phase.seconds}초</small></span>`;
    step.setAttribute('aria-label', `${phase.type === 'work' ? `${phase.set}세트 운동` : name} ${phase.seconds}초`);
    $('cycle-strip').append(step);
  });
  lastStateKey = undefined;
  lastSecond = undefined;
  render();
}

function render() {
  const snapshot = timer.snapshot();
  const { state, phase, seconds, index, next } = snapshot;
  const complete = state === 'complete';
  const running = state === 'running';
  const ready = state === 'ready';
  const stateKey = `${state}-${index}`;
  $('timer-value').textContent = clock(seconds);
  $('timer-value').setAttribute('aria-label', `남은 시간 ${seconds}초`);
  $('remaining-time').textContent = clock(snapshot.totalRemaining);
  const fraction = 1 - snapshot.progress;
  $('ring-progress').style.strokeDasharray = `${circumference}`;
  $('ring-progress').style.strokeDashoffset = `${circumference * snapshot.progress}`;
  const angle = (-90 + fraction * 360) * Math.PI / 180;
  $('ring-cap').setAttribute('cx', 170 + Math.cos(angle) * 146);
  $('ring-cap').setAttribute('cy', 170 + Math.sin(angle) * 146);
  $('ring-cap').style.opacity = fraction <= 0 ? '0' : '1';
  if (stateKey === lastStateKey) return;
  const previousState = lastStateKey;
  lastStateKey = stateKey;
  document.title = complete ? '완료! — PACE' : ready ? 'PACE — 나만의 운동 리듬' : state === 'paused' ? '일시정지 — PACE' : `${clock(seconds)} ${phase.type === 'rest' ? '휴식' : phase.type === 'prepare' ? '준비' : '운동'} — PACE`;
  document.body.dataset.phase = complete ? 'work' : phase.type;
  document.body.dataset.state = state;
  $('phase-name').textContent = complete ? '완료' : state === 'paused' ? '일시정지' : ready ? '준비' : phase.type === 'rest' ? '휴식 중' : phase.type === 'prepare' ? '준비 중' : '운동 중';
  $('dial-instruction').textContent = complete ? '오늘의 루틴, 해냈어요!' : state === 'paused' ? '잠시 쉬어가도 괜찮아요' : ready ? '움직일 준비가 됐나요?' : phase.type === 'rest' ? '천천히, 숨을 고르세요' : phase.type === 'prepare' ? '편안하게 자세를 잡으세요' : '그대로, 조금만 더';
  $('dial-unit').textContent = complete ? '수고했어요' : phase.type === 'rest' ? '휴식 시간' : phase.type === 'prepare' ? '곧 운동이 시작돼요' : '유지 시간';
  $('current-set').textContent = String(phase.set).padStart(2, '0');
  $('start-label').textContent = running ? '일시정지' : state === 'paused' ? '이어서 하기' : complete ? '한 번 더 하기' : '운동 시작';
  $('start-icon').setAttribute('href', running ? '#i-pause' : '#i-play');
  $('skip-button').disabled = ready || complete;
  $('next-label').textContent = complete ? 'WELL DONE' : 'UP NEXT';
  $('next-description').innerHTML = complete ? `<strong>${config.sets}세트 완주</strong>` : next ? `${next.type === 'rest' ? '휴식' : `${next.set}세트 유지`} <strong>${next.seconds}초</strong>` : '<strong>루틴 완료</strong>';
  $('settings-lock').hidden = ready || complete;
  document.querySelectorAll('.settings-body button, .settings-body input, .settings-body select').forEach((element) => { element.disabled = !ready && !complete; });
  document.querySelectorAll('.set-dot').forEach((dot) => {
    const set = Number(dot.dataset.set);
    const finished = complete || set < phase.set || (phase.type === 'rest' && set === phase.set);
    dot.classList.toggle('finished', finished);
    dot.classList.toggle('current', !complete && set === phase.set && phase.type !== 'rest');
    dot.setAttribute('aria-label', `${set}세트 ${finished ? '완료' : set === phase.set ? '현재' : '대기'}`);
  });
  document.querySelectorAll('.cycle-step').forEach((step) => {
    const stepIndex = Number(step.dataset.index);
    step.classList.toggle('current', !complete && stepIndex === index);
    step.classList.toggle('finished', complete || stepIndex < index);
    if (!complete && stepIndex === index) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
  });
  if (running && previousState) {
    const activeStep = $('cycle-strip').querySelector('.current');
    if (activeStep && $('cycle-strip').scrollWidth > $('cycle-strip').clientWidth) {
      $('cycle-strip').scrollTo({ left: Math.max(0, activeStep.offsetLeft - $('cycle-strip').offsetLeft - 30), behavior: 'smooth' });
    }
  }
  $('completion-message').hidden = !complete;
  if (complete && !lastCompleted) {
    beep('complete');
    announce(`운동 완료! ${config.sets}세트를 모두 마쳤어요. 수고했어요.`);
    try { navigator.vibrate?.([100, 70, 100]); } catch {}
  }
  lastCompleted = complete;
  if (!complete) {
    announce(ready ? `준비. ${config.work}초 운동 ${config.sets}세트.` : state === 'paused' ? '타이머 일시정지' : `${phase.type === 'rest' ? '휴식' : phase.type === 'prepare' ? '준비' : `${phase.set}세트 운동`} ${seconds}초`);
  }
  syncWakeLock();
  renderAwake(screenAwake.status);
}

function updateConfig(next) {
  if (!['ready', 'complete'].includes(timer.state)) return;
  config = normalizeConfig({ ...config, ...next });
  timer.configure(config);
  save();
  buildRoutine();
}

function toggleTimer() {
  unlockAudio();
  if (timer.state === 'running') timer.pause();
  else { timer.start(); beep('change'); }
  lastSecond = undefined;
  render();
  syncWakeLock(true);
}

$('start-button').addEventListener('click', toggleTimer);
$('reset-button').addEventListener('click', () => {
  timer.reset(); lastSecond = undefined; render();
  announce('타이머를 초기화했어요.');
});
$('skip-button').addEventListener('click', () => {
  timer.tick();
  if (timer.skip()) { beep('change'); lastSecond = undefined; render(); }
  else render();
});
document.querySelectorAll('[data-delta]').forEach((button) => button.addEventListener('click', () => {
  updateConfig({ [button.dataset.field]: config[button.dataset.field] + Number(button.dataset.delta) });
}));
for (const field of ['work', 'rest', 'sets']) {
  $(`${field}-input`).addEventListener('input', (event) => {
    const value = Number(event.target.value);
    if (event.target.value.trim() !== '' && Number.isFinite(value) && value >= Number(event.target.min) && value <= Number(event.target.max)) {
      updateConfig({ [field]: value });
    }
  });
  $(`${field}-input`).addEventListener('change', (event) => {
    updateConfig({ [field]: event.target.value.trim() === '' ? config[field] : Number(event.target.value) });
  });
}
$('exercise-select').addEventListener('change', () => {
  if (!['ready', 'complete'].includes(timer.state)) return;
  save();
  preferences.activeExercise = $('exercise-select').value;
  config = { ...currentExercise(preferences).config };
  timer.configure(config);
  save();
  buildRoutine();
});
$('add-exercise-button').addEventListener('click', () => {
  $('exercise-form').hidden = !$('exercise-form').hidden;
  if (!$('exercise-form').hidden) $('exercise-name').focus();
});
$('cancel-exercise-button').addEventListener('click', () => { $('exercise-form').hidden = true; $('add-exercise-button').focus(); });
$('exercise-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!['ready', 'complete'].includes(timer.state)) return;
  const name = $('exercise-name').value.trim().slice(0, 40);
  if (!name) { $('exercise-name').focus(); return; }
  const existing = preferences.exercises.find(exercise => exercise.name === name);
  if (!existing && preferences.exercises.length >= 50) { toast('운동은 최대 50개까지 저장할 수 있어요.'); return; }
  save();
  const exercise = existing || { id: `exercise-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`, name, config: { ...config } };
  if (!existing) preferences.exercises.push(exercise);
  preferences.activeExercise = exercise.id;
  config = { ...exercise.config };
  timer.configure(config);
  $('exercise-form').reset();
  $('exercise-form').hidden = true;
  buildExercisePicker();
  save();
  buildRoutine();
  toast(existing ? `${name} 설정을 불러왔어요` : `${name} 운동을 추가했어요`);
});
$('prepare-toggle').addEventListener('click', () => updateConfig({ prepare: config.prepare ? 0 : 5 }));
$('awake-button').addEventListener('click', () => {
  if (preferences.keepAwake && ['blocked', 'interrupted'].includes(screenAwake.status)) { syncWakeLock(true); return; }
  if (screenAwake.status === 'unsupported' && preferences.keepAwake) toast('이 브라우저에서는 화면 켜짐 유지가 지원되지 않아요.');
  preferences.keepAwake = !preferences.keepAwake;
  save();
  syncWakeLock(true);
  renderAwake(screenAwake.status);
});

function renderSound() {
  $('sound-button').setAttribute('aria-pressed', String(sound));
  $('sound-button').setAttribute('aria-label', sound ? '알림음 끄기' : '알림음 켜기');
  $('sound-button').title = sound ? '알림음 끄기' : '알림음 켜기';
  $('sound-button').querySelector('use').setAttribute('href', sound ? '#i-sound' : '#i-mute');
}
$('sound-button').addEventListener('click', () => {
  sound = !sound; unlockAudio(); renderSound(); save(); beep();
  toast(sound ? '알림음을 켰어요' : '알림음을 껐어요');
});

function updateFocus(active) {
  document.body.classList.toggle('focus-mode', active);
  $('fullscreen-button').setAttribute('aria-pressed', String(active));
  $('fullscreen-button').setAttribute('aria-label', active ? '집중 모드 끄기' : '집중 모드 켜기');
  $('fullscreen-button').title = active ? '집중 모드 끄기' : '집중 모드 켜기';
}
$('fullscreen-button').addEventListener('click', async () => {
  const active = !document.body.classList.contains('focus-mode');
  updateFocus(active);
  try {
    if (active && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else if (!active && document.fullscreenElement) await document.exitFullscreen();
  } catch { /* In-page focus mode is available even if full screen is unsupported. */ }
});
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) updateFocus(false); });
document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') { updateFocus(false); return; }
  if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest('input, button, a, summary, [contenteditable="true"]')) return;
  event.preventDefault(); toggleTimer();
});
document.addEventListener('visibilitychange', () => {
  timer.tick(); render(); syncWakeLock(true);
  if (document.visibilityState === 'visible') unlockAudio();
});
window.addEventListener('pageshow', () => { timer.tick(); render(); syncWakeLock(true); });
window.addEventListener('pagehide', () => { screenAwake.sync(false); });
window.addEventListener('focus', () => { syncWakeLock(true); });

$('settings-panel').open = !window.matchMedia('(max-width: 760px)').matches;
buildDial();
buildExercisePicker();
save();
buildRoutine();
renderSound();
setInterval(() => { syncWakeLock(); }, 5000);
setInterval(() => {
  if (timer.state !== 'running') return;
  const changed = timer.tick();
  const snapshot = timer.snapshot();
  if (changed && snapshot.state !== 'complete') { beep('change'); try { navigator.vibrate?.(70); } catch {} }
  if (!changed && snapshot.seconds > 0 && snapshot.seconds <= 3 && snapshot.seconds !== lastSecond) beep();
  lastSecond = snapshot.seconds;
  render();
  document.title = snapshot.state === 'complete' ? '완료! — PACE' : `${clock(snapshot.seconds)} ${snapshot.phase.type === 'rest' ? '휴식' : snapshot.phase.type === 'prepare' ? '준비' : '운동'} — PACE`;
}, 100);
