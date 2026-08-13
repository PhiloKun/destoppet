// 设置窗口逻辑：读取/写入 Config，并同步系统能力（开机自启）
import { Config } from "./core/Config.js";

const config = new Config();
const hint = document.getElementById("hint");

const ids = ["followMouse", "autostart", "muted"];

async function refresh() {
  await config.ready();
  for (const id of ids) {
    document.getElementById(id).checked = !!config.get(id);
  }
}

for (const id of ids) {
  document.getElementById(id).addEventListener("change", async (e) => {
    const v = e.target.checked;
    await config.set(id, v);
    if (id === "autostart") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("set_autostart", { enable: v });
      } catch (err) {
        hint.textContent = "开机自启设置失败：" + err;
      }
    }
    hint.textContent = "";
  });
}

document.getElementById("close").addEventListener("click", async () => {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  } catch (e) {
    window.close();
  }
});

refresh();
