/**
 * Process-wide semaphore bounding how many image-generation calls run at
 * once, regardless of how many concurrent HTTP requests reach the route
 * handler (see task requirement: "Limit concurrent variant generation").
 */
const MAX_CONCURRENT_GENERATIONS = 3;

let active = 0;
const queue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT_GENERATIONS) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}

function release(): void {
  active -= 1;
  const next = queue.shift();
  if (next) {
    active += 1;
    next();
  }
}

export async function withGenerationSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
