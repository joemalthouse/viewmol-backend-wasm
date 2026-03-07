/**
 * Reusable validators for viewmol-ray-v2 scene JSON and viewmol-bin-v1 binary
 * formats. Used by both unit tests (with synthetic data) and integration tests
 * (with real WASM output).
 */

export interface SceneValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// ---------------------------------------------------------------------------
// JSON scene validation
// ---------------------------------------------------------------------------

/**
 * Validates a parsed viewmol-ray-v2 scene object.
 *
 * Checks required fields, types, and internal consistency (e.g. primitives
 * array length matches primitive_count * primitive_stride).
 */
export function validateSceneJSON(scene: Record<string, unknown>): SceneValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required: format
    if (scene.format !== 'viewmol-ray-v2') {
        errors.push('missing or invalid "format" (expected "viewmol-ray-v2")');
    }

    // Required: width, height (positive integers)
    if (typeof scene.width !== 'number' || scene.width <= 0) {
        errors.push('missing or invalid "width" (expected positive number)');
    }
    if (typeof scene.height !== 'number' || scene.height <= 0) {
        errors.push('missing or invalid "height" (expected positive number)');
    }

    // Required: primitive_count (non-negative integer)
    if (typeof scene.primitive_count !== 'number' || scene.primitive_count < 0) {
        errors.push('missing or invalid "primitive_count" (expected non-negative number)');
    }

    // Required: primitive_stride (positive integer)
    if (typeof scene.primitive_stride !== 'number' || scene.primitive_stride <= 0) {
        errors.push('missing or invalid "primitive_stride" (expected positive number)');
    }

    // Required: primitives (array)
    if (!Array.isArray(scene.primitives)) {
        errors.push('"primitives" must be an array');
    } else if (typeof scene.primitive_count === 'number' && typeof scene.primitive_stride === 'number') {
        const expected = scene.primitive_count * scene.primitive_stride;
        if (scene.primitives.length !== expected) {
            errors.push(
                `primitives array length (${scene.primitives.length}) does not match ` +
                `primitive_count (${scene.primitive_count}) * primitive_stride (${scene.primitive_stride}) = ${expected}`
            );
        }
    }

    // Optional but recommended: model_view (16 floats)
    if (scene.model_view !== undefined) {
        if (!Array.isArray(scene.model_view) || scene.model_view.length !== 16) {
            errors.push('model_view must be an array of 16 numbers');
        }
    } else {
        warnings.push('missing optional field "model_view"');
    }

    // Optional: volume (6 floats)
    if (scene.volume !== undefined) {
        if (!Array.isArray(scene.volume) || scene.volume.length !== 6) {
            errors.push('volume must be an array of 6 numbers');
        }
    } else {
        warnings.push('missing optional field "volume"');
    }

    // Optional: pos (3 floats)
    if (scene.pos !== undefined) {
        if (!Array.isArray(scene.pos) || scene.pos.length !== 3) {
            errors.push('pos must be an array of 3 numbers');
        }
    } else {
        warnings.push('missing optional field "pos"');
    }

    // Optional: fov
    if (scene.fov !== undefined) {
        if (typeof scene.fov !== 'number') {
            errors.push('fov must be a number');
        }
    } else {
        warnings.push('missing optional field "fov"');
    }

    // Optional: bg (3 floats)
    if (scene.bg !== undefined) {
        if (!Array.isArray(scene.bg) || scene.bg.length !== 3) {
            errors.push('bg must be an array of 3 numbers');
        }
    } else {
        warnings.push('missing optional field "bg"');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

// ---------------------------------------------------------------------------
// Binary header validation
// ---------------------------------------------------------------------------

/** Expected binary magic bytes. */
const BINARY_MAGIC = 'VMOL';

/** Minimum header size in bytes to read magic + version + header fields. */
const MIN_HEADER_SIZE = 20;

/**
 * Validates a viewmol-bin-v1 binary buffer header.
 *
 * Header layout (little-endian):
 *   [0..3]   magic     4 bytes  "VMOL"
 *   [4..7]   version   uint32   1
 *   [8..11]  headerSz  uint32   total header byte count
 *   [12..15] primStride uint32  bytes per primitive
 *   [16..19] primCount  uint32  number of primitives
 */
export function validateBinaryHeader(buf: Uint8Array): SceneValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (buf.length < MIN_HEADER_SIZE) {
        errors.push(`buffer too small (${buf.length} bytes, need at least ${MIN_HEADER_SIZE})`);
        return { valid: false, errors, warnings };
    }

    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    // Magic bytes
    const magic = String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!);
    if (magic !== BINARY_MAGIC) {
        errors.push(`invalid magic bytes "${magic}" (expected "${BINARY_MAGIC}")`);
    }

    // Version
    const version = view.getUint32(4, true);
    if (version !== 1) {
        errors.push(`unsupported version ${version} (expected 1)`);
    }

    // Header size
    const headerSize = view.getUint32(8, true);
    if (headerSize > buf.length) {
        errors.push(`header_size (${headerSize}) exceeds buffer length (${buf.length})`);
    }

    // Primitive stride
    const primStride = view.getUint32(12, true);
    if (primStride === 0) {
        errors.push('primitive stride is 0 (expected > 0)');
    }

    // Primitive count (informational, validated against buffer length if stride > 0)
    const primCount = view.getUint32(16, true);
    if (primStride > 0 && primCount > 0) {
        const expectedDataSize = primStride * primCount;
        const availableData = buf.length - headerSize;
        if (availableData < expectedDataSize) {
            warnings.push(
                `buffer may be truncated: need ${expectedDataSize} bytes for ${primCount} primitives, ` +
                `but only ${availableData} bytes after header`
            );
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
