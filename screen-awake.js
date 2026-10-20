// Keep a single screen lock, including across tab visibility and request races.
export class ScreenAwake {
  constructor({ request, visible = () => true, onStatus = () => {}, now = () => Date.now(), retryMs = 5000 } = {}) {
    this.request = request;
    this.visible = visible;
    this.onStatus = onStatus;
    this.now = now;
    this.retryMs = retryMs;
    this.enabled = false;
    this.lock = null;
    this.pending = null;
    this.nextAttempt = 0;
    this.status = 'off';
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus(status);
  }

  async release() {
    const lock = this.lock;
    this.lock = null;
    if (lock && !lock.released) { try { await lock.release(); } catch {} }
  }

  async sync(enabled = this.enabled, { force = false } = {}) {
    this.enabled = enabled;
    if (!enabled || !this.visible()) {
      this.setStatus(enabled ? 'hidden' : 'off');
      await this.release();
      return;
    }
    if (!this.request) { this.setStatus('unsupported'); return; }
    if (this.lock && !this.lock.released) { this.setStatus('active'); return; }
    if (this.pending) return this.pending;
    if (!force && this.now() < this.nextAttempt) return;
    this.nextAttempt = this.now() + this.retryMs;
    this.setStatus('requesting');
    this.pending = (async () => {
      try {
        const lock = await Promise.resolve().then(() => this.request());
        if (!this.enabled || !this.visible()) {
          try { await lock.release(); } catch {}
          this.setStatus(this.enabled ? 'hidden' : 'off');
          return;
        }
        // The browser can release a sentinel before its request settles.
        // Never report an already released lock as keeping the screen awake.
        if (lock.released) {
          this.setStatus('interrupted');
          return;
        }
        this.lock = lock;
        lock.addEventListener('release', () => {
          if (this.lock !== lock) return;
          this.lock = null;
          this.setStatus(this.enabled ? (this.visible() ? 'interrupted' : 'hidden') : 'off');
        });
        this.setStatus('active');
      } catch {
        if (this.enabled && this.visible()) this.setStatus('blocked');
      } finally { this.pending = null; }
    })();
    return this.pending;
  }
}
