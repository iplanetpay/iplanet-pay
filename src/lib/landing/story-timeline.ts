/** Share of the runway before step 1 settles (phone rises in). */
export const STORY_INTRO = 0.06;
/** Share of the runway after step 3 before the stage releases. */
export const STORY_OUTRO = 0.05;
/** Cross-fade window between two steps, centered on their boundary. */
export const STORY_FADE = 0.08;
/** Rest points sit this far inside a hold so they never land on a fade edge. */
const REST_INSET = 0.004;

/**
 * Shell tilt in degrees across the runway.
 * The old pose ended at 14° (`[0, 0.5, 1] → [-16, 0, 14]`). That Y rotation
 * promoted a 3D layer; when step 3 finished, the layer tore into black tiles.
 */
export const PHONE_SHELL_ROTATE_Y = [0, 0, 0] as const;

export function phoneShellTilt(progress: number): number {
  const [start, mid, end] = PHONE_SHELL_ROTATE_Y;
  if (!Number.isFinite(progress) || progress <= 0) return start;
  if (progress >= 1) return end;
  if (progress <= 0.5) return start + (mid - start) * (progress / 0.5);
  return mid + (end - mid) * ((progress - 0.5) / 0.5);
}

export type StorySegment = { start: number; end: number };

export function storySegments(count: number): StorySegment[] {
  const span = (1 - STORY_INTRO - STORY_OUTRO) / count;
  return Array.from({ length: count }, (_, i) => {
    const start = STORY_INTRO + i * span;
    return { start, end: start + span };
  });
}

/** Opacity keyframes: fade in across the start boundary, out across the end one. */
export function presenceKeyframes(index: number, count: number) {
  const { start, end } = storySegments(count)[index]!;
  const half = STORY_FADE / 2;
  const enterFrom = Math.max(0, start - half);
  const enterTo = start + half;
  if (index === count - 1) {
    return { input: [enterFrom, enterTo, 1], output: [0, 1, 1] };
  }
  return {
    input: [enterFrom, enterTo, end - half, end + half],
    output: [0, 1, 1, 0],
  };
}

/** Scroll range where the step is fully visible and its screen animates 0→1. */
export function holdRange(index: number, count: number): [number, number] {
  const { start, end } = storySegments(count)[index]!;
  const half = STORY_FADE / 2;
  const holdEnd = index === count - 1 ? 1 - STORY_OUTRO : end - half;
  return [start + half, holdEnd];
}

export function activeStoryStep(progress: number, count: number): number {
  const segments = storySegments(count);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (progress >= segments[i]!.start) return i;
  }
  return 0;
}

/**
 * Where the stage should come to rest when scrolling stops, so the reader
 * never stays parked mid cross-fade. null means the current spot is fine.
 */
export function nearestRestingProgress(progress: number, count: number): number | null {
  if (progress <= 0 || progress >= 1) return null;
  const segments = storySegments(count);
  const half = STORY_FADE / 2;

  const first = segments[0]!;
  if (progress > first.start - half && progress < first.start + half) {
    return first.start + half + REST_INSET;
  }

  for (let i = 0; i < segments.length - 1; i++) {
    const boundary = segments[i]!.end;
    if (Math.abs(progress - boundary) < half) {
      return progress < boundary
        ? boundary - half - REST_INSET
        : boundary + half + REST_INSET;
    }
  }
  return null;
}
