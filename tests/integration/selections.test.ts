/**
 * Integration tests for atom selection language.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB, TWO_CHAIN_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless selections', () => {
    let createPyMOL: ReturnType<typeof loadCreatePyMOL>;
    let pymol: PyMOLHeadless;

    beforeAll(async () => {
        createPyMOL = loadCreatePyMOL();
        pymol = new PyMOLHeadless();
        await pymol.init(createPyMOL as any);
        pymol.load('mol', TINY_PDB);
        pymol.load('twoch', TWO_CHAIN_PDB);
    });

    afterAll(() => {
        pymol.destroy();
    });

    it('"all" matches all atoms', () => {
        const count = pymol.getAtomCount('all');
        expect(count).toBeGreaterThan(0);
    });

    it('"none" matches zero atoms', () => {
        const count = pymol.getAtomCount('none');
        expect(count).toBe(0);
    });

    it('"name CA" matches CA atoms', () => {
        const count = pymol.getAtomCount('name CA');
        expect(count).toBeGreaterThan(0);
        // Should be fewer than total
        expect(count).toBeLessThan(pymol.getAtomCount('all'));
    });

    it('"name N" matches nitrogen atoms', () => {
        const count = pymol.getAtomCount('name N');
        expect(count).toBeGreaterThan(0);
    });

    it('"chain A" matches chain A atoms', () => {
        const chainA = pymol.getAtomCount('chain A and twoch');
        const chainB = pymol.getAtomCount('chain B and twoch');
        expect(chainA).toBeGreaterThan(0);
        expect(chainB).toBeGreaterThan(0);
        expect(chainA).not.toBe(chainB);
    });

    it('"resi 1" matches residue 1', () => {
        const count = pymol.getAtomCount('resi 1 and mol');
        expect(count).toBeGreaterThan(0);
    });

    it('"resn ALA" matches alanine residues', () => {
        const count = pymol.getAtomCount('resn ALA and mol');
        expect(count).toBeGreaterThan(0);
    });

    it('"elem N" matches nitrogen elements', () => {
        const count = pymol.getAtomCount('elem N and mol');
        expect(count).toBeGreaterThan(0);
    });

    it('"name CA+N+C+O" matches backbone atoms', () => {
        const backbone = pymol.getAtomCount('name CA+N+C+O and mol');
        const total = pymol.getAtomCount('mol');
        expect(backbone).toBeGreaterThan(0);
        expect(backbone).toBeLessThan(total);
    });

    it('object name as selection works', () => {
        const molCount = pymol.getAtomCount('mol');
        expect(molCount).toBe(16); // TINY_PDB atoms
    });

    it('non-existent object returns 0', () => {
        const count = pymol.getAtomCount('nonexistent_object');
        expect(count).toBe(0);
    });
});
