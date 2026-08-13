// 设置读写封装（基于 Tauri store 本地 JSON）
// 存储项：followMouse（跟随鼠标）、muted（静音）、autostart（开机自启）
import { load } from "@tauri-apps/plugin-store";

const STORE_FILE = "mochi.json";

const DEFAULTS = {
  followMouse: true, // 鼠标靠近时宠物看向鼠标
  muted: false,
  autostart: false, // 开机自启
};

let storePromise = null;

async function getStore() {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true });
  }
  return storePromise;
}

export class Config {
  constructor() {
    this.values = { ...DEFAULTS };
    this._ready = this.load();
  }

  async load() {
    try {
      const store = await getStore();
      for (const key of Object.keys(DEFAULTS)) {
        const v = await store.get(key);
        if (v !== null && v !== undefined) this.values[key] = v;
      }
    } catch (e) {
      // 非 Tauri 环境或读取失败：用默认值
    }
    return this.values;
  }

  get(key) {
    return this.values[key];
  }

  async set(key, value) {
    this.values[key] = value;
    try {
      const store = await getStore();
      await store.set(key, value);
      await store.save();
    } catch (e) {
      // 忽略
    }
  }

  ready() {
    return this._ready;
  }
}
