/**
 * Integration tests for molecular data loading.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB, SINGLE_ATOM_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless, LOAD_FORMAT_PDB_STR } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless.load', () => {
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

    it('loads a PDB string and reports correct atom count', () => {
        const ok = pymol.load('tripeptide', TINY_PDB, LOAD_FORMAT_PDB_STR);
        expect(ok).toBe(true);

        const count = pymol.getAtomCount('tripeptide');
        expect(count).toBe(16); // 16 atoms in TINY_PDB
    });

    it('loads a single-atom PDB', () => {
        const ok = pymol.load('single', SINGLE_ATOM_PDB, LOAD_FORMAT_PDB_STR);
        expect(ok).toBe(true);

        const count = pymol.getAtomCount('single');
        expect(count).toBe(1);
    });

    it('loads an empty string without crashing', () => {
        // Empty PDB should result in object with 0 atoms or load failure
        const ok = pymol.load('empty', '', LOAD_FORMAT_PDB_STR);
        // Either succeeds with 0 atoms or returns false — both acceptable
        if (ok) {
            const count = pymol.getAtomCount('empty');
            expect(count).toBe(0);
        } else {
            expect(ok).toBe(false);
        }
    });

    it('handles garbage data without crashing', () => {
        // PyMOL should gracefully handle unparseable data
        expect(() => {
            pymol.load('garbage', 'this is not valid PDB data\ngarbage garbage', LOAD_FORMAT_PDB_STR);
        }).not.toThrow();
    });

    it('can load multiple objects', () => {
        pymol.load('obj1', TINY_PDB, LOAD_FORMAT_PDB_STR);
        pymol.load('obj2', SINGLE_ATOM_PDB, LOAD_FORMAT_PDB_STR);

        const count1 = pymol.getAtomCount('obj1');
        const count2 = pymol.getAtomCount('obj2');

        expect(count1).toBeGreaterThan(count2);
    });

    it('"all" selection counts atoms across all objects', () => {
        const totalBefore = pymol.getAtomCount('all');
        pymol.load('extra', SINGLE_ATOM_PDB, LOAD_FORMAT_PDB_STR);
        const totalAfter = pymol.getAtomCount('all');

        expect(totalAfter).toBeGreaterThanOrEqual(totalBefore);
    });
});
