export const createCausalSyncRunner = ({ syncOnce, hasPending = () => false }) => {
  let runningPromise = null;
  let requestedWhileRunning = false;

  const run = () => {
    requestedWhileRunning = true;
    if (runningPromise) return runningPromise;

    runningPromise = (async () => {
      let result = { synced: true };
      do {
        requestedWhileRunning = false;
        result = await syncOnce();
        if (!result?.synced) return result;
      } while (requestedWhileRunning || hasPending());
      return result;
    })().finally(() => {
      runningPromise = null;
    });

    return runningPromise;
  };

  return {
    run,
    isRunning: () => Boolean(runningPromise)
  };
};
