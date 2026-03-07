/**
 * Integration tests for distance, angle, dihedral, and area queries.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isWasmAvailable, loadCreatePyMOL, TINY_PDB } from '../helpers/wasm-harness.js';
import { PyMOLHeadless } from '../../packages/pymol-wasm/src/pymol.js';

const runIntegration = isWasmAvailable();

describe.skipIf(!runIntegration)('PyMOLHeadless measurements', () => {
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

    describe('getDistance', () => {
        it('returns a positive number for valid atom pair', () => {
            // N-CA bond in residue 1
            const d = pymol.getDistance('name N and resi 1', 'name CA and resi 1');
            expect(d).toBeGreaterThan(0);
        });

        it('N-CA distance is approximately 1.4-1.6 Å', () => {
            const d = pymol.getDistance('name N and resi 1', 'name CA and resi 1');
            expect(d).toBeGreaterThan(1.0);
            expect(d).toBeLessThan(2.0);
        });

        it('distance to self is 0', () => {
            const d = pymol.getDistance('name N and resi 1', 'name N and resi 1');
            expect(d).toBeCloseTo(0, 2);
        });
    });

    describe('getAngle', () => {
        it('returns a positive angle for three atoms', () => {
            const angle = pymol.getAngle(
                'name N and resi 1',
                'name CA and resi 1',
                'name C and resi 1',
            );
            expect(angle).toBeGreaterThan(0);
            expect(angle).toBeLessThan(180);
        });

        it('N-CA-C angle is approximately 109-120 degrees', () => {
            const angle = pymol.getAngle(
                'name N and resi 1',
                'name CA and resi 1',
                'name C and resi 1',
            );
            // Tetrahedral ~109.5°, typical backbone ~111°
            expect(angle).toBeGreaterThan(100);
            expect(angle).toBeLessThan(130);
        });
    });

    describe('getDihedral', () => {
        it('returns a dihedral angle for four atoms', () => {
            const dihedral = pymol.getDihedral(
                'name N and resi 1',
                'name CA and resi 1',
                'name C and resi 1',
                'name O and resi 1',
            );
            // Dihedral can be -180 to +180
            expect(dihedral).toBeGreaterThanOrEqual(-180);
            expect(dihedral).toBeLessThanOrEqual(180);
        });
    });

    describe('getArea', () => {
        it('returns a positive SASA for all atoms', () => {
            const area = pymol.getArea('all');
            expect(area).toBeGreaterThan(0);
        });
    });

    describe('getExtent', () => {
        it('returns a 6-element bounding box', () => {
            const extent = pymol.getExtent('all');
            expect(extent).not.toBeNull();
            expect(extent!.length).toBe(6);
        });

        it('min <= max for each axis', () => {
            const ext = pymol.getExtent('all')!;
            expect(ext[0]).toBeLessThanOrEqual(ext[3]!); // minX <= maxX
            expect(ext[1]).toBeLessThanOrEqual(ext[4]!); // minY <= maxY
            expect(ext[2]).toBeLessThanOrEqual(ext[5]!); // minZ <= maxZ
        });
    });
});
