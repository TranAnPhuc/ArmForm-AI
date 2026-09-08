/**
 * How to stand before starting.
 *
 * The tracker only measures what the camera can see, and a side-on view with
 * the whole arm in frame is the difference between a rep that counts and one
 * that does not. Saying so before the workout costs nothing; discovering it
 * halfway through a set costs the set.
 */

const STEPS = [
  {
    title: "Stand side-on",
    detail:
      "Turn about 90° to the camera so your shoulder, elbow and wrist are all visible at once.",
  },
  {
    title: "Fit your upper body in frame",
    detail:
      "Close enough that the arm fills a good part of the picture, far enough that nothing is cut off.",
  },
  {
    title: "Light from the front",
    detail:
      "A plain background and even light keep the wrist trackable at the top of the curl.",
  },
  {
    title: "Pick the arm you are training",
    detail:
      "Only one arm is tracked at a time. Switching arms starts a new workout.",
  },
];

export function SetupGuide() {
  return (
    <section className="w-full max-w-xl rounded-lg border border-slate-800 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Before you start
      </h2>

      <ol className="flex flex-col gap-2.5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[1.4rem_1fr] gap-2">
            <span
              className="font-mono text-xs text-slate-500"
              aria-hidden="true"
            >
              {index + 1}.
            </span>
            <span className="text-sm">
              <span className="font-medium">{step.title}</span>
              <span className="text-slate-400"> — {step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-400">
        Video is processed entirely on your device. Nothing is uploaded or
        recorded.
      </p>
    </section>
  );
}
