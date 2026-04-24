const defaults = {
  danceability: 0.72,
  energy: 0.78,
  valence: 0.64,
  acousticness: 0.22,
  speechiness: 0.08,
  tempo: 122,
};

const form = document.querySelector("#predictor-form");
const resetButton = document.querySelector("#reset-button");
const scoreRing = document.querySelector(".score-ring");
const scoreValue = document.querySelector("#score-value");
const scoreTitle = document.querySelector("#score-title");
const scoreCopy = document.querySelector("#score-copy");
const recommendationText = document.querySelector("#recommendation-text");

const outputs = Object.fromEntries(
  Object.keys(defaults).map((key) => [key, document.querySelector(`#${key}-output`)])
);

const meters = {
  party: document.querySelector("#party-value"),
  mood: document.querySelector("#mood-value"),
  polish: document.querySelector("#polish-value"),
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value) => Math.round(value);

function readFeatures() {
  return Object.fromEntries(
    Object.keys(defaults).map((key) => {
      const input = form.elements[key];
      return [key, Number(input.value)];
    })
  );
}

function updateOutputs(features) {
  Object.entries(features).forEach(([key, value]) => {
    outputs[key].textContent = key === "tempo" ? String(round(value)) : value.toFixed(2);
  });
}

function scoreTrack(features) {
  const tempoFit = 1 - Math.min(Math.abs(features.tempo - 122) / 78, 1);
  const party = features.danceability * features.energy;
  const mood = features.valence * 0.65 + features.energy * 0.35;
  const polish = features.energy * 0.42 + tempoFit * 0.36 + (1 - features.speechiness) * 0.22;
  const acousticBalance = 1 - Math.abs(features.acousticness - 0.22);

  const raw =
    party * 0.32 +
    mood * 0.24 +
    polish * 0.22 +
    acousticBalance * 0.12 +
    (1 - features.speechiness) * 0.1;

  return {
    score: clamp(round(raw * 100), 8, 96),
    party: round(party * 100),
    mood: round(mood * 100),
    polish: round(polish * 100),
  };
}

function describeScore(score, features) {
  if (score >= 76) {
    return {
      title: "Chart Contender",
      copy: "This profile has the bright, energetic shape that often reads as highly playlistable.",
    };
  }

  if (score >= 58) {
    return {
      title: "Playlist Ready",
      copy: "Strong fundamentals are here. A tighter balance between mood, tempo, and polish could lift it.",
    };
  }

  if (features.energy < 0.45 || features.danceability < 0.45) {
    return {
      title: "Niche Signal",
      copy: "The track may work for a specific audience, but the mainstream hit indicators are muted.",
    };
  }

  return {
    title: "Needs Lift",
    copy: "The current mix is missing one or two traits that usually help songs travel further.",
  };
}

function recommend(features) {
  if (features.energy < 0.55) return "Add more drive or rhythmic density before optimizing smaller details.";
  if (features.danceability < 0.55) return "Try a stronger groove pocket so the track feels easier to move with.";
  if (features.valence < 0.45) return "A brighter hook or more open chorus could improve the mood signal.";
  if (features.speechiness > 0.24) return "Reduce spoken-word density if the goal is broad radio-style reach.";
  if (features.tempo < 95 || features.tempo > 165) return "Move closer to a mid-tempo range before testing promotion ideas.";
  return "Keep this balance and test the hook against real listener feedback.";
}

function render() {
  const features = readFeatures();
  const signals = scoreTrack(features);
  const description = describeScore(signals.score, features);

  updateOutputs(features);
  scoreRing.style.setProperty("--score", signals.score);
  scoreValue.textContent = `${signals.score}%`;
  scoreTitle.textContent = description.title;
  scoreCopy.textContent = description.copy;
  recommendationText.textContent = recommend(features);

  meters.party.textContent = signals.party;
  meters.mood.textContent = signals.mood;
  meters.polish.textContent = signals.polish;

  meters.party.nextElementSibling.style.setProperty("--meter", `${signals.party}%`);
  meters.mood.nextElementSibling.style.setProperty("--meter", `${signals.mood}%`);
  meters.polish.nextElementSibling.style.setProperty("--meter", `${signals.polish}%`);
}

form.addEventListener("input", render);

resetButton.addEventListener("click", () => {
  Object.entries(defaults).forEach(([key, value]) => {
    form.elements[key].value = value;
  });
  render();
});

render();
