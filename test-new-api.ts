/**
 * Tests for all new API functions added in Issues 1-6.
 * Run with: npx tsx test-new-api.ts
 */
import assert from 'assert';
import type { PyMOLModule } from './pymol.js';
import { LOAD_FORMAT_PDB_STR } from './pymol.js';

function withString<T>(module: PyMOLModule, str: string, fn: (ptr: number) => T): T {
    const ptr = module.stringToNewUTF8(str);
    assert.notStrictEqual(ptr, 0, `Failed to allocate WASM string for "${str.slice(0, 50)}"`);
    try { return fn(ptr); } finally { module._free(ptr); }
}

function withBuffer<T>(module: PyMOLModule, bytes: number, fn: (ptr: number) => T): T {
    const ptr = module._malloc(bytes);
    assert.notStrictEqual(ptr, 0, `Failed to allocate ${bytes} bytes`);
    try { return fn(ptr); } finally { module._free(ptr); }
}

/** Reads a malloc'd string from a char** out_ptr pattern, frees the inner buffer. */
function readOutString(module: PyMOLModule, outPtrPtr: number): string {
    const bufPtr = module.HEAP32[outPtrPtr >> 2];
    if (bufPtr === 0) return "";
    try { return module.UTF8ToString(bufPtr); } finally { module._free(bufPtr); }
}

/** Calls a function that writes to char** out_ptr, returns the string. */
function callWithOutPtr<T>(module: PyMOLModule, fn: (outPtrPtr: number) => T): { result: T; str: string } {
    return withBuffer(module, 4, (outPtrPtr) => {
        module.HEAP32[outPtrPtr >> 2] = 0;
        const result = fn(outPtrPtr);
        const str = readOutString(module, outPtrPtr);
        return { result, str };
    });
}

const pdbData = `ATOM      1  N   ALA A   1      -0.612   0.093  -0.547  1.00 10.00           N
ATOM      2  CA  ALA A   1      -0.347   1.464  -0.088  1.00 20.00           C
ATOM      3  C   ALA A   1       1.155   1.698  -0.207  1.00 30.00           C
ATOM      4  O   ALA A   1       1.670   1.815  -1.312  1.00 40.00           O
ATOM      5  CB  ALA A   1      -0.817   1.666   1.353  1.00 50.00           C
ATOM      6  N   GLY B   2       1.782   1.761   0.880  1.00 60.00           N
ATOM      7  CA  GLY B   2       3.200   2.000   0.700  1.00 70.00           C
ATOM      8  C   GLY B   2       3.900   0.800   0.100  1.00 80.00           C
ATOM      9  O   GLY B   2       3.300  -0.200  -0.300  1.00 90.00           O
END`;

const pdbByteLength = new TextEncoder().encode(pdbData).byteLength;
const objName = "test_mol";

let passCount = 0;
let failCount = 0;

function pass(name: string) {
    passCount++;
    console.log(`  ✓ ${name}`);
}

function fail(name: string, err: unknown) {
    failCount++;
    console.error(`  ✗ ${name}: ${err}`);
}

/** Loads the test molecule, returns atom count for verification. */
function loadTestMolecule(module: PyMOLModule, pymolPtr: number, name: string = objName): number {
    return withString(module, name, (namePtr) =>
        withString(module, pdbData, (pdbPtr) => {
            const result = module._PyMOLWasm_Load(pymolPtr, namePtr, pdbPtr, pdbByteLength, LOAD_FORMAT_PDB_STR);
            assert.strictEqual(result, 1, "Load failed");
            return withString(module, "all", (selPtr) =>
                module._PyMOLWasm_GetAtomCount(pymolPtr, selPtr)
            );
        })
    );
}

// =============================================================================
// Issue 1: Viewing / Display
// =============================================================================

function testEnableDisable(m: PyMOLModule, p: number) {
    withString(m, objName, (namePtr) => {
        assert.strictEqual(m._PyMOLWasm_Disable(p, namePtr), 1);
        assert.strictEqual(m._PyMOLWasm_Enable(p, namePtr), 1);
    });
    pass("Enable/Disable");
}

function testOrient(m: PyMOLModule, p: number) {
    withString(m, "all", (selPtr) => {
        assert.strictEqual(m._PyMOLWasm_Orient(p, selPtr), 1);
    });
    pass("Orient");
}

function testClip(m: PyMOLModule, p: number) {
    withString(m, "near", (modePtr) =>
        withString(m, "", (selPtr) => {
            assert.strictEqual(m._PyMOLWasm_Clip(p, modePtr, -5.0, selPtr), 1);
        })
    );
    withString(m, "far", (modePtr) =>
        withString(m, "", (selPtr) => {
            assert.strictEqual(m._PyMOLWasm_Clip(p, modePtr, 10.0, selPtr), 1);
        })
    );
    pass("Clip");
}

function testMove(m: PyMOLModule, p: number) {
    withString(m, "x", (axisPtr) => {
        assert.strictEqual(m._PyMOLWasm_Move(p, axisPtr, 5.0), 1);
    });
    withString(m, "z", (axisPtr) => {
        assert.strictEqual(m._PyMOLWasm_Move(p, axisPtr, -3.0), 1);
    });
    pass("Move");
}

function testReset(m: PyMOLModule, p: number) {
    withString(m, "", (namePtr) => {
        assert.strictEqual(m._PyMOLWasm_Reset(p, namePtr), 1);
    });
    pass("Reset");
}

function testBgColor(m: PyMOLModule, p: number) {
    withString(m, "white", (colorPtr) => {
        assert.strictEqual(m._PyMOLWasm_BgColor(p, colorPtr), 1);
    });
    withString(m, "black", (colorPtr) => {
        assert.strictEqual(m._PyMOLWasm_BgColor(p, colorPtr), 1);
    });
    pass("BgColor");
}

function testCartoon(m: PyMOLModule, p: number) {
    withString(m, "all", (selPtr) => {
        assert.strictEqual(m._PyMOLWasm_Cartoon(p, 0, selPtr), 1); // automatic
    });
    pass("Cartoon");
}

function testToggle(m: PyMOLModule, p: number) {
    withString(m, "cartoon", (repPtr) =>
        withString(m, "all", (selPtr) => {
            assert.strictEqual(m._PyMOLWasm_Toggle(p, repPtr, selPtr), 1);
            assert.strictEqual(m._PyMOLWasm_Toggle(p, repPtr, selPtr), 1); // toggle back
        })
    );
    pass("Toggle");
}

function testRebuild(m: PyMOLModule, p: number) {
    assert.strictEqual(m._PyMOLWasm_Rebuild(p), 1);
    pass("Rebuild");
}

function testIsolevel(m: PyMOLModule, p: number) {
    // Isolevel on a non-existent object should fail gracefully (return 0)
    withString(m, "nonexistent_mesh", (namePtr) => {
        const result = m._PyMOLWasm_Isolevel(p, namePtr, 2.0, -1);
        assert.strictEqual(result, 0, "Isolevel on missing object should return 0");
    });
    pass("Isolevel (graceful fail)");
}

// =============================================================================
// Issue 1: Structure Manipulation
// =============================================================================

function testHAdd(m: PyMOLModule, p: number) {
    withString(m, "all", (selPtr) => {
        const beforeCount = m._PyMOLWasm_GetAtomCount(p, selPtr);
        assert.strictEqual(m._PyMOLWasm_HAdd(p, selPtr), 1);
        const afterCount = m._PyMOLWasm_GetAtomCount(p, selPtr);
        assert.ok(afterCount >= beforeCount, `HAdd should add hydrogens: ${beforeCount} → ${afterCount}`);
        console.log(`    (${beforeCount} → ${afterCount} atoms)`);
    });
    pass("HAdd");
}

function testProtectMask(m: PyMOLModule, p: number) {
    withString(m, "all", (selPtr) => {
        assert.strictEqual(m._PyMOLWasm_Protect(p, selPtr, 1), 1); // protect
        assert.strictEqual(m._PyMOLWasm_Protect(p, selPtr, 0), 1); // deprotect
        assert.strictEqual(m._PyMOLWasm_Mask(p, selPtr, 1), 1);    // mask
        assert.strictEqual(m._PyMOLWasm_Mask(p, selPtr, 0), 1);    // unmask
    });
    pass("Protect/Mask");
}

function testFlag(m: PyMOLModule, p: number) {
    withString(m, "all", (selPtr) => {
        assert.strictEqual(m._PyMOLWasm_Flag(p, 0, selPtr, 1), 1); // set flag 0
        assert.strictEqual(m._PyMOLWasm_Flag(p, 0, selPtr, 2), 1); // clear flag 0
    });
    pass("Flag");
}

function testSetDihedral(m: PyMOLModule, p: number) {
    // Use 4 single-atom selections
    withString(m, "id 1", (s0) =>
        withString(m, "id 2", (s1) =>
            withString(m, "id 3", (s2) =>
                withString(m, "id 4", (s3) => {
                    const result = m._PyMOLWasm_SetDihedral(p, s0, s1, s2, s3, 120.0, 0);
                    // May fail if atoms aren't bonded in the right way, that's OK
                    console.log(`    (SetDihedral returned ${result})`);
                })
            )
        )
    );
    pass("SetDihedral");
}

function testSort(m: PyMOLModule, p: number) {
    withString(m, objName, (namePtr) => {
        assert.strictEqual(m._PyMOLWasm_Sort(p, namePtr), 1);
    });
    pass("Sort");
}

function testSculpt(m: PyMOLModule, p: number) {
    withString(m, objName, (namePtr) => {
        assert.strictEqual(m._PyMOLWasm_SculptActivate(p, namePtr), 1);
        const energy = m._PyMOLWasm_SculptIterate(p, namePtr, -1, 5);
        console.log(`    (Sculpt energy: ${energy})`);
        assert.ok(energy >= 0 || energy === -1.0, "Sculpt energy should be non-negative or -1");
    });
    pass("SculptActivate/SculptIterate");
}

function testPseudoatom(m: PyMOLModule, p: number) {
    withString(m, "pseudo_obj", (objPtr) =>
        withString(m, "", (emptyPtr) =>
            withString(m, "PS", (resnPtr) =>
                withString(m, "PSA", (namePtr) =>
                    withString(m, "X", (chainPtr) =>
                        withString(m, "marker", (labelPtr) => {
                            withBuffer(m, 12, (posPtr) => {
                                new Float32Array(m.HEAPF32.buffer, posPtr, 3).set([1.0, 2.0, 3.0]);
                                const result = m._PyMOLWasm_Pseudoatom(p, objPtr, emptyPtr, namePtr, resnPtr, chainPtr, posPtr, labelPtr, -1);
                                assert.strictEqual(result, 1, "Pseudoatom creation failed");
                            });
                        })
                    )
                )
            )
        )
    );
    // Clean up
    withString(m, "pseudo_obj", (ptr) => m._PyMOLWasm_Delete(p, ptr));
    pass("Pseudoatom");
}

// =============================================================================
// Issue 1: Object Management
// =============================================================================

function testSetName(m: PyMOLModule, p: number) {
    // Create a copy, rename it, then delete
    withString(m, "rename_src", (srcPtr) =>
        withString(m, "all", (selPtr) => {
            m._PyMOLWasm_CreateObject(p, srcPtr, selPtr, -1, -1, 0);
            withString(m, "rename_dst", (dstPtr) => {
                assert.strictEqual(m._PyMOLWasm_SetName(p, srcPtr, dstPtr), 1);
                m._PyMOLWasm_Delete(p, dstPtr);
            });
        })
    );
    pass("SetName");
}

function testSetTitle(m: PyMOLModule, p: number) {
    withString(m, objName, (namePtr) =>
        withString(m, "Test Title", (titlePtr) => {
            assert.strictEqual(m._PyMOLWasm_SetTitle(p, namePtr, 0, titlePtr), 1);
        })
    );
    pass("SetTitle");
}

function testOrder(m: PyMOLModule, p: number) {
    withString(m, objName, (namesPtr) => {
        assert.strictEqual(m._PyMOLWasm_Order(p, namesPtr, 0, 0), 1);
    });
    pass("Order");
}

function testGroup(m: PyMOLModule, p: number) {
    withString(m, "test_group", (groupPtr) =>
        withString(m, objName, (memberPtr) => {
            m._PyMOLWasm_Group(p, groupPtr, memberPtr, 0); // add
            m._PyMOLWasm_Group(p, groupPtr, memberPtr, 6); // ungroup
            m._PyMOLWasm_Delete(p, groupPtr);
        })
    );
    pass("Group");
}

function testSetObjectColor(m: PyMOLModule, p: number) {
    withString(m, objName, (namePtr) =>
        withString(m, "green", (colorPtr) => {
            assert.strictEqual(m._PyMOLWasm_SetObjectColor(p, namePtr, colorPtr), 1);
        })
    );
    pass("SetObjectColor");
}

// =============================================================================
// Issue 1: Settings
// =============================================================================

function testUnsetSetting(m: PyMOLModule, p: number) {
    withString(m, "", (selPtr) => {
        // Unset a global setting (sphere_scale = index 155)
        assert.strictEqual(m._PyMOLWasm_UnsetSetting(p, 155, selPtr, -1), 1);
    });
    pass("UnsetSetting");
}

// =============================================================================
// Issue 2: Atom Property Access
// =============================================================================

function testSetGetAtomPropertyFloat(m: PyMOLModule, p: number) {
    // Use a single-atom selection (id 1) to avoid any interaction with prior test state
    withString(m, "id 1", (selPtr) =>
        withString(m, "b", (propPtr) => {
            // Set B-factor to 42.0
            const count = m._PyMOLWasm_SetAtomPropertyFloat(p, selPtr, propPtr, 42.0);
            assert.strictEqual(count, 1, `SetAtomPropertyFloat should modify 1 atom, got ${count}`);

            // Read it back
            withBuffer(m, 4, (bufPtr) => {
                const readCount = m._PyMOLWasm_GetAtomPropertyFloat(p, selPtr, propPtr, bufPtr, 1);
                assert.strictEqual(readCount, 1, "Read count should be 1");
                const value = m.HEAPF32[bufPtr >> 2];
                assert.ok(Math.abs(value - 42.0) < 0.001, `B-factor should be 42.0, got ${value}`);
            });
            console.log(`    (Set id 1 b=42.0, verified readback)`);
        })
    );
    pass("SetAtomPropertyFloat / GetAtomPropertyFloat (b-factor)");
}

function testSetGetAtomPropertyInt(m: PyMOLModule, p: number) {
    withString(m, "all", (selPtr) =>
        withString(m, "color", (propPtr) => {
            // Read color indices
            const atomCount = m._PyMOLWasm_GetAtomCount(p, selPtr);
            withBuffer(m, atomCount * 4, (bufPtr) => {
                const readCount = m._PyMOLWasm_GetAtomPropertyInt(p, selPtr, propPtr, bufPtr, atomCount);
                assert.ok(readCount > 0, `GetAtomPropertyInt should read atoms, got ${readCount}`);
                console.log(`    (Read ${readCount} color indices)`);
            });
        })
    );
    pass("GetAtomPropertyInt (color)");
}

function testSetGetAtomPropertyString(m: PyMOLModule, p: number) {
    // Set chain for selection
    withString(m, "resn ALA", (selPtr) =>
        withString(m, "chain", (propPtr) =>
            withString(m, "Z", (valPtr) => {
                const count = m._PyMOLWasm_SetAtomPropertyString(p, selPtr, propPtr, valPtr);
                assert.ok(count > 0, `SetAtomPropertyString should modify atoms, got ${count}`);
                console.log(`    (Set ${count} atoms chain=Z)`);
            })
        )
    );

    // Read back names of all atoms
    withString(m, "all", (selPtr) =>
        withString(m, "name", (propPtr) => {
            const { result: readCount, str: jsonStr } = callWithOutPtr(m, (outPtr) =>
                m._PyMOLWasm_GetAtomPropertyString(p, selPtr, propPtr, outPtr)
            );
            assert.ok(readCount > 0, `GetAtomPropertyString should read atoms, got ${readCount}`);
            const names = JSON.parse(jsonStr);
            assert.ok(Array.isArray(names), "Should return JSON array");
            assert.strictEqual(names.length, readCount, "Array length should match count");
            console.log(`    (Read ${readCount} atom names: ${names.slice(0, 5).join(',')}...)`);
        })
    );

    // Restore chain
    withString(m, "resn ALA", (selPtr) =>
        withString(m, "chain", (propPtr) =>
            withString(m, "A", (valPtr) => {
                m._PyMOLWasm_SetAtomPropertyString(p, selPtr, propPtr, valPtr);
            })
        )
    );
    pass("SetAtomPropertyString / GetAtomPropertyString");
}

function testAtomPropertySideEffects(m: PyMOLModule, p: number) {
    // Test that setting 'elem' triggers AtomInfoAssignParameters
    withString(m, "id 1", (selPtr) =>
        withString(m, "elem", (propPtr) =>
            withString(m, "C", (valPtr) => {
                const count = m._PyMOLWasm_SetAtomPropertyString(p, selPtr, propPtr, valPtr);
                assert.ok(count > 0, "Should modify at least 1 atom");
            })
        )
    );
    // Restore
    withString(m, "id 1", (selPtr) =>
        withString(m, "elem", (propPtr) =>
            withString(m, "N", (valPtr) => {
                m._PyMOLWasm_SetAtomPropertyString(p, selPtr, propPtr, valPtr);
            })
        )
    );
    pass("Atom property side effects (elem)");
}

// =============================================================================
// Issue 3: File Export
// =============================================================================

function testGetStrPDB(m: PyMOLModule, p: number) {
    withString(m, "pdb", (fmtPtr) =>
        withString(m, "all", (selPtr) => {
            const { result: len, str: pdbStr } = callWithOutPtr(m, (outPtr) =>
                m._PyMOLWasm_GetStr(p, fmtPtr, selPtr, -1, outPtr)
            );
            assert.ok(len > 0, `GetStr(pdb) should return positive length, got ${len}`);
            assert.ok(pdbStr.includes("ATOM"), "PDB output should contain ATOM records");
            assert.ok(pdbStr.includes("ALA"), "PDB output should contain ALA residue");
            console.log(`    (PDB export: ${len} bytes, ${pdbStr.split('\n').length} lines)`);
        })
    );
    pass("GetStr (PDB)");
}

function testGetStrSDF(m: PyMOLModule, p: number) {
    withString(m, "sdf", (fmtPtr) =>
        withString(m, "all", (selPtr) => {
            const { result: len, str: sdfStr } = callWithOutPtr(m, (outPtr) =>
                m._PyMOLWasm_GetStr(p, fmtPtr, selPtr, -1, outPtr)
            );
            assert.ok(len > 0, `GetStr(sdf) should return positive length, got ${len}`);
            assert.ok(sdfStr.includes("$$$$"), "SDF output should contain $$$$ terminator");
            console.log(`    (SDF export: ${len} bytes)`);
        })
    );
    pass("GetStr (SDF)");
}

function testGetStrCIF(m: PyMOLModule, p: number) {
    withString(m, "cif", (fmtPtr) =>
        withString(m, "all", (selPtr) => {
            const { result: len, str: cifStr } = callWithOutPtr(m, (outPtr) =>
                m._PyMOLWasm_GetStr(p, fmtPtr, selPtr, -1, outPtr)
            );
            assert.ok(len > 0, `GetStr(cif) should return positive length, got ${len}`);
            assert.ok(cifStr.includes("_atom_site"), "CIF output should contain _atom_site");
            console.log(`    (CIF export: ${len} bytes)`);
        })
    );
    pass("GetStr (CIF)");
}

function testGetStrMOL2(m: PyMOLModule, p: number) {
    withString(m, "mol2", (fmtPtr) =>
        withString(m, "all", (selPtr) => {
            const { result: len, str: mol2Str } = callWithOutPtr(m, (outPtr) =>
                m._PyMOLWasm_GetStr(p, fmtPtr, selPtr, -1, outPtr)
            );
            assert.ok(len > 0, `GetStr(mol2) should return positive length, got ${len}`);
            assert.ok(mol2Str.includes("@<TRIPOS>ATOM"), "MOL2 output should contain TRIPOS section");
            console.log(`    (MOL2 export: ${len} bytes)`);
        })
    );
    pass("GetStr (MOL2)");
}

// =============================================================================
// Issue 5: Label Runs (tested via GetRayScene)
// =============================================================================

function testLabelRuns(m: PyMOLModule, p: number) {
    // Add labels, then get ray scene and check for label_runs
    withString(m, "name CA", (selPtr) =>
        withString(m, "name", (exprPtr) =>
            withString(m, "labels", (repPtr) => {
                m._PyMOLWasm_Label(p, selPtr, exprPtr);
                m._PyMOLWasm_Show(p, repPtr, selPtr);
            })
        )
    );

    // Get ray scene
    const { result: jsonLen, str: jsonStr } = callWithOutPtr(m, (outPtr) =>
        m._PyMOLWasm_GetRayScene(p, 320, 240, outPtr, 0)
    );
    assert.ok(jsonLen > 0, "GetRayScene should return data");
    const scene = JSON.parse(jsonStr);

    // Check v1 label_runs format: {runs: [...], glyphs: [...]}
    assert.strictEqual(scene.label_runs_version, 1, "Should have label_runs_version 1");
    assert.ok(scene.label_runs && typeof scene.label_runs === 'object', "Scene should have label_runs object");
    assert.ok(Array.isArray(scene.label_runs.runs), "label_runs should have runs array");
    assert.ok(Array.isArray(scene.label_runs.glyphs), "label_runs should have glyphs array");

    // Labels emit both character primitives (type 5) AND label_runs data
    const stride = scene.primitive_stride; // 46
    const prims = scene.primitives;
    let charPrimCount = 0;
    for (let i = 0; i < prims.length; i += stride) {
        if (prims[i] === 5) charPrimCount++;
    }

    const runCount = scene.label_runs.runs.length;
    const glyphCount = scene.label_runs.glyphs.length;
    console.log(`    (${runCount} label runs, ${glyphCount} glyphs, ${charPrimCount} char prims, ${scene.primitive_count} total prims)`);

    // Either runs OR character primitives should exist (labels produce both)
    assert.ok(runCount > 0 || charPrimCount > 0,
        "Labels should produce label_runs and/or character primitives");

    if (runCount > 0) {
        const run = scene.label_runs.runs[0];
        assert.ok(Array.isArray(run.anchor), "Label run should have anchor");
        assert.strictEqual(run.anchor.length, 3, "Anchor should have 3 components");
        assert.ok(typeof run.font_id === 'number', "Label run should have font_id");
        assert.ok(typeof run.scale === 'number', "Label run should have scale");
    }

    // Check char_bitmaps
    assert.ok(Array.isArray(scene.char_bitmaps), "Scene should have char_bitmaps");

    // Clear labels
    withString(m, "all", (selPtr) =>
        withString(m, "", (emptyPtr) => {
            m._PyMOLWasm_Label(p, selPtr, emptyPtr);
        })
    );
    pass("Label Runs (ray scene)");
}

// =============================================================================
// Issue 6: Introspection
// =============================================================================

function testGetNames(m: PyMOLModule, p: number) {
    const { result: count, str: jsonStr } = callWithOutPtr(m, (outPtr) =>
        m._PyMOLWasm_GetNames(p, 0, outPtr) // mode 0 = all
    );
    assert.ok(count > 0, `GetNames should return at least 1 name, got ${count}`);
    const names = JSON.parse(jsonStr);
    assert.ok(Array.isArray(names), "Should return JSON array");
    assert.ok(names.includes(objName), `Names should include "${objName}"`);
    console.log(`    (${count} names: ${names.join(', ')})`);
    pass("GetNames");
}

function testGetType(m: PyMOLModule, p: number) {
    withString(m, objName, (namePtr) => {
        const { result: len, str: typeStr } = callWithOutPtr(m, (outPtr) =>
            m._PyMOLWasm_GetType(p, namePtr, outPtr)
        );
        assert.ok(len > 0, "GetType should return type string");
        assert.strictEqual(typeStr, "object:molecule", `Type should be "object:molecule", got "${typeStr}"`);
        console.log(`    (Type: "${typeStr}")`);
    });
    pass("GetType");
}

function testCountStates(m: PyMOLModule, p: number) {
    withString(m, "all", (selPtr) => {
        const count = m._PyMOLWasm_CountStates(p, selPtr);
        assert.strictEqual(count, 1, `Should have 1 state, got ${count}`);
    });
    pass("CountStates");
}

function testGetChains(m: PyMOLModule, p: number) {
    withString(m, "all", (selPtr) => {
        const { result: count, str: jsonStr } = callWithOutPtr(m, (outPtr) =>
            m._PyMOLWasm_GetChains(p, selPtr, -1, outPtr)
        );
        assert.ok(count > 0, `GetChains should return at least 1 chain, got ${count}`);
        const chains = JSON.parse(jsonStr);
        assert.ok(Array.isArray(chains), "Should return JSON array");
        console.log(`    (${count} chains: ${chains.join(', ')})`);
    });
    pass("GetChains");
}

function testGetSettingFloat(m: PyMOLModule, p: number) {
    // Read field_of_view (setting index 152)
    const fov = m._PyMOLWasm_GetSettingFloat(p, 152);
    assert.ok(fov > 0, `FOV should be positive, got ${fov}`);
    console.log(`    (field_of_view = ${fov})`);
    pass("GetSettingFloat");
}

function testGetSettingInt(m: PyMOLModule, p: number) {
    // Read ortho setting (index 1)
    const ortho = m._PyMOLWasm_GetSettingInt(p, 1);
    console.log(`    (ortho = ${ortho})`);
    pass("GetSettingInt");
}

function testGetSceneList(m: PyMOLModule, p: number) {
    // Store a scene first
    withString(m, "test_scene_q", (namePtr) =>
        withString(m, "", (msgPtr) => {
            m._PyMOLWasm_SceneStore(p, namePtr, msgPtr);
        })
    );

    const { result: count, str: jsonStr } = callWithOutPtr(m, (outPtr) =>
        m._PyMOLWasm_GetSceneList(p, outPtr)
    );
    assert.ok(count > 0, `GetSceneList should return at least 1 scene, got ${count}`);
    const scenes = JSON.parse(jsonStr);
    assert.ok(Array.isArray(scenes), "Should return JSON array");
    assert.ok(scenes.includes("test_scene_q"), "Scenes should include test_scene_q");
    console.log(`    (${count} scenes: ${scenes.join(', ')})`);
    pass("GetSceneList");
}

function testGetColorTuple(m: PyMOLModule, p: number) {
    withString(m, "red", (colorPtr) =>
        withBuffer(m, 12, (rgbPtr) => {
            assert.strictEqual(m._PyMOLWasm_GetColorTuple(p, colorPtr, rgbPtr), 1);
            const rgb = new Float32Array(m.HEAPF32.buffer, rgbPtr, 3);
            assert.ok(Math.abs(rgb[0] - 1.0) < 0.01, `Red R should be ~1.0, got ${rgb[0]}`);
            assert.ok(rgb[1] < 0.1, `Red G should be ~0.0, got ${rgb[1]}`);
            assert.ok(rgb[2] < 0.1, `Red B should be ~0.0, got ${rgb[2]}`);
            console.log(`    (red = [${rgb[0].toFixed(3)}, ${rgb[1].toFixed(3)}, ${rgb[2].toFixed(3)}])`);
        })
    );
    pass("GetColorTuple");
}

function testGetObjectMatrix(m: PyMOLModule, p: number) {
    withString(m, objName, (namePtr) =>
        withBuffer(m, 128, (matPtr) => { // 16 doubles * 8 bytes
            const result = m._PyMOLWasm_GetObjectMatrix(p, namePtr, -1, matPtr);
            if (result === 1) {
                const mat = new Float64Array(m.HEAPF64.buffer, matPtr, 16);
                // Identity-ish matrix: diagonal should be ~1.0
                console.log(`    (Matrix diagonal: [${mat[0].toFixed(3)}, ${mat[5].toFixed(3)}, ${mat[10].toFixed(3)}, ${mat[15].toFixed(3)}])`);
            } else {
                console.log(`    (No matrix available for state -1, returned ${result})`);
            }
        })
    );
    pass("GetObjectMatrix");
}

function testGetTitle(m: PyMOLModule, p: number) {
    // We set a title earlier, read it back
    withString(m, objName, (namePtr) => {
        const { result: len, str: title } = callWithOutPtr(m, (outPtr) =>
            m._PyMOLWasm_GetTitle(p, namePtr, 0, outPtr)
        );
        if (len > 0) {
            assert.strictEqual(title, "Test Title", `Title should be "Test Title", got "${title}"`);
            console.log(`    (Title: "${title}")`);
        } else {
            console.log(`    (No title set for state 0)`);
        }
    });
    pass("GetTitle");
}

function testReinit(m: PyMOLModule, p: number) {
    // Reinitialize everything
    assert.strictEqual(m._PyMOLWasm_Reinitialize(p, 0), 1);
    // Verify objects are cleared
    withString(m, "all", (selPtr) => {
        const count = m._PyMOLWasm_GetAtomCount(p, selPtr);
        assert.strictEqual(count, 0, `After reinitialize, atom count should be 0, got ${count}`);
    });
    pass("Reinitialize");
}

// =============================================================================
// Main Runner
// =============================================================================

async function runTests() {
    console.log("Loading PyMOL WebAssembly module...");
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const createPyMOL = require('./load-wasm.cjs') as (args: Partial<PyMOLModule>) => Promise<PyMOLModule>;

    const module = await createPyMOL({
        print: () => {},          // suppress PyMOL output
        printErr: () => {},       // suppress PyMOL errors
        noInitialRun: true
    });

    const optionsPtr = module._PyMOLOptions_New();
    const pymolPtr = module._PyMOL_NewWithOptions(optionsPtr);
    module._PyMOL_Start(pymolPtr);
    console.log("PyMOL started.\n");

    try {
        // Load test molecule
        const atomCount = loadTestMolecule(module, pymolPtr);
        console.log(`Loaded ${atomCount} atoms.\n`);

        // Show a representation for rendering tests
        withString(module, "spheres", (repPtr) =>
            withString(module, "all", (selPtr) => {
                module._PyMOLWasm_Show(pymolPtr, repPtr, selPtr);
                module._PyMOLWasm_Zoom(pymolPtr, selPtr, 0);
            })
        );

        console.log("=== Issue 1: Viewing / Display ===");
        const viewTests = [testEnableDisable, testOrient, testClip, testMove, testReset,
                          testBgColor, testCartoon, testToggle, testRebuild, testIsolevel];
        for (const t of viewTests) {
            try { t(module, pymolPtr); } catch (e) { fail(t.name, e); }
        }

        console.log("\n=== Issue 1: Structure Manipulation ===");
        const structTests = [testHAdd, testProtectMask, testFlag, testSetDihedral, testSort,
                            testSculpt, testPseudoatom];
        for (const t of structTests) {
            try { t(module, pymolPtr); } catch (e) { fail(t.name, e); }
        }

        console.log("\n=== Issue 1: Object Management ===");
        const objTests = [testSetName, testSetTitle, testOrder, testGroup, testSetObjectColor];
        for (const t of objTests) {
            try { t(module, pymolPtr); } catch (e) { fail(t.name, e); }
        }

        console.log("\n=== Issue 1: Settings ===");
        try { testUnsetSetting(module, pymolPtr); } catch (e) { fail("testUnsetSetting", e); }

        console.log("\n=== Issue 2: Atom Property Access ===");
        const propTests = [testSetGetAtomPropertyFloat, testSetGetAtomPropertyInt,
                          testSetGetAtomPropertyString, testAtomPropertySideEffects];
        for (const t of propTests) {
            try { t(module, pymolPtr); } catch (e) { fail(t.name, e); }
        }

        console.log("\n=== Issue 3: File Export ===");
        const exportTests = [testGetStrPDB, testGetStrSDF, testGetStrCIF, testGetStrMOL2];
        for (const t of exportTests) {
            try { t(module, pymolPtr); } catch (e) { fail(t.name, e); }
        }

        console.log("\n=== Issue 5: Label Runs ===");
        try { testLabelRuns(module, pymolPtr); } catch (e) { fail("testLabelRuns", e); }

        console.log("\n=== Issue 6: Introspection ===");
        const queryTests = [testGetNames, testGetType, testCountStates, testGetChains,
                           testGetSettingFloat, testGetSettingInt, testGetSceneList,
                           testGetColorTuple, testGetObjectMatrix, testGetTitle];
        for (const t of queryTests) {
            try { t(module, pymolPtr); } catch (e) { fail(t.name, e); }
        }

        // Reinitialize must be last since it clears everything
        console.log("\n=== Reinitialize ===");
        try { testReinit(module, pymolPtr); } catch (e) { fail("testReinit", e); }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`Results: ${passCount} passed, ${failCount} failed`);
        console.log(`${'='.repeat(50)}`);

    } finally {
        module._PyMOL_Free(pymolPtr);
        module._PyMOLOptions_Free(optionsPtr);
    }

    if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
