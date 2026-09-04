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
const contributionList = document.querySelector("#contribution-list");
const radar = document.querySelector("#feature-radar");
const presetButtons = document.querySelectorAll(".preset-button");
const circumference = 2 * Math.PI * 80;

let features = Object.fromEntries(FEATURES.map((feature) => [feature.key, feature.default]));
let displayedScore = 0;
let scoreFrame = null;

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
  if (score >= 0.78) return { label: "SMASH HIT", color: "#00ffa3" };
  if (score >= 0.62) return { label: "CHART CLIMBER", color: "#6ee7ff" };
  if (score >= 0.48) return { label: "SOLID TRACK", color: "#fbbf24" };
  if (score >= 0.32) return { label: "DEEP CUT", color: "#f97316" };
  return { label: "SHELF WARMER", color: "#ef4444" };
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
  const duration = 650;

  if (scoreFrame) cancelAnimationFrame(scoreFrame);

  function step(timestamp) {
    const progress = clamp((timestamp - startTime) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    displayedScore = Math.round(startValue + (target - startValue) * eased);
    scoreValue.textContent = displayedScore;

    if (progress < 1) {
      scoreFrame = requestAnimationFrame(step);
    }
  }

  scoreFrame = requestAnimationFrame(step);
}

function renderScore(score, verdict) {
  document.documentElement.style.setProperty("--verdict", verdict.color);
  scoreProgress.style.strokeDasharray = circumference;
  scoreProgress.style.strokeDashoffset = circumference - score * circumference;
  verdictLabel.textContent = verdict.label;
  animateScore(score);
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

function renderRadar() {
  const keys = ["danceability", "energy", "valence", "speechiness", "acousticness", "liveness"];
  const labels = ["Dance", "Energy", "Valence", "Speech", "Acoustic", "Live"];
  const cx = 100;
  const cy = 100;
  const radius = 70;

  const ringMarkup = [0.25, 0.5, 0.75, 1].map((scale) => {
    const points = keys.map((_, index) => {
      const angle = (Math.PI * 2 * index) / keys.length - Math.PI / 2;
      return `${cx + Math.cos(angle) * radius * scale},${cy + Math.sin(angle) * radius * scale}`;
    }).join(" ");

    return `<polygon class="radar-grid" points="${points}"></polygon>`;
  }).join("");

  const axisMarkup = keys.map((_, index) => {
    const angle = (Math.PI * 2 * index) / keys.length - Math.PI / 2;
    return `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${cx + Math.cos(angle) * radius}" y2="${cy + Math.sin(angle) * radius}"></line>`;
  }).join("");

  const points = keys.map((key, index) => {
    const feature = FEATURES.find((item) => item.key === key);
    const norm = normalize(features[key], feature.min, feature.max);
    const angle = (Math.PI * 2 * index) / keys.length - Math.PI / 2;

    return {
      x: cx + Math.cos(angle) * radius * norm,
      y: cy + Math.sin(angle) * radius * norm,
      labelX: cx + Math.cos(angle) * (radius + 18),
      labelY: cy + Math.sin(angle) * (radius + 18),
      label: labels[index],
    };
  });

  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  const pointMarkup = points.map((point) => `
    <g>
      <circle class="radar-dot" cx="${point.x}" cy="${point.y}" r="3"></circle>
      <text class="radar-label" x="${point.labelX}" y="${point.labelY}" text-anchor="middle" dominant-baseline="middle">${point.label}</text>
    </g>
  `).join("");

  radar.innerHTML = `${ringMarkup}${axisMarkup}<polygon class="radar-area" points="${polygon}"></polygon>${pointMarkup}`;
}

function renderContributions() {
  const contributions = [
    { key: "danceability", label: "Dance", weight: 0.18 },
    { key: "energy", label: "Energy", weight: 0.12 },
    { key: "loudness", label: "Loud", weight: 0.14 },
    { key: "valence", label: "Mood", weight: 0.08 },
    { key: "instrumentalness", label: "Instr", weight: -0.15 },
  ].map((contribution) => {
    const feature = FEATURES.find((item) => item.key === contribution.key);
    const norm = normalize(features[contribution.key], feature.min, feature.max);
    return { ...contribution, impact: norm * contribution.weight };
  }).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const maxImpact = Math.max(...contributions.map((item) => Math.abs(item.impact)), 0.01);

  contributionList.innerHTML = contributions.map((contribution) => {
    const isPositive = contribution.impact >= 0;
    const impactWidth = Math.abs(contribution.impact) / maxImpact * 100;
    const score = `${isPositive ? "+" : ""}${(contribution.impact * 100).toFixed(1)}`;

    return `
      <div class="contribution-row">
        <span class="contribution-label">${contribution.label}</span>
        <span class="contribution-track">
          <span class="contribution-fill ${isPositive ? "positive" : "negative"}" style="--impact: ${impactWidth}%"></span>
        </span>
        <span class="contribution-score ${isPositive ? "positive" : "negative"}">${score}</span>
      </div>
    `;
  }).join("");
}

function render() {
  const score = predictHit(features);
  const verdict = getVerdict(score);

  renderInputs();
  renderScore(score, verdict);
  renderRadar();
  renderContributions();
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
