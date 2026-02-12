// ==========================================================
// Setup detection
// ==========================================================

async function checkSetupComplete() {
  const stored = await browser.storage.local.get(["setupComplete"]);
  return stored.setupComplete === true;
}

async function showCorrectScreen() {
  const setupDone = await checkSetupComplete();

  if (setupDone) {
    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("settings-screen").style.display = "block";
  } else {
    document.getElementById("setup-screen").style.display = "block";
    document.getElementById("settings-screen").style.display = "none";
  }
}

// "I've completed the setup" button — trust the user
document.getElementById("setup-done-btn").addEventListener("click", async () => {
  await browser.storage.local.set({ setupComplete: true });
  showCorrectScreen();
});

// ==========================================================
// Settings
// ==========================================================

async function loadSettings() {
  const stored = await browser.storage.local.get([
    "autoNextEpisode",
    "autoFullscreen",
    "autoSubtitles",
    "subtitleLanguage",
  ]);

  document.getElementById("autoNext").checked = stored.autoNextEpisode !== false;
  document.getElementById("autoFullscreen").checked = stored.autoFullscreen !== false;
  document.getElementById("autoSubtitles").checked = stored.autoSubtitles !== false;
  document.getElementById("subtitleLang").value = stored.subtitleLanguage || "";
}

function saveSettings() {
  browser.storage.local.set({
    autoNextEpisode: document.getElementById("autoNext").checked,
    autoFullscreen: document.getElementById("autoFullscreen").checked,
    autoSubtitles: document.getElementById("autoSubtitles").checked,
    subtitleLanguage: document.getElementById("subtitleLang").value,
  });
}

document.querySelectorAll("input, select").forEach((el) => {
  el.addEventListener("change", saveSettings);
});

loadSettings();
showCorrectScreen();
