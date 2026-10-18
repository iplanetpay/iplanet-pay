/** HTMLMediaElement.HAVE_FUTURE_DATA */
const HAVE_FUTURE_DATA = 3;

/**
 * iOS Safari does not buffer a video before it starts playing, so a video
 * marked optional (it has a poster) must never hold the boot overlay.
 */
export function videoBlocksBoot(video: {
  optional: boolean;
  hasError: boolean;
  readyState: number;
}): boolean {
  if (video.optional || video.hasError) return false;
  return video.readyState < HAVE_FUTURE_DATA;
}

export function readBootVideo(video: HTMLVideoElement) {
  return {
    optional: video.hasAttribute("data-boot-optional"),
    hasError: Boolean(video.error),
    readyState: video.readyState,
  };
}
