export const RUNNER_SYSTEM_EDGE_PX = 24;

export const isRunnerSystemEdgeStart = (clientX, viewportWidth, edge = RUNNER_SYSTEM_EDGE_PX) => (
  Number(clientX) <= edge || Number(clientX) >= Number(viewportWidth) - edge
);

export const runnerSwipeActionForDelta = (deltaX) => Number(deltaX) > 0 ? "correct" : "primary";

export const runnerSwipeDirectedDistance = (deltaX, action) => (
  action === "correct" ? Number(deltaX) : -Number(deltaX)
);

export const runnerSwipeTranslation = (progress, action) => (
  `${(action === "correct" ? 1 : -1) * Number(progress || 0) * 5.5}rem`
);
