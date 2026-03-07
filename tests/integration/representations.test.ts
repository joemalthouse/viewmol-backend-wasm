/**
 * Integration tests for show/hide representation commands.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';
import type { RepresentationName } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless show/hide', () => {
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

    const reps: RepresentationName[] = [
        'lines', 'sticks', 'spheres', 'cartoon', 'ribbon',
        'surface', 'mesh', 'dots', 'nb_spheres', 'ellipsoids',
    ];

    for (const rep of reps) {
        it(`show("${rep}") returns true`, () => {
            expect(pymol.show(rep)).toBe(true);
        });

        it(`hide("${rep}") returns true`, () => {
            expect(pymol.hide(rep)).toBe(true);
        });
    }

    it('hide("everything") returns true', () => {
        expect(pymol.hide('everything')).toBe(true);
    });

    it('show with selection returns true', () => {
        expect(pymol.show('sticks', 'name CA')).toBe(true);
    });

    it('hide with selection returns true', () => {
        expect(pymol.hide('sticks', 'name CA')).toBe(true);
    });
});
