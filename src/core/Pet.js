// 宠物状态机：WALK / IDLE / SLEEP / LOOK
// 用程序化绘制的占位宠物（方块 + 眼睛），后续可替换为 Sprite 精灵图。

export const State = {
  WALK: "WALK",
  IDLE: "IDLE",
  SLEEP: "SLEEP",
  LOOK: "LOOK",
};

export class Pet {
  constructor(screen) {
    this.screen = screen; // { width, height }
    this.x = screen.width * 0.5;
    this.y = screen.height - 120; // 贴底
    this.dir = 1; // 1 右, -1 左
    this.size = 64;
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

  // mouse: { x, y } | null
  update(dt, mouse) {
    this.stateTime += dt;
    this.blink -= dt;
    if (this.blink < 0 && Math.random() < 0.01) this.blink = 120; // 偶尔眨眼

    switch (this.state) {
      case State.WALK: {
        const speed = 0.06 * dt; // px/ms
        this.x += this.dir * speed;
        if (this.x < 20) {
          this.x = 20;
          this.dir = 1;
        }
        if (this.x > this.screen.width - 20 - this.size) {
          this.x = this.screen.width - 20 - this.size;
          this.dir = -1;
        }
        if (this.stateTime > this.nextThink) {
          this.setState(Math.random() < 0.5 ? State.IDLE : State.SLEEP);
          this.nextThink = 800 + Math.random() * 2000;
        }
        break;
      }
      case State.IDLE: {
        if (mouse && Math.abs(mouse.x - (this.x + this.size / 2)) < 200) {
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
      case State.SLEEP: {
        if (this.stateTime > 4000 + Math.random() * 3000) {
          this.setState(State.IDLE);
          this.nextThink = 600 + Math.random() * 1000;
        }
        break;
      }
      case State.LOOK: {
        if (!mouse || Math.abs(mouse.x - (this.x + this.size / 2)) > 260) {
          this.setState(State.IDLE);
        }
        break;
      }
    }
  }

  draw(ctx) {
    const s = this.size;
    const x = this.x;
    const y = this.y;
    ctx.save();

    // 身体（圆角方块）
    ctx.fillStyle = "#7ec8e3";
    this.roundRect(ctx, x, y, s, s, 14);
    ctx.fill();

    // 脚（走动时小幅摆动）
    ctx.fillStyle = "#5aa9c9";
    const foot = this.state === State.WALK ? Math.sin(this.stateTime / 80) * 4 : 0;
    ctx.fillRect(x + 10, y + s - 6, 14, 8 + foot);
    ctx.fillRect(x + s - 24, y + s - 6, 14, 8 - foot);

    // 眼睛（眨眼 / 看向鼠标）
    const eyeY = y + 24;
    const blink = this.blink > 0;
    let lookOff = 0;
    if (this.state === State.LOOK && this.lookTargetX != null) {
      lookOff = this.lookTargetX > x + s / 2 ? 3 : -3;
    }
    ctx.fillStyle = "#222";
    if (blink) {
      ctx.fillRect(x + 16, eyeY, 10, 2);
      ctx.fillRect(x + s - 26, eyeY, 10, 2);
    } else {
      ctx.beginPath();
      ctx.arc(x + 21 + lookOff, eyeY, 5, 0, Math.PI * 2);
      ctx.arc(x + s - 21 + lookOff, eyeY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 睡觉时的 Zzz
    if (this.state === State.SLEEP) {
      ctx.fillStyle = "rgba(80,80,80,0.7)";
      ctx.font = "14px sans-serif";
      const a = (this.stateTime / 600) % 1;
      ctx.globalAlpha = 1 - a;
      ctx.fillText("z", x + s - 6, y - 6 - a * 14);
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
