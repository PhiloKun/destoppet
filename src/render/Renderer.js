// Canvas 渲染器：窗口尺寸=宠物大小(64x64)，处理 DPI 适配
export class Renderer {
  constructor(canvas, size = 64) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = window.devicePixelRatio || 1;
    this.width = size;
    this.height = size;
    this.resize();
  }

  resize() {
    const w = this.width;
    const h = this.height;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
