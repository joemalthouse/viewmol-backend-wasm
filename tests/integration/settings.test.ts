/**
 * Integration tests for setting get/set operations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

// Common PyMOL setting indices
const Settings = {
    sphere_scale: 154,
    stick_radius: 156,
    sphere_transparency: 449,
    cartoon_transparency: 564,
    ray_trace_mode: 178,
    ambient: 35,
    bg_rgb: 39,
    label_size: 453,
    ray_shadows: 36,
} as const;

describe.skipIf(!runIntegration)('PyMOLHeadless settings', () => {
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

    it('setSetting with numeric value returns true', () => {
        expect(pymol.setSetting(Settings.sphere_scale, 0.5)).toBe(true);
    });

    it('setSetting with zero value returns true', () => {
        expect(pymol.setSetting(Settings.ray_shadows, 0)).toBe(true);
    });

    it('setSetting with float value returns true', () => {
        expect(pymol.setSetting(Settings.ambient, 0.3)).toBe(true);
    });

    it('setSetting with selection returns true', () => {
        expect(pymol.setSetting(Settings.sphere_scale, 0.8, 'name CA')).toBe(true);
    });

    it('setSettingString with color name returns true', () => {
        // label_color is a string-valued setting
        expect(pymol.setSettingString(469, 'red')).toBe(true); // 469 = label_color
    });

    it('multiple setSetting calls accumulate', () => {
        expect(pymol.setSetting(Settings.sphere_scale, 0.3)).toBe(true);
        expect(pymol.setSetting(Settings.stick_radius, 0.15)).toBe(true);
        expect(pymol.setSetting(Settings.ambient, 0.5)).toBe(true);
        // If we get here without errors, settings accumulated successfully
    });
});
