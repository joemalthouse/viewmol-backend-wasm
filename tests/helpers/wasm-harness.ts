/**
 * Shared WASM test harness for integration and smoke tests.
 *
 * Provides:
 * - A guard that skips tests when the WASM binary isn't built
 * - Factory functions to create/destroy PyMOLHeadless instances
 * - Embedded test PDB data (no external file dependencies)
 */

import { existsSync } from 'fs';
import { resolve } from 'path';

// Path to the built WASM loader
const WASM_LOADER_PATH = resolve(__dirname, '../../packages/pymol-wasm/src/load-wasm.cjs');
const WASM_DIST_PATH = resolve(__dirname, '../../packages/pymol-wasm/dist/pymol_wasm.js');

/**
 * Returns true if the WASM binary has been built and is available.
 * Use this in describe blocks to skip integration tests gracefully.
 */
export function isWasmAvailable(): boolean {
    return existsSync(WASM_LOADER_PATH) && existsSync(WASM_DIST_PATH);
}

/**
 * Dynamically loads the createPyMOL factory function.
 * Throws if the WASM binary isn't built.
 */
export function loadCreatePyMOL(): (moduleArgs?: Record<string, unknown>) => Promise<unknown> {
    if (!isWasmAvailable()) {
        throw new Error(
            'WASM binary not found. Run `pnpm build:wasm` first.\n' +
            `  Expected: ${WASM_DIST_PATH}`
        );
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(WASM_LOADER_PATH);
}

// ---------------------------------------------------------------------------
// Embedded test PDB data
// ---------------------------------------------------------------------------

/**
 * Minimal ALA tripeptide PDB (ACE-ALA-NME, 22 atoms).
 * Small enough to load instantly, has backbone + side chain atoms.
 */
export const TINY_PDB = `\
ATOM      1  N   ALA A   1       1.458   0.000   0.000  1.00  0.00           N
ATOM      2  CA  ALA A   1       2.009   1.420   0.000  1.00  0.00           C
ATOM      3  C   ALA A   1       1.555   2.151   1.260  1.00  0.00           C
ATOM      4  O   ALA A   1       0.751   1.633   2.046  1.00  0.00           O
ATOM      5  CB  ALA A   1       1.498   2.126  -1.245  1.00  0.00           C
ATOM      6  N   ALA A   2       2.095   3.371   1.400  1.00  0.00           N
ATOM      7  CA  ALA A   2       1.720   4.159   2.577  1.00  0.00           C
ATOM      8  C   ALA A   2       2.275   5.579   2.471  1.00  0.00           C
ATOM      9  O   ALA A   2       3.213   5.843   1.706  1.00  0.00           O
ATOM     10  CB  ALA A   2       2.296   3.490   3.822  1.00  0.00           C
ATOM     11  N   ALA A   3       1.651   6.495   3.218  1.00  0.00           N
ATOM     12  CA  ALA A   3       2.103   7.882   3.180  1.00  0.00           C
ATOM     13  C   ALA A   3       1.618   8.611   4.430  1.00  0.00           C
ATOM     14  O   ALA A   3       0.490   8.396   4.894  1.00  0.00           O
ATOM     15  CB  ALA A   3       1.542   8.563   1.932  1.00  0.00           C
ATOM     16  OXT ALA A   3       2.382   9.374   5.016  1.00  0.00           O
END
`;

/**
 * Single-atom PDB (one carbon atom at origin).
 */
export const SINGLE_ATOM_PDB = `\
ATOM      1  C   UNK A   1       0.000   0.000   0.000  1.00  0.00           C
END
`;

/**
 * Two-chain PDB for testing chain selections.
 */
export const TWO_CHAIN_PDB = `\
ATOM      1  N   ALA A   1       1.458   0.000   0.000  1.00  0.00           N
ATOM      2  CA  ALA A   1       2.009   1.420   0.000  1.00  0.00           C
ATOM      3  C   ALA A   1       1.555   2.151   1.260  1.00  0.00           C
ATOM      4  O   ALA A   1       0.751   1.633   2.046  1.00  0.00           O
ATOM      5  CB  ALA A   1       1.498   2.126  -1.245  1.00  0.00           C
TER
ATOM      6  N   GLY B   1      10.000   0.000   0.000  1.00  0.00           N
ATOM      7  CA  GLY B   1      10.500   1.420   0.000  1.00  0.00           C
ATOM      8  C   GLY B   1      10.100   2.151   1.260  1.00  0.00           C
ATOM      9  O   GLY B   1       9.300   1.633   2.046  1.00  0.00           O
END
`;
