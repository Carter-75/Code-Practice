# Code Practitioner (Code-Practice)

A personal project: an AI coding-practice trainer. It generates original
programming challenges from a built-in curriculum, grades submissions with AI
feedback, and adapts its own grading rules from user critiques.

Live: https://code-practice-nu.vercel.app/

## What it does

- **Question generation**: Pick topics and a difficulty (easy, medium, hard).
  The backend selects a topic from the curriculum in `backend/prompts/context.json`
  (204 reference topics across 20 domains, from JavaScript and Python to
  automata, compilers, MIPS, and Prolog) and prompts the AI to invent a
  completely original problem at that skill level, as a code, multiple-choice,
  text, or drawing challenge.
- **AI evaluation**: Submissions are graded by the AI as CORRECT,
  MOSTLY_CORRECT, PARTIAL, or INCORRECT, with an explanation, a list of
  issues, and a corrected solution. The answer key from question generation
  is never sent to the browser.
- **Self-evolution**: After a graded answer, the user can critique the
  grading. The AI distills the critique into a short rule, stored in
  `backend/prompts/evolution_rules.json` (last 10 kept), which is included in
  later generation and grading prompts. On the deployed read-only filesystem
  these runtime files live in /tmp and are ephemeral per instance.
- **Extras**: Drawing canvas for diagram questions (with an optional AI
  reference diagram), confetti and a Matter.js physics burst for feedback,
  topic and difficulty preferences remembered in localStorage.

## Requirements

- Node.js 20+
- An OpenAI API key for the AI features. Without `OPENAI_API_KEY` the API
  still runs and the topic list works, but question generation, evaluation,
  and feedback return a clear 503 message saying AI is unavailable. Nothing
  is faked client-side.

## Running locally

1. Create `.env.local` at the repository root:

   ```
   OPENAI_API_KEY=your key here
   # Optional:
   # MONGODB_URI=...        (no core feature depends on MongoDB; the API runs without it)
   # PORT=3000
   # PRODUCTION=true
   ```

2. Backend (http://localhost:3000):

   ```bash
   cd backend
   npm install
   npm start
   ```

3. Frontend (http://localhost:4200, calls the backend at localhost:3000):

   ```bash
   cd frontend
   npm install
   npm start
   ```

`sync-env.py` is an optional helper that pushes the root `.env.local`
variables to the linked Vercel project's production environment.

## Deployment

Two Vercel projects:

- **Frontend** (project root `frontend/`): static Angular build deployed to
  code-practice-nu.vercel.app. Its `vercel.json` rewrites `/api/*` to the
  backend deployment and sets a CSP `frame-ancestors` header that allows
  embedding in the portfolio at carter-portfolio.fyi.
- **Backend** (project root `backend/`): the Express app as a serverless
  function (code-practice-backend.vercel.app), with `OPENAI_API_KEY` set in
  the project environment. It serves the same `frame-ancestors` policy.

## Stack

Angular 21 (standalone components, signals), Tailwind CSS, Express,
OpenAI gpt-4o (questions, grading, feedback reflection) and DALL-E 3
(optional reference diagrams), Matter.js, Anime.js, canvas-confetti.
