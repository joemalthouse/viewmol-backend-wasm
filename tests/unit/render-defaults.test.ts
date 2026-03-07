import { describe, it, expect } from 'vitest';

/**
 * Tests for render.ts defaults and merge logic.
 *
 * We import the module values directly. Since render.ts uses a global
 * ViewMolAPI lookup (browser-only), we only test the pure logic here —
 * the DEFAULT_SETTINGS, interface shape, and merge behavior.
 */

// We can't import DEFAULT_SETTINGS directly (it's not exported),
// so we test the merge behavior through the public API shape.
// Instead we validate the contract via a re-import of the source.

// Import the raw source to test the constants
import { readFileSync } from 'fs';
import { resolve } from 'path';

const renderSrc = readFileSync(
    resolve(__dirname, '../../packages/pymol-wasm/src/render.ts'),
    'utf8',
);

describe('render.ts DEFAULT_SETTINGS', () => {
    it('defines rayShadows', () => {
        expect(renderSrc).toContain('rayShadows:');
    });

    it('defines ambient', () => {
        expect(renderSrc).toContain('ambient:');
    });

    it('defines direct', () => {
        expect(renderSrc).toContain('direct:');
    });

    it('defines specPower', () => {
        expect(renderSrc).toContain('specPower:');
    });

    it('defines specReflect', () => {
        expect(renderSrc).toContain('specReflect:');
    });

    it('defines reflect', () => {
        expect(renderSrc).toContain('reflect:');
    });

    it('defines gamma as 1.0', () => {
        expect(renderSrc).toMatch(/gamma:\s*1\.0/);
    });

    it('defines lightCount', () => {
        expect(renderSrc).toContain('lightCount:');
    });

    it('defines light as [0, 0, -1]', () => {
        expect(renderSrc).toMatch(/light:\s*\[0,\s*0,\s*-1\]/);
    });

    it('defines opaqueBg as true', () => {
        expect(renderSrc).toMatch(/opaqueBg:\s*true/);
    });

    it('defines bgRgb as [0, 0, 0]', () => {
        expect(renderSrc).toMatch(/bgRgb:\s*\[0,\s*0,\s*0\]/);
    });
});

describe('render.ts DEFAULT_OPTIONS', () => {
    it('defines executionProfile as parity', () => {
        expect(renderSrc).toMatch(/executionProfile:\s*['"]parity['"]/);
    });

    it('defines returnRGBA as true', () => {
        expect(renderSrc).toMatch(/returnRGBA:\s*true/);
    });
});

describe('render.ts exports', () => {
    it('exports renderRayScene function', () => {
        expect(renderSrc).toContain('export async function renderRayScene');
    });

    it('exports renderRaySceneBinary function', () => {
        expect(renderSrc).toContain('export async function renderRaySceneBinary');
    });

    it('exports RenderSettings interface', () => {
        expect(renderSrc).toContain('export interface RenderSettings');
    });

    it('exports RenderOptions interface', () => {
        expect(renderSrc).toContain('export interface RenderOptions');
    });
});

describe('render.ts merge behavior', () => {
    it('uses spread for settings merge (caller overrides defaults)', () => {
        // Verify the merge pattern: { ...DEFAULT_SETTINGS, ...settings }
        expect(renderSrc).toMatch(/\{\s*\.\.\.DEFAULT_SETTINGS,\s*\.\.\.settings\s*\}/);
    });

    it('uses spread for options merge (caller overrides defaults)', () => {
        expect(renderSrc).toMatch(/\{\s*\.\.\.DEFAULT_OPTIONS,\s*\.\.\.renderOptions\s*\}/);
    });
});
