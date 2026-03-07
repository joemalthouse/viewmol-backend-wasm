/**
 * Integration tests for atom coordinate get/set operations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless coordinates', () => {
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

    it('getAtomCoordinates returns Float32Array', () => {
        const coords = pymol.getAtomCoordinates('all');
        expect(coords).toBeInstanceOf(Float32Array);
    });

    it('coordinate array length = atomCount * 3', () => {
        const count = pymol.getAtomCount('all');
        const coords = pymol.getAtomCoordinates('all');
        expect(coords.length).toBe(count * 3);
    });

    it('coordinates match PDB values approximately', () => {
        // First atom (N) in TINY_PDB: x=1.458, y=0.000, z=0.000
        const coords = pymol.getAtomCoordinates('name N and resi 1');
        expect(coords.length).toBeGreaterThanOrEqual(3);
        expect(coords[0]).toBeCloseTo(1.458, 1);
        expect(coords[1]).toBeCloseTo(0.0, 1);
        expect(coords[2]).toBeCloseTo(0.0, 1);
    });

    it('empty selection returns empty array', () => {
        const coords = pymol.getAtomCoordinates('none');
        expect(coords.length).toBe(0);
    });

    it('setAtomCoordinates round-trip preserves values', () => {
        const original = pymol.getAtomCoordinates('all');
        const modified = new Float32Array(original);

        // Offset all coordinates by +1.0
        for (let i = 0; i < modified.length; i++) {
            modified[i] += 1.0;
        }

        const updated = pymol.setAtomCoordinates(modified, 'all');
        expect(updated).toBeGreaterThan(0);

        const retrieved = pymol.getAtomCoordinates('all');
        for (let i = 0; i < modified.length; i++) {
            expect(retrieved[i]).toBeCloseTo(modified[i]!, 3);
        }

        // Restore original
        pymol.setAtomCoordinates(original, 'all');
    });

    it('setAtomCoordinates rejects non-divisible-by-3 arrays', () => {
        const bad = new Float32Array(5); // Not divisible by 3
        expect(() => pymol.setAtomCoordinates(bad)).toThrow('not divisible by 3');
    });

    it('setAtomCoordinates with empty array returns 0', () => {
        const empty = new Float32Array(0);
        expect(pymol.setAtomCoordinates(empty)).toBe(0);
    });
});
