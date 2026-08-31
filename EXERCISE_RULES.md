# Exercise Rules

## Supported Exercise

Dumbbell Biceps Curl

The first version assumes the user is viewed approximately from the side.

The camera should clearly see:

- shoulder;
- elbow;
- wrist.

## Joint Angle

The primary measurement is the elbow angle.

Points:

A = shoulder

B = elbow

C = wrist

The calculated angle is angle ABC.

Typical approximate values:

- nearly straight arm: 150–180 degrees;
- contracted curl position: approximately 40–70 degrees.

These values are initial engineering thresholds and must be tested with real users.

## Curl States

The initial state machine:

DOWN
→ LIFTING
→ UP
→ LOWERING
→ DOWN

A completed repetition occurs only when the movement finishes a valid cycle.

## Initial Thresholds

Example starting thresholds:

DOWN:

elbow angle greater than approximately 145 degrees.

UP:

elbow angle less than approximately 65 degrees.

These values are configurable and should not be hard-coded throughout the application.

## Rep Counting

Do not increment the repetition counter simply because the elbow angle passes one threshold.

Incorrect logic:

angle < 65
→ rep + 1

This could count many repetitions while the arm remains in the same position.

Instead, a repetition requires valid state transitions.

Example:

DOWN
→ LIFTING
→ UP
→ LOWERING
→ DOWN
→ REP + 1

## Range of Motion

A repetition should record:

- minimum angle;
- maximum angle.

Possible feedback:

If maximum angle is too small:

"Extend your arm further."

If minimum angle is too large:

"Curl slightly higher."

## Tempo

Record:

- lifting start time;
- lifting end time;
- lowering start time;
- lowering end time.

Possible feedback:

- movement too fast;
- controlled tempo;
- lowering phase too fast.

Tempo rules are advisory only.

## Pose Confidence

If shoulder, elbow or wrist landmarks have low confidence:

- do not count a repetition;
- show tracking feedback;
- wait until reliable landmarks return.

## Noise Handling

Pose measurements will fluctuate slightly between frames.

The system may later use:

- angle smoothing;
- threshold hysteresis;
- minimum state duration;
- movement direction checks.

These mechanisms should be introduced only when testing shows they are necessary.
