export const DEFAULT_CONFIG = Object.freeze({ work: 30, rest: 45, sets: 3, prepare: 0 });

export function normalizeConfig(input = {}) {
  const number = (key, fallback, min, max) => {
    const parsed = Number(input[key]);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
  };
  return {
    work: number('work', 30, 1, 3600),
    rest: number('rest', 45, 0, 3600),
    sets: number('sets', 3, 1, 30),
    prepare: input.prepare ? 5 : 0,
  };
}

export function buildPhases(input) {
  const config = normalizeConfig(input);
  const phases = [];
  if (config.prepare) phases.push({ type: 'prepare', seconds: config.prepare, set: 1 });
  for (let set = 1; set <= config.sets; set++) {
    phases.push({ type: 'work', seconds: config.work, set });
    if (set < config.sets && config.rest > 0) phases.push({ type: 'rest', seconds: config.rest, set });
  }
  return phases;
}

export class IntervalTimer {
  constructor(config = DEFAULT_CONFIG, now = () => performance.now()) {
    this.now = now;
    this.configure(config);
  }

  configure(config) {
    this.config = normalizeConfig(config);
    this.phases = buildPhases(this.config);
    this.totalMs = this.phases.reduce((sum, phase) => sum + phase.seconds * 1000, 0);
    this.reset();
  }

  reset() {
    this.index = 0;
    this.state = 'ready';
    this.remainingMs = this.phases[0].seconds * 1000;
    this.deadline = 0;
  }

  start() {
    if (this.state === 'running') return;
    if (this.state === 'complete') this.reset();
    this.deadline = this.now() + this.remainingMs;
    this.state = 'running';
  }

  pause() {
    if (this.state !== 'running') return;
    this.tick();
    if (this.state === 'complete') return;
    this.remainingMs = Math.max(0, this.deadline - this.now());
    this.state = 'paused';
  }

  tick() {
    if (this.state !== 'running') return false;
    const time = this.now();
    let changed = false;
    while (this.state === 'running' && time >= this.deadline) {
      changed = true;
      this.index++;
      if (this.index === this.phases.length) {
        this.state = 'complete';
        this.remainingMs = 0;
      } else this.deadline += this.phases[this.index].seconds * 1000;
    }
    if (this.state === 'running') this.remainingMs = Math.max(0, this.deadline - time);
    return changed;
  }

  skip() {
    if (this.state === 'ready' || this.state === 'complete') return false;
    const wasRunning = this.state === 'running';
    this.index++;
    if (this.index >= this.phases.length) {
      this.state = 'complete';
      this.remainingMs = 0;
    } else {
      this.remainingMs = this.phases[this.index].seconds * 1000;
      if (wasRunning) this.deadline = this.now() + this.remainingMs;
    }
    return true;
  }

  snapshot() {
    const complete = this.state === 'complete';
    const phase = this.phases[Math.min(this.index, this.phases.length - 1)];
    const futureMs = this.phases.slice(this.index + 1).reduce((sum, next) => sum + next.seconds * 1000, 0);
    return {
      state: this.state,
      index: this.index,
      phase,
      next: complete ? null : this.phases[this.index + 1] ?? null,
      seconds: Math.ceil(this.remainingMs / 1000),
      totalRemaining: complete ? 0 : Math.ceil((this.remainingMs + futureMs) / 1000),
      progress: complete ? 1 : 1 - this.remainingMs / (phase.seconds * 1000),
      totalSeconds: this.totalMs / 1000,
    };
  }
}

export function clock(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
