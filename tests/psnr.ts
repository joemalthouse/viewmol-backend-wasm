/**
 * PSNR / MAE / RMSE image comparison utilities for RGBA pixel buffers.
 *
 * All functions operate on flat Uint8Array or Uint8ClampedArray buffers
 * in RGBA layout (4 bytes per pixel).
 */

export interface CompareMetrics {
    pixels: number;
    maeRgb: number;
    rmseRgb: number;
    psnrRgb: number;
    maeAlpha: number;
    maxDiff: number;
    pctDiffPxGt1: number;
    pctDiffPxGt4: number;
    pctDiffPxGt8: number;
    fgPixels: number;
    fgMaeRgb: number;
}

/**
 * Compare two RGBA pixel buffers of identical dimensions.
 *
 * PSNR is computed over RGB channels only (alpha excluded from RMSE).
 * "fg" (foreground) metrics only count pixels where at least one image
 * has sum(R+G+B) > 15.
 */
export function compareRGBA(
    a: Uint8Array | Uint8ClampedArray,
    b: Uint8Array | Uint8ClampedArray,
): CompareMetrics {
    const pixels = Math.floor(Math.min(a.length, b.length) / 4);
    let sumAbsRgb = 0;
    let sumSqRgb = 0;
    let sumAbsAlpha = 0;
    let maxDiff = 0;
    let diffPx1 = 0;
    let diffPx4 = 0;
    let diffPx8 = 0;
    let fgCount = 0;
    let fgAbsRgb = 0;

    for (let i = 0; i < pixels; i++) {
        const off = i * 4;
        const dr = Math.abs(a[off]! - b[off]!);
        const dg = Math.abs(a[off + 1]! - b[off + 1]!);
        const db = Math.abs(a[off + 2]! - b[off + 2]!);
        const da = Math.abs(a[off + 3]! - b[off + 3]!);
        const pxMax = Math.max(dr, dg, db, da);
        maxDiff = Math.max(maxDiff, pxMax);
        const rgbAbs = dr + dg + db;
        sumAbsRgb += rgbAbs;
        sumSqRgb += dr * dr + dg * dg + db * db;
        sumAbsAlpha += da;
        if (pxMax > 1) diffPx1++;
        if (pxMax > 4) diffPx4++;
        if (pxMax > 8) diffPx8++;
        const aFg = (a[off]! + a[off + 1]! + a[off + 2]!) > 15;
        const bFg = (b[off]! + b[off + 1]! + b[off + 2]!) > 15;
        if (aFg || bFg) {
            fgCount++;
            fgAbsRgb += rgbAbs;
        }
    }

    const denomRgb = Math.max(1, pixels * 3);
    const rmseRgb = Math.sqrt(sumSqRgb / denomRgb);
    const psnrRgb = rmseRgb > 0 ? 20 * Math.log10(255 / rmseRgb) : 99;

    return {
        pixels,
        maeRgb: sumAbsRgb / denomRgb,
        rmseRgb,
        psnrRgb,
        maeAlpha: sumAbsAlpha / Math.max(1, pixels),
        maxDiff,
        pctDiffPxGt1: (100 * diffPx1) / Math.max(1, pixels),
        pctDiffPxGt4: (100 * diffPx4) / Math.max(1, pixels),
        pctDiffPxGt8: (100 * diffPx8) / Math.max(1, pixels),
        fgPixels: fgCount,
        fgMaeRgb: fgAbsRgb / Math.max(1, fgCount * 3),
    };
}

export type PassLevel = 'PASS' | 'WARN' | 'FAIL';

/**
 * Classify a PSNR value into PASS/WARN/FAIL.
 *   PASS  >= passThreshold dB  (default 60; near pixel-identical)
 *   WARN  >= 45 dB             (minor precision differences)
 *   FAIL  <  45 dB             (WASM command produced different state)
 *
 * Cases with documented platform precision limitations (e.g. ARM64 FMA vs
 * WASM non-FMA) can override passThreshold to a lower value.
 */
export function classify(psnr: number, passThreshold: number = 60): PassLevel {
    if (psnr >= passThreshold) return 'PASS';
    if (psnr >= 45) return 'WARN';
    return 'FAIL';
}
