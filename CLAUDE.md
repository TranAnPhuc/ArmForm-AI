# ArmForm AI — Claude Code Instructions

## Response Language

Always respond in Vietnamese (tiếng Việt).

This applies to every result: explanations, summaries, plans, code reviews, test reports, and error messages shown to the owner.

Keep the following in English:

- source code (identifiers, function names, types);
- code comments;
- commit messages;
- file names and paths;
- terminal commands;
- technical terms with no common Vietnamese equivalent (for example `useState`, `MediaStream`, `state machine`).

## Project Purpose

ArmForm AI is both:

1. a fitness motion tracking application;
2. a learning project for software engineering and Claude Code.

The owner is learning while building the application.

Therefore, producing code quickly is not the only goal.

Understanding the architecture, decisions and generated code is equally important.

## Current MVP

The MVP supports only:

Dumbbell Biceps Curl.

Primary flow:

Camera
→ MediaPipe Pose Detection
→ Shoulder / Elbow / Wrist
→ Elbow Angle
→ Curl State Machine
→ Rep Counting
→ ROM / Tempo / Form Feedback

## Current Technology

Frontend:

- React
- TypeScript
- Vite
- Tailwind CSS

Computer Vision:

- MediaPipe

Rendering:

- HTML Canvas

Testing:

- Vitest

## Not Yet Allowed

Do not introduce the following unless explicitly requested:

- backend;
- PostgreSQL;
- Prisma;
- authentication;
- Docker;
- Kubernetes;
- cloud infrastructure;
- custom machine learning training;
- LLM APIs inside the product;
- Redux or other global state libraries;
- microservices.

## Development Workflow

For every meaningful feature:

1. Inspect the existing repository.
2. Explain the problem.
3. Propose the smallest reasonable design.
4. Identify affected files.
5. Explain relevant concepts.
6. Implement only the approved scope.
7. Add or update tests.
8. Run relevant tests.
9. Review the implementation.
10. Explain what the owner should learn.
11. Stop before starting the next milestone.

## Planning Rule

For non-trivial tasks, do not immediately write code.

First explain:

- what needs to change;
- why;
- which files will change;
- possible edge cases;
- test strategy.

## Architecture Rules

Keep these concerns separate:

- camera access;
- pose detection;
- pose processing;
- exercise logic;
- form evaluation;
- UI.

Exercise logic must not depend directly on React.

Core mathematical and exercise functions should be unit-testable.

## TypeScript Rules

- Use strict TypeScript.
- Avoid `any`.
- Prefer explicit domain types.
- Keep functions small.
- Prefer pure functions for mathematical logic.
- Avoid unnecessary abstractions.

## React Rules

React components should focus on:

- rendering;
- user interaction;
- composing features.

Do not place core rep-counting logic inside React components.

### State Management

Prefer `useState` for simple UI state.

Use `useReducer` when state transitions become complex (for example, several related values that change together).

Do not introduce Context, Redux, Zustand, or another state management library unless there is a demonstrated need.

## Testing Rules

Important exercise algorithms should have unit tests.

Tests should cover:

- normal behavior;
- boundary values;
- invalid input;
- important state transitions.

## Learning Rule

When implementing something important, explain it as if teaching a junior developer.

Do not only say what the code does.

Explain:

- why it exists;
- why this approach was chosen;
- alternatives;
- possible mistakes.

## Scope Rule

Prefer the smallest working implementation.

Do not build infrastructure for hypothetical future requirements.

Avoid over-engineering.

## Change Control

Before making significant changes:

- inspect existing code;
- check documentation;
- avoid unrelated refactoring.

After making changes:

- summarize modified files;
- report test results;
- explain important decisions.

Do not automatically start another milestone.
