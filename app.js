const FEATURES = [
  { key: "danceability", label: "Danceability", min: 0, max: 1, step: 0.01, default: 0.65, description: "How suitable for dancing" },
  { key: "energy", label: "Energy", min: 0, max: 1, step: 0.01, default: 0.72, description: "Intensity and activity" },
  { key: "valence", label: "Valence", min: 0, max: 1, step: 0.01, default: 0.55, description: "Musical positivity" },
  { key: "tempo", label: "Tempo", min: 60, max: 200, step: 1, default: 120, description: "Beats per minute" },
  { key: "loudness", label: "Loudness", min: -20, max: 0, step: 0.1, default: -5.5, description: "Overall volume in dB" },
  { key: "speechiness", label: "Speechiness", min: 0, max: 1, step: 0.01, default: 0.08, description: "Presence of spoken words" },
  { key: "acousticness", label: "Acousticness", min: 0, max: 1, step: 0.01, default: 0.15, description: "Acoustic confidence" },
  { key: "instrumentalness", label: "Instrumentalness", min: 0, max: 1, step: 0.01, default: 0.01, description: "No vocal content likelihood" },
  { key: "liveness", label: "Liveness", min: 0, max: 1, step: 0.01, default: 0.12, description: "Audience presence detected" },
  { key: "duration_ms", label: "Duration", min: 60000, max: 480000, step: 1000, default: 210000, description: "Track length" },
];

const PRESETS = {
  pop: { name: "Pop Anthem", values: { danceability: 0.78, energy: 0.82, valence: 0.72, tempo: 128, loudness: -4.2, speechiness: 0.05, acousticness: 0.08, instrumentalness: 0, liveness: 0.1, duration_ms: 200000 } },
  sad: { name: "Sad Ballad", values: { danceability: 0.35, energy: 0.28, valence: 0.18, tempo: 72, loudness: -9.5, speechiness: 0.03, acousticness: 0.82, instrumentalness: 0.01, liveness: 0.09, duration_ms: 260000 } },
  club: { name: "Club Banger", values: { danceability: 0.92, energy: 0.95, valence: 0.68, tempo: 138, loudness: -2.8, speechiness: 0.12, acousticness: 0.02, instrumentalness: 0.05, liveness: 0.15, duration_ms: 195000 } },
  lofi: { name: "Lo-Fi Chill", values: { danceability: 0.55, energy: 0.35, valence: 0.42, tempo: 85, loudness: -11, speechiness: 0.03, acousticness: 0.45, instrumentalness: 0.65, liveness: 0.08, duration_ms: 180000 } },
};

const weights = {
  danceability: 0.18,
  energy: 0.12,
  valence: 0.08,
  tempo: 0.06,
  loudness: 0.14,
  speechiness: -0.08,
  acousticness: -0.06,
  instrumentalness: -0.15,
  liveness: -0.04,
  duration_ms: -0.02,
};

const form = document.querySelector("#feature-form");
const scoreProgress = document.querySelector("#score-progress");
const scoreValue = document.querySelector("#score-value");
const verdictLabel = document.querySelector("#verdict-label");
const verdictPill = document.querySelector("#verdict-pill");
const contributionList = document.querySelector("#contribution-list");
const radar = document.querySelector("#feature-radar");
const presetButtons = document.querySelectorAll(".preset-button");
const scoreAnnounce = document.querySelector("#score-announce");
const circumference = 2 * Math.PI * 80;
const SETTLE_MS = 260;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let features = Object.fromEntries(FEATURES.map((feature) => [feature.key, feature.default]));
let displayedScore = 0;
let scoreFrame = null;
let announceTimer = null;
let verdictShown = null;
let verdictTimer = null;
let firstPaint = true;

function normalize(value, min, max) {
  return (value - min) / (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function predictHit(values) {
  let score = 0.35;

  FEATURES.forEach((feature) => {
    const norm = normalize(values[feature.key], feature.min, feature.max);
    score += norm * weights[feature.key];
  });

  score = clamp(score, 0, 1);

  const danceBoost = values.danceability > 0.7 && values.energy > 0.6 ? 0.08 : 0;
  const sadPenalty = values.valence < 0.25 && values.energy < 0.35 ? -0.05 : 0;
  const lengthPenalty = values.duration_ms > 300000 ? -0.06 : 0;

  return clamp(score + danceBoost + sadPenalty + lengthPenalty, 0, 1);
}

function getVerdict(score) {
  if (score >= 0.78) return { label: "SMASH HIT", key: "smash" };
  if (score >= 0.62) return { label: "CHART CLIMBER", key: "climber" };
  if (score >= 0.48) return { label: "SOLID TRACK", key: "solid" };
  if (score >= 0.32) return { label: "DEEP CUT", key: "deep" };
  return { label: "SHELF WARMER", key: "shelf" };
}

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatValue(feature, value) {
  if (feature.key === "duration_ms") return formatDuration(value);
  if (feature.key === "tempo") return `${value} BPM`;
  if (feature.key === "loudness") return `${value.toFixed(1)} dB`;
  return value.toFixed(2);
}

function createSlider(feature) {
  const card = document.createElement("label");
  card.className = "feature-card";
  card.innerHTML = `
    <div class="feature-top">
      <span class="feature-name">
        <svg class="feature-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${feature.key}"></use></svg>
        <span class="feature-label">${feature.label}</span>
      </span>
      <output class="feature-value" id="${feature.key}-output">${formatValue(feature, feature.default)}</output>
    </div>
    <div class="range-shell">
      <span class="range-fill" id="${feature.key}-fill"></span>
      <input
        id="${feature.key}"
        name="${feature.key}"
        type="range"
        min="${feature.min}"
        max="${feature.max}"
        step="${feature.step}"
        value="${feature.default}"
      />
    </div>
    <div class="feature-description">${feature.description}</div>
  `;

  return card;
}

function renderSliders() {
  form.innerHTML = "";
  FEATURES.forEach((feature) => form.appendChild(createSlider(feature)));

  form.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    features = { ...features, [input.name]: Number(input.value) };
    presetButtons.forEach((button) => button.classList.remove("is-active"));
    render();
  });
}

function animateScore(nextScore) {
  const target = Math.round(nextScore * 100);
  const startValue = displayedScore;
  const startTime = performance.now();
  const duration = SETTLE_MS;

  if (scoreFrame) cancelAnimationFrame(scoreFrame);

  if (reducedMotion.matches || firstPaint) {
    displayedScore = target;
    scoreValue.textContent = target;
    return;
  }

  function step(timestamp) {
    const progress = clamp((timestamp - startTime) / duration, 0, 1);
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    displayedScore = Math.round(startValue + (target - startValue) * eased);
    scoreValue.textContent = displayedScore;

    if (progress < 1) {
      scoreFrame = requestAnimationFrame(step);
    }
  }

  scoreFrame = requestAnimationFrame(step);
}

function setVerdict(verdict) {
  if (verdictShown === verdict.label) return;

  if (verdictShown === null || reducedMotion.matches) {
    verdictShown = verdict.label;
    verdictLabel.textContent = verdict.label;
    return;
  }

  verdictShown = verdict.label;
  verdictPill.classList.add("is-swapping");
  clearTimeout(verdictTimer);
  verdictTimer = setTimeout(() => {
    verdictLabel.textContent = verdict.label;
    verdictPill.classList.remove("is-swapping");
  }, 120);
}

function renderScore(score, verdict) {
  document.documentElement.dataset.verdict = verdict.key;

  if (firstPaint) scoreProgress.style.transition = "none";
  scoreProgress.style.strokeDasharray = circumference;
  scoreProgress.style.strokeDashoffset = circumference - score * circumference;
  if (firstPaint) {
    // read back to force a style recalc while the transition is still off,
    // otherwise both changes land in one recalc and the ring animates anyway
    getComputedStyle(scoreProgress).strokeDashoffset;
    scoreProgress.style.transition = "";
  }
  setVerdict(verdict);
  animateScore(score);

  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    const rounded = Math.round(score * 100);
    scoreAnnounce.textContent = `Score ${rounded} out of 100. ${verdict.label.toLowerCase()}.`;
  }, 500);
}

function renderInputs() {
  FEATURES.forEach((feature) => {
    const value = features[feature.key];
    const pct = normalize(value, feature.min, feature.max) * 100;
    const input = document.querySelector(`#${feature.key}`);
    const output = document.querySelector(`#${feature.key}-output`);
    const fill = document.querySelector(`#${feature.key}-fill`);

    input.value = value;
    output.textContent = formatValue(feature, value);
    fill.style.setProperty("--pct", `${pct}%`);
  });
}

const RADAR_KEYS = ["danceability", "energy", "valence", "speechiness", "acousticness", "liveness"];
const RADAR_LABELS = ["Dance", "Energy", "Valence", "Speech", "Acoustic", "Live"];
const RADAR_CX = 100;
const RADAR_CY = 100;
const RADAR_R = 70;
const radarAngle = (index) => (Math.PI * 2 * index) / RADAR_KEYS.length - Math.PI / 2;

let radarNodes = null;
let radarCurrent = null;
let radarFrame = null;

function radarTargets() {
  return RADAR_KEYS.map((key, index) => {
    const feature = FEATURES.find((item) => item.key === key);
    const norm = normalize(features[key], feature.min, feature.max);
    const angle = radarAngle(index);
    return {
      x: RADAR_CX + Math.cos(angle) * RADAR_R * norm,
      y: RADAR_CY + Math.sin(angle) * RADAR_R * norm,
    };
  });
}

// chrome is static, so it is built once. only the polygon and dots move.
function buildRadar() {
  const rings = [0.5, 1].map((scale) => {
    const points = RADAR_KEYS.map((_, index) => {
      const angle = radarAngle(index);
      return `${RADAR_CX + Math.cos(angle) * RADAR_R * scale},${RADAR_CY + Math.sin(angle) * RADAR_R * scale}`;
    }).join(" ");
    return `<polygon class="radar-grid" points="${points}"></polygon>`;
  }).join("");

  const axes = RADAR_KEYS.map((_, index) => {
    const angle = radarAngle(index);
    return `<line class="radar-axis" x1="${RADAR_CX}" y1="${RADAR_CY}" x2="${RADAR_CX + Math.cos(angle) * RADAR_R}" y2="${RADAR_CY + Math.sin(angle) * RADAR_R}"></line>`;
  }).join("");

  const labels = RADAR_KEYS.map((_, index) => {
    const angle = radarAngle(index);
    const x = RADAR_CX + Math.cos(angle) * (RADAR_R + 26);
    const y = RADAR_CY + Math.sin(angle) * (RADAR_R + 26);
    return `<text class="radar-label" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${RADAR_LABELS[index]}</text>`;
  }).join("");

  const dots = RADAR_KEYS.map(() => '<circle class="radar-dot" r="3"></circle>').join("");

  radar.innerHTML = `${rings}${axes}<polygon class="radar-area"></polygon>${dots}${labels}`;
  radarNodes = {
    area: radar.querySelector(".radar-area"),
    dots: [...radar.querySelectorAll(".radar-dot")],
  };
}

function paintRadar(points) {
  radarNodes.area.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
  points.forEach((point, index) => {
    radarNodes.dots[index].setAttribute("cx", point.x);
    radarNodes.dots[index].setAttribute("cy", point.y);
  });
}

// `points` is an SVG attribute, not a CSS property, so the shape is
// interpolated here on the same curve and duration as the ring.
function renderRadar() {
  if (!radarNodes) buildRadar();
  const target = radarTargets();

  if (!radarCurrent || reducedMotion.matches) {
    radarCurrent = target;
    paintRadar(target);
    return;
  }

  const from = radarCurrent;
  const startTime = performance.now();
  if (radarFrame) cancelAnimationFrame(radarFrame);

  function step(timestamp) {
    const progress = clamp((timestamp - startTime) / SETTLE_MS, 0, 1);
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    radarCurrent = from.map((point, index) => ({
      x: point.x + (target[index].x - point.x) * eased,
      y: point.y + (target[index].y - point.y) * eased,
    }));
    paintRadar(radarCurrent);
    if (progress < 1) radarFrame = requestAnimationFrame(step);
  }

  radarFrame = requestAnimationFrame(step);
}

const CONTRIBUTIONS = [
  { key: "danceability", label: "Dance", weight: 0.18 },
  { key: "energy", label: "Energy", weight: 0.12 },
  { key: "loudness", label: "Loud", weight: 0.14 },
  { key: "valence", label: "Mood", weight: 0.08 },
  { key: "instrumentalness", label: "Instr", weight: -0.15 },
];

let contributionRows = null;

function buildContributions() {
  contributionList.innerHTML = CONTRIBUTIONS.map(() => `
      <div class="contribution-row">
        <span class="contribution-label"></span>
        <span class="contribution-track">
          <span class="contribution-fill"></span>
        </span>
        <span class="contribution-score"></span>
      </div>
    `).join("");

  contributionRows = [...contributionList.querySelectorAll(".contribution-row")].map((row) => ({
    label: row.querySelector(".contribution-label"),
    fill: row.querySelector(".contribution-fill"),
    score: row.querySelector(".contribution-score"),
  }));
}

function renderContributions() {
  if (!contributionRows) buildContributions();

  const contributions = CONTRIBUTIONS.map((contribution) => {
    const feature = FEATURES.find((item) => item.key === contribution.key);
    const norm = normalize(features[contribution.key], feature.min, feature.max);
    return { ...contribution, impact: norm * contribution.weight };
  });

  const maxImpact = Math.max(...contributions.map((item) => Math.abs(item.impact)), 0.01);

  contributions.forEach((contribution, index) => {
    const row = contributionRows[index];
    const isPositive = contribution.impact >= 0;
    row.label.textContent = contribution.label;
    // unitless: the fill is full width and scaled, so the browser can
    // composite it instead of laying it out every frame
    row.fill.style.setProperty("--impact", (Math.abs(contribution.impact) / maxImpact).toFixed(4));
    row.fill.className = `contribution-fill ${isPositive ? "positive" : "negative"}`;
    row.score.className = `contribution-score ${isPositive ? "positive" : "negative"}`;
    row.score.textContent = `${isPositive ? "+" : ""}${(contribution.impact * 100).toFixed(1)}`;
  });
}

function render() {
  const score = predictHit(features);
  const verdict = getVerdict(score);

  renderInputs();
  renderScore(score, verdict);
  renderRadar();
  renderContributions();

  firstPaint = false;
}

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const preset = PRESETS[button.dataset.preset];
    features = { ...features, ...preset.values };
    presetButtons.forEach((nextButton) => nextButton.classList.remove("is-active"));
    button.classList.add("is-active");
    render();
  });
});

scoreProgress.style.strokeDasharray = circumference;
renderSliders();
render();
