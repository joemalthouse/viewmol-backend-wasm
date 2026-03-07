/**
 * Integration tests for PyMOLHeadless lifecycle management.
 * Tests init → use → destroy → reinit cycles.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless lifecycle', () => {
    let createPyMOL: ReturnType<typeof loadCreatePyMOL>;

    beforeAll(() => {
        createPyMOL = loadCreatePyMOL();
    });

    afterEach(() => {
        // Each test creates its own instance; cleanup is tested explicitly
    });

    it('initializes successfully', async () => {
        const pymol = new PyMOLHeadless();
        await pymol.init(createPyMOL as any);

        expect(pymol.getInstancePtr()).toBeGreaterThan(0);
        expect(pymol.getModule()).toBeDefined();

        pymol.destroy();
    });

    it('throws if init called twice without destroy', async () => {
        const pymol = new PyMOLHeadless();
        await pymol.init(createPyMOL as any);

        await expect(pymol.init(createPyMOL as any)).rejects.toThrow('already initialized');

        pymol.destroy();
    });

    it('destroy cleans up resources', async () => {
        const pymol = new PyMOLHeadless();
        await pymol.init(createPyMOL as any);

        pymol.destroy();

        expect(() => pymol.getModule()).toThrow('not initialized');
        expect(() => pymol.getInstancePtr()).toThrow('not initialized');
    });

    it('double destroy does not crash', async () => {
        const pymol = new PyMOLHeadless();
        await pymol.init(createPyMOL as any);

        pymol.destroy();
        // Should not throw
        pymol.destroy();
    });

    it('can reinitialize after destroy', async () => {
        const pymol = new PyMOLHeadless();

        // First init + use + destroy
        await pymol.init(createPyMOL as any);
        pymol.load('mol', TINY_PDB);
        expect(pymol.getAtomCount('all')).toBeGreaterThan(0);
        pymol.destroy();

        // Second init + use + destroy
        await pymol.init(createPyMOL as any);
        pymol.load('mol', TINY_PDB);
        expect(pymol.getAtomCount('all')).toBeGreaterThan(0);
        pymol.destroy();
    });

    it('getModule throws before init', () => {
        const pymol = new PyMOLHeadless();
        expect(() => pymol.getModule()).toThrow('not initialized');
    });

    it('getInstancePtr throws before init', () => {
        const pymol = new PyMOLHeadless();
        expect(() => pymol.getInstancePtr()).toThrow('not initialized');
    });
});
