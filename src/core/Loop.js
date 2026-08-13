// 主循环：requestAnimationFrame，计算 dt 并回调 update/draw
export class Loop {
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.last = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
  }

  _tick(now) {
    if (!this.running) return;
    const dt = Math.min(now - this.last, 50); // 限制最大 dt，防止后台标签页跳变
    this.last = now;
    this.onFrame(dt, now);
    requestAnimationFrame(this._tick);
  }
}
