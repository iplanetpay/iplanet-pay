import { readBootVideo, videoBlocksBoot } from "@/lib/navigation/boot-media";
import {
  countFraction,
  createMonotonicPercent,
  documentStateFraction,
  weightedFraction,
  type LoadTask,
} from "@/lib/navigation/load-progress";

const MAX_READY_MS = 12_000;
const MIN_VISIBLE_MS = 650;
/** Long enough for the 100% frame to paint before the overlay unmounts. */
const COMPLETE_HOLD_MS = 180;
/** Media is loaded but a page-specific check (canvas, 3D stage) is still pending. */
const PENDING_MEDIA_CAP = 0.9;

/** Heavy landing files that must finish downloading before the overlay lifts. */
export const LANDING_PRELOAD_URLS = [
  "/images/duo-scroll/step-1-outer.png",
  "/images/duo-scroll/step-1-inner.png",
  "/images/duo-scroll/step-2-outer.png",
  "/images/duo-scroll/step-2-inner.png",
  "/images/duo-scroll/step-3-outer.png",
  "/images/duo-scroll/step-3-inner.png",
  "/images/iphone-18-pro-max-unboxing.png",
  "/videos/iphone-18-pro-hero-poster.jpg",
  "/videos/iphone-18-pro-hero.mp4",
  "/vendor/iphone-duo-scroll/duo_model.zip",
  "/models/iphone-18-pro-max/source/apple_iphone_18_pro_max_burgundy.glb",
] as const;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function waitForFonts(timeoutMs: number) {
  if (!document.fonts?.ready) return;
  await Promise.race([document.fonts.ready, delay(timeoutMs)]);
}

async function waitForImages(
  root: HTMLElement,
  timeoutMs: number,
  maxImages: number,
  onFraction: (fraction: number) => void,
) {
  const imgs = Array.from(root.querySelectorAll("img")).slice(0, maxImages);
  if (imgs.length === 0) return;

  let settled = 0;
  const settle = () => {
    settled += 1;
    onFraction(countFraction(settled, imgs.length));
  };

  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              settle();
              resolve();
              return;
            }
            const done = () => {
              settle();
              resolve();
            };
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
      ),
    ),
    delay(timeoutMs),
  ]);
}

function trackDocumentState(onFraction: (fraction: number) => void) {
  const read = () => onFraction(documentStateFraction(document.readyState));
  read();
  if (document.readyState === "complete") return () => {};
  document.addEventListener("readystatechange", read);
  return () => document.removeEventListener("readystatechange", read);
}

function promoteLazyImages(root: HTMLElement) {
  for (const img of root.querySelectorAll("img")) {
    if (img.loading === "lazy") img.loading = "eager";
  }
}

function promoteLazyMedia(root: HTMLElement) {
  promoteLazyImages(root);
  for (const video of root.querySelectorAll("video")) {
    if (
      (video.preload === "none" || video.preload === "metadata") &&
      video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      video.preload = "auto";
      video.load();
    }
  }
}

function mediaCounts(root: HTMLElement) {
  let total = 0;
  let loaded = 0;
  for (const img of root.querySelectorAll("img")) {
    if (!img.getAttribute("src") && !img.getAttribute("srcset") && !img.currentSrc) {
      continue;
    }
    total += 1;
    if (img.complete) loaded += 1;
  }
  for (const video of root.querySelectorAll("video")) {
    total += 1;
    // Playable buffer is enough. Waiting for NETWORK_LOADING to go idle
    // holds the gate until the whole file arrives.
    if (!videoBlocksBoot(readBootVideo(video))) loaded += 1;
  }
  return { total, loaded };
}

async function waitUntilMediaSettled(
  root: HTMLElement,
  timeoutMs: number,
  onFraction: (fraction: number) => void,
  isPending?: (root: HTMLElement) => boolean,
) {
  const started = performance.now();
  let calm = 0;
  while (performance.now() - started < timeoutMs) {
    promoteLazyMedia(root);
    const media = mediaCounts(root);
    const extraPending = Boolean(isPending?.(root));
    const fraction = countFraction(media.loaded, media.total);
    onFraction(extraPending ? Math.min(fraction, PENDING_MEDIA_CAP) : fraction);
    const pending = media.loaded < media.total || extraPending;
    if (!pending) {
      calm += 1;
      if (calm >= 4) return;
    } else {
      calm = 0;
    }
    await delay(100);
  }
}

async function downloadFully(
  url: string,
  timeoutMs: number,
  onFraction: (fraction: number) => void,
) {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), Math.max(timeoutMs, 1_000));
  try {
    const res = await fetch(url, { cache: "force-cache", signal: ctrl.signal });
    if (!res.ok || !res.body) {
      onFraction(1);
      return;
    }
    const total = Number(res.headers.get("content-length") || 0);
    const reader = res.body.getReader();
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value?.byteLength ?? 0;
      if (total > 0) onFraction(Math.min(0.99, received / total));
    }
    onFraction(1);
  } catch {
    onFraction(1);
  } finally {
    window.clearTimeout(timer);
  }
}

function createProgress(onProgress?: (percent: number) => void) {
  const tasks: LoadTask[] = [];
  const meter = createMonotonicPercent((percent) => onProgress?.(percent));
  const emit = () => meter.update(weightedFraction(tasks));
  return {
    reserve(weight = 1) {
      const task: LoadTask = { weight, fraction: 0 };
      tasks.push(task);
      return (fraction: number) => {
        if (fraction <= task.fraction) return;
        task.fraction = Math.min(1, fraction);
        emit();
      };
    },
    start: emit,
    complete() {
      meter.complete();
    },
  };
}

async function waitForSelector(selector: string, minCount: number, timeoutMs: number) {
  if (timeoutMs <= 0) return;
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (document.querySelectorAll(selector).length >= minCount) return;
    await delay(80);
  }
}

export async function waitUntilPageReady(
  root: HTMLElement | null,
  options?: {
    imageCap?: number;
    minVisibleMs?: number;
    maxReadyMs?: number;
    preloadUrls?: readonly string[];
    waitFor?: { selector: string; minCount: number }[];
    watchMedia?: boolean;
    isPending?: (root: HTMLElement) => boolean;
    onProgress?: (percent: number) => void;
    /** Extra work (e.g. route prefetch) that counts toward the percentage. */
    alongside?: readonly Promise<unknown>[];
  },
) {
  const started = performance.now();
  const imageCap = options?.imageCap ?? 48;
  const minVisibleMs = options?.minVisibleMs ?? MIN_VISIBLE_MS;
  const maxReadyMs = options?.maxReadyMs ?? MAX_READY_MS;
  const progress = createProgress(options?.onProgress);
  const urls = options?.preloadUrls ?? [];
  const alongside = options?.alongside ?? [];

  const documentTick = progress.reserve();
  const fontTick = progress.reserve();
  const mediaTick = progress.reserve(2);
  const urlTicks = urls.map(() => progress.reserve());
  const alongsideTicks = alongside.map(() => progress.reserve());
  progress.start();
  const stopDocument = trackDocumentState(documentTick);

  await nextFrame();
  await nextFrame();

  const elapsed = () => performance.now() - started;
  const remaining = () => Math.max(0, maxReadyMs - elapsed());

  if (root) promoteLazyMedia(root);

  const preloadTask = Promise.all(
    urls.map((url, index) => downloadFully(url, remaining(), urlTicks[index]!)),
  );
  const fontTask = waitForFonts(Math.min(8_000, remaining())).then(() => {
    fontTick(1);
  });
  const alongsideTask = Promise.all(
    alongside.map((task, index) =>
      Promise.resolve(task)
        .catch(() => undefined)
        .then(() => alongsideTicks[index]!(1)),
    ),
  );

  if (options?.watchMedia && root) {
    await Promise.all([
      fontTask,
      preloadTask,
      alongsideTask,
      waitUntilMediaSettled(root, remaining(), mediaTick, options.isPending).then(() => {
        mediaTick(1);
      }),
    ]);
  } else {
    await Promise.all([
      fontTask,
      preloadTask,
      alongsideTask,
      (root ? waitForImages(root, remaining(), imageCap, mediaTick) : Promise.resolve()).then(
        () => {
          mediaTick(1);
        },
      ),
      ...(options?.waitFor ?? []).map((item) =>
        waitForSelector(item.selector, item.minCount, remaining()),
      ),
    ]);
  }

  stopDocument();
  progress.complete();

  const minLeft = minVisibleMs - elapsed();
  await delay(Math.max(minLeft, COMPLETE_HOLD_MS));
}
