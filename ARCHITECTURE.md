# Architecture

## Architecture Goal

The architecture should keep computer vision separate from exercise business logic.

The exercise algorithm must be testable without a camera.

## Main Flow

Camera
→ Pose Detector
→ Pose Landmarks
→ Pose Engine
→ Exercise Engine
→ Rep Analyzer
→ Form Evaluation
→ UI

## Responsibilities

### Camera Layer

Responsible for:

- webcam permission;
- video stream;
- video frames.

It should not contain exercise logic.

### Pose Detection Layer

Uses MediaPipe.

Input:

video frame.

Output:

pose landmarks.

Example landmarks:

- shoulder;
- elbow;
- wrist.

This layer should not decide whether a repetition occurred.

### Pose Engine

Responsible for converting raw pose data into useful normalized information.

Possible responsibilities:

- applying the arm (LEFT or RIGHT) manually selected by the user; the Pose Engine does not choose the arm automatically;
- validating landmark confidence;
- normalizing coordinates.

Output includes a validity flag (for example `isValid: boolean`) alongside the normalized landmarks, based on shoulder/elbow/wrist confidence.

### Exercise Engine

Responsible for exercise logic.

Input example:

- shoulder coordinate;
- elbow coordinate;
- wrist coordinate;
- timestamp;
- validity flag from the Pose Engine.

Output example:

- elbow angle;
- movement phase;
- rep count;
- repetition metrics.

The Exercise Engine must only advance the curl state machine on frames marked valid. Invalid or low-confidence frames must not cause a state transition.

This module must not depend on React.

### Form Evaluation

Responsible for evaluating completed repetitions.

Possible metrics:

- range of motion;
- lifting duration;
- lowering duration;
- movement consistency.

### React UI

Responsible only for presentation and user interaction.

React components should not contain the core rep-counting algorithm.

## Suggested Frontend Structure

src/

- app/
- features/
  - camera/
  - pose/
  - workout/

- lib/
- components/

Later, reusable exercise logic may be moved into:

packages/exercise-engine

if the project grows.

## Important Architectural Rule

Do not introduce unnecessary enterprise architecture during the MVP.

Avoid adding:

- repositories;
- unit of work;
- message queues;
- microservices;
- Docker infrastructure;
- complex state management;
- backend abstractions

until they are actually needed.
