# Exercise Rules

## Supported Exercise

Dumbbell Biceps Curl

The first version assumes the user is viewed approximately from the side.

The user manually selects which arm (LEFT or RIGHT) is being tracked before starting. Automatic arm detection is not implemented in the early MVP.

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

### A repetition must begin from DOWN

A repetition represents a complete movement cycle, so the cycle has to start
somewhere. The arm must have been in the DOWN phase before reaching UP.

If tracking begins while the arm is already contracted, lowering it is only
half a movement and must not be counted:

UNKNOWN
→ UP
→ LOWERING
→ DOWN
→ no repetition

The next cycle, which does start from DOWN, counts normally.

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

### Tempo is evaluated only when it was measured

A phase duration that could not be measured is recorded as null, never as zero.

Null means "not enough data to judge" and is not the same as a movement that
took no time. Tempo rules skip a phase whose duration is null, so the user is
never told they moved too fast when the system simply did not observe the
phase.

## Pose Confidence

If shoulder, elbow or wrist landmarks have low confidence:

- do not count a repetition;
- show tracking feedback;
- wait until reliable landmarks return.

Frames marked invalid or low-confidence must not advance the curl state machine. The state machine only processes frames that have been marked valid by pose processing.

## Noise Handling

Pose measurements will fluctuate slightly between frames.

The system may later use:

- angle smoothing;
- threshold hysteresis;
- minimum state duration;
- movement direction checks.

These mechanisms should be introduced only when testing shows they are necessary.
