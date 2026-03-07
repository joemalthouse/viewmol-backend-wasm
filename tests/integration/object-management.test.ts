/**
 * Integration tests for object management operations:
 * delete, remove, color, label, distance measurement.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB, SINGLE_ATOM_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless object management', () => {
    let createPyMOL: ReturnType<typeof loadCreatePyMOL>;
    let pymol: PyMOLHeadless;

    beforeAll(async () => {
        createPyMOL = loadCreatePyMOL();
        pymol = new PyMOLHeadless();
        await pymol.init(createPyMOL as any);
    });

    afterAll(() => {
        pymol.destroy();
    });

    describe('color', () => {
        it('color("red") returns true', () => {
            pymol.load('c1', TINY_PDB);
            expect(pymol.color('red')).toBe(true);
        });

        it('color with selection returns true', () => {
            pymol.load('c2', TINY_PDB);
            expect(pymol.color('blue', 'name CA')).toBe(true);
        });

        it('multiple colors can be applied', () => {
            pymol.load('c3', TINY_PDB);
            expect(pymol.color('red', 'name N')).toBe(true);
            expect(pymol.color('green', 'name CA')).toBe(true);
            expect(pymol.color('blue', 'name C')).toBe(true);
        });
    });

    describe('delete', () => {
        it('delete removes an object', () => {
            pymol.load('del1', TINY_PDB);
            expect(pymol.getAtomCount('del1')).toBeGreaterThan(0);

            pymol.delete('del1');
            expect(pymol.getAtomCount('del1')).toBe(0);
        });
    });

    describe('remove', () => {
        it('remove atoms from selection', () => {
            pymol.load('rem1', TINY_PDB);
            const before = pymol.getAtomCount('rem1');

            pymol.remove('name CB and rem1');
            const after = pymol.getAtomCount('rem1');

            expect(after).toBeLessThan(before);
        });
    });

    describe('label', () => {
        it('label("all", "name") returns true', () => {
            pymol.load('lab1', TINY_PDB);
            expect(pymol.label('lab1', 'name')).toBe(true);
        });

        it('label with resn expression returns true', () => {
            pymol.load('lab2', TINY_PDB);
            expect(pymol.label('lab2', 'resn')).toBe(true);
        });

        it('clear labels with empty expression', () => {
            pymol.load('lab3', TINY_PDB);
            pymol.label('lab3', 'name');
            expect(pymol.label('lab3', '')).toBe(true);
        });
    });

    describe('distance measurement', () => {
        it('creates a distance measurement object', () => {
            pymol.load('dist1', TINY_PDB);
            const ok = pymol.distance('d1', 'name N and resi 1 and dist1', 'name CA and resi 1 and dist1');
            expect(ok).toBe(true);
        });
    });
});
