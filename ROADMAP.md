# Roadmap

## Milestone 0 — Project Foundation

Goal:

Prepare the project documentation and Claude Code workflow.

Tasks:

- Define product scope.
- Define architecture.
- Define biceps curl rules.
- Configure CLAUDE.md.
- Review documentation with Claude Code.

No application code should be written during this milestone.

---

## Milestone 1 — Frontend Skeleton

Goal:

Create the smallest runnable application.

Technology:

- React
- TypeScript
- Vite
- Tailwind CSS
- Vitest

Initial screen:

ArmForm AI

Biceps Curl Form Tracker

[ Start Workout ]

No camera or MediaPipe yet.

Definition of Done:

- `npm run dev` works.
- `npm run test` passes.
- `npm run build` passes.
- The application displays "ArmForm AI", "Biceps Curl Form Tracker", and a "Start Workout" button.
- "Start Workout" does nothing yet.

---

## Milestone 2 — Camera

Goal:

Allow the user to start and stop the webcam.

Learn:

- MediaDevices API
- video element
- React useRef
- React useEffect
- browser permissions

---

## Milestone 3 — Pose Detection

Goal:

Use MediaPipe to detect:

- shoulder;
- elbow;
- wrist.

Display landmarks using Canvas.

The user manually selects LEFT or RIGHT arm before tracking starts. Automatic arm selection is not implemented yet.

Learn:

- pose landmarks;
- coordinates;
- confidence scores;
- requestAnimationFrame;
- Canvas rendering.

---

## Milestone 4 — Angle Engine

Goal:

Create a reusable function for calculating joint angles.

Example:

shoulder
→ elbow
→ wrist

Output:

elbow angle in degrees.

Requirements:

- independent from React;
- independent from MediaPipe;
- unit tested with Vitest.

---

## Milestone 5 — Curl State Machine

Goal:

Detect biceps curl phases.

Initial states:

- DOWN
- LIFTING
- UP
- LOWERING

A repetition is completed only after a valid movement cycle.

Learn:

- finite state machines;
- thresholds;
- transition rules;
- debouncing/noise handling.

---

## Milestone 6 — Form Evaluation

Goal:

Evaluate each repetition.

Initial metrics:

- minimum elbow angle;
- maximum elbow angle;
- lifting duration;
- lowering duration;
- range-of-motion score;
- basic form feedback.

---

## Milestone 7 — Workout Interface

Goal:

Create a practical workout screen showing:

- current rep;
- current angle;
- phase;
- weight (manually entered by the user, in kilograms; no lb conversion yet);
- form feedback;
- completed repetitions.

This is a single-session rep tracker. Multi-set workout management (multiple sets, rest timers, per-set summaries) is not part of the early MVP and may be introduced later.

---

## Future Milestones

Only after the MVP works reliably:

- workout history;
- backend;
- PostgreSQL;
- authentication;
- progress tracking;
- additional exercises;
- mobile application;
- AI coach.
