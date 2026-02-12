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
    if (!CONFIG.autoNextEpisode) return false;
    if (Date.now() - state.lastClickTime < CONFIG.CLICK_COOLDOWN_MS) return false;

    let btn = document.querySelector(SELECTORS.upNextPlayButton);
    if (!btn) btn = document.querySelector(SELECTORS.skipButton);
    if (!btn) btn = document.querySelector(".skip__button.body-copy");
    if (!btn) btn = document.querySelector('[class*="skip__button"]');
    if (!btn) btn = findElementByText("button, div, a, span", "next episode", "play next", "continue watching", "skip");

    if (btn) {
      state.wasFullscreen = !!document.fullscreenElement || state.userEnteredFullscreen;
      state.needsFullscreenRestore = state.wasFullscreen;
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
        state.needsFullscreenRestore = false;
      })
      .catch(() => {
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
    const picker = document.getElementById("subtitleTrackPicker");
    if (!picker) return;

    // Find the English subtitle radio input inside the picker
    const inputs = picker.querySelectorAll('input[type="radio"]');
    for (const input of inputs) {
      if (input.value === "off") continue;
      const label = document.querySelector(`label[for="${input.id}"]`);
      const text = label ? label.textContent.trim().toLowerCase() : "";
      if (text.includes("english")) {
        input.click();
        return;
      }
    }

    // Fallback: click the first non-off option
    for (const input of inputs) {
      if (input.value !== "off") {
        input.click();
        return;
      }
    }
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
              tryClickNextEpisode();
              return;
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
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
          setTimeout(() => tryClickNextEpisode(), 1000);
        });

        video.addEventListener("timeupdate", () => {
          if (video.duration && video.currentTime > 0) {
            const remaining = video.duration - video.currentTime;
            if (remaining < 30) {
              rememberSubtitleState();
            }
            if (remaining < 10 && document.fullscreenElement) {
              state.userEnteredFullscreen = true;
            }
          }
        });

        video._saskatoonAttached = true;
      }
    }

    attachToVideo();
    setInterval(attachToVideo, 3000);
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
      // Settings load failed, using defaults
    }

    // Listen for settings changes from popup
    browser.storage.onChanged.addListener((changes) => {
      if (changes.autoNextEpisode) CONFIG.autoNextEpisode = changes.autoNextEpisode.newValue;
      if (changes.autoFullscreen) CONFIG.autoFullscreen = changes.autoFullscreen.newValue;
      if (changes.autoSubtitles) CONFIG.autoSubtitles = changes.autoSubtitles.newValue;
      if (changes.subtitleLanguage) state.subtitleLanguage = changes.subtitleLanguage.newValue;
    });

    // Track fullscreen state and auto-restore on transition
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement) {
        state.userEnteredFullscreen = true;
      } else if (state.userEnteredFullscreen) {
        state.userEnteredFullscreen = false;

        // Player gone = episode transition → auto-restore
        // Player present = user pressed Escape → don't restore
        const player = document.querySelector("disney-web-player")
                    || document.querySelector(SELECTORS.playerContainer)
                    || document.querySelector("video");

        if (!player) {
          state.needsFullscreenRestore = true;
          setTimeout(() => restoreFullscreen(), CONFIG.FULLSCREEN_DELAY_MS);
          setTimeout(() => tryReenableSubtitles(), CONFIG.SUBTITLE_DELAY_MS);
        }
      }
    });

    setupMutationObserver();
    setupPollingFallback();
    setupVideoListener();
  }

  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }
})();
