console.log("[Saskatoon BG] Background script loaded");

// Open setup page on first install
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const stored = await browser.storage.local.get(["setupComplete"]);
    if (!stored.setupComplete) {
      browser.tabs.create({ url: browser.runtime.getURL("setup.html") });
    }
  }
});

browser.runtime.onMessage.addListener((message, sender) => {
  console.log("[Saskatoon BG] Received message:", message.action);

  if (message.action === "enterFullscreen" && sender.tab) {
    return browser.windows.update(sender.tab.windowId, {
      state: "fullscreen"
    }).then((windowInfo) => {
      console.log("[Saskatoon BG] Window state after update:", windowInfo.state);
      return { success: true, state: windowInfo.state };
    }).catch((err) => {
      console.error("[Saskatoon BG] enterFullscreen failed:", err);
      return { success: false, error: err.message };
    });
  }

  if (message.action === "exitFullscreen" && sender.tab) {
    return browser.windows.update(sender.tab.windowId, {
      state: "normal"
    }).then((windowInfo) => {
      console.log("[Saskatoon BG] Exited fullscreen, state:", windowInfo.state);
      return { success: true, state: windowInfo.state };
    }).catch((err) => {
      console.error("[Saskatoon BG] exitFullscreen failed:", err);
      return { success: false, error: err.message };
    });
  }
});
