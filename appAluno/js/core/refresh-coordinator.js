export const createRefreshCoordinator = ({ now = () => Date.now() } = {}) => {
  const records = new Map();
  const inFlight = new Map();

  const getRecord = (key) => records.get(key) || { lastAttemptAt: 0, lastSuccessAt: 0 };

  const isFresh = (key, maxAgeMs) => {
    const { lastSuccessAt } = getRecord(key);
    return lastSuccessAt > 0 && now() - lastSuccessAt < Math.max(0, Number(maxAgeMs) || 0);
  };

  const run = (key, task, {
    force = false,
    maxAgeMs = 0,
    retryAfterMs = 15_000,
    isSuccess = (value) => value?.synced !== false && value?.ok !== false
  } = {}) => {
    if (inFlight.has(key)) return inFlight.get(key);

    const record = getRecord(key);
    const coolingDown = record.lastAttemptAt > record.lastSuccessAt
      && now() - record.lastAttemptAt < Math.max(0, Number(retryAfterMs) || 0);
    if (!force && (isFresh(key, maxAgeMs) || coolingDown)) {
      return Promise.resolve({ executed: false, reason: coolingDown ? "cooldown" : "fresh", value: undefined });
    }

    record.lastAttemptAt = now();
    records.set(key, record);
    const promise = Promise.resolve()
      .then(task)
      .then((value) => {
        if (isSuccess(value)) {
          record.lastSuccessAt = now();
          records.set(key, record);
        }
        return { executed: true, value };
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };

  const markFresh = (key, at = now()) => {
    const record = getRecord(key);
    record.lastAttemptAt = at;
    record.lastSuccessAt = at;
    records.set(key, record);
  };

  const invalidate = (key) => {
    if (key) records.delete(key);
    else records.clear();
  };

  return { run, isFresh, markFresh, invalidate };
};
