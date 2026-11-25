// iOS refuses canvases with a larger bitmap area.
const MAX_CANVAS_AREA = 16_777_216;

interface ElementSize {
  cssWidth: number;
  cssHeight: number;
  devicePixelWidth: number;
  devicePixelHeight: number;
}

interface BitmapSize {
  width: number;
  height: number;
}

function observeElementSize(element: HTMLElement, onChange: (size: ElementSize) => void): () => void {
  const view = element.ownerDocument.defaultView;
  if (!view || !('ResizeObserver' in view)) return () => {};

  const hasDevicePixelBox = 'devicePixelContentBoxSize' in view.ResizeObserverEntry.prototype;
  const observer = new view.ResizeObserver((entries) => {
    const entry = entries.at(-1);
    if (entry) onChange(elementSizeOf(entry, view.devicePixelRatio));
  });

  // A fresh observation always reports, which is the only way to learn the size after the pixel ratio alone changes.
  const observeAfresh = () => {
    observer.unobserve(element);
    observer.observe(element, hasDevicePixelBox ? { box: 'device-pixel-content-box' } : {});
  };

  let stopWatchingPixelRatio = () => {};
  const watchPixelRatio = () => {
    const query = view.matchMedia(`(resolution: ${view.devicePixelRatio}dppx)`);
    const onPixelRatioChange = () => {
      watchPixelRatio();
      observeAfresh();
    };
    query.addEventListener('change', onPixelRatioChange, { once: true });
    stopWatchingPixelRatio = () => query.removeEventListener('change', onPixelRatioChange);
  };

  observeAfresh();
  watchPixelRatio();
  view.addEventListener('resize', observeAfresh);

  return () => {
    observer.disconnect();
    stopWatchingPixelRatio();
    view.removeEventListener('resize', observeAfresh);
  };
}

function measureElementSize(element: HTMLElement): ElementSize {
  const pixelRatio = element.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  return {
    cssWidth: element.clientWidth,
    cssHeight: element.clientHeight,
    devicePixelWidth: Math.round(element.clientWidth * pixelRatio),
    devicePixelHeight: Math.round(element.clientHeight * pixelRatio),
  };
}

function bitmapSizeFor(size: ElementSize): BitmapSize {
  const area = size.devicePixelWidth * size.devicePixelHeight;
  if (area <= MAX_CANVAS_AREA) return { width: size.devicePixelWidth, height: size.devicePixelHeight };

  const scale = Math.sqrt(MAX_CANVAS_AREA / area);
  return { width: Math.floor(size.devicePixelWidth * scale), height: Math.floor(size.devicePixelHeight * scale) };
}

function elementSizeOf(entry: ResizeObserverEntry, pixelRatio: number): ElementSize {
  const cssWidth = entry.contentBoxSize[0]?.inlineSize ?? 0;
  const cssHeight = entry.contentBoxSize[0]?.blockSize ?? 0;
  const deviceBox = entry.devicePixelContentBoxSize?.[0];

  return {
    cssWidth,
    cssHeight,
    devicePixelWidth: devicePixels(cssWidth * pixelRatio, deviceBox?.inlineSize),
    devicePixelHeight: devicePixels(cssHeight * pixelRatio, deviceBox?.blockSize),
  };
}

// Chromium reports the device pixel box in CSS pixels while a device scale factor is emulated (DevTools device mode,
// Playwright), so it only counts when it is the snapped version of the scaled CSS size.
function devicePixels(scaledCssPixels: number, reported: number | undefined): number {
  const isSnappedCssSize = reported !== undefined && Math.abs(reported - scaledCssPixels) < 1;
  return isSnappedCssSize ? reported : Math.round(scaledCssPixels);
}

export { observeElementSize, measureElementSize, bitmapSizeFor };
export type { ElementSize };
