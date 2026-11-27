# Feynman AI

An AI-powered study companion built around the Feynman Technique, designed especially for science and engineering learning.

## Features
- Upload PDF notes or paste text.
- Extract a structured topic map.
- Explain concepts at toddler, beginner, university, or professional level.
- Receive adaptive questions and explain answers in your own words.
- Get strict feedback on accuracy, completeness, clarity, reasoning, terminology, misconceptions, and missed concepts.
- Progress through mastery-based follow-up questions.

## Run locally
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Add your Gemini API key to `GEMINI_API_KEY` in `.env`.
4. Run `npm install`, then `npm start`.
5. Open http://localhost:3000.

The Gemini key is used only by the server. Never put it in browser code or commit it to GitHub.

## Deployment
Deploy as a Node web service (for example, Render). Set `GEMINI_API_KEY` in the host's private environment variables. Set `GEMINI_MODEL` only if you want to override the default model.

## Privacy and limitations
This starter has no user accounts or cloud learning-history database. Uploaded material is sent to Gemini for analysis when you start a session. Do not upload confidential material unless you are comfortable with the provider's data policies. Add authentication, rate limiting, persistence, and stronger file validation before opening the service to the public.
