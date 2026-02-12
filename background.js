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
  if (message.action === "enterFullscreen" && sender.tab) {
    return browser.windows.update(sender.tab.windowId, {
      state: "fullscreen"
    }).then((windowInfo) => {
      return { success: true, state: windowInfo.state };
    }).catch((err) => {
      return { success: false, error: err.message };
    });
  }

  if (message.action === "exitFullscreen" && sender.tab) {
    return browser.windows.update(sender.tab.windowId, {
      state: "normal"
    }).then((windowInfo) => {
      return { success: true, state: windowInfo.state };
    }).catch((err) => {
      return { success: false, error: err.message };
    });
  }
});
