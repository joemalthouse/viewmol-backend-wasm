/**
 * Integration tests for error handling and edge cases.
 * Verifies that invalid inputs don't crash the WASM module.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB, SINGLE_ATOM_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless error handling', () => {
    let createPyMOL: ReturnType<typeof loadCreatePyMOL>;
    let pymol: PyMOLHeadless;

    beforeAll(async () => {
        createPyMOL = loadCreatePyMOL();
        pymol = new PyMOLHeadless();
        await pymol.init(createPyMOL as any);
        pymol.load('mol', TINY_PDB);
    });

    afterAll(() => {
        pymol.destroy();
    });

    describe('color with invalid names', () => {
        it('color with non-existent color name does not crash', () => {
            // PyMOL may silently ignore unknown colors or apply a default
            expect(() => pymol.color('notarealcolor')).not.toThrow();
        });

        it('color with empty string does not crash', () => {
            expect(() => pymol.color('')).not.toThrow();
        });
    });

    describe('show/hide with invalid inputs', () => {
        it('show on non-existent selection does not crash', () => {
            expect(() => pymol.show('sticks', 'nonexistent_object_xyz')).not.toThrow();
        });

        it('hide on non-existent selection does not crash', () => {
            expect(() => pymol.hide('sticks', 'nonexistent_object_xyz')).not.toThrow();
        });
    });

    describe('delete and remove', () => {
        it('delete non-existent object does not crash', () => {
            expect(() => pymol.delete('does_not_exist')).not.toThrow();
        });

        it('remove with empty matching selection does not crash', () => {
            expect(() => pymol.remove('none')).not.toThrow();
        });
    });

    describe('measurements on invalid selections', () => {
        it('getDistance with non-matching selection returns -1', () => {
            const d = pymol.getDistance('none', 'none');
            expect(d).toBeLessThanOrEqual(0);
        });

        it('getAngle with non-matching selections does not crash', () => {
            expect(() => {
                pymol.getAngle('none', 'none', 'none');
            }).not.toThrow();
        });

        it('getDihedral with non-matching selections does not crash', () => {
            expect(() => {
                pymol.getDihedral('none', 'none', 'none', 'none');
            }).not.toThrow();
        });
    });

    describe('settings edge cases', () => {
        it('setSetting with very large index does not crash', () => {
            // Unknown setting index — should be a no-op or return false
            expect(() => pymol.setSetting(99999, 1.0)).not.toThrow();
        });

        it('setSetting with negative value does not crash', () => {
            expect(() => pymol.setSetting(154, -1.0)).not.toThrow();
        });

        it('setSetting with zero does not crash', () => {
            expect(() => pymol.setSetting(154, 0)).not.toThrow();
        });
    });

    describe('label edge cases', () => {
        it('label with empty expression does not crash', () => {
            expect(() => pymol.label('all', '')).not.toThrow();
        });

        it('label on non-existent selection does not crash', () => {
            expect(() => pymol.label('nonexistent', 'name')).not.toThrow();
        });
    });

    describe('getAtomCoordinates edge cases', () => {
        it('coordinates for non-matching selection returns empty array', () => {
            const coords = pymol.getAtomCoordinates('none');
            expect(coords.length).toBe(0);
        });

        it('coordinates for single atom returns 3 floats', () => {
            pymol.load('single_err', SINGLE_ATOM_PDB);
            const coords = pymol.getAtomCoordinates('single_err');
            expect(coords.length).toBe(3);
        });
    });

    describe('zoom/center/origin edge cases', () => {
        it('zoom on non-existent selection does not crash', () => {
            expect(() => pymol.zoom('nonexistent')).not.toThrow();
        });

        it('center on non-existent selection does not crash', () => {
            expect(() => pymol.center('nonexistent')).not.toThrow();
        });

        it('origin on non-existent selection does not crash', () => {
            expect(() => pymol.origin('nonexistent')).not.toThrow();
        });
    });

    describe('getRayScene edge cases', () => {
        it('getRayScene with zero dimensions returns valid scene', () => {
            // width/height = 0 should use default/scene dimensions
            pymol.show('sticks');
            const json = pymol.getRayScene(0, 0);
            expect(typeof json).toBe('string');
            const scene = JSON.parse(json);
            expect(scene.format).toBe('viewmol-ray-v2');
        });
    });
});
