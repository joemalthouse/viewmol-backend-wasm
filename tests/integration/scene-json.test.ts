/**
 * Integration tests for getRayScene() JSON output.
 * Validates the structure and content of the viewmol-ray-v2 scene format.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB, SINGLE_ATOM_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';
import { validateSceneJSON } from '../helpers/scene-validators.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless.getRayScene', () => {
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

    it('returns valid JSON string', () => {
        pymol.load('mol', TINY_PDB);
        pymol.hide('everything');
        pymol.show('sticks');
        pymol.zoom('all');

        const json = pymol.getRayScene(256, 256);
        expect(typeof json).toBe('string');
        expect(json.length).toBeGreaterThan(0);

        // Should parse without error
        const scene = JSON.parse(json);
        expect(scene).toBeDefined();
    });

    it('scene JSON passes structural validation', () => {
        pymol.load('mol2', TINY_PDB);
        pymol.hide('everything');
        pymol.show('lines');
        pymol.zoom('all');

        const json = pymol.getRayScene(256, 256);
        const scene = JSON.parse(json);
        const result = validateSceneJSON(scene);

        if (!result.valid) {
            console.error('Validation errors:', result.errors);
        }
        expect(result.valid).toBe(true);
    });

    it('has format "viewmol-ray-v2"', () => {
        pymol.load('mol3', TINY_PDB);
        pymol.hide('everything');
        pymol.show('spheres');
        pymol.zoom('all');

        const scene = JSON.parse(pymol.getRayScene(256, 256));
        expect(scene.format).toBe('viewmol-ray-v2');
    });

    it('reports correct width and height', () => {
        pymol.load('mol4', TINY_PDB);
        pymol.show('sticks');
        pymol.zoom('all');

        const scene = JSON.parse(pymol.getRayScene(512, 384));
        expect(scene.width).toBe(512);
        expect(scene.height).toBe(384);
    });

    it('produces primitives for visible atoms', () => {
        pymol.load('visible', TINY_PDB);
        pymol.hide('everything');
        pymol.show('spheres', 'all');
        pymol.zoom('all');

        const scene = JSON.parse(pymol.getRayScene(256, 256));
        expect(scene.primitive_count).toBeGreaterThan(0);
        expect(scene.primitives.length).toBe(scene.primitive_count * scene.primitive_stride);
    });

    it('model_view is a 16-element array', () => {
        pymol.load('mv', TINY_PDB);
        pymol.show('sticks');
        pymol.zoom('all');

        const scene = JSON.parse(pymol.getRayScene(256, 256));
        expect(Array.isArray(scene.model_view)).toBe(true);
        expect(scene.model_view.length).toBe(16);
        // All values should be finite numbers
        for (const v of scene.model_view) {
            expect(typeof v).toBe('number');
            expect(Number.isFinite(v)).toBe(true);
        }
    });

    it('pos is a 3-element array', () => {
        pymol.load('postest', TINY_PDB);
        pymol.show('sticks');
        pymol.zoom('all');

        const scene = JSON.parse(pymol.getRayScene(256, 256));
        expect(Array.isArray(scene.pos)).toBe(true);
        expect(scene.pos.length).toBe(3);
    });

    it('primitive_stride is 46 (standard)', () => {
        pymol.load('stride', TINY_PDB);
        pymol.show('spheres');
        pymol.zoom('all');

        const scene = JSON.parse(pymol.getRayScene(256, 256));
        expect(scene.primitive_stride).toBe(46);
    });

    it('all primitive values are finite numbers', () => {
        pymol.load('finite', TINY_PDB);
        pymol.hide('everything');
        pymol.show('spheres');
        pymol.zoom('all');

        const scene = JSON.parse(pymol.getRayScene(256, 256));
        for (let i = 0; i < scene.primitives.length; i++) {
            expect(Number.isFinite(scene.primitives[i])).toBe(true);
        }
    });

    it('empty scene (hide everything) has 0 primitives', () => {
        pymol.load('empty_scene', SINGLE_ATOM_PDB);
        pymol.hide('everything');

        const scene = JSON.parse(pymol.getRayScene(256, 256));
        expect(scene.primitive_count).toBe(0);
        expect(scene.primitives.length).toBe(0);
    });
});
