import { Pet, State } from "./core/Pet.js";
import { Loop } from "./core/Loop.js";
import { Renderer } from "./render/Renderer.js";

const canvas = document.getElementById("stage");
const renderer = new Renderer(canvas);
const pet = new Pet({ width: renderer.width, height: renderer.height });

// 监听窗口尺寸变化，同步宠物活动边界
window.addEventListener("resize", () => {
  pet.screen = { width: renderer.width, height: renderer.height };
});

// 鼠标位置（用于 LOOK 注视），Tauri 窗口设置了点击穿透，
// 这里通过 webview 自身监听获取鼠标位置（在穿透关闭拖拽时也可用）
const mouse = { x: null, y: null };
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

const loop = new Loop((dt, now) => {
  pet.update(dt, mouse);
  renderer.clear();
  pet.draw(renderer.ctx);
});

loop.start();

// 便于调试
window.__pet = pet;
