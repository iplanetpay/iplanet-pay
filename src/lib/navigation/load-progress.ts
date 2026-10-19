export type DocumentLoadState = "loading" | "interactive" | "complete";

export interface LoadTask {
  weight: number;
  fraction: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function documentStateFraction(state: DocumentLoadState): number {
  switch (state) {
    case "loading":
      return 0;
    case "interactive":
      return 0.5;
    case "complete":
      return 1;
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

/** Nothing tracked means nothing left to wait for. */
export function countFraction(done: number, total: number): number {
  if (total <= 0) return 1;
  return clamp01(done / total);
}

export function weightedFraction(tasks: readonly LoadTask[]): number {
  let total = 0;
  let loaded = 0;
  for (const task of tasks) {
    if (task.weight <= 0) continue;
    total += task.weight;
    loaded += task.weight * clamp01(task.fraction);
  }
  return total > 0 ? loaded / total : 0;
}

/** 100% is reserved for the moment every task has settled. */
export function loadPercent(fraction: number, done: boolean): number {
  if (done) return 100;
  return Math.min(99, Math.floor(clamp01(fraction) * 100));
}

/** Emits only increasing values, so late-discovered media never pulls the bar back. */
export function createMonotonicPercent(emit: (percent: number) => void) {
  let last = -1;
  const push = (next: number) => {
    if (next <= last) return;
    last = next;
    emit(next);
  };
  return {
    update(fraction: number) {
      push(loadPercent(fraction, false));
    },
    complete() {
      push(100);
    },
    current() {
      return Math.max(0, last);
    },
  };
}
