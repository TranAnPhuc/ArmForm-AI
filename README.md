# ArmForm AI

ArmForm AI is a learning-focused web application that uses a camera to analyze basic arm exercise movement.

The first MVP focuses only on the Dumbbell Biceps Curl.

The project has two goals:

1. Build a working exercise form tracker.
2. Learn software engineering and Claude Code through a real project.

## MVP Flow

Camera
→ Pose Detection
→ Shoulder / Elbow / Wrist Landmarks
→ Elbow Angle
→ Curl State Machine
→ Rep Counting
→ ROM / Tempo / Form Feedback

## Getting Started

```bash
npm install
npm run dev
```

Open the printed local URL, choose LEFT or RIGHT arm, then press Start Workout
and allow camera access. Stand side-on to the camera so the shoulder, elbow and
wrist are all visible.

Other commands:

- `npm run test` — unit tests
- `npm run build` — type-check and production build

The MediaPipe model and WASM runtime are loaded from a CDN on first use, so the
first start needs an internet connection.

## Initial Technology Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- MediaPipe
- HTML Canvas
- Vitest

## Not Included in the First MVP

The first MVP will not include:

- Backend
- PostgreSQL
- Authentication
- Cloud deployment
- Custom machine learning models
- AI chatbot
- Multiple exercises

These may be added later after the core motion tracking system works reliably.

## Development Philosophy

The project should be developed incrementally.

Each feature should follow:

Discover
→ Design
→ Implement
→ Test
→ Review
→ Learn
→ Commit

Claude Code should not implement large features without first explaining the plan.
