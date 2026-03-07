/**
 * Post-build smoke tests.
 *
 * These are minimal sanity checks that verify the built WASM binary is
 * functional. Run after `pnpm build:wasm` in CI as a gate before heavier
 * integration or parity tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';

const DIST_DIR = resolve(__dirname, '../../packages/pymol-wasm/dist');
const runSmoke = isWasmAvailable();

describe.skipIf(!runSmoke)('WASM smoke tests', () => {
    describe('build artifacts', () => {
        it('pymol_wasm.js exists', () => {
            expect(existsSync(resolve(DIST_DIR, 'pymol_wasm.js'))).toBe(true);
        });

        it('pymol_wasm.wasm exists', () => {
            expect(existsSync(resolve(DIST_DIR, 'pymol_wasm.wasm'))).toBe(true);
        });

        it('.wasm file is > 1 MB (not an empty or stub file)', () => {
            const wasmPath = resolve(DIST_DIR, 'pymol_wasm.wasm');
            if (!existsSync(wasmPath)) return;
            const stat = statSync(wasmPath);
            expect(stat.size).toBeGreaterThan(1_000_000);
        });

        it('.wasm file is < 100 MB (no accidental bloat)', () => {
            const wasmPath = resolve(DIST_DIR, 'pymol_wasm.wasm');
            if (!existsSync(wasmPath)) return;
            const stat = statSync(wasmPath);
            expect(stat.size).toBeLessThan(100_000_000);
        });
    });

    describe('module loading', () => {
        it('createPyMOL factory loads successfully', () => {
            const createPyMOL = loadCreatePyMOL();
            expect(typeof createPyMOL).toBe('function');
        });

        it('PyMOLHeadless initializes with loaded module', async () => {
            const createPyMOL = loadCreatePyMOL();
            const pymol = new PyMOLHeadless();

            await pymol.init(createPyMOL as any);
            expect(pymol.getInstancePtr()).toBeGreaterThan(0);

            pymol.destroy();
        });
    });

    describe('basic functionality', () => {
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

        it('can load a PDB', () => {
            const ok = pymol.load('smoke', TINY_PDB);
            expect(ok).toBe(true);
        });

        it('getAtomCount returns non-zero', () => {
            expect(pymol.getAtomCount('all')).toBeGreaterThan(0);
        });

        it('getRayScene returns valid JSON on empty scene', () => {
            pymol.hide('everything');
            const json = pymol.getRayScene(64, 64);
            const scene = JSON.parse(json);
            expect(scene.format).toBe('viewmol-ray-v2');
        });

        it('getRayScene returns primitives for visible scene', () => {
            pymol.show('spheres');
            pymol.zoom('all');
            const json = pymol.getRayScene(64, 64);
            const scene = JSON.parse(json);
            expect(scene.primitive_count).toBeGreaterThan(0);
        });
    });
});
