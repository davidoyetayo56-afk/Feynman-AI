const $ = (id) => document.getElementById(id);
let session = { material: "", topic: "", level: "university", question: "", previousFeedback: "" };
let currentFile = null;
let sessionFile = null;
let lastReport = null;
let recognition = null;
let toastTimer = null;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 4200);
}
function busy(button, on, label) {
  button.disabled = on;
  if (on) {
    button.dataset.old = button.innerHTML;
    button.innerHTML = '<span class="loader"></span><span>' + escapeHtml(label || "Working...") + '</span>';
  } else if (button.dataset.old) {
    button.innerHTML = button.dataset.old;
    delete button.dataset.old;
  }
}
function setActivity(id, message, visible) {
  const box = $(id);
  if (!box) return;
  if (message) {
    const target = $(id + "-text");
    if (target) target.textContent = message;
  }
  box.classList.toggle("hidden", !visible);
}
async function api(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const message = data.error || "Something went wrong.";
    if (r.status === 503) throw new Error("Gemini is temporarily unavailable or busy. Your material is still here — please try again shortly.");
    if (r.status === 429) throw new Error("The Gemini API quota or rate limit has been reached. Please check your Google AI Studio usage and try again later.");
    if (r.status === 413) throw new Error("This PDF is too large to send. Please choose a smaller PDF.");
    throw new Error(message);
  }
  return data;
}
function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function resetFileInput() {
  $("pdf").value = "";
  currentFile = null;
  $("file-card").classList.add("hidden");
  $("upload-box").classList.remove("hidden");
}
function setFile(file) {
  if (!file) return;
  currentFile = null;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) { resetFileInput(); toast("That file doesn't look like a PDF. Please choose a .pdf file."); return; }
  if (file.size > 13 * 1024 * 1024) { resetFileInput(); toast("This PDF is over 13 MB. Please choose a smaller file."); return; }
  if (file.size === 0) { resetFileInput(); toast("This file appears to be empty. Please choose another PDF."); return; }
  $("file-name").textContent = file.name;
  $("file-meta").textContent = formatBytes(file.size) + " · Reading file…";
  $("upload-box").classList.add("hidden");
  $("file-card").classList.remove("hidden");
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || "");
    const comma = result.indexOf(",");
    if (comma < 0) {
      currentFile = null;
      $("file-meta").textContent = "Could not read this file";
      toast("Your phone couldn't read that PDF. Please choose it again.");
      return;
    }
    currentFile = { mimeType: "application/pdf", data: result.slice(comma + 1), name: file.name };
    $("file-meta").textContent = formatBytes(file.size) + " · Ready to analyse";
    toast("PDF ready. You're good to build your learning map.");
  };
  reader.onerror = () => {
    currentFile = null;
    $("file-meta").textContent = "Could not read this file";
    toast("There was a problem reading your PDF. Please try selecting it again.");
  };
  reader.readAsDataURL(file);
}
$("pdf").addEventListener("change", e => setFile(e.target.files && e.target.files[0]));
$("remove-file").addEventListener("click", resetFileInput);
const uploadBox = $("upload-box");
["dragenter", "dragover"].forEach(name => uploadBox.addEventListener(name, e => {
  e.preventDefault(); e.stopPropagation(); uploadBox.classList.add("dragging");
}));
["dragleave", "drop"].forEach(name => uploadBox.addEventListener(name, e => {
  e.preventDefault(); e.stopPropagation(); uploadBox.classList.remove("dragging");
}));
uploadBox.addEventListener("drop", e => setFile(e.dataTransfer && e.dataTransfer.files[0]));
uploadBox.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("pdf").click(); }
});

$("notes").addEventListener("input", () => {
  $("notes-count").textContent = $("notes").value.length.toLocaleString() + " characters";
});
$("sample-notes").addEventListener("click", () => {
  $("notes").value = "A simple electric circuit contains a source of electrical energy, connecting wires and a load. Voltage is the electrical potential difference that provides energy per unit charge. Current is the rate at which electric charge flows through a conductor. Resistance describes how strongly a component opposes the flow of current. For an ohmic conductor at constant temperature, Ohm's law states that voltage equals current multiplied by resistance (V = IR).";
  $("notes").dispatchEvent(new Event("input"));
  $("notes").focus();
  toast("Sample notes added. Try building a learning map with them.");
});

function setStep(active) {
  const ids = ["step-upload", "step-learn", "step-review"];
  ids.forEach((id, index) => {
    $(id).classList.toggle("active", index === active);
    $(id).classList.toggle("complete", index < active);
  });
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function renderTopics(topics) {
  $("topic-count").textContent = topics.length;
  $("topic-list").innerHTML = topics.map((topic, index) => {
    const subtopics = (topic.subtopics || []).map(item => "<li>" + escapeHtml(item) + "</li>").join("");
    return '<details class="topic"' + (index === 0 ? " open" : "") + '><summary><span class="topic-number">' + String(index + 1).padStart(2, "0") + '</span><span class="topic-title">' + escapeHtml(topic.name || "Focus area") + '</span><span class="topic-chevron">⌄</span></summary><div class="topic-body"><p>' + escapeHtml(topic.description || "Explore the central ideas in this topic.") + '</p>' + (subtopics ? "<ul>" + subtopics + "</ul>" : "") + "</div></details>";
  }).join("") || '<p class="muted">No topic list was returned. Review the overview and try again with clearer material.</p>';
}
function renderPrerequisites(items) {
  if (!items || !items.length) { $("prerequisites").classList.add("hidden"); return; }
  $("prerequisite-list").innerHTML = items.map(item => "<li>" + escapeHtml(item) + "</li>").join("");
  $("prerequisites").classList.remove("hidden");
}
$("start").addEventListener("click", async () => {
  const text = $("notes").value.trim();
  if (!text && !currentFile) { toast("Upload a PDF or paste your notes first."); return; }
  if ($("file-card").classList.contains("hidden") === false && !currentFile) {
    toast("Your PDF is still being read. Wait until it says Ready to analyse."); return;
  }
  session = { ...session, material: text, level: $("level").value, previousFeedback: "" };
  sessionFile = currentFile ? { ...currentFile } : null;
  const button = $("start");
  busy(button, true, "Building your map...");
  setActivity("activity", "Reading your material and identifying the important concepts...", true);
  try {
    const data = await api("/api/analyze", { text, file: currentFile, level: session.level });
    $("map-title").textContent = data.title || "Your learning map";
    $("map-overview").textContent = data.overview || "Your material has been organized into topics.";
    $("question").textContent = data.first_question || "Explain the central idea in your own words.";
    session.question = $("question").textContent;
    renderTopics(data.topics || []);
    renderPrerequisites(data.key_prerequisites || []);
    $("learning").classList.remove("hidden");
    $("feedback").classList.add("hidden");
    setStep(1);
    $("learning").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    toast(error.message);
  } finally {
    busy(button, false);
    setActivity("activity", "", false);
  }
});

function list(items) {
  return (items || []).map(item => {
    if (typeof item === "string") return "<li>" + escapeHtml(item) + "</li>";
    return "<li><strong>" + escapeHtml(item.claim || "Your statement") + "</strong> — " + escapeHtml(item.correction || "") + (item.why ? " " + escapeHtml(item.why) : "") + "</li>";
  }).join("");
}
function renderReport(data) {
  lastReport = data;
  const score = Math.max(0, Math.min(100, Number(data.score) || 0));
  const categories = ["accuracy", "completeness", "clarity", "reasoning", "terminology"];
  const mastery = Boolean(data.mastery_achieved);
  $("report").innerHTML =
    '<div class="score-panel"><div class="score-ring" style="--score:' + score + '"><strong>' + score + '</strong></div><div class="score-copy"><h3>' + escapeHtml(data.grade || "Your assessment") + '</h3><p>' + escapeHtml(data.verdict || "Review the feedback below and strengthen your explanation.") + '</p>' + (mastery ? '<span class="mastery-tag">✓ MASTERY DEMONSTRATED</span>' : '<span class="mastery-tag">KEEP BUILDING YOUR UNDERSTANDING</span>') + '</div></div>' +
    '<div class="rubric">' + categories.map(key => '<div class="rubric-item"><strong>' + key[0].toUpperCase() + key.slice(1) + '</strong><span>' + (Math.max(0, Math.min(100, Number(data[key]?.score) || 0))) + '/100</span><p>' + escapeHtml(data[key]?.feedback || "") + '</p></div>').join("") + '</div>' +
    '<div class="report-block"><h3>✦ What you got right</h3><ul>' + list(data.correct_points) + '</ul></div>' +
    '<div class="report-block"><h3>↗ Misconceptions to correct</h3><ul>' + list(data.misconceptions) + '</ul></div>' +
    '<div class="report-block"><h3>＋ Concepts you missed</h3><ul>' + list(data.missing_concepts) + '</ul></div>' +
    '<div class="report-block"><h3>⌘ Important terminology</h3><ul>' + list(data.keywords_to_include) + '</ul></div>' +
    '<div class="report-block"><h3>A stronger explanation</h3><p>' + escapeHtml(data.model_explanation || "Use the corrections above to improve your explanation.") + '</p></div>' +
    '<div class="next-question"><strong>' + (mastery ? "READY TO GO DEEPER?" : "YOUR NEXT STEP") + '</strong><p>' + escapeHtml(data.follow_up_question || data.next_step || "Review the feedback and explain the concept again.") + '</p><button class="primary" id="continue"><span>Try the next question</span><b>→</b></button></div>' +
    '<div class="report-actions"><button class="secondary" type="button" id="download-report">↓ Save feedback as .txt</button><button class="secondary" type="button" id="back-to-answer">← Review my answer</button></div>';
  $("continue").addEventListener("click", () => {
    session.question = data.follow_up_question || "Explain the concept again, correcting the gaps identified above.";
    $("question").textContent = session.question;
    $("answer").value = "";
    $("answer").dispatchEvent(new Event("input"));
    $("feedback").classList.add("hidden");
    $("learning").scrollIntoView({ behavior: "smooth", block: "start" });
    $("answer").focus({ preventScroll: true });
  });
  $("download-report").addEventListener("click", downloadReport);
  $("back-to-answer").addEventListener("click", () => {
    $("feedback").classList.add("hidden");
    $("learning").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
function downloadReport() {
  if (!lastReport) return;
  const d = lastReport;
  const sections = [
    "FEYNMAN AI — UNDERSTANDING REPORT",
    "Score: " + (d.score ?? 0) + "/100",
    "Grade: " + (d.grade || ""),
    d.verdict || "",
    "",
    "MODEL EXPLANATION",
    d.model_explanation || "",
    "",
    "CORRECT POINTS",
    ...(d.correct_points || []).map(x => "- " + x),
    "",
    "MISCONCEPTIONS",
    ...(d.misconceptions || []).map(x => "- " + (x.claim || "") + " → " + (x.correction || "") + " " + (x.why || "")),
    "",
    "MISSING CONCEPTS",
    ...(d.missing_concepts || []).map(x => "- " + x),
    "",
    "KEYWORDS",
    ...(d.keywords_to_include || []).map(x => "- " + x),
    "",
    "NEXT STEP",
    d.follow_up_question || d.next_step || ""
  ];
  const blob = new Blob([sections.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "feynman-ai-feedback.txt"; a.click();
  URL.revokeObjectURL(url);
}
$("answer").addEventListener("input", () => {
  const words = $("answer").value.trim() ? $("answer").value.trim().split(/\s+/).length : 0;
  $("answer-count").textContent = words + (words === 1 ? " word" : " words");
});
$("submit-answer").addEventListener("click", async () => {
  const answer = $("answer").value.trim();
  if (!answer) { toast("Write or speak your explanation first."); $("answer").focus(); return; }
  const button = $("submit-answer");
  busy(button, true, "Assessing...");
  setActivity("assess-activity", "Checking accuracy, completeness, reasoning and clarity...", true);
  try {
    const data = await api("/api/assess", {
      material: session.material,
      topic: $("map-title").textContent,
      level: session.level,
      question: session.question,
      answer,
      previousFeedback: session.previousFeedback,
      file: sessionFile
    });
    renderReport(data);
    session.previousFeedback = JSON.stringify(data).slice(0, 2500);
    $("feedback").classList.remove("hidden");
    setStep(2);
    $("feedback").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    toast(error.message);
  } finally {
    busy(button, false);
    setActivity("assess-activity", "", false);
  }
});
$("new-session").addEventListener("click", () => {
  $("learning").classList.add("hidden");
  $("feedback").classList.add("hidden");
  $("answer").value = "";
  $("answer").dispatchEvent(new Event("input"));
  $("notes").value = "";
  $("notes").dispatchEvent(new Event("input"));
  resetFileInput();
  session = { material: "", topic: "", level: "university", question: "", previousFeedback: "" };
  sessionFile = null;
  lastReport = null;
  setStep(0);
  $("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
});
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  $("mic").disabled = true;
  $("mic").title = "Speech recognition is not supported in this browser. You can type your answer instead.";
  $("mic").querySelector("span").textContent = "Voice input unavailable";
} else {
  $("mic").addEventListener("click", () => {
    if (recognition) { recognition.stop(); return; }
    recognition = new SpeechRecognition();
    recognition.lang = "en-NG";
    recognition.interimResults = true;
    recognition.continuous = true;
    $("mic").classList.add("listening");
    $("mic").querySelector("span").textContent = "Stop speaking";
    $("mic-status").textContent = "Listening — speak clearly.";
    recognition.onresult = event => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript + " ";
      $("answer").value = transcript.trim();
      $("answer").dispatchEvent(new Event("input"));
    };
    recognition.onerror = event => {
      $("mic-status").textContent = event.error === "not-allowed" ? "Microphone permission was denied." : "Microphone unavailable. You can type instead.";
    };
    recognition.onend = () => {
      recognition = null;
      $("mic").classList.remove("listening");
      $("mic").querySelector("span").textContent = "Start speaking";
      if ($("mic-status").textContent.startsWith("Listening")) $("mic-status").textContent = "";
    };
    try { recognition.start(); } catch { recognition = null; toast("Couldn't start voice input. Please try again."); }
  });
}
$("theme-toggle").addEventListener("click", () => {
  const dark = document.body.classList.toggle("dark");
  $("theme-toggle").textContent = dark ? "☀" : "☾";
  $("theme-toggle").setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  try { localStorage.setItem("feynman-theme", dark ? "dark" : "light"); } catch {}
});
try {
  if (localStorage.getItem("feynman-theme") === "dark") {
    document.body.classList.add("dark");
    $("theme-toggle").textContent = "☀";
    $("theme-toggle").setAttribute("aria-label", "Switch to light theme");
  }
} catch {}
setStep(0);
