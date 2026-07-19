/**
 * Pure, DOM-free detector for vertically stacked multi-view collages — a
 * single uploaded photo that is actually several photos stacked with a
 * separator band (a solid or near-solid strip) between each panel.
 *
 * Operates only on raw pixel data the caller already decoded (see
 * src/lib/crop-image.ts for the browser-side decode step) and never reads
 * or writes anything else — it cannot modify the original image, and the
 * caller is responsible for keeping the original bytes it decoded from
 * untouched. No randomness, no I/O: same input always produces the same
 * output, which is what makes it unit-testable without a browser.
 */

export interface PixelBuffer {
  width: number;
  height: number;
  /** RGBA, length must equal width * height * 4. */
  data: Uint8ClampedArray;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedView {
  crop: CropRect;
  confidence: number;
}

export interface CollageDetectionResult {
  views: DetectedView[];
  /** True when no confident split was found and a single full-image view was returned instead. */
  isFallback: boolean;
  /** Confidence in the returned split (or, when isFallback is true, in the decision to not split). */
  confidence: number;
}

export interface DetectionOptions {
  /** Max per-row grayscale standard deviation for a row to be treated as part of a solid separator band. */
  flatnessThreshold: number;
  /** Minimum consecutive flat rows to consider as a candidate separator band. */
  minSeparatorHeight: number;
  /** Minimum grayscale contrast between a candidate band and the content rows on both sides. */
  minEdgeContrast: number;
  /** A split is rejected if it would produce a view shorter than this. */
  minViewHeight: number;
  /** A split is rejected (falls back to one view) if its overall confidence is below this. */
  minConfidence: number;
}

export const DEFAULT_DETECTION_OPTIONS: DetectionOptions = {
  flatnessThreshold: 10,
  minSeparatorHeight: 3,
  minEdgeContrast: 15,
  minViewHeight: 24,
  minConfidence: 0.55,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function rowGrayscaleStats(pixels: PixelBuffer, y: number): { mean: number; stdDev: number } {
  const { width, data } = pixels;
  const rowStart = y * width * 4;
  let sum = 0;
  const grays = new Array<number>(width);
  for (let x = 0; x < width; x++) {
    const i = rowStart + x * 4;
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    grays[x] = gray;
    sum += gray;
  }
  const mean = sum / width;
  let variance = 0;
  for (let x = 0; x < width; x++) {
    const diff = grays[x] - mean;
    variance += diff * diff;
  }
  variance /= width;
  return { mean, stdDev: Math.sqrt(variance) };
}

function fullImageView(pixels: PixelBuffer, confidence: number): CollageDetectionResult {
  return {
    views: [{ crop: { x: 0, y: 0, width: pixels.width, height: pixels.height }, confidence }],
    isFallback: true,
    confidence,
  };
}

interface Band {
  start: number;
  end: number;
}

/**
 * Analyzes every row of `pixels` for solid-color separator bands and, when
 * confident, splits the image into vertically stacked views at those bands.
 * Falls back to a single view spanning the whole image whenever no interior
 * band is found, a split would produce a too-thin view, or the resulting
 * confidence is below `minConfidence` — ambiguous input is never forced
 * into a split.
 */
export function detectCollageViews(pixels: PixelBuffer, partialOptions: Partial<DetectionOptions> = {}): CollageDetectionResult {
  const options: DetectionOptions = { ...DEFAULT_DETECTION_OPTIONS, ...partialOptions };
  const { width, height } = pixels;

  if (pixels.data.length !== width * height * 4) {
    throw new Error("PixelBuffer.data length must equal width * height * 4");
  }
  if (height < options.minViewHeight * 2 + options.minSeparatorHeight) {
    return fullImageView(pixels, 1);
  }

  const rowMean = new Array<number>(height);
  const rowStdDev = new Array<number>(height);
  for (let y = 0; y < height; y++) {
    const stats = rowGrayscaleStats(pixels, y);
    rowMean[y] = stats.mean;
    rowStdDev[y] = stats.stdDev;
  }

  const bands: Band[] = [];
  let runStart = -1;
  for (let y = 0; y < height; y++) {
    const flat = rowStdDev[y] <= options.flatnessThreshold;
    if (flat && runStart === -1) runStart = y;
    if (!flat && runStart !== -1) {
      bands.push({ start: runStart, end: y - 1 });
      runStart = -1;
    }
  }
  if (runStart !== -1) bands.push({ start: runStart, end: height - 1 });

  const separators: Array<Band & { confidence: number }> = [];
  for (const band of bands) {
    // A real separator has content on both sides — a flat run touching an
    // edge is a border/background artifact, not a mid-collage boundary.
    if (band.start === 0 || band.end === height - 1) continue;

    const bandHeight = band.end - band.start + 1;
    if (bandHeight < options.minSeparatorHeight) continue;

    let bandMeanSum = 0;
    let bandStdSum = 0;
    for (let y = band.start; y <= band.end; y++) {
      bandMeanSum += rowMean[y];
      bandStdSum += rowStdDev[y];
    }
    const bandMean = bandMeanSum / bandHeight;
    const bandAvgStd = bandStdSum / bandHeight;

    const above = rowMean[band.start - 1];
    const below = rowMean[band.end + 1];
    const edgeContrast = Math.min(Math.abs(bandMean - above), Math.abs(bandMean - below));
    if (edgeContrast < options.minEdgeContrast) continue;

    const flatnessScore = clamp01(1 - bandAvgStd / options.flatnessThreshold);
    const contrastScore = clamp01(edgeContrast / (options.minEdgeContrast * 2));
    const confidence = clamp01(flatnessScore * 0.5 + contrastScore * 0.5);

    separators.push({ start: band.start, end: band.end, confidence });
  }

  if (separators.length === 0) {
    return fullImageView(pixels, 1);
  }

  const boundaries: number[] = [0];
  for (const sep of separators) boundaries.push(sep.start, sep.end + 1);
  boundaries.push(height);

  const views: DetectedView[] = [];
  for (let i = 0; i < boundaries.length; i += 2) {
    const y = boundaries[i];
    const end = boundaries[i + 1];
    views.push({ crop: { x: 0, y, width, height: end - y }, confidence: 0 });
  }

  const overallConfidence = separators.reduce((sum, sep) => sum + sep.confidence, 0) / separators.length;
  const tooThin = views.some((view) => view.crop.height < options.minViewHeight);

  if (tooThin || overallConfidence < options.minConfidence) {
    return fullImageView(pixels, overallConfidence);
  }

  for (const view of views) view.confidence = overallConfidence;
  return { views, isFallback: false, confidence: overallConfidence };
}
