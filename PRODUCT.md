# Product Definition

## Product Name

ArmForm AI

## Problem

People performing arm exercises may have difficulty knowing:

- whether they completed a full repetition;
- whether their range of motion is sufficient;
- whether they are moving too quickly;
- how many repetitions they completed;
- whether their movement becomes less consistent during a set.

ArmForm AI uses camera-based pose tracking to provide simple real-time exercise feedback.

## Target User

The first version is intended for:

- beginner gym users;
- people training at home;
- developers experimenting with computer vision and fitness applications.

## MVP Exercise

The first supported exercise is:

Dumbbell Biceps Curl

The MVP will support only one visible arm at a time.

## MVP Features

The application should be able to:

1. Access the user's webcam.
2. Detect shoulder, elbow and wrist landmarks.
3. Calculate elbow angle.
4. Detect curl movement phases.
5. Count completed repetitions.
6. Record minimum and maximum elbow angles.
7. Measure lifting and lowering duration.
8. Provide simple feedback about range of motion and movement speed.
9. Display the information in real time.

## Example Feedback

Examples:

- Good repetition
- Extend your arm further
- Curl slightly higher
- Movement too fast
- Rep completed

## Non-Goals

The MVP does not attempt to:

- diagnose injuries;
- provide medical advice;
- accurately measure muscle activation;
- calculate muscle growth;
- measure grip strength through the camera;
- replace a professional trainer.

## Success Criteria

The MVP is successful when a user can perform a normal side-view biceps curl and the application can reliably:

- detect arm landmarks;
- calculate elbow angle;
- recognize one complete curl cycle;
- count repetitions without repeatedly counting the same repetition;
- provide basic ROM feedback.
