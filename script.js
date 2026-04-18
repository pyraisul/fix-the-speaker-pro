// Speaker Cleaner Tool — plays sound.mp3 (water & dust) and vibrate.mp3 (vibration mode)

const SOUND_MP3 = "sound.mp3";
const VIBRATE_MP3 = "vibrate.mp3";

let audioContext;
/** Splits stereo MP3 into L/R paths so "Left / Right" mutes the other channel (clearer than StereoPanner on many PCs). */
let channelSplitter;
let gainSpeakerL;
let gainSpeakerR;
let channelMerger;
let soundEl;
let vibrateEl;
let soundMediaNode;
let vibrateMediaNode;
let graphReady = false;
/** When false, MP3s play via plain HTMLAudioElement (needed for file:// and if Web Audio routing fails). */
let useWebAudioRouting = false;

function isHttpLikeOrigin() {
  return location.protocol === "http:" || location.protocol === "https:";
}

let isPlaying = false;
let currentMode = "water";
let lastSoundMode = "water";
let currentSpeaker = "both";
let progressInterval;
let vibrationInterval;
/** Set while an MP3 session is active; call to settle the waiting promise (e.g. on Stop). */
let settlePlayback = null;

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  setupMobileMenu();
  setupFAQ();
  setupSmoothScroll();
});

function ensureAudioGraph() {
  if (graphReady) return;

  soundEl = new Audio(SOUND_MP3);
  vibrateEl = new Audio(VIBRATE_MP3);
  soundEl.preload = "auto";
  vibrateEl.preload = "auto";

  useWebAudioRouting = false;
  soundMediaNode = undefined;
  vibrateMediaNode = undefined;

  if (!isHttpLikeOrigin()) {
    graphReady = true;
    return;
  }

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    graphReady = true;
    return;
  }

  try {
    audioContext = new AC();
    channelSplitter = audioContext.createChannelSplitter(2);
    gainSpeakerL = audioContext.createGain();
    gainSpeakerR = audioContext.createGain();
    channelMerger = audioContext.createChannelMerger(2);
    channelSplitter.connect(gainSpeakerL, 0);
    channelSplitter.connect(gainSpeakerR, 1);
    gainSpeakerL.connect(channelMerger, 0, 0);
    gainSpeakerR.connect(channelMerger, 0, 1);
    channelMerger.connect(audioContext.destination);
    applySpeakerPan();
    soundMediaNode = audioContext.createMediaElementSource(soundEl);
    vibrateMediaNode = audioContext.createMediaElementSource(vibrateEl);
    useWebAudioRouting = true;
  } catch (e) {
    console.warn("Web Audio routing unavailable; using direct speaker output.", e);
    audioContext = undefined;
    channelSplitter = undefined;
    gainSpeakerL = undefined;
    gainSpeakerR = undefined;
    channelMerger = undefined;
    soundMediaNode = undefined;
    vibrateMediaNode = undefined;
    useWebAudioRouting = false;
  }

  graphReady = true;
}

function applySpeakerPan() {
  if (!useWebAudioRouting || !gainSpeakerL || !gainSpeakerR || !audioContext) return;
  const t = audioContext.currentTime;
  switch (currentSpeaker) {
    case "left":
      gainSpeakerL.gain.setValueAtTime(1, t);
      gainSpeakerR.gain.setValueAtTime(0, t);
      break;
    case "right":
      gainSpeakerL.gain.setValueAtTime(0, t);
      gainSpeakerR.gain.setValueAtTime(1, t);
      break;
    case "both":
    default:
      gainSpeakerL.gain.setValueAtTime(1, t);
      gainSpeakerR.gain.setValueAtTime(1, t);
      break;
  }
}

function disconnectMediaFromPanner() {
  if (!useWebAudioRouting || !soundMediaNode) return;
  try {
    soundMediaNode.disconnect();
  } catch (e) {
    /* not connected */
  }
  try {
    vibrateMediaNode.disconnect();
  } catch (e) {
    /* not connected */
  }
}

/** Pause and rewind both MP3 elements; detach from panner. */
function stopAllAudio() {
  if (soundEl) {
    soundEl.pause();
    soundEl.currentTime = 0;
  }
  if (vibrateEl) {
    vibrateEl.pause();
    vibrateEl.currentTime = 0;
  }
  if (graphReady && useWebAudioRouting) disconnectMediaFromPanner();
}

/**
 * Play one HTMLMediaElement through the shared panner until it ends or cleaning stops.
 * @returns {Promise<void>}
 */
function playMp3ThroughGraph(mediaEl, mediaNode, statusWhilePlaying, statusIfCompleted) {
  stopAllAudio();
  if (useWebAudioRouting && mediaNode && channelSplitter) {
    applySpeakerPan();
    disconnectMediaFromPanner();
    mediaNode.connect(channelSplitter);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (naturalEnd) => {
      if (settled) return;
      settled = true;
      settlePlayback = null;
      clearInterval(progressInterval);
      progressInterval = null;
      mediaEl.removeEventListener("ended", onEnded);
      if (naturalEnd && isPlaying && statusIfCompleted) {
        updateProgress(100, statusIfCompleted);
      }
      resolve();
    };

    const onEnded = () => finish(true);

    settlePlayback = () => finish(false);

    updateProgress(0, statusWhilePlaying);

    progressInterval = setInterval(() => {
      if (!isPlaying) {
        mediaEl.pause();
        if (settlePlayback) settlePlayback();
        return;
      }
      const d = mediaEl.duration;
      if (d && isFinite(d) && d > 0) {
        updateProgress((mediaEl.currentTime / d) * 100, statusWhilePlaying);
      }
    }, 100);

    mediaEl.currentTime = 0;
    mediaEl.addEventListener("ended", onEnded);

    mediaEl.play().catch((err) => {
      console.error(err);
      isPlaying = false;
      settlePlayback();
      alert(
        "Could not play audio. Check that sound.mp3 / vibrate.mp3 are in the same folder as this page, then try again."
      );
    });
  });
}

function handlePrimaryAction() {
  if (isPlaying) {
    stopCleaning();
  } else {
    startCleaning();
  }
}

function setupEventListeners() {
  const startBtn = document.getElementById("startBtn");
  if (!startBtn) return;

  const soundTool = document.getElementById("soundTool");

  const modeTypeBtns = document.querySelectorAll(".mode-type-btn");
  modeTypeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      modeTypeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (type === "vibrate") {
        if (soundTool) soundTool.classList.add("sound-tool--vibrate-type");
        if (currentMode === "water" || currentMode === "dust") {
          lastSoundMode = currentMode;
        }
        currentMode = "vibrate";
        document
          .querySelectorAll(".sound-submodes .mode-btn")
          .forEach((b) => b.classList.remove("active"));
      } else {
        if (soundTool) soundTool.classList.remove("sound-tool--vibrate-type");
        currentMode = lastSoundMode;
        document.querySelectorAll(".sound-submodes .mode-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.mode === lastSoundMode);
        });
      }
      updateEjectHint();
    });
  });

  const modeBtns = document.querySelectorAll(".sound-submodes .mode-btn");
  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode;
      lastSoundMode = currentMode;
      updateEjectHint();
    });
  });

  const speakerBtns = document.querySelectorAll(".speaker-btn");
  speakerBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      speakerBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSpeaker = btn.dataset.speaker;
      applySpeakerPan();
    });
  });

  startBtn.addEventListener("click", handlePrimaryAction);

  initProgressGauge();
  updateEjectHint();
}

function updateEjectHint() {
  const el = document.getElementById("ejectHint");
  if (!el) return;
  if (currentMode === "vibrate") {
    el.textContent = "Press for vibration mode";
  } else if (currentMode === "dust") {
    el.textContent = "Press to remove dust";
  } else {
    el.textContent = "Press to eject water";
  }
}

function initProgressGauge() {
  const gaugePath = document.getElementById("progressGaugeFill");
  if (!gaugePath) return;
  gaugePath.style.strokeDasharray = "100";
  gaugePath.style.strokeDashoffset = "100";
}

async function startCleaning() {
  if (isPlaying) return;

  ensureAudioGraph();
  if (!graphReady || !soundEl || !vibrateEl) {
    alert("Audio could not be initialized in this browser.");
    return;
  }

  if (useWebAudioRouting && audioContext) {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  }

  isPlaying = true;
  updateUIState(true);
  updateProgress(0, "Starting...");

  switch (currentMode) {
    case "water":
      await waterEjectMode();
      break;
    case "dust":
      await dustRemovalMode();
      break;
    case "vibrate":
      await vibrationMode();
      break;
  }

  stopVibration();
  stopAllAudio();
  isPlaying = false;
  updateUIState(false);
}

function stopCleaning() {
  isPlaying = false;
  stopAllAudio();
  stopVibration();
  if (settlePlayback) {
    settlePlayback();
  }
  clearInterval(progressInterval);
  progressInterval = null;
  updateProgress(0, "Stopped");
  updateUIState(false);
}

async function waterEjectMode() {
  await playMp3ThroughGraph(
    soundEl,
    soundMediaNode,
    "Ejecting water...",
    "Water ejection complete!"
  );
}

async function dustRemovalMode() {
  await playMp3ThroughGraph(
    soundEl,
    soundMediaNode,
    "Removing dust...",
    "Dust removal complete!"
  );
}

async function vibrationMode() {
  if (!("vibrate" in navigator)) {
    alert("Vibration API is not supported on this device; audio will still play.");
  } else {
    startVibrationPattern();
  }

  await playMp3ThroughGraph(
    vibrateEl,
    vibrateMediaNode,
    "Vibrating...",
    "Vibration complete!"
  );

  stopVibration();
}

function startVibrationPattern() {
  const pattern = [200, 100];
  vibrationInterval = setInterval(() => {
    if (isPlaying && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, 300);
}

function stopVibration() {
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  if ("vibrate" in navigator) {
    navigator.vibrate(0);
  }
}

function updateProgress(percent, status) {
  const p = Math.min(100, Math.max(0, percent));
  const progressPercent = document.getElementById("progressPercent");
  const statusText = document.getElementById("statusText");
  const gaugePath = document.getElementById("progressGaugeFill");
  const progressFill = document.getElementById("progressFill");

  if (progressPercent) progressPercent.textContent = `${Math.round(p)}%`;
  if (statusText) statusText.textContent = status;
  if (gaugePath) gaugePath.style.strokeDashoffset = String(100 - p);
  if (progressFill) progressFill.style.width = `${p}%`;
}

function updateUIState(playing) {
  const startBtn = document.getElementById("startBtn");
  const primaryToggleLabel = document.getElementById("primaryToggleLabel");
  const modeBtns = document.querySelectorAll(".sound-submodes .mode-btn");
  const speakerBtns = document.querySelectorAll(".speaker-btn");
  const modeTypeBtns = document.querySelectorAll(".mode-type-btn");

  if (startBtn) {
    startBtn.disabled = false;
    startBtn.setAttribute("aria-label", playing ? "Stop cleaning" : "Start cleaning");
    startBtn.classList.toggle("eject-circle-btn--running", playing);
  }

  if (primaryToggleLabel) {
    primaryToggleLabel.textContent = playing ? "Stop" : "Start";
  }

  modeBtns.forEach((btn) => (btn.disabled = playing));
  speakerBtns.forEach((btn) => (btn.disabled = playing));
  modeTypeBtns.forEach((btn) => (btn.disabled = playing));
}

function setupMobileMenu() {
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const navLinks = document.getElementById("navLinks");

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      mobileMenuBtn.classList.toggle("active");
    });

    const links = navLinks.querySelectorAll("a");
    links.forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        mobileMenuBtn.classList.remove("active");
      });
    });
  }
}

function setupFAQ() {
  const faqQuestions = document.querySelectorAll(".faq-question");

  faqQuestions.forEach((question) => {
    question.addEventListener("click", () => {
      const faqItem = question.parentElement;
      const isActive = faqItem.classList.contains("active");

      document.querySelectorAll(".faq-item").forEach((item) => {
        item.classList.remove("active");
      });

      if (!isActive) {
        faqItem.classList.add("active");
      }
    });
  });
}

function setupSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href === "#") return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  window.addEventListener("scroll", () => {
    let current = "";

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      if (pageYOffset >= sectionTop - 200) {
        current = section.getAttribute("id");
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href") === `#${current}`) {
        link.classList.add("active");
      }
    });
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && isPlaying) {
    // stopCleaning();
  }
});

window.addEventListener("beforeunload", () => {
  stopCleaning();
  if (audioContext) {
    audioContext.close();
  }
});
