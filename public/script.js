const input = document.querySelector("#photoInput");
const fileName = document.querySelector("#fileName");
const dropzone = document.querySelector(".dropzone");
const uploadForm = document.querySelector("#uploadForm");
const loveBtn = document.querySelector("#loveBtn");
const loveNote = document.querySelector("#loveNote");
const startScreen = document.querySelector("#startScreen");
const result = document.querySelector("#result");
const newPhotoBtn = document.querySelector("#newPhotoBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const resultImageWrap = document.querySelector("#resultImageWrap");
const resultImage = document.querySelector("#resultImage");
const resultMeta = document.querySelector("#resultMeta");

const MAX_SHORT_SIDE = 2000;
const JPEG_QUALITY = 0.85;

const LOVE_LIMIT = 10;
const LOVE_WINDOW_MS = 60 * 60 * 1000;
const LOVE_STORAGE_KEY = "asya-love-limit-v3";
const BLOCK_MESSAGE = "Любовь моя, отдохни часок, дай мне собраться с мыслями, мы обязательно продолжим!";

let loveTimerId = null;
let processedUrl = null;
let processedFileName = "lightdrop-photo-light.jpg";


input.addEventListener("change", () => {
  const file = input.files?.[0];

  if (file) {
    fileName.textContent = file.name;
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files?.[0];

  if (!file) return;

  input.files = event.dataTransfer.files;
  fileName.textContent = file.name;
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = input.files?.[0];

  if (!file) {
    fileName.textContent = "сначала выбери фоточку";
    return;
  }

  startScreen.classList.add("hidden");
  result.classList.remove("hidden");
  resultImageWrap.classList.remove("has-image");
  resultImage.removeAttribute("src");
  resultMeta.textContent = "Готовим лёгкую JPG-картиночку…";
  downloadBtn.classList.add("disabled");
  downloadBtn.removeAttribute("href");

  try {
    const processed = await convertImageToLightJpg(file);

    if (processedUrl) {
      URL.revokeObjectURL(processedUrl);
    }

    processedUrl = URL.createObjectURL(processed.blob);
    processedFileName = makeOutputName(file.name);

    resultImage.src = processedUrl;
    resultImageWrap.classList.add("has-image");

    downloadBtn.href = processedUrl;
    downloadBtn.download = processedFileName;
    downloadBtn.classList.remove("disabled");

    resultMeta.textContent = `Было: ${formatBytes(file.size)} · стало: ${formatBytes(processed.blob.size)} · размер: ${processed.width}×${processed.height}px`;
  } catch (error) {
    console.error(error);
    resultMeta.textContent = "Не получилось обработать эту фоточку. Попробуй JPG, PNG, WebP или другое обычное изображение.";
  }
});

newPhotoBtn.addEventListener("click", () => {
  input.value = "";
  fileName.textContent = "или перетащи её сюда";
  loveNote.classList.remove("visible");
  result.classList.add("hidden");
  startScreen.classList.remove("hidden");
  resultImageWrap.classList.remove("has-image");
  resultImage.removeAttribute("src");
  resultMeta.textContent = "Готовим лёгкую JPG-картиночку…";
  downloadBtn.classList.add("disabled");
  downloadBtn.removeAttribute("href");

  if (processedUrl) {
    URL.revokeObjectURL(processedUrl);
    processedUrl = null;
  }
});

loveBtn.addEventListener("click", async () => {
  const state = getLoveState();
  const now = Date.now();

  if (state.blockedUntil && now < state.blockedUntil) {
    loveNote.textContent = BLOCK_MESSAGE;
    loveNote.classList.add("visible");
    applyLoveCooldown(state.blockedUntil);
    return;
  }

  if (state.count >= LOVE_LIMIT) {
    const blockedUntil = now + LOVE_WINDOW_MS;

    saveLoveState({
      count: LOVE_LIMIT,
      windowStartedAt: state.windowStartedAt || now,
      blockedUntil
    });

    loveNote.textContent = BLOCK_MESSAGE;
    loveNote.classList.add("visible");
    applyLoveCooldown(blockedUntil);
    return;
  }

  loveBtn.disabled = true;
  loveBtn.textContent = "…";

  try {
    const response = await fetch("/api/love", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const data = await response.json();

    loveNote.textContent = data.message || "Я люблю тебя.";
    loveNote.classList.add("visible");

    if (!response.ok || data.error) {
      loveBtn.disabled = false;
      loveBtn.textContent = "♥";
      return;
    }

    const freshState = getLoveState();
    saveLoveState({
      count: freshState.count + 1,
      windowStartedAt: freshState.windowStartedAt || now,
      blockedUntil: 0
    });

    loveBtn.disabled = false;
    loveBtn.textContent = "♥";
  } catch (error) {
    console.error(error);
    loveNote.textContent = "Любовь моя, я немного растерялся. Попробуй ещё раз через минутку.";
    loveNote.classList.add("visible");
    loveBtn.disabled = false;
    loveBtn.textContent = "♥";
  }
});

initLoveLimit();

document.addEventListener("click", (event) => {
  createHeartBurst(event.clientX, event.clientY);
});

async function convertImageToLightJpg(file) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = getTargetSize(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);

  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (resultBlob) => {
        if (resultBlob) {
          resolve(resultBlob);
        } else {
          reject(new Error("Canvas conversion failed"));
        }
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });

  return { blob, width, height };
}

function getTargetSize(width, height) {
  const shortSide = Math.min(width, height);

  if (shortSide <= MAX_SHORT_SIDE) {
    return { width, height };
  }

  const scale = MAX_SHORT_SIDE / shortSide;

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}

function makeOutputName(originalName) {
  const cleanName = originalName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Zа-яА-Я0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${cleanName || "lightdrop-photo"}-light.jpg`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 Б";

  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getLoveState() {
  const now = Date.now();
  const fallback = {
    count: 0,
    windowStartedAt: now,
    blockedUntil: 0
  };

  try {
    const raw = localStorage.getItem(LOVE_STORAGE_KEY);

    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const blockedUntil = Number(parsed.blockedUntil || 0);

    if (blockedUntil && now < blockedUntil) {
      return {
        count: Number(parsed.count || 0),
        windowStartedAt: Number(parsed.windowStartedAt || now),
        blockedUntil
      };
    }

    const windowStartedAt = Number(parsed.windowStartedAt || 0);

    if (!windowStartedAt || now - windowStartedAt >= LOVE_WINDOW_MS) {
      saveLoveState(fallback);
      return fallback;
    }

    return {
      count: Number(parsed.count || 0),
      windowStartedAt,
      blockedUntil: 0
    };
  } catch {
    return fallback;
  }
}

function saveLoveState(state) {
  localStorage.setItem(LOVE_STORAGE_KEY, JSON.stringify(state));
}

function initLoveLimit() {
  const state = getLoveState();

  if (state.blockedUntil && Date.now() < state.blockedUntil) {
    loveNote.textContent = BLOCK_MESSAGE;
    loveNote.classList.add("visible");
    applyLoveCooldown(state.blockedUntil);
  }
}

function applyLoveCooldown(blockedUntil) {
  loveBtn.disabled = true;
  loveBtn.classList.add("is-timer");
  updateLoveTimer(blockedUntil);

  if (loveTimerId) {
    clearInterval(loveTimerId);
  }

  loveTimerId = setInterval(() => {
    updateLoveTimer(blockedUntil);

    if (Date.now() >= blockedUntil) {
      clearInterval(loveTimerId);
      loveTimerId = null;

      loveBtn.disabled = false;
      loveBtn.classList.remove("is-timer");
      loveBtn.textContent = "♥";
      loveBtn.removeAttribute("title");
    }
  }, 1000);
}

function updateLoveTimer(blockedUntil) {
  const remainingMs = Math.max(0, blockedUntil - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  loveBtn.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  loveBtn.title = "Признания отдыхают один час";
}

function createHeartBurst(x, y) {
  const count = 34;
  const colors = ["#ff4d95", "#ff77ad", "#d83f86", "#ff9fc8", "#ffffff"];

  for (let i = 0; i < count; i++) {
    const heart = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const speed = 5.5 + Math.random() * 8.5;
    const upwardBoost = 3 + Math.random() * 7;
    const size = 13 + Math.random() * 22;

    const particle = {
      element: heart,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - upwardBoost,
      gravity: 0.22 + Math.random() * 0.14,
      airResistance: 0.965 + Math.random() * 0.012,
      maxFallSpeed: 2.1 + Math.random() * 1.5,
      rotation: Math.random() * 360,
      rotationSpeed: -10 + Math.random() * 20,
      life: 0,
      maxLife: 130 + Math.random() * 55
    };

    heart.className = "flying-heart";
    heart.textContent = Math.random() > 0.32 ? "♥" : "♡";
    heart.style.left = "0px";
    heart.style.top = "0px";
    heart.style.setProperty("--heart-size", `${size}px`);
    heart.style.setProperty("--heart-color", colors[Math.floor(Math.random() * colors.length)]);

    document.body.appendChild(heart);
    animateHeartParticle(particle);
  }
}

function animateHeartParticle(particle) {
  particle.life += 1;

  particle.vx *= particle.airResistance;
  particle.vy += particle.gravity;

  if (particle.vy > particle.maxFallSpeed) {
    particle.vy += (particle.maxFallSpeed - particle.vy) * 0.09;
  }

  particle.x += particle.vx;
  particle.y += particle.vy;
  particle.rotationSpeed *= 0.985;
  particle.rotation += particle.rotationSpeed;

  const progress = particle.life / particle.maxLife;
  const opacity = Math.max(0, 1 - Math.pow(progress, 1.7));
  const scale = progress < 0.1
    ? 0.35 + progress * 8
    : Math.max(0.58, 1.18 - progress * 0.38);

  particle.element.style.opacity = opacity;
  particle.element.style.transform = `
    translate(${particle.x}px, ${particle.y}px)
    translate(-50%, -50%)
    scale(${scale})
    rotate(${particle.rotation}deg)
  `;

  const isOutsideScreen =
    particle.y > window.innerHeight + 80 ||
    particle.x < -80 ||
    particle.x > window.innerWidth + 80;

  if (particle.life < particle.maxLife && !isOutsideScreen) {
    requestAnimationFrame(() => animateHeartParticle(particle));
  } else {
    particle.element.remove();
  }
}
