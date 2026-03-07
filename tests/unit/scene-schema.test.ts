import { describe, it, expect } from 'vitest';
import {
    validateSceneJSON,
    validateBinaryHeader,
    type SceneValidationResult,
} from '../helpers/scene-validators.js';

// ===========================================================================
// Scene JSON validation
// ===========================================================================

describe('validateSceneJSON', () => {
    it('accepts a well-formed viewmol-ray-v2 scene', () => {
        const scene = {
            format: 'viewmol-ray-v2',
            width: 256,
            height: 256,
            primitive_count: 2,
            primitive_stride: 46,
            primitives: new Array(2 * 46).fill(0).map((_, i) => i * 0.01),
            model_view: new Array(16).fill(0),
            volume: [0, 0, 0, 256, 256, 100],
            pos: [0, 0, -50],
            fov: 15,
            bg: [0, 0, 0],
        };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects missing format field', () => {
        const scene = { width: 256, height: 256, primitive_count: 0, primitive_stride: 46, primitives: [] };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('missing or invalid "format" (expected "viewmol-ray-v2")');
    });

    it('rejects wrong format value', () => {
        const scene = { format: 'wrong-format', width: 256, height: 256, primitive_count: 0, primitive_stride: 46, primitives: [] };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(false);
    });

    it('rejects missing width/height', () => {
        const scene = { format: 'viewmol-ray-v2', primitive_count: 0, primitive_stride: 46, primitives: [] };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('width'))).toBe(true);
        expect(result.errors.some(e => e.includes('height'))).toBe(true);
    });

    it('rejects non-positive width/height', () => {
        const scene = { format: 'viewmol-ray-v2', width: 0, height: -1, primitive_count: 0, primitive_stride: 46, primitives: [] };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(false);
    });

    it('rejects missing primitive_count', () => {
        const scene = { format: 'viewmol-ray-v2', width: 256, height: 256, primitive_stride: 46, primitives: [] };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('primitive_count'))).toBe(true);
    });

    it('rejects negative primitive_count', () => {
        const scene = { format: 'viewmol-ray-v2', width: 256, height: 256, primitive_count: -1, primitive_stride: 46, primitives: [] };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(false);
    });

    it('rejects primitives array length mismatch', () => {
        const scene = {
            format: 'viewmol-ray-v2',
            width: 256,
            height: 256,
            primitive_count: 3,
            primitive_stride: 46,
            primitives: [1, 2, 3], // Should be 3 * 46 = 138
        };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('primitives'))).toBe(true);
    });

    it('accepts empty scene (primitive_count = 0)', () => {
        const scene = {
            format: 'viewmol-ray-v2',
            width: 256,
            height: 256,
            primitive_count: 0,
            primitive_stride: 46,
            primitives: [],
        };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(true);
    });

    it('rejects non-array primitives', () => {
        const scene = {
            format: 'viewmol-ray-v2',
            width: 256,
            height: 256,
            primitive_count: 0,
            primitive_stride: 46,
            primitives: 'not an array',
        };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(false);
    });

    it('warns on missing optional fields (model_view, volume, pos, fov, bg)', () => {
        const scene = {
            format: 'viewmol-ray-v2',
            width: 256,
            height: 256,
            primitive_count: 0,
            primitive_stride: 46,
            primitives: [],
        };
        const result = validateSceneJSON(scene);
        // Still valid, but warnings expected
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('validates model_view has 16 elements', () => {
        const scene = {
            format: 'viewmol-ray-v2',
            width: 256,
            height: 256,
            primitive_count: 0,
            primitive_stride: 46,
            primitives: [],
            model_view: [1, 2, 3], // Should be 16
        };
        const result = validateSceneJSON(scene);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('model_view'))).toBe(true);
    });
});

// ===========================================================================
// Binary header validation
// ===========================================================================

describe('validateBinaryHeader', () => {
    /** Build a minimal valid binary header. */
    function makeHeader(overrides?: {
        magic?: string;
        version?: number;
        headerSize?: number;
        primStride?: number;
        primCount?: number;
    }): Uint8Array {
        const magic = overrides?.magic ?? 'VMOL';
        const version = overrides?.version ?? 1;
        const headerSize = overrides?.headerSize ?? 128;
        const primStride = overrides?.primStride ?? 184; // 46 floats * 4 bytes
        const primCount = overrides?.primCount ?? 0;

        const buf = new ArrayBuffer(Math.max(headerSize, 128));
        const view = new DataView(buf);
        const u8 = new Uint8Array(buf);

        // Magic bytes (4 chars)
        for (let i = 0; i < 4; i++) {
            u8[i] = magic.charCodeAt(i) || 0;
        }
        // Version (uint32 LE at offset 4)
        view.setUint32(4, version, true);
        // Header size (uint32 LE at offset 8)
        view.setUint32(8, headerSize, true);
        // Primitive stride (uint32 LE at offset 12)
        view.setUint32(12, primStride, true);
        // Primitive count (uint32 LE at offset 16)
        view.setUint32(16, primCount, true);

        return new Uint8Array(buf);
    }

    it('accepts a valid binary header', () => {
        const buf = makeHeader();
        const result = validateBinaryHeader(buf);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects buffer too small for header', () => {
        const buf = new Uint8Array(8);
        const result = validateBinaryHeader(buf);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('too small'))).toBe(true);
    });

    it('rejects wrong magic bytes', () => {
        const buf = makeHeader({ magic: 'XXXX' });
        const result = validateBinaryHeader(buf);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('magic'))).toBe(true);
    });

    it('rejects unsupported version', () => {
        const buf = makeHeader({ version: 999 });
        const result = validateBinaryHeader(buf);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('version'))).toBe(true);
    });

    it('rejects zero primitive stride', () => {
        const buf = makeHeader({ primStride: 0 });
        const result = validateBinaryHeader(buf);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('stride'))).toBe(true);
    });

    it('accepts zero primitive count (empty scene)', () => {
        const buf = makeHeader({ primCount: 0 });
        const result = validateBinaryHeader(buf);
        expect(result.valid).toBe(true);
    });
});
