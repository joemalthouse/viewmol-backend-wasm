import assert from 'assert';
import type { PyMOLModule } from './pymol.js';
import { LOAD_FORMAT_PDB_STR } from './pymol.js';

const textEncoder = new TextEncoder();

/**
 * Allocates a UTF-8 string in WASM memory, calls fn with the pointer,
 * and guarantees the pointer is freed even if fn throws.
 */
function withString<T>(module: PyMOLModule, str: string, fn: (ptr: number) => T): T {
    const ptr = module.stringToNewUTF8(str);
    assert.notStrictEqual(ptr, 0, `Failed to allocate WASM string for "${str.slice(0, 50)}"`);
    try {
        return fn(ptr);
    } finally {
        module._free(ptr);
    }
}

/**
 * Allocates a buffer of the given byte size, calls fn with the pointer,
 * and guarantees the pointer is freed even if fn throws.
 */
function withBuffer<T>(module: PyMOLModule, bytes: number, fn: (ptr: number) => T): T {
    const ptr = module._malloc(bytes);
    assert.notStrictEqual(ptr, 0, `Failed to allocate ${bytes} bytes`);
    try {
        return fn(ptr);
    } finally {
        module._free(ptr);
    }
}

const pdbData = `ATOM      1  N   ALA A   1      -0.612   0.093  -0.547  1.00  0.00           N
ATOM      2  CA  ALA A   1      -0.347   1.464  -0.088  1.00  0.00           C
ATOM      3  C   ALA A   1       1.155   1.698  -0.207  1.00  0.00           C
ATOM      4  O   ALA A   1       1.670   1.815  -1.312  1.00  0.00           O
ATOM      5  CB  ALA A   1      -0.817   1.666   1.353  1.00  0.00           C
ATOM      6  OXT ALA A   1       1.782   1.761   0.880  1.00  0.00           O
END`;

const pdbByteLength = textEncoder.encode(pdbData).byteLength;
const objName = "test_molecule";

// --- Individual test functions ---

function testLoadPDB(module: PyMOLModule, pymolPtr: number) {
    withString(module, objName, (objNamePtr) =>
        withString(module, pdbData, (pdbPtr) => {
            const result = module._PyMOLWasm_Load(pymolPtr, objNamePtr, pdbPtr, pdbByteLength, LOAD_FORMAT_PDB_STR);
            assert.strictEqual(result, 1, "PyMOLWasm_Load should return 1 on success");
        })
    );
    console.log("  Load test passed.");
}

function testAtomCount(module: PyMOLModule, pymolPtr: number) {
    withString(module, "all", (selPtr) => {
        const count = module._PyMOLWasm_GetAtomCount(pymolPtr, selPtr);
        assert.strictEqual(count, 6, `Expected 6 atoms, got ${count}`);
    });
    console.log("  Atom count test passed.");
}

function testShowRepresentation(module: PyMOLModule, pymolPtr: number) {
    withString(module, "cartoon", (repPtr) =>
        withString(module, "all", (selPtr) => {
            const result = module._PyMOLWasm_Show(pymolPtr, repPtr, selPtr);
            assert.strictEqual(result, 1, "PyMOLWasm_Show should return 1 on success");
        })
    );
    console.log("  Show representation test passed.");
}

function testColor(module: PyMOLModule, pymolPtr: number) {
    withString(module, "red", (colorPtr) =>
        withString(module, "all", (selPtr) => {
            const result = module._PyMOLWasm_Color(pymolPtr, colorPtr, selPtr);
            assert.strictEqual(result, 1, "PyMOLWasm_Color should return 1 on success");
        })
    );
    console.log("  Color test passed.");
}

function testCoordinateExtraction(module: PyMOLModule, pymolPtr: number) {
    withString(module, "all", (selPtr) => {
        const count = module._PyMOLWasm_GetAtomCount(pymolPtr, selPtr);
        const bufferFloats = count * 3;
        withBuffer(module, bufferFloats * 4, (bufPtr) => {
            const extracted = module._PyMOLWasm_GetAtomCoordinates(pymolPtr, selPtr, bufPtr, bufferFloats);
            assert.strictEqual(extracted, count, "Should extract exactly the same number of atoms");
            const vertexData = new Float32Array(module.HEAPF32.buffer, bufPtr, count * 3);
            assert.ok(vertexData.length === 18, "Should have 18 float components (6 atoms * 3)");
            console.log("  Extracted Vertex Data Sample:", vertexData.slice(0, 6));
        });
    });
    console.log("  Data Extraction test passed.");
}

function testCameraCommands(module: PyMOLModule, pymolPtr: number) {
    withString(module, "all", (selPtr) => {
        assert.strictEqual(module._PyMOLWasm_Zoom(pymolPtr, selPtr, 0), 1, "Zoom failed");
        assert.strictEqual(module._PyMOLWasm_Center(pymolPtr, selPtr), 1, "Center failed");
        assert.strictEqual(module._PyMOLWasm_Origin(pymolPtr, selPtr), 1, "Origin failed");
    });
    console.log("  Camera commands passed.");
}

function testHideAndRemove(module: PyMOLModule, pymolPtr: number) {
    withString(module, "everything", (everyPtr) =>
        withString(module, "all", (selPtr) => {
            assert.strictEqual(module._PyMOLWasm_Hide(pymolPtr, everyPtr, selPtr), 1, "Hide failed");
            assert.strictEqual(module._PyMOLWasm_Remove(pymolPtr, selPtr), 1, "Remove failed");
            assert.strictEqual(module._PyMOLWasm_GetAtomCount(pymolPtr, selPtr), 0, "All atoms should be removed");
        })
    );
    console.log("  Hide and Remove test passed.");
}

function testDeleteObject(module: PyMOLModule, pymolPtr: number) {
    // Reload for this test
    withString(module, objName, (objNamePtr) =>
        withString(module, pdbData, (pdbPtr) =>
            withString(module, "all", (selPtr) => {
                module._PyMOLWasm_Load(pymolPtr, objNamePtr, pdbPtr, pdbByteLength, LOAD_FORMAT_PDB_STR);
                assert.strictEqual(module._PyMOLWasm_GetAtomCount(pymolPtr, selPtr), 6, "Should be 6 atoms loaded again");
                assert.strictEqual(module._PyMOLWasm_Delete(pymolPtr, objNamePtr), 1, "Delete failed");
                assert.strictEqual(module._PyMOLWasm_GetAtomCount(pymolPtr, selPtr), 0, "Object should be deleted");
            })
        )
    );
    console.log("  Delete test passed.");
}

function testMeasurementsAndSettings(module: PyMOLModule, pymolPtr: number) {
    // Reload for this test
    withString(module, objName, (objNamePtr) =>
        withString(module, pdbData, (pdbPtr) =>
            withString(module, "all", (selPtr) => {
                module._PyMOLWasm_Load(pymolPtr, objNamePtr, pdbPtr, pdbByteLength, LOAD_FORMAT_PDB_STR);

                assert.strictEqual(module._PyMOLWasm_SetSetting(pymolPtr, 100, 0.5), 1, "SetSetting failed");

                const dist = module._PyMOLWasm_GetDistance(pymolPtr, selPtr, selPtr);
                console.log("  Distance between all and all:", dist);

                const angle = module._PyMOLWasm_GetAngle(pymolPtr, selPtr, selPtr, selPtr);
                console.log("  Angle:", angle);

                const dihedral = module._PyMOLWasm_GetDihedral(pymolPtr, selPtr, selPtr, selPtr, selPtr);
                console.log("  Dihedral:", dihedral);

                const area = module._PyMOLWasm_GetArea(pymolPtr, selPtr);
                console.log("  Surface Area:", area);
            })
        )
    );
    console.log("  Measurements and Settings test passed.");
}

function testViewMatrix(module: PyMOLModule, pymolPtr: number) {
    const bytesPerFloat = 4;
    withBuffer(module, 25 * bytesPerFloat, (viewBufPtr) => {
        assert.strictEqual(module._PyMOLWasm_GetView(pymolPtr, viewBufPtr), 1, "GetView failed");
        const viewData = new Float32Array(module.HEAPF32.buffer, viewBufPtr, 25);
        console.log("  Current View[0]:", viewData[0]);
        assert.strictEqual(module._PyMOLWasm_SetView(pymolPtr, viewBufPtr), 1, "SetView failed");
    });
    console.log("  View Matrix (Get/Set) test passed.");
}

function testAlign(module: PyMOLModule, pymolPtr: number) {
    withString(module, "all", (selPtr) => {
        const rmsd = module._PyMOLWasm_Align(pymolPtr, selPtr, selPtr);
        console.log("  Alignment RMSD (self):", rmsd);
    });
    console.log("  Align test passed.");
}

function testCreationAndAlteration(module: PyMOLModule, pymolPtr: number) {
    withString(module, "test_copy", (newObjPtr) =>
        withString(module, "all", (selPtr) =>
            withString(module, objName, (objNamePtr) => {
                assert.strictEqual(module._PyMOLWasm_CreateObject(pymolPtr, newObjPtr, selPtr, -1, -1, 0), 1, "CreateObject failed");

                withString(module, "sym_", (symPrefixPtr) => {
                    module._PyMOLWasm_SymExp(pymolPtr, symPrefixPtr, objNamePtr, objNamePtr, 5.0);
                });

                withString(module, "my_mesh", (meshPtr) =>
                    withString(module, "missing_map", (mapPtr) => {
                        const meshRes = module._PyMOLWasm_Isomesh(pymolPtr, meshPtr, mapPtr, 1.0, selPtr, 0.0, 1, 0.0, 0);
                        assert.strictEqual(meshRes, 0, "Isomesh correctly failed on missing map");
                    })
                );
            })
        )
    );
    console.log("  Creation and Alteration test passed.");
}

function testAnimationAndStates(module: PyMOLModule, pymolPtr: number) {
    assert.strictEqual(module._PyMOLWasm_SetFrame(pymolPtr, 0, 1), 1, "SetFrame failed");
    assert.strictEqual(module._PyMOLWasm_GetState(pymolPtr), 0, "State should be 0");
    assert.strictEqual(module._PyMOLWasm_MPlay(pymolPtr), 1, "MPlay failed");
    assert.strictEqual(module._PyMOLWasm_MStop(pymolPtr), 1, "MStop failed");
    console.log("  Animation and state test passed.");
}

function testTransformations(module: PyMOLModule, pymolPtr: number) {
    const bytesPerFloat = 4;

    withBuffer(module, 16 * bytesPerFloat, (matrixPtr) => {
        new Float32Array(module.HEAPF32.buffer, matrixPtr, 16).set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

        withString(module, objName, (objNamePtr) =>
            withString(module, "all", (selPtr) => {
                assert.strictEqual(module._PyMOLWasm_TransformObject(pymolPtr, objNamePtr, -1, selPtr, matrixPtr, 1, 1), 1, "TransformObject failed");
                assert.strictEqual(module._PyMOLWasm_TransformSelection(pymolPtr, -1, selPtr, matrixPtr, 1), 1, "TransformSelection failed");

                withBuffer(module, 3 * bytesPerFloat, (vecPtr) => {
                    new Float32Array(module.HEAPF32.buffer, vecPtr, 3).set([1.0, 2.0, 3.0]);
                    withString(module, "id 1", (atomSelPtr) => {
                        module._PyMOLWasm_TranslateAtom(pymolPtr, atomSelPtr, vecPtr, -1, 0);
                    });
                });

                assert.strictEqual(module._PyMOLWasm_ResetMatrix(pymolPtr, objNamePtr, -1), 1, "ResetMatrix failed");
            })
        );
    });
    console.log("  Transformation test passed.");
}

function testStructuralGeneration(module: PyMOLModule, pymolPtr: number) {
    withString(module, "struct_copy", (copyTargetPtr) =>
        withString(module, objName, (objNamePtr) =>
            withString(module, "all", (selPtr) =>
                withString(module, "id 1", (atomSelPtr) => {
                    assert.strictEqual(module._PyMOLWasm_Copy(pymolPtr, copyTargetPtr, objNamePtr), 1, "Copy failed");
                    module._PyMOLWasm_Bond(pymolPtr, selPtr, selPtr, 1, 0);
                    module._PyMOLWasm_Unbond(pymolPtr, selPtr, selPtr);
                    module._PyMOLWasm_Fuse(pymolPtr, atomSelPtr, atomSelPtr);
                })
            )
        )
    );
    console.log("  Structural Generation test passed.");
}

function testMapsAndSelections(module: PyMOLModule, pymolPtr: number) {
    const bytesPerFloat = 4;

    withString(module, "all", (selPtr) =>
        withString(module, "my_map", (mapNamePtr) =>
            withString(module, "my_custom_sel", (selNamePtr) =>
                withString(module, "b", (exprPtr) =>
                    withString(module, "my_ramp", (rampNamePtr) => {
                        module._PyMOLWasm_MapNew(pymolPtr, mapNamePtr, 0, 1.0, selPtr, 1.0, -1);
                        assert.strictEqual(module._PyMOLWasm_Select(pymolPtr, selNamePtr, selPtr), 1, "Select failed");
                        assert.strictEqual(module._PyMOLWasm_Spectrum(pymolPtr, selNamePtr, exprPtr, 0.0, 100.0), 1, "Spectrum failed");

                        withBuffer(module, 2 * bytesPerFloat, (rangePtr) => {
                            new Float32Array(module.HEAPF32.buffer, rangePtr, 2).set([0.0, 1.0]);
                            withBuffer(module, 6 * bytesPerFloat, (colorPtr) => {
                                new Float32Array(module.HEAPF32.buffer, colorPtr, 6).set([1.0, 0.0, 0.0, 0.0, 0.0, 1.0]);
                                module._PyMOLWasm_RampNew(pymolPtr, rampNamePtr, mapNamePtr, rangePtr, 2, colorPtr);
                            });
                        });
                    })
                )
            )
        )
    );
    console.log("  Maps and Selections test passed.");
}

function testScenesAndExtents(module: PyMOLModule, pymolPtr: number) {
    const bytesPerFloat = 4;

    withString(module, "my_scene", (sceneNamePtr) =>
        withString(module, "Hello Scene", (msgPtr) =>
            withString(module, "all", (selPtr) => {
                assert.strictEqual(module._PyMOLWasm_SceneStore(pymolPtr, sceneNamePtr, msgPtr), 1, "SceneStore failed");
                assert.strictEqual(module._PyMOLWasm_SceneRecall(pymolPtr, sceneNamePtr, 0.0), 1, "SceneRecall failed");

                withBuffer(module, 6 * bytesPerFloat, (extentPtr) => {
                    const extentRes = module._PyMOLWasm_GetExtent(pymolPtr, selPtr, extentPtr);
                    if (extentRes) {
                        const extentData = new Float32Array(module.HEAPF32.buffer, extentPtr, 6);
                        console.log("  Extent:", extentData);
                    }
                });

                assert.strictEqual(module._PyMOLWasm_MovieClear(pymolPtr), 1, "MovieClear failed");
            })
        )
    );
    console.log("  Scenes and Extent test passed.");
}

function testGetRayScene(module: PyMOLModule, pymolPtr: number) {
    // Reload a fresh molecule for ray scene export
    withString(module, "ray_test_mol", (objNamePtr) =>
        withString(module, pdbData, (pdbPtr) =>
            withString(module, "all", (selPtr) =>
                withString(module, "spheres", (repPtr) => {
                    module._PyMOLWasm_Load(pymolPtr, objNamePtr, pdbPtr, pdbByteLength, LOAD_FORMAT_PDB_STR);
                    module._PyMOLWasm_Show(pymolPtr, repPtr, selPtr);
                    module._PyMOLWasm_Zoom(pymolPtr, selPtr, 0);

                    // Allocate a 2MB buffer for the JSON output
                    const bufSize = 2 * 1024 * 1024;
                    withBuffer(module, bufSize, (bufPtr) => {
                        const result = module._PyMOLWasm_GetRayScene(pymolPtr, 640, 480, bufPtr, bufSize);
                        assert.ok(result > 0, `GetRayScene should return positive length, got ${result}`);

                        const jsonStr = module.UTF8ToString(bufPtr);
                        assert.ok(jsonStr.length > 0, "JSON string should be non-empty");

                        const scene = JSON.parse(jsonStr);

                        // Verify format
                        assert.strictEqual(scene.format, "viewmol-ray-v2", "Format should be viewmol-ray-v2");

                        // Verify dimensions
                        assert.strictEqual(scene.width, 640, "Width should be 640");
                        assert.strictEqual(scene.height, 480, "Height should be 480");

                        // Verify primitives exist
                        assert.ok(scene.primitive_count > 0, `Should have primitives, got ${scene.primitive_count}`);
                        assert.ok(Array.isArray(scene.primitives), "Primitives should be an array");
                        assert.ok(scene.primitives.length > 0, "Primitives array should be non-empty");

                        // Verify stride
                        assert.strictEqual(scene.primitive_stride, 46, "Primitive stride should be 46");

                        // Verify camera parameters exist
                        assert.ok(Array.isArray(scene.model_view), "model_view should be an array");
                        assert.strictEqual(scene.model_view.length, 16, "model_view should have 16 elements");
                        assert.ok(Array.isArray(scene.volume), "volume should be an array");
                        assert.strictEqual(scene.volume.length, 6, "volume should have 6 elements");
                        assert.ok(Array.isArray(scene.pos), "pos should be an array");
                        assert.strictEqual(scene.pos.length, 3, "pos should have 3 elements");
                        assert.ok(typeof scene.fov === 'number', "fov should be a number");

                        // Verify wobble/random data
                        assert.ok(Array.isArray(scene.random_table), "random_table should be an array");
                        assert.strictEqual(scene.random_table.length, 256, "random_table should have 256 elements");

                        console.log(`  Scene: ${scene.primitive_count} primitives, ${scene.width}x${scene.height}`);
                        console.log(`  JSON size: ${jsonStr.length} bytes`);
                    });

                    // Clean up
                    module._PyMOLWasm_Delete(pymolPtr, objNamePtr);
                })
            )
        )
    );
    console.log("  GetRayScene test passed.");
}

function testFinalSpecializedCommands(module: PyMOLModule, pymolPtr: number) {
    const bytesPerFloat = 4;

    withString(module, "all", (selPtr) =>
        withString(module, "", (emptyPtr) =>
            withString(module, "my_map", (mapNamePtr) => {
                assert.strictEqual(module._PyMOLWasm_AssignSS(pymolPtr, selPtr, 0, emptyPtr, 0), 1, "AssignSS failed");
                assert.strictEqual(module._PyMOLWasm_FixChemistry(pymolPtr, selPtr, selPtr, 1), 1, "FixChemistry failed");

                module._PyMOLWasm_MapDouble(pymolPtr, mapNamePtr, 0);
                module._PyMOLWasm_MapHalve(pymolPtr, mapNamePtr, 0, 0);
                module._PyMOLWasm_MapTrim(pymolPtr, mapNamePtr, selPtr, 1.0, 0, 0);

                // Test SetAtomCoordinates with buffer_size
                const coordFloats = 3 * 3; // 3 atoms x 3 components
                withBuffer(module, coordFloats * bytesPerFloat, (coordsPtr) => {
                    new Float32Array(module.HEAPF32.buffer, coordsPtr, coordFloats).set([0, 0, 0, 1, 1, 1, 2, 2, 2]);
                    const setCoordsRes = module._PyMOLWasm_SetAtomCoordinates(pymolPtr, selPtr, 0, coordsPtr, coordFloats);
                    console.log("  SetAtomCoordinates returned:", setCoordsRes);
                });
            })
        )
    );
    console.log("  Final Specialized Commands test passed.");
}

// --- Main runner ---

async function runTests() {
    console.log("Loading PyMOL WebAssembly module for testing...");
    const wasmPath = './pymol-open-source/pymol_wasm.js';
    const createPyMOLModule = await import(wasmPath) as { default?: (args: Partial<PyMOLModule>) => Promise<PyMOLModule> };
    const createPyMOL = createPyMOLModule.default ?? (createPyMOLModule as unknown as (args: Partial<PyMOLModule>) => Promise<PyMOLModule>);

    const module = await createPyMOL({
        print: (text: string) => console.log('[PyMOL]', text),
        printErr: (text: string) => console.error('[PyMOL Err]', text),
        noInitialRun: true
    });

    console.log("Module loaded successfully.");

    const optionsPtr = module._PyMOLOptions_New();
    assert.notStrictEqual(optionsPtr, 0, "Failed to allocate options");

    const pymolPtr = module._PyMOL_NewWithOptions(optionsPtr);
    assert.notStrictEqual(pymolPtr, 0, "Failed to create PyMOL instance");

    try {
        module._PyMOL_Start(pymolPtr);
        console.log("PyMOL core allocated and started.\n");

        console.log("TEST 1: Load PDB");
        testLoadPDB(module, pymolPtr);

        console.log("TEST 2: Atom Count");
        testAtomCount(module, pymolPtr);

        console.log("TEST 3: Show Representation");
        testShowRepresentation(module, pymolPtr);

        console.log("TEST 4: Color");
        testColor(module, pymolPtr);

        console.log("TEST 5: Coordinate Extraction");
        testCoordinateExtraction(module, pymolPtr);

        console.log("TEST 6: Camera Commands");
        testCameraCommands(module, pymolPtr);

        console.log("TEST 7: Hide and Remove");
        testHideAndRemove(module, pymolPtr);

        console.log("TEST 8: Delete Object");
        testDeleteObject(module, pymolPtr);

        console.log("TEST 9: Measurements and Settings");
        testMeasurementsAndSettings(module, pymolPtr);

        console.log("TEST 10: View Matrix");
        testViewMatrix(module, pymolPtr);

        console.log("TEST 11: Align");
        testAlign(module, pymolPtr);

        console.log("TEST 12: Creation and Alteration");
        testCreationAndAlteration(module, pymolPtr);

        console.log("TEST 13: Animation and States");
        testAnimationAndStates(module, pymolPtr);

        console.log("TEST 14: Transformations");
        testTransformations(module, pymolPtr);

        console.log("TEST 15: Structural Generation");
        testStructuralGeneration(module, pymolPtr);

        console.log("TEST 16: Maps and Selections");
        testMapsAndSelections(module, pymolPtr);

        console.log("TEST 17: Scenes and Extents");
        testScenesAndExtents(module, pymolPtr);

        console.log("TEST 18: GetRayScene");
        testGetRayScene(module, pymolPtr);

        console.log("TEST 19: Final Specialized Commands");
        testFinalSpecializedCommands(module, pymolPtr);

        console.log("\nAll tests completed successfully.");
    } finally {
        module._PyMOL_Free(pymolPtr);
        module._PyMOLOptions_Free(optionsPtr);
        console.log("Memory freed.");
    }
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
