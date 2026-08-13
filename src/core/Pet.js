// 宠物状态机：WALK / IDLE / SLEEP / LOOK
// 用程序化绘制的占位宠物（方块 + 眼睛），后续可替换为 Sprite 精灵图。

export const State = {
  WALK: "WALK",
  IDLE: "IDLE",
  SLEEP: "SLEEP",
  LOOK: "LOOK",
  HAPPY: "HAPPY", // 点击反馈：开心一跳
};

export class Pet {
  constructor(screen) {
    this.screen = screen; // { width, height }
    this.size = 64;
    this.x = screen.width * 0.5; // 窗口在屏幕上的 x
    this.y = screen.height - this.size; // 贴底
    this.dir = 1; // 1 右, -1 左
    this.state = State.IDLE;
    this.stateTime = 0; // 当前状态已持续时间(ms)
    this.nextThink = 800 + Math.random() * 1200; // 下次决策间隔
    this.blink = 0; // 眨眼计时
    this.lookTargetX = null; // LOOK 时注视的 x
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
  }

  centerX() {
    return this.x + this.size / 2;
  }

  // mouse: { x, y } | null ; followMouse: 是否允许看向鼠标
  update(dt, mouse, followMouse = true) {
    this.stateTime += dt;
    this.blink -= dt;
    if (this.blink < 0 && Math.random() < 0.01) this.blink = 120; // 偶尔眨眼

    switch (this.state) {
      case State.WALK: {
        const speed = 0.06 * dt; // px/ms
        this.x += this.dir * speed;
        if (this.x < 0) {
          this.x = 0;
          this.dir = 1;
        }
        if (this.x > this.screen.width - this.size) {
          this.x = this.screen.width - this.size;
          this.dir = -1;
        }
        if (this.stateTime > this.nextThink) {
          this.setState(Math.random() < 0.5 ? State.IDLE : State.SLEEP);
          this.nextThink = 800 + Math.random() * 2000;
        }
        break;
      }
      case State.IDLE: {
        if (followMouse && mouse && Math.abs(mouse.x - this.centerX()) < 200) {
          this.lookTargetX = mouse.x;
          this.setState(State.LOOK);
          break;
        }
        if (this.stateTime > this.nextThink) {
          const r = Math.random();
          if (r < 0.6) this.setState(State.WALK);
          else this.setState(State.SLEEP);
          this.nextThink = 800 + Math.random() * 2000;
        }
        break;
      }
      case State.HAPPY: {
        // 开心一跳，约 600ms 后回 IDLE
        if (this.stateTime > 600) {
          this.setState(State.IDLE);
          this.nextThink = 600 + Math.random() * 1000;
        }
        break;
      }
      case State.SLEEP: {
        if (this.stateTime > 4000 + Math.random() * 3000) {
          this.setState(State.IDLE);
          this.nextThink = 600 + Math.random() * 1000;
        }
        break;
      }
      case State.LOOK: {
        if (!followMouse || !mouse || Math.abs(mouse.x - this.centerX()) > 260) {
          this.setState(State.IDLE);
        }
        break;
      }
    }
  }

  // 点击反馈：触发开心一跳（若正在拖拽/睡觉也允许被打断）
  triggerHappy() {
    this.setState(State.HAPPY);
    this.stateTime = 0;
  }

  draw(ctx) {
    const s = this.size;
    // 宠物绘制在窗口内 (0,0)，窗口位置由前端每帧 setPosition 跟随 this.x/this.y
    let y = 0;
    let jump = 0;
    if (this.state === State.HAPPY) {
      const t = this.stateTime / 600; // 0..1
      jump = Math.sin(t * Math.PI) * 18;
      y -= jump;
    }
    ctx.save();

    // 身体（圆角方块）
    ctx.fillStyle = "#7ec8e3";
    this.roundRect(ctx, 0, y, s, s, 14);
    ctx.fill();

    // 脚（走动时小幅摆动；开心时收起）
    ctx.fillStyle = "#5aa9c9";
    const foot = this.state === State.WALK ? Math.sin(this.stateTime / 80) * 4 : 0;
    const footH = this.state === State.HAPPY ? 4 : 8;
    ctx.fillRect(10, y + s - 6, 14, footH + foot);
    ctx.fillRect(s - 24, y + s - 6, 14, footH - foot);

    // 眼睛（眨眼 / 看向鼠标 / 开心弯月）
    const eyeY = y + 24;
    const blink = this.blink > 0;
    let lookOff = 0;
    if (this.state === State.LOOK && this.lookTargetX != null) {
      lookOff = this.lookTargetX > this.centerX() ? 3 : -3;
    }
    ctx.fillStyle = "#222";
    if (blink) {
      ctx.fillRect(16, eyeY, 10, 2);
      ctx.fillRect(s - 26, eyeY, 10, 2);
    } else if (this.state === State.HAPPY) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#222";
      for (const cx of [21, s - 21]) {
        ctx.beginPath();
        ctx.arc(cx + lookOff, eyeY + 4, 5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(21 + lookOff, eyeY, 5, 0, Math.PI * 2);
      ctx.arc(s - 21 + lookOff, eyeY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 开心张嘴
    if (this.state === State.HAPPY) {
      ctx.fillStyle = "#e06b6b";
      ctx.beginPath();
      ctx.arc(s / 2, y + 44, 6, 0, Math.PI);
      ctx.fill();
    }

    // 睡觉时的 Zzz
    if (this.state === State.SLEEP) {
      ctx.fillStyle = "rgba(80,80,80,0.7)";
      ctx.font = "14px sans-serif";
      const a = (this.stateTime / 600) % 1;
      ctx.globalAlpha = 1 - a;
      ctx.fillText("z", s - 6, y - 6 - a * 14);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
