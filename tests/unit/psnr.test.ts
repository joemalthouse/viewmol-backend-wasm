import { describe, it, expect } from 'vitest';
import { compareRGBA, classify } from '../parity/psnr.js';
import type { CompareMetrics, PassLevel } from '../parity/psnr.js';

// ---------------------------------------------------------------------------
// Helper: build an RGBA buffer from pixel values
// ---------------------------------------------------------------------------

/** Creates a flat RGBA Uint8Array from an array of [R, G, B, A] tuples. */
function rgba(pixels: [number, number, number, number][]): Uint8Array {
    const buf = new Uint8Array(pixels.length * 4);
    for (let i = 0; i < pixels.length; i++) {
        buf[i * 4] = pixels[i]![0]!;
        buf[i * 4 + 1] = pixels[i]![1]!;
        buf[i * 4 + 2] = pixels[i]![2]!;
        buf[i * 4 + 3] = pixels[i]![3]!;
    }
    return buf;
}

/** Creates a uniform RGBA buffer with all pixels the same color. */
function uniform(r: number, g: number, b: number, a: number, count: number): Uint8Array {
    const buf = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
        buf[i * 4] = r;
        buf[i * 4 + 1] = g;
        buf[i * 4 + 2] = b;
        buf[i * 4 + 3] = a;
    }
    return buf;
}

// ===========================================================================
// compareRGBA
// ===========================================================================

describe('compareRGBA', () => {
    it('returns PSNR=99 for identical buffers', () => {
        const buf = uniform(128, 64, 200, 255, 100);
        const m = compareRGBA(buf, buf);
        expect(m.psnrRgb).toBe(99);
        expect(m.maeRgb).toBe(0);
        expect(m.rmseRgb).toBe(0);
        expect(m.maxDiff).toBe(0);
        expect(m.maeAlpha).toBe(0);
        expect(m.pctDiffPxGt1).toBe(0);
        expect(m.pctDiffPxGt4).toBe(0);
        expect(m.pctDiffPxGt8).toBe(0);
    });

    it('returns correct pixel count', () => {
        const buf = uniform(0, 0, 0, 255, 42);
        const m = compareRGBA(buf, buf);
        expect(m.pixels).toBe(42);
    });

    it('handles all-black vs all-white', () => {
        const black = uniform(0, 0, 0, 255, 64);
        const white = uniform(255, 255, 255, 255, 64);
        const m = compareRGBA(black, white);

        // MAE should be 255 per channel
        expect(m.maeRgb).toBe(255);
        // RMSE should be 255
        expect(m.rmseRgb).toBe(255);
        // PSNR should be 0 dB (20*log10(255/255) = 0)
        expect(m.psnrRgb).toBeCloseTo(0, 5);
        // All pixels differ by 255
        expect(m.maxDiff).toBe(255);
        // Alpha is identical
        expect(m.maeAlpha).toBe(0);
        // All pixels differ by more than 1, 4, 8
        expect(m.pctDiffPxGt1).toBe(100);
        expect(m.pctDiffPxGt4).toBe(100);
        expect(m.pctDiffPxGt8).toBe(100);
    });

    it('computes correct metrics for a single differing pixel', () => {
        // Two 2-pixel buffers, differ in one pixel by 10 in R channel only
        const a = rgba([[100, 50, 50, 255], [100, 50, 50, 255]]);
        const b = rgba([[110, 50, 50, 255], [100, 50, 50, 255]]);
        const m = compareRGBA(a, b);

        expect(m.pixels).toBe(2);
        // denomRgb = 2 * 3 = 6
        // sumAbsRgb = 10, sumSqRgb = 100
        expect(m.maeRgb).toBeCloseTo(10 / 6, 8);
        expect(m.rmseRgb).toBeCloseTo(Math.sqrt(100 / 6), 8);
        expect(m.maxDiff).toBe(10);
        expect(m.pctDiffPxGt1).toBe(50); // 1 of 2 pixels
        expect(m.pctDiffPxGt4).toBe(50);
        expect(m.pctDiffPxGt8).toBe(50);
    });

    it('tracks alpha difference separately', () => {
        const a = rgba([[100, 100, 100, 200]]);
        const b = rgba([[100, 100, 100, 100]]);
        const m = compareRGBA(a, b);

        expect(m.maeRgb).toBe(0); // RGB identical
        expect(m.maeAlpha).toBe(100); // Alpha differs by 100
        expect(m.maxDiff).toBe(100); // maxDiff includes alpha
    });

    it('counts foreground pixels correctly', () => {
        // FG threshold: sum(R+G+B) > 15
        // Pixel 1: sum = 5+5+5 = 15, NOT foreground
        // Pixel 2: sum = 10+3+3 = 16, IS foreground
        const a = rgba([[5, 5, 5, 255], [10, 3, 3, 255]]);
        const b = rgba([[5, 5, 5, 255], [10, 3, 3, 255]]);
        const m = compareRGBA(a, b);

        expect(m.fgPixels).toBe(1); // only pixel 2 is FG
    });

    it('computes foreground MAE only for FG pixels', () => {
        // FG check: aFg || bFg — a pixel is FG if EITHER image has sum(RGB) > 15
        // Pixel 1: a=[1,1,1] (sum=3, not FG), b=[1,1,1] (sum=3, not FG) → not FG
        // Pixel 2: a=[100,100,100] (sum=300, FG), b=[110,100,100] (sum=310, FG) → FG
        const a = rgba([[1, 1, 1, 255], [100, 100, 100, 255]]);
        const b = rgba([[1, 1, 1, 255], [110, 100, 100, 255]]);
        const m = compareRGBA(a, b);

        expect(m.fgPixels).toBe(1);
        // fgAbsRgb = 10 (only pixel 2 contributes), fgCount = 1
        // fgMaeRgb = 10 / (1 * 3)
        expect(m.fgMaeRgb).toBeCloseTo(10 / 3, 8);
    });

    it('handles mismatched buffer lengths (uses shorter)', () => {
        const a = uniform(100, 100, 100, 255, 10);
        const b = uniform(100, 100, 100, 255, 5);
        const m = compareRGBA(a, b);
        expect(m.pixels).toBe(5);
        expect(m.psnrRgb).toBe(99);
    });

    it('handles empty (zero-length) buffers', () => {
        const empty = new Uint8Array(0);
        const m = compareRGBA(empty, empty);
        expect(m.pixels).toBe(0);
        expect(m.maeRgb).toBe(0);
        expect(m.psnrRgb).toBe(99); // rmseRgb = 0 → psnr = 99
        expect(m.fgPixels).toBe(0);
        expect(m.fgMaeRgb).toBe(0);
    });

    it('handles single pixel buffers', () => {
        const a = rgba([[255, 0, 0, 255]]);
        const b = rgba([[0, 255, 0, 255]]);
        const m = compareRGBA(a, b);
        expect(m.pixels).toBe(1);
        // sumAbsRgb = 255 + 255 = 510, denomRgb = 3
        expect(m.maeRgb).toBe(510 / 3);
        // sumSqRgb = 255^2 + 255^2 = 130050, denomRgb = 3
        expect(m.rmseRgb).toBeCloseTo(Math.sqrt(130050 / 3), 6);
    });

    it('handles partial pixel at end of buffer (ignores trailing bytes)', () => {
        // 5 bytes = 1 full pixel + 1 extra byte
        const a = new Uint8Array([100, 100, 100, 255, 50]);
        const b = new Uint8Array([100, 100, 100, 255, 99]);
        const m = compareRGBA(a, b);
        expect(m.pixels).toBe(1);
        expect(m.psnrRgb).toBe(99);
    });

    it('diffPx thresholds are exclusive (>1, >4, >8)', () => {
        // Pixel with maxDiff exactly 1 should NOT count as >1
        const a = rgba([[100, 100, 100, 255]]);
        const b = rgba([[101, 100, 100, 255]]);
        const m = compareRGBA(a, b);
        expect(m.maxDiff).toBe(1);
        expect(m.pctDiffPxGt1).toBe(0); // not > 1

        // Pixel with maxDiff exactly 4
        const c = rgba([[100, 100, 100, 255]]);
        const d = rgba([[104, 100, 100, 255]]);
        const m2 = compareRGBA(c, d);
        expect(m2.pctDiffPxGt1).toBe(100);
        expect(m2.pctDiffPxGt4).toBe(0); // not > 4

        // Pixel with maxDiff exactly 8
        const e = rgba([[100, 100, 100, 255]]);
        const f = rgba([[108, 100, 100, 255]]);
        const m3 = compareRGBA(e, f);
        expect(m3.pctDiffPxGt4).toBe(100);
        expect(m3.pctDiffPxGt8).toBe(0); // not > 8
    });

    it('PSNR formula: 20*log10(255/rmse)', () => {
        // Construct a case where we know exact RMSE
        // 1 pixel, diff = (10, 20, 30) in RGB
        const a = rgba([[0, 0, 0, 255]]);
        const b = rgba([[10, 20, 30, 255]]);
        const m = compareRGBA(a, b);

        const expectedSumSq = 100 + 400 + 900;
        const expectedRmse = Math.sqrt(expectedSumSq / 3);
        const expectedPsnr = 20 * Math.log10(255 / expectedRmse);

        expect(m.rmseRgb).toBeCloseTo(expectedRmse, 8);
        expect(m.psnrRgb).toBeCloseTo(expectedPsnr, 8);
    });

    it('handles Uint8ClampedArray input', () => {
        const a = new Uint8ClampedArray([100, 50, 50, 255, 200, 100, 100, 255]);
        const b = new Uint8ClampedArray([100, 50, 50, 255, 200, 100, 100, 255]);
        const m = compareRGBA(a, b);
        expect(m.pixels).toBe(2);
        expect(m.psnrRgb).toBe(99);
    });

    it('large buffer produces reasonable metrics', () => {
        const size = 10000;
        const a = uniform(128, 128, 128, 255, size);
        const b = uniform(129, 128, 128, 255, size);
        const m = compareRGBA(a, b);

        expect(m.pixels).toBe(size);
        expect(m.maxDiff).toBe(1);
        // All pixels differ by exactly 1 → not counted in pctDiffPxGt1
        expect(m.pctDiffPxGt1).toBe(0);
        expect(m.psnrRgb).toBeGreaterThan(40);
    });
});

// ===========================================================================
// classify
// ===========================================================================

describe('classify', () => {
    it('returns PASS for PSNR >= 60 (default threshold)', () => {
        expect(classify(60)).toBe('PASS');
        expect(classify(99)).toBe('PASS');
        expect(classify(75)).toBe('PASS');
    });

    it('returns WARN for 45 <= PSNR < 60', () => {
        expect(classify(45)).toBe('WARN');
        expect(classify(59.99)).toBe('WARN');
        expect(classify(50)).toBe('WARN');
    });

    it('returns FAIL for PSNR < 45', () => {
        expect(classify(44.99)).toBe('FAIL');
        expect(classify(0)).toBe('FAIL');
        expect(classify(-1)).toBe('FAIL');
    });

    it('respects custom passThreshold', () => {
        // With threshold 50, PSNR 55 should PASS (>= 50)
        expect(classify(55, 50)).toBe('PASS');
        // With threshold 50, PSNR 49 should be WARN (< 50 but >= 45)
        expect(classify(49, 50)).toBe('WARN');
        // With threshold 40, PSNR 42 should PASS (42 >= 40)
        expect(classify(42, 40)).toBe('PASS');
        // With threshold 50, PSNR 44 should FAIL (< 45)
        expect(classify(44, 50)).toBe('FAIL');
    });

    it('boundary: exactly at thresholds', () => {
        expect(classify(60)).toBe('PASS');
        expect(classify(45)).toBe('WARN');
    });

    it('handles very high PSNR', () => {
        expect(classify(999)).toBe('PASS');
    });

    it('handles zero and negative PSNR', () => {
        expect(classify(0)).toBe('FAIL');
        expect(classify(-100)).toBe('FAIL');
    });
});
