// Speaker Cleaner Tool - Main JavaScript File

// Global variables
let audioContext;
let oscillator;
let gainNode;
let isPlaying = false;
let currentMode = "water";
let currentSpeaker = "both";
let progressInterval;
let vibrationInterval;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeAudioContext();
  setupEventListeners();
  setupMobileMenu();
  setupFAQ();
  setupSmoothScroll();
});

// Initialize Audio Context
function initializeAudioContext() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
  } catch (error) {
    console.error("Web Audio API not supported:", error);
    alert(
      "Your browser does not support the Web Audio API. Please use a modern browser."
    );
  }
}

function setupEventListeners() {
  // Only setup if the tool is present (check for main button)
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  if (!startBtn || !stopBtn) return;

  // Mode selection buttons
  const modeBtns = document.querySelectorAll(".mode-btn");
  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode;
    });
  });

  // Speaker selection buttons
  const speakerBtns = document.querySelectorAll(".speaker-btn");
  speakerBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      speakerBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSpeaker = btn.dataset.speaker;
    });
  });

  // Control buttons
  startBtn.addEventListener("click", startCleaning);
  stopBtn.addEventListener("click", stopCleaning);
}

// Setup Event Listeners
// function setupEventListeners() {
//   // Mode selection buttons
//   const modeBtns = document.querySelectorAll(".mode-btn");
//   modeBtns.forEach((btn) => {
//     btn.addEventListener("click", () => {
//       modeBtns.forEach((b) => b.classList.remove("active"));
//       btn.classList.add("active");
//       currentMode = btn.dataset.mode;
//     });
//   });

//   // Speaker selection buttons
//   const speakerBtns = document.querySelectorAll(".speaker-btn");
//   speakerBtns.forEach((btn) => {
//     btn.addEventListener("click", () => {
//       speakerBtns.forEach((b) => b.classList.remove("active"));
//       btn.classList.add("active");
//       currentSpeaker = btn.dataset.speaker;
//     });
//   });

//   // Control buttons
//   document.getElementById("startBtn").addEventListener("click", startCleaning);
//   document.getElementById("stopBtn").addEventListener("click", stopCleaning);
// }

// Start Cleaning Process
async function startCleaning() {
  if (isPlaying) return;

  // Resume audio context if suspended (required for user interaction)
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  isPlaying = true;
  updateUIState(true);

  // Reset progress
  updateProgress(0, "Starting...");

  // Execute cleaning based on mode
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
}

// Stop Cleaning Process
function stopCleaning() {
  isPlaying = false;
  stopAllAudio();
  stopVibration();
  clearInterval(progressInterval);
  updateProgress(0, "Stopped");
  updateUIState(false);
}

// Water Eject Mode
async function waterEjectMode() {
  updateProgress(0, "Ejecting water...");

  // Play 165Hz frequency (optimal for water ejection)
  const duration = 60000; // 60 seconds
  playFrequency(165, duration);

  // Animate progress
  animateProgress(duration, "Ejecting water...");

  // Wait for completion
  await sleep(duration);

  if (isPlaying) {
    updateProgress(100, "Water ejection complete!");
    stopAllAudio();
    isPlaying = false;
    updateUIState(false);
  }
}

// Dust Removal Mode
async function dustRemovalMode() {
  updateProgress(0, "Removing dust...");

  // Cycle through frequencies for dust removal
  const frequencies = [200, 400, 800, 1600, 3200, 6400];
  const durationPerFreq = 10000; // 10 seconds per frequency
  const totalDuration = frequencies.length * durationPerFreq;

  let elapsed = 0;

  for (let i = 0; i < frequencies.length && isPlaying; i++) {
    const freq = frequencies[i];
    playFrequency(freq, durationPerFreq);

    const startTime = Date.now();
    const endTime = startTime + durationPerFreq;

    while (Date.now() < endTime && isPlaying) {
      elapsed = i * durationPerFreq + (Date.now() - startTime);
      const progress = (elapsed / totalDuration) * 100;
      updateProgress(progress, `Removing dust... ${freq}Hz`);
      await sleep(100);
    }

    stopAllAudio();
    await sleep(500); // Brief pause between frequencies
  }

  if (isPlaying) {
    updateProgress(100, "Dust removal complete!");
    isPlaying = false;
    updateUIState(false);
  }
}

// Vibration Mode
async function vibrationMode() {
  if (!("vibrate" in navigator)) {
    alert("Vibration API not supported on this device");
    stopCleaning();
    return;
  }

  updateProgress(0, "Vibration mode active...");

  // Play low frequency sound with vibration
  const duration = 30000; // 30 seconds
  playFrequency(80, duration);

  // Start vibration pattern
  startVibrationPattern();

  // Animate progress
  animateProgress(duration, "Vibrating...");

  // Wait for completion
  await sleep(duration);

  if (isPlaying) {
    updateProgress(100, "Vibration complete!");
    stopAllAudio();
    stopVibration();
    isPlaying = false;
    updateUIState(false);
  }
}

// Play Frequency
function playFrequency(frequency, duration) {
  stopAllAudio();

  // Create oscillator
  oscillator = audioContext.createOscillator();
  gainNode = audioContext.createGain();

  // Create stereo panner for left/right speaker selection
  const panner = audioContext.createStereoPanner();

  // Set panning based on speaker selection
  switch (currentSpeaker) {
    case "left":
      panner.pan.value = -1; // Full left
      break;
    case "right":
      panner.pan.value = 1; // Full right
      break;
    case "both":
    default:
      panner.pan.value = 0; // Center (both)
      break;
  }

  // Configure oscillator
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

  // Set gain (volume)
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.1); // Fade in

  // Connect nodes
  oscillator.connect(gainNode);
  gainNode.connect(panner);
  panner.connect(audioContext.destination);

  // Start oscillator
  oscillator.start();

  // Schedule fade out before stop
  const stopTime = audioContext.currentTime + duration / 1000;
  gainNode.gain.setValueAtTime(1, stopTime - 0.1);
  gainNode.gain.linearRampToValueAtTime(0, stopTime);
  oscillator.stop(stopTime);
}

// Stop All Audio
function stopAllAudio() {
  if (oscillator) {
    try {
      oscillator.stop();
      oscillator.disconnect();
    } catch (e) {
      // Already stopped
    }
    oscillator = null;
  }
  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }
}

// Start Vibration Pattern
function startVibrationPattern() {
  // Vibrate pattern: [vibrate, pause, vibrate, pause, ...]
  const pattern = [200, 100]; // 200ms vibrate, 100ms pause

  vibrationInterval = setInterval(() => {
    if (isPlaying && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, 300);
}

// Stop Vibration
function stopVibration() {
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  if ("vibrate" in navigator) {
    navigator.vibrate(0); // Stop any ongoing vibration
  }
}

// Animate Progress
function animateProgress(duration, statusText) {
  const startTime = Date.now();
  const endTime = startTime + duration;

  clearInterval(progressInterval);

  progressInterval = setInterval(() => {
    if (!isPlaying) {
      clearInterval(progressInterval);
      return;
    }

    const now = Date.now();
    const elapsed = now - startTime;
    const progress = Math.min((elapsed / duration) * 100, 100);

    updateProgress(progress, statusText);

    if (progress >= 100) {
      clearInterval(progressInterval);
    }
  }, 100);
}

// Update Progress Bar
function updateProgress(percent, status) {
  const progressFill = document.getElementById("progressFill");
  const progressPercent = document.getElementById("progressPercent");
  const statusText = document.getElementById("statusText");

  progressFill.style.width = `${percent}%`;
  progressPercent.textContent = `${Math.round(percent)}%`;
  statusText.textContent = status;
}

// Update UI State
function updateUIState(playing) {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const modeBtns = document.querySelectorAll(".mode-btn");
  const speakerBtns = document.querySelectorAll(".speaker-btn");

  startBtn.disabled = playing;
  stopBtn.disabled = !playing;

  modeBtns.forEach((btn) => (btn.disabled = playing));
  speakerBtns.forEach((btn) => (btn.disabled = playing));

  if (!playing) {
    startBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
            <span>Start Cleaning</span>
        `;
  } else {
    startBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" opacity="0.5"/>
            </svg>
            <span>Running...</span>
        `;
  }
}

// Mobile Menu
function setupMobileMenu() {
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const navLinks = document.getElementById("navLinks");

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      mobileMenuBtn.classList.toggle("active");
    });

    // Close menu when clicking on a link
    const links = navLinks.querySelectorAll("a");
    links.forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        mobileMenuBtn.classList.remove("active");
      });
    });
  }
}

// FAQ Accordion
function setupFAQ() {
  const faqQuestions = document.querySelectorAll(".faq-question");

  faqQuestions.forEach((question) => {
    question.addEventListener("click", () => {
      const faqItem = question.parentElement;
      const isActive = faqItem.classList.contains("active");

      // Close all other FAQ items
      document.querySelectorAll(".faq-item").forEach((item) => {
        item.classList.remove("active");
      });

      // Toggle current item
      if (!isActive) {
        faqItem.classList.add("active");
      }
    });
  });
}

// Smooth Scroll
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

  // Update active nav link on scroll
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  window.addEventListener("scroll", () => {
    let current = "";

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
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

// Utility function for sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Handle page visibility change (pause when tab is hidden)
document.addEventListener("visibilitychange", () => {
  if (document.hidden && isPlaying) {
    // Optionally stop when tab is hidden
    // stopCleaning();
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  stopCleaning();
  if (audioContext) {
    audioContext.close();
  }
});
