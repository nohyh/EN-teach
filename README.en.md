<p align="right"><strong>English</strong> | <a href="./README.md">简体中文</a></p>

# EN-teach · AI English Tutor

A mobile AI-assisted English learning app for children and beginner learners. The product uses a virtual companion, **Lumi**, to guide students through interactive lessons organized around a learn → practice → feedback → review loop.

> **Current status:** the Expo / React Native mobile MVP has implemented the main screens and learning interactions. The FastAPI backend is still at the skeleton / design stage.

## Implemented

- Login and role selection
- Home and lesson entry
- Interactive lesson flow
- Homework screen
- AI tutor screen
- Growth / learning progress screen
- Lumi mascot guidance and feedback
- TTS pronunciation playback

### Five lesson activity types

| Type | Purpose |
| --- | --- |
| `word` | vocabulary and pronunciation |
| `sentence` | sentence patterns and comprehension |
| `recall` | translation, listening recognition, fill-in-the-blank, etc. |
| `pronunciation` | speaking and pronunciation practice |
| `dialog` | scenario-based English conversation |

The lesson flow also includes journey progress, correct/incorrect feedback, Lumi hints, and completion celebrations.

See [`docs/lesson-components.md`](docs/lesson-components.md) for the shared lesson-component contract.

## Tech Stack

### Implemented

- Expo SDK 57
- React Native + TypeScript
- Expo Router
- Expo Speech
- React Native Web

### Planned Backend

- Python + FastAPI + Pydantic v2
- SQLAlchemy 2.x
- SQLite
- OpenAI-compatible APIs

The first version intentionally avoids Redis, PostgreSQL, queues, microservices, and Kubernetes in order to prioritize the learning loop and iteration speed.

## Project Structure

```text
EN-teach/
├── app/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── screens/
│       ├── services/
│       ├── data/
│       └── types/
├── server/        # FastAPI backend skeleton
├── scripts/
└── docs/
```

## Run Locally

```bash
cd app
npm install
npm start
```

You can run the app with Expo Go, Android / iOS emulators, or the web target.

```bash
npm run android
npm run ios
npm run typecheck
```

## Design Principles

- **Contract-first components**: frontend and backend share a consistent lesson JSON model.
- **Child-friendly interaction**: mascot guidance, immediate feedback, journey progress, and low-pressure retries.
- **Controlled runtime AI usage**: content that can be pre-generated should be prepared ahead of time; runtime LLM calls are reserved for open-ended tasks such as dialog.
- **MVP first**: validate the learning experience before adding infrastructure complexity.

## Roadmap

- [x] Expo / React Native client foundation
- [x] Core screens and navigation
- [x] Five lesson activity types
- [x] Lumi guidance, feedback, and TTS
- [ ] FastAPI APIs and persistence
- [ ] Content generation / import pipeline
- [ ] Runtime LLM dialog activities
- [ ] Learning history and personalized review loop

---

The project explores a simple question: **how can LLM capabilities become part of a genuinely interactive, low-latency learning product instead of just wrapping a chatbot in an “AI education” label?**
