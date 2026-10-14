const MAX_READY_MS = 12_000;
const MIN_VISIBLE_MS = 650;

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
  maxImages = 12,
) {
  const imgs = Array.from(root.querySelectorAll("img")).slice(0, maxImages);
  if (imgs.length === 0) return;

  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
      ),
    ),
    delay(timeoutMs),
  ]);
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

function mediaStillLoading(root: HTMLElement) {
  for (const img of root.querySelectorAll("img")) {
    if (!img.getAttribute("src") && !img.getAttribute("srcset") && !img.currentSrc) {
      continue;
    }
    if (!img.complete) return true;
  }
  for (const video of root.querySelectorAll("video")) {
    if (video.error) continue;
    // Playable buffer is enough. Waiting for NETWORK_LOADING to go idle
    // holds the gate until the whole file arrives.
    if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return true;
  }
  return false;
}

async function waitUntilMediaSettled(
  root: HTMLElement,
  timeoutMs: number,
  isPending?: (root: HTMLElement) => boolean,
) {
  const started = performance.now();
  let calm = 0;
  while (performance.now() - started < timeoutMs) {
    promoteLazyMedia(root);
    const pending = mediaStillLoading(root) || Boolean(isPending?.(root));
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
  let total = 0;
  let loaded = 0;
  const emit = (force?: number) => {
    if (!onProgress) return;
    if (force != null) {
      onProgress(force);
      return;
    }
    if (total <= 0) {
      onProgress(0);
      return;
    }
    onProgress(Math.min(99, Math.round((loaded / total) * 100)));
  };
  return {
    reserve(units = 100) {
      total += units;
      emit();
      let advanced = 0;
      return (fraction: number) => {
        const next = Math.max(0, Math.min(units, units * fraction));
        const delta = next - advanced;
        if (delta <= 0) return;
        advanced = next;
        loaded += delta;
        emit();
      };
    },
    complete() {
      emit(100);
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
  },
) {
  const started = performance.now();
  const imageCap = options?.imageCap ?? 48;
  const minVisibleMs = options?.minVisibleMs ?? MIN_VISIBLE_MS;
  const maxReadyMs = options?.maxReadyMs ?? MAX_READY_MS;
  const progress = createProgress(options?.onProgress);
  options?.onProgress?.(0);

  await nextFrame();
  await nextFrame();

  const elapsed = () => performance.now() - started;
  const remaining = () => Math.max(0, maxReadyMs - elapsed());
  const urls = options?.preloadUrls ?? [];

  if (root) promoteLazyMedia(root);

  const fontTick = progress.reserve();
  const mediaTick = progress.reserve();
  const urlTicks = urls.map(() => progress.reserve());

  const preloadTask = Promise.all(
    urls.map((url, index) => downloadFully(url, remaining(), urlTicks[index]!)),
  );
  const fontTask = waitForFonts(Math.min(8_000, remaining())).then(() => {
    fontTick(1);
  });

  if (options?.watchMedia && root) {
    await Promise.all([
      fontTask,
      preloadTask,
      waitUntilMediaSettled(root, remaining(), options.isPending).then(() => {
        mediaTick(1);
      }),
    ]);
  } else {
    await Promise.all([
      fontTask,
      preloadTask,
      (root ? waitForImages(root, remaining(), imageCap) : Promise.resolve()).then(() => {
        mediaTick(1);
      }),
      ...(options?.waitFor ?? []).map((item) =>
        waitForSelector(item.selector, item.minCount, remaining()),
      ),
    ]);
  }

  progress.complete();

  const minLeft = minVisibleMs - elapsed();
  if (minLeft > 0) await delay(minLeft);
}
