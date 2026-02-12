(function () {
  "use strict";

  // ==========================================================
  // Configuration & State
  // ==========================================================

  const CONFIG = {
    POLL_INTERVAL_MS: 1000,
    CLICK_COOLDOWN_MS: 5000,
    FULLSCREEN_DELAY_MS: 1000,
    SUBTITLE_DELAY_MS: 4000,
    autoNextEpisode: true,
    autoFullscreen: true,
    autoSubtitles: true,
  };

  const state = {
    lastClickTime: 0,
    wasFullscreen: false,
    userEnteredFullscreen: false,
    needsFullscreenRestore: false,
    subtitleLanguage: null,
  };

  // ==========================================================
  // Selector Strategy
  // ==========================================================
  // Priority: data-testid > aria-label > text content > class
  // Disney+ uses generated class names that break on redeploy,
  // so we avoid them as primary selectors.

  const SELECTORS = {
    upNextPlayButton: '[data-testid="up-next-play-button"]',
    skipButton: ".skip__button",
    upNextContainer: '[data-gv2containerkey="playerUpNext"]',
    videoElement: "video",
    fullscreenButton: [
      "#toggle-fullscreen",
      ".toggle-fullscreen-button",
      'button[aria-label*="ull screen"]',
      'button[aria-label*="ullscreen"]',
      '[data-testid*="fullscreen"]',
      'button[aria-label="Enter full screen"]',
    ],
    subtitlesMenuButton: [
      'button[aria-label*="udio and subtitle"]',
      'button[aria-label*="ubtitle"]',
      'button[aria-label*="losed caption"]',
      '.audio-subtitles-control > button',
      '[data-testid*="subtitle"]',
      '[data-testid*="audio"]',
    ],
    playerContainer: '[data-testid="web-player"]',
  };

  function queryFirst(selectorOrArray) {
    if (Array.isArray(selectorOrArray)) {
      for (const sel of selectorOrArray) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    }
    return document.querySelector(selectorOrArray);
  }

  function findElementByText(selectors, ...texts) {
    const elements = document.querySelectorAll(selectors);
    for (const el of elements) {
      const elText = el.textContent.trim().toLowerCase();
      for (const text of texts) {
        if (elText.includes(text.toLowerCase())) {
          return el;
        }
      }
    }
    return null;
  }

  // ==========================================================
  // Feature 1: Auto-Click Next Episode
  // ==========================================================

  function tryClickNextEpisode() {
    if (!CONFIG.autoNextEpisode) {
      console.log("[Saskatoon] autoNextEpisode is OFF, skipping");
      return false;
    }
    if (Date.now() - state.lastClickTime < CONFIG.CLICK_COOLDOWN_MS) return false;

    // Try multiple selectors for the next episode / skip button
    let btn = document.querySelector(SELECTORS.upNextPlayButton);
    if (!btn) btn = document.querySelector(SELECTORS.skipButton);
    if (!btn) btn = document.querySelector(".skip__button.body-copy");
    if (!btn) btn = document.querySelector('[class*="skip__button"]');
    if (!btn) btn = findElementByText("button, div, a, span", "next episode", "play next", "continue watching", "skip");

    if (btn) {
      console.log("[Saskatoon] Clicking next episode button:", btn.tagName, btn.className, btn.textContent.trim().substring(0, 50));
      state.wasFullscreen = !!document.fullscreenElement || state.userEnteredFullscreen;
      state.needsFullscreenRestore = state.wasFullscreen;
      console.log("[Saskatoon] wasFullscreen:", state.wasFullscreen);
      btn.click();
      state.lastClickTime = Date.now();
      state.userEnteredFullscreen = false;
      schedulePostTransitionActions();
      return true;
    }
    return false;
  }

  // ==========================================================
  // Feature 2: Re-enter Fullscreen (automatic)
  // ==========================================================
  // Requires about:config full-screen-api.allow-trusted-requests-only = false
  // With that setting, requestFullscreen() works without a user gesture,
  // so we can restore fullscreen fully automatically after transitions.

  function restoreFullscreen(retryCount = 0) {
    if (!CONFIG.autoFullscreen) return;
    if (document.fullscreenElement) return;

    // Click Disney+'s own fullscreen button (inside shadow DOM) so the
    // player sets up its internal state and controls work correctly.
    const toggleFs = document.querySelector("toggle-fullscreen");
    if (toggleFs && toggleFs.shadowRoot) {
      const btn = toggleFs.shadowRoot.querySelector("button.fullscreen-icon")
               || toggleFs.shadowRoot.querySelector("button");
      if (btn) {
        btn.click();
        console.log("[Saskatoon] Clicked Disney+ fullscreen button");
        state.needsFullscreenRestore = false;
        return;
      }
    }

    // Fallback: direct requestFullscreen if button not found
    const player = document.querySelector("disney-web-player")
                || document.querySelector(SELECTORS.playerContainer)
                || document.documentElement;

    player.requestFullscreen()
      .then(() => {
        console.log("[Saskatoon] Fullscreen restored via requestFullscreen fallback");
        state.needsFullscreenRestore = false;
      })
      .catch((err) => {
        console.warn("[Saskatoon] requestFullscreen failed:", err);
        if (retryCount < 10) {
          setTimeout(() => restoreFullscreen(retryCount + 1), 500);
        }
      });
  }

  // ==========================================================
  // Feature 3: Re-enable Subtitles
  // ==========================================================

  function tryReenableSubtitles() {
    if (!CONFIG.autoSubtitles) return;

    // Layer 1: HTML5 TextTrack API
    const video = document.querySelector(SELECTORS.videoElement);
    if (video && video.textTracks && video.textTracks.length > 0) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (track.kind === "subtitles" || track.kind === "captions") {
          if (state.subtitleLanguage && track.language !== state.subtitleLanguage) {
            continue;
          }
          if (track.mode !== "showing") {
            track.mode = "showing";
            console.log(`[Saskatoon] Enabled subtitle track: ${track.language}`);
            return;
          }
          return; // already showing
        }
      }
    }

    // Layer 2: Click through Disney+ subtitle UI
    tryClickSubtitleUI();
  }

  function tryClickSubtitleUI() {
    // Use the subtitleTrackPicker element directly by ID
    const picker = document.getElementById("subtitleTrackPicker");
    if (!picker) {
      console.warn("[Saskatoon] Could not find subtitleTrackPicker");
      return;
    }

    // Find the English subtitle radio input inside the picker
    const inputs = picker.querySelectorAll('input[type="radio"]');
    for (const input of inputs) {
      if (input.value === "off") continue;
      const label = document.querySelector(`label[for="${input.id}"]`);
      const text = label ? label.textContent.trim().toLowerCase() : "";
      if (text.includes("english")) {
        input.click();
        console.log("[Saskatoon] Selected subtitle: English");
        return;
      }
    }

    // Fallback: click the first non-off option
    for (const input of inputs) {
      if (input.value !== "off") {
        const label = document.querySelector(`label[for="${input.id}"]`);
        input.click();
        console.log(`[Saskatoon] Selected subtitle: ${label?.textContent.trim() || input.value}`);
        return;
      }
    }

    console.warn("[Saskatoon] No subtitle options found in picker");
  }

  // ==========================================================
  // Subtitle State Tracking
  // ==========================================================

  function rememberSubtitleState() {
    const video = document.querySelector(SELECTORS.videoElement);
    if (video && video.textTracks) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (
          track.mode === "showing" &&
          (track.kind === "subtitles" || track.kind === "captions")
        ) {
          state.subtitleLanguage = track.language || track.label;
          return;
        }
      }
    }
  }

  // ==========================================================
  // Post-Transition Orchestration
  // ==========================================================

  function schedulePostTransitionActions() {
    if (state.wasFullscreen) {
      setTimeout(() => restoreFullscreen(), CONFIG.FULLSCREEN_DELAY_MS);
    }
    setTimeout(() => tryReenableSubtitles(), CONFIG.SUBTITLE_DELAY_MS);
  }

  // ==========================================================
  // Detection: MutationObserver
  // ==========================================================

  function setupMutationObserver() {
    const skipSelectors = [
      SELECTORS.upNextPlayButton,
      SELECTORS.skipButton,
      ".skip__button.body-copy",
      '[class*="skip__button"]',
    ];

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          for (const sel of skipSelectors) {
            if (
              (node.matches && node.matches(sel)) ||
              (node.querySelector && node.querySelector(sel))
            ) {
              console.log("[Saskatoon] MutationObserver detected skip/next button via:", sel);
              tryClickNextEpisode();
              return;
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log("[Saskatoon] MutationObserver active");
  }

  // ==========================================================
  // Detection: Polling Fallback
  // ==========================================================

  function setupPollingFallback() {
    setInterval(() => {
      tryClickNextEpisode();
      rememberSubtitleState();
    }, CONFIG.POLL_INTERVAL_MS);
  }

  // ==========================================================
  // Detection: Video Events
  // ==========================================================

  function setupVideoListener() {
    function attachToVideo() {
      const video = document.querySelector(SELECTORS.videoElement);
      if (video && !video._saskatoonAttached) {
        video.addEventListener("ended", () => {
          console.log("[Saskatoon] Video ended event fired");
          setTimeout(() => tryClickNextEpisode(), 1000);
        });

        video.addEventListener("timeupdate", () => {
          if (video.duration && video.currentTime > 0) {
            const remaining = video.duration - video.currentTime;
            if (remaining < 30) {
              rememberSubtitleState();
            }
            // Remember fullscreen state before the transition
            if (remaining < 10 && document.fullscreenElement) {
              state.userEnteredFullscreen = true;
            }
          }
        });

        video._saskatoonAttached = true;
        console.log("[Saskatoon] Attached to <video> element");
      }
    }

    attachToVideo();
    setInterval(attachToVideo, 3000);
  }

  // ==========================================================
  // Selector Validation (Debug Logging)
  // ==========================================================

  function validateSelectors() {
    const checks = [
      ["videoElement", SELECTORS.videoElement],
      ["playerContainer", SELECTORS.playerContainer],
      ["fullscreenButton", SELECTORS.fullscreenButton],
      ["subtitlesMenuButton", SELECTORS.subtitlesMenuButton],
    ];

    for (const [name, sel] of checks) {
      const el = queryFirst(sel);
      if (el) {
        console.log(`[Saskatoon] Found ${name}`);
      } else {
        console.warn(`[Saskatoon] Not found: ${name}`);
      }
    }
  }

  // ==========================================================
  // Initialization
  // ==========================================================

  async function init() {
    try {
      const stored = await browser.storage.local.get([
        "autoNextEpisode",
        "autoFullscreen",
        "autoSubtitles",
        "subtitleLanguage",
      ]);
      if (stored.autoNextEpisode !== undefined) CONFIG.autoNextEpisode = stored.autoNextEpisode;
      if (stored.autoFullscreen !== undefined) CONFIG.autoFullscreen = stored.autoFullscreen;
      if (stored.autoSubtitles !== undefined) CONFIG.autoSubtitles = stored.autoSubtitles;
      if (stored.subtitleLanguage) state.subtitleLanguage = stored.subtitleLanguage;
    } catch (e) {
      console.warn("[Saskatoon] Could not load preferences:", e);
    }

    // Listen for settings changes from popup
    browser.storage.onChanged.addListener((changes) => {
      if (changes.autoNextEpisode) CONFIG.autoNextEpisode = changes.autoNextEpisode.newValue;
      if (changes.autoFullscreen) CONFIG.autoFullscreen = changes.autoFullscreen.newValue;
      if (changes.autoSubtitles) CONFIG.autoSubtitles = changes.autoSubtitles.newValue;
      if (changes.subtitleLanguage) state.subtitleLanguage = changes.subtitleLanguage.newValue;
      console.log("[Saskatoon] Settings updated");
    });

    console.log("[Saskatoon] Initializing with settings:", JSON.stringify({
      autoNextEpisode: CONFIG.autoNextEpisode,
      autoFullscreen: CONFIG.autoFullscreen,
      autoSubtitles: CONFIG.autoSubtitles,
    }));

    // Track fullscreen state and auto-restore on transition
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement) {
        state.userEnteredFullscreen = true;
        console.log("[Saskatoon] User entered fullscreen");
      } else if (state.userEnteredFullscreen) {
        state.userEnteredFullscreen = false;

        // Player gone = episode transition → auto-restore
        // Player present = user pressed Escape → don't restore
        const player = document.querySelector("disney-web-player")
                    || document.querySelector(SELECTORS.playerContainer)
                    || document.querySelector("video");

        if (!player) {
          console.log("[Saskatoon] Fullscreen lost during transition, restoring automatically");
          state.needsFullscreenRestore = true;
          // Delay to let the new player load into the DOM
          setTimeout(() => restoreFullscreen(), CONFIG.FULLSCREEN_DELAY_MS);
          setTimeout(() => tryReenableSubtitles(), CONFIG.SUBTITLE_DELAY_MS);
        } else {
          console.log("[Saskatoon] User manually exited fullscreen");
        }
      }
    });

    // Handle messages from popup (e.g. fullscreen permission test)
    browser.runtime.onMessage.addListener((message) => {
      if (message.action === "testFullscreen") {
        const el = document.createElement("div");
        document.body.appendChild(el);
        return el.requestFullscreen()
          .then(() => {
            document.exitFullscreen();
            el.remove();
            return { success: true };
          })
          .catch(() => {
            el.remove();
            return { success: false };
          });
      }
    });

    setupMutationObserver();
    setupPollingFallback();
    setupVideoListener();

    // Run selector validation after a delay (let the SPA render)
    setTimeout(validateSelectors, 5000);
  }

  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }
})();
