import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

app.use(express.json({ limit: "22mb" }));
app.use(express.static(path.join(__dirname, "public")));

async function askGemini(prompt, pdf) {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error("The server is missing its GEMINI_API_KEY environment variable.");
    error.status = 503;
    throw error;
  }
  const parts = [];
  if (pdf?.data && pdf?.mimeType === "application/pdf") {
    parts.push({ inlineData: { mimeType: "application/pdf", data: pdf.data } });
  }
  parts.push({ text: prompt });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.35, maxOutputTokens: 6000 }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Gemini could not complete the request.");
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  const raw = payload.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  try { return JSON.parse(raw); }
  catch {
    const error = new Error("Gemini returned an unreadable response. Please try again.");
    error.status = 502;
    throw error;
  }
}

const baseRules = `You are Feynman AI, a rigorous but encouraging science and engineering tutor using the Feynman Technique. Ground your answers in the supplied learning material; clearly flag any necessary correction to inaccurate source material. Never invent facts. Return only valid JSON matching the requested fields. Adapt to the learner's chosen explanation level. Ask one focused question at a time. The goal is genuine conceptual understanding, not memorization.`;

app.post("/api/analyze", async (req, res) => {
  try {
    const { text = "", file, level = "university" } = req.body || {};
    if (!text.trim() && !file?.data) return res.status(400).json({ error: "Add notes or upload a PDF first." });
    if (file && (file.mimeType !== "application/pdf" || !file.data)) return res.status(400).json({ error: "Please upload a valid PDF." });
    if ((file?.data?.length || 0) > 18 * 1024 * 1024) return res.status(413).json({ error: "That PDF is too large. Try a smaller file (under about 13 MB)." });
    const prompt = `${baseRules}
Analyze the provided study material. Learner level: ${level}.
Return JSON with:
{"title":"short title","overview":"brief overview","topics":[{"name":"topic","description":"what it covers","subtopics":["..."]}],"key_prerequisites":["..."],"first_question":"one essential open-ended Feynman question","success_criteria":["what a strong explanation must include"]}
Create a useful topic map, not an exhaustive table of contents. If the material is unclear or unreadable, say so in overview and do not pretend to have read it.
${text ? "Additional learner notes:\n" + text.slice(0, 50000) : ""}`;
    const result = await askGemini(prompt, file);
    res.json(result);
  } catch (e) { res.status(e.status || 500).json({ error: e.message || "Unexpected server error." }); }
});

app.post("/api/assess", async (req, res) => {
  try {
    const { material = "", topic = "", level = "university", question = "", answer = "", previousFeedback = "" } = req.body || {};
    if (!topic.trim() || !question.trim() || !answer.trim()) return res.status(400).json({ error: "Topic, question, and your explanation are required." });
    const prompt = `${baseRules}
Assess this learner's explanation using strict scientific standards. Explanation level: ${level}.
Study material context: ${material.slice(0, 24000)}
Topic: ${topic}
Question: ${question}
Learner explanation: ${answer.slice(0, 12000)}
Previous feedback (if any): ${previousFeedback.slice(0, 3000)}
Return JSON:
{"score":0,"grade":"Needs work|Developing|Good|Strong|Mastered","verdict":"short overall judgement","accuracy":{"score":0,"feedback":"..."},"completeness":{"score":0,"feedback":"..."},"clarity":{"score":0,"feedback":"..."},"reasoning":{"score":0,"feedback":"..."},"terminology":{"score":0,"feedback":"..."},"correct_points":["..."],"misconceptions":[{"claim":"what learner said","correction":"accurate correction","why":"brief explanation"}],"missing_concepts":["..."],"keywords_to_include":["..."],"model_explanation":"a clear corrected explanation at the selected level","next_step":"one practical instruction","follow_up_question":"one targeted question testing the biggest gap","mastery_achieved":false}
Each category score is 0-100. Overall score reflects conceptual understanding, not writing style. Be fair: do not penalize simple language when the idea is correct. mastery_achieved is true only if the explanation is accurate, sufficiently complete, and shows sound reasoning (normally score >= 85). If the answer is blank or irrelevant, say so plainly.
`;
    const result = await askGemini(prompt);
    res.json(result);
  } catch (e) { res.status(e.status || 500).json({ error: e.message || "Unexpected server error." }); }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL, keyConfigured: Boolean(process.env.GEMINI_API_KEY) }));
app.listen(PORT, () => console.log(`Feynman AI running at http://localhost:${PORT}`));