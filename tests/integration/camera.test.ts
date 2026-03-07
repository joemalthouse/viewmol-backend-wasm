/**
 * Integration tests for camera/view operations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless, SCENE_VIEW_SIZE } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless camera', () => {
    let createPyMOL: ReturnType<typeof loadCreatePyMOL>;
    let pymol: PyMOLHeadless;

    beforeAll(async () => {
        createPyMOL = loadCreatePyMOL();
        pymol = new PyMOLHeadless();
        await pymol.init(createPyMOL as any);
        pymol.load('mol', TINY_PDB);
        pymol.zoom('all');
    });

    afterAll(() => {
        pymol.destroy();
    });

    describe('getView / setView', () => {
        it('getView returns Float32Array of SCENE_VIEW_SIZE elements', () => {
            const view = pymol.getView();
            expect(view).toBeInstanceOf(Float32Array);
            expect(view.length).toBe(SCENE_VIEW_SIZE);
        });

        it('getView/setView round-trip preserves view', () => {
            const original = pymol.getView();
            pymol.setView(original);
            const restored = pymol.getView();

            for (let i = 0; i < SCENE_VIEW_SIZE; i++) {
                expect(restored[i]).toBeCloseTo(original[i]!, 4);
            }
        });

        it('setView rejects wrong-size array', () => {
            const bad = new Float32Array(10);
            expect(() => pymol.setView(bad)).toThrow();
        });
    });

    describe('zoom', () => {
        it('zoom("all") returns true', () => {
            expect(pymol.zoom('all')).toBe(true);
        });

        it('zoom with positive buffer works', () => {
            expect(pymol.zoom('all', 5)).toBe(true);
        });

        it('zoom with negative buffer works', () => {
            expect(pymol.zoom('all', -5)).toBe(true);
        });

        it('zoom changes the view matrix', () => {
            pymol.zoom('all', 0);
            const before = pymol.getView();
            pymol.zoom('all', 10);
            const after = pymol.getView();

            // At least one value should differ (the z-depth)
            let differs = false;
            for (let i = 0; i < SCENE_VIEW_SIZE; i++) {
                if (Math.abs(before[i]! - after[i]!) > 0.01) {
                    differs = true;
                    break;
                }
            }
            expect(differs).toBe(true);
        });
    });

    describe('turn', () => {
        it('turn("x", 90) returns true', () => {
            expect(pymol.turn('x', 90)).toBe(true);
        });

        it('turn("y", 45) returns true', () => {
            expect(pymol.turn('y', 45)).toBe(true);
        });

        it('turn("z", 180) returns true', () => {
            expect(pymol.turn('z', 180)).toBe(true);
        });

        it('turn changes the rotation matrix', () => {
            pymol.zoom('all');
            const before = pymol.getView();
            pymol.turn('y', 90);
            const after = pymol.getView();

            // Rotation matrix (first 9 floats) should differ
            let differs = false;
            for (let i = 0; i < 9; i++) {
                if (Math.abs(before[i]! - after[i]!) > 0.01) {
                    differs = true;
                    break;
                }
            }
            expect(differs).toBe(true);
        });
    });

    describe('center', () => {
        it('center("all") returns true', () => {
            expect(pymol.center('all')).toBe(true);
        });
    });

    describe('origin', () => {
        it('origin("all") returns true', () => {
            expect(pymol.origin('all')).toBe(true);
        });
    });
});
