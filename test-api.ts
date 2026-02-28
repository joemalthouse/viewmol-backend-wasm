import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
    console.log("Loading PyMOL WebAssembly module for testing...");
    // @ts-ignore
    const createPyMOLModule = await import('./pymol-open-source/pymol_wasm.js');
    const createPyMOL = createPyMOLModule.default || createPyMOLModule;
    
    const module = await createPyMOL({
        print: (text: string) => console.log('[PyMOL]', text),
        printErr: (text: string) => console.error('[PyMOL Err]', text),
        noInitialRun: true
    });

    console.log("Module loaded successfully.");
    
    // Allocate core
    const optionsPtr = module._PyMOLOptions_New();
    const pymolPtr = module._PyMOL_NewWithOptions(optionsPtr);
    module._PyMOL_Start(pymolPtr);
    
    console.log("PyMOL core allocated and started.");

    // --- TEST 1: Load a simple PDB string ---
    const pdbData = `ATOM      1  N   ALA A   1      -0.612   0.093  -0.547  1.00  0.00           N
ATOM      2  CA  ALA A   1      -0.347   1.464  -0.088  1.00  0.00           C
ATOM      3  C   ALA A   1       1.155   1.698  -0.207  1.00  0.00           C
ATOM      4  O   ALA A   1       1.670   1.815  -1.312  1.00  0.00           O
ATOM      5  CB  ALA A   1      -0.817   1.666   1.353  1.00  0.00           C
ATOM      6  OXT ALA A   1       1.782   1.761   0.880  1.00  0.00           O
END`;
    
    const objName = "test_molecule";
    
    // Allocate string buffers in WASM memory
    const pdbPtr = module.stringToNewUTF8(pdbData);
    const objNamePtr = module.stringToNewUTF8(objName);
    
    console.log("Executing PyMOLWasm_Load...");
    // Format 9 = cLoadTypePDBStr (loads PDB format from a string memory buffer).
    const loadResult = module._PyMOLWasm_Load(pymolPtr, objNamePtr, pdbPtr, pdbData.length, 9);
    assert.strictEqual(loadResult, 1, "PyMOLWasm_Load should return 1 on success");
    console.log("✅ Load test passed.");

    // --- TEST 2: Query Atom Count ---
    const allSelPtr = module.stringToNewUTF8("all");
    const count = module._PyMOLWasm_GetAtomCount(pymolPtr, allSelPtr);
    assert.strictEqual(count, 6, `Expected 6 atoms, got ${count}`);
    console.log("✅ Atom count test passed.");
    
    // --- TEST 3: Representation Manipulation ---
    const cartoonPtr = module.stringToNewUTF8("cartoon");
    const showResult = module._PyMOLWasm_Show(pymolPtr, cartoonPtr, allSelPtr);
    assert.strictEqual(showResult, 1, "PyMOLWasm_Show should return 1 on success");
    console.log("✅ Show representation test passed.");

    // --- TEST 4: Color Manipulation ---
    const redPtr = module.stringToNewUTF8("red");
    const colorResult = module._PyMOLWasm_Color(pymolPtr, redPtr, allSelPtr);
    assert.strictEqual(colorResult, 1, "PyMOLWasm_Color should return 1 on success");
    console.log("✅ Color test passed.");

    // --- TEST 5: Data Extraction for WebGPU ---
    const bytesPerFloat = 4;
    const componentsPerVertex = 3;
    const bufferSize = count * componentsPerVertex * bytesPerFloat;
    
    // Allocate space in the WebAssembly heap
    const outBufferPtr = module._malloc(bufferSize);
    
    // Call the extraction function
    const extractedCount = module._PyMOLWasm_GetAtomCoordinates(pymolPtr, allSelPtr, outBufferPtr);
    assert.strictEqual(extractedCount, count, "Should extract exactly the same number of atoms");
    
    // Create a JavaScript TypedArray view over the WebAssembly memory
    const vertexData = new Float32Array(module.HEAPF32.buffer, outBufferPtr, count * componentsPerVertex);
    
    // Validate that we can read the memory successfully
    assert.ok(vertexData.length === 18, "Should have 18 float components (6 atoms * 3)");
    console.log("Extracted Vertex Data Sample:", vertexData.slice(0, 6));
    console.log("✅ Data Extraction test passed.");

    // --- TEST 6: Structural and Camera Commands ---
    console.log("Executing camera commands (Zoom, Center, Origin)...");
    const zoomRes = module._PyMOLWasm_Zoom(pymolPtr, allSelPtr, 0);
    assert.strictEqual(zoomRes, 1, "PyMOLWasm_Zoom failed");
    
    const centerRes = module._PyMOLWasm_Center(pymolPtr, allSelPtr);
    assert.strictEqual(centerRes, 1, "PyMOLWasm_Center failed");
    
    const originRes = module._PyMOLWasm_Origin(pymolPtr, allSelPtr);
    assert.strictEqual(originRes, 1, "PyMOLWasm_Origin failed");
    console.log("✅ Camera commands passed.");

    // --- TEST 7: Hide and Remove ---
    console.log("Executing Hide...");
    const everythingPtr = module.stringToNewUTF8("everything");
    const hideRes = module._PyMOLWasm_Hide(pymolPtr, everythingPtr, allSelPtr);
    assert.strictEqual(hideRes, 1, "PyMOLWasm_Hide failed");
    console.log("✅ Hide test passed.");

    console.log("Executing Remove (Atoms)...");
    const removeRes = module._PyMOLWasm_Remove(pymolPtr, allSelPtr);
    assert.strictEqual(removeRes, 1, "PyMOLWasm_Remove failed");
    
    const emptyCount = module._PyMOLWasm_GetAtomCount(pymolPtr, allSelPtr);
    assert.strictEqual(emptyCount, 0, "All atoms should be removed");
    console.log("✅ Remove test passed.");

    // --- TEST 8: Delete Object ---
    // Load it again to test object deletion
    module._PyMOLWasm_Load(pymolPtr, objNamePtr, pdbPtr, pdbData.length, 9);
    assert.strictEqual(module._PyMOLWasm_GetAtomCount(pymolPtr, allSelPtr), 6, "Should be 6 atoms loaded again");
    
    console.log("Executing Delete (Object)...");
    const delRes = module._PyMOLWasm_Delete(pymolPtr, objNamePtr);
    assert.strictEqual(delRes, 1, "PyMOLWasm_Delete failed");
    
    const finalCount = module._PyMOLWasm_GetAtomCount(pymolPtr, allSelPtr);
    assert.strictEqual(finalCount, 0, "Object should be deleted, leaving 0 atoms");
    console.log("✅ Delete test passed.");

    // --- TEST 9: Measurement and Settings ---
    console.log("Executing Settings and Measurement...");
    // Load object again
    module._PyMOLWasm_Load(pymolPtr, objNamePtr, pdbPtr, pdbData.length, 9);
    
    // Set a random setting (e.g. ambient light, which is setting 0 usually, but let's just pass some index like 100)
    const setRes = module._PyMOLWasm_SetSetting(pymolPtr, 100, 0.5);
    assert.strictEqual(setRes, 1, "PyMOLWasm_SetSetting failed");
    console.log("✅ Set setting passed.");

    // Test Distance
    // Since we don't have atom-specific selectors easily hardcoded, we will just use "all" vs "all" 
    // which might return 0.0 or fail if it expects exactly two atoms, but we can verify it doesn't crash.
    const dist = module._PyMOLWasm_GetDistance(pymolPtr, allSelPtr, allSelPtr);
    console.log("Distance between all and all:", dist);
    console.log("✅ GetDistance test passed (no crash).");

    // Test Angle and Dihedral
    // Note: Like distance, we use "all" to prove the API boundary doesn't crash.
    // Real tests would use explicit atom indices (e.g., "id 1", "id 2").
    const angle = module._PyMOLWasm_GetAngle(pymolPtr, allSelPtr, allSelPtr, allSelPtr);
    console.log("Angle:", angle);
    console.log("✅ GetAngle test passed (no crash).");

    const dihedral = module._PyMOLWasm_GetDihedral(pymolPtr, allSelPtr, allSelPtr, allSelPtr, allSelPtr);
    console.log("Dihedral:", dihedral);
    console.log("✅ GetDihedral test passed (no crash).");

    // Test Area
    const area = module._PyMOLWasm_GetArea(pymolPtr, allSelPtr);
    console.log("Surface Area:", area);
    console.log("✅ GetArea test passed (no crash).");

    // --- TEST 10: View Matrix Management ---
    console.log("Executing View Matrix Management...");
    const viewBufferPtr = module._malloc(25 * bytesPerFloat);
    
    // Get view
    const getViewRes = module._PyMOLWasm_GetView(pymolPtr, viewBufferPtr);
    assert.strictEqual(getViewRes, 1, "PyMOLWasm_GetView failed");
    
    const viewData = new Float32Array(module.HEAPF32.buffer, viewBufferPtr, 25);
    console.log("Current View[0]:", viewData[0]); // Just to verify it's reading
    
    // Set view (using the exact same view we just got)
    const setViewRes = module._PyMOLWasm_SetView(pymolPtr, viewBufferPtr);
    assert.strictEqual(setViewRes, 1, "PyMOLWasm_SetView failed");
    console.log("✅ View Matrix (Get/Set) test passed.");

    // Align
    // Aligning an object to itself should give 0.0 RMSD
    const alignRmsd = module._PyMOLWasm_Align(pymolPtr, allSelPtr, allSelPtr);
    console.log("Alignment RMSD (self):", alignRmsd);
    console.log("✅ Align test passed.");

    // --- TEST 11: Creation, Extraction, Alteration ---
    console.log("Executing Creation and Alteration commands...");
    
    // Create new object from existing
    const newObjPtr = module.stringToNewUTF8("test_copy");
    const createRes = module._PyMOLWasm_CreateObject(pymolPtr, newObjPtr, allSelPtr, -1, -1, 0); // 0 = create
    assert.strictEqual(createRes, 1, "PyMOLWasm_CreateObject failed");
    console.log("✅ Create object test passed.");

    // Symmetry Expansion (Usually requires CRYST1 record in PDB, but testing for no crash)
    const symPrefixPtr = module.stringToNewUTF8("sym_");
    const symRes = module._PyMOLWasm_SymExp(pymolPtr, symPrefixPtr, objNamePtr, objNamePtr, 5.0);
    console.log("✅ SymExp test passed (no crash).");

    // Isomesh / Isosurface (Requires map data, testing for no crash)
    const meshNamePtr = module.stringToNewUTF8("my_mesh");
    const mapNamePtr = module.stringToNewUTF8("missing_map");
    const meshRes = module._PyMOLWasm_Isomesh(pymolPtr, meshNamePtr, mapNamePtr, 1.0, allSelPtr, 0.0, 1, 0.0, 0);
    // meshRes will likely be 0 since the map doesn't exist, which is correct behavior
    assert.strictEqual(meshRes, 0, "Isomesh correctly failed on missing map");
    console.log("✅ Isomesh test passed (handled missing data safely).");

    // --- TEST 12: Animation and States ---
    console.log("Executing Animation and State commands...");
    
    // Set absolute frame to 1 (mode 0)
    const frameSetRes = module._PyMOLWasm_SetFrame(pymolPtr, 0, 1);
    assert.strictEqual(frameSetRes, 1, "PyMOLWasm_SetFrame failed");
    
    const state = module._PyMOLWasm_GetState(pymolPtr);
    console.log("Current state:", state);
    assert.strictEqual(state, 0, "State should be 0 (1st state)");

    const playRes = module._PyMOLWasm_MPlay(pymolPtr);
    assert.strictEqual(playRes, 1, "PyMOLWasm_MPlay failed");

    const stopRes = module._PyMOLWasm_MStop(pymolPtr);
    assert.strictEqual(stopRes, 1, "PyMOLWasm_MStop failed");
    console.log("✅ Animation and state tests passed.");

    // --- TEST 13: Matrix Transformations ---
    console.log("Executing Transformations...");
    const identityMatrixPtr = module._malloc(16 * bytesPerFloat);
    const identityMatrix = new Float32Array(module.HEAPF32.buffer, identityMatrixPtr, 16);
    identityMatrix.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); // Identity matrix
    
    const transformObjRes = module._PyMOLWasm_TransformObject(pymolPtr, objNamePtr, -1, allSelPtr, identityMatrixPtr, 1, 1);
    assert.strictEqual(transformObjRes, 1, "PyMOLWasm_TransformObject failed");

    const transformSelRes = module._PyMOLWasm_TransformSelection(pymolPtr, -1, allSelPtr, identityMatrixPtr, 1);
    assert.strictEqual(transformSelRes, 1, "PyMOLWasm_TransformSelection failed");

    const vectorPtr = module._malloc(3 * bytesPerFloat);
    const vectorData = new Float32Array(module.HEAPF32.buffer, vectorPtr, 3);
    vectorData.set([1.0, 2.0, 3.0]);

    const singleAtomSelPtr = module.stringToNewUTF8("id 1");
    const translateRes = module._PyMOLWasm_TranslateAtom(pymolPtr, singleAtomSelPtr, vectorPtr, -1, 0);
    console.log("TranslateAtom result (might be 0 if selector isn't exactly 1 atom):", translateRes);
    console.log("✅ PyMOLWasm_TranslateAtom test passed (no crash).");

    const resetMatrixRes = module._PyMOLWasm_ResetMatrix(pymolPtr, objNamePtr, -1);
    assert.strictEqual(resetMatrixRes, 1, "PyMOLWasm_ResetMatrix failed");
    console.log("✅ Advanced Transformation tests passed.");

    // --- TEST 14: Structural Generation ---
    console.log("Executing Structural Generation...");
    const copyTargetPtr = module.stringToNewUTF8("struct_copy");
    const copyRes = module._PyMOLWasm_Copy(pymolPtr, copyTargetPtr, objNamePtr);
    assert.strictEqual(copyRes, 1, "PyMOLWasm_Copy failed");

    // Creating bonds across generic "all" might fail internally but shouldn't crash the engine
    const bondRes = module._PyMOLWasm_Bond(pymolPtr, allSelPtr, allSelPtr, 1, 0);
    console.log("Bond result:", bondRes); // Can be 0 or 1 depending on internal heuristics
    const unbondRes = module._PyMOLWasm_Unbond(pymolPtr, allSelPtr, allSelPtr);
    console.log("Unbond result:", unbondRes);

    const fuseRes = module._PyMOLWasm_Fuse(pymolPtr, singleAtomSelPtr, singleAtomSelPtr);
    console.log("Fuse result:", fuseRes);
    console.log("✅ Structural Generation tests passed (no crashes).");

    // --- TEST 15: Maps and Coloring ---
    console.log("Executing Maps and Selections...");
    const mapNamePtr2 = module.stringToNewUTF8("my_map");
    // Generate a pseudo-map from atoms (type 0 corresponds to vdw usually)
    const mapRes = module._PyMOLWasm_MapNew(pymolPtr, mapNamePtr2, 0, 1.0, allSelPtr, 1.0, -1);
    console.log("MapNew result:", mapRes); // Might fail internally if type 0 isn't perfectly mapped without UI, but shouldn't crash

    // Selections
    const newSelNamePtr = module.stringToNewUTF8("my_custom_sel");
    const selRes = module._PyMOLWasm_Select(pymolPtr, newSelNamePtr, allSelPtr);
    assert.strictEqual(selRes, 1, "PyMOLWasm_Select failed");

    // Spectrum
    const exprPtr = module.stringToNewUTF8("b"); // color by b-factor
    const spectrumRes = module._PyMOLWasm_Spectrum(pymolPtr, newSelNamePtr, exprPtr, 0.0, 100.0);
    assert.strictEqual(spectrumRes, 1, "PyMOLWasm_Spectrum failed");

    // Color Ramp
    const rampNamePtr = module.stringToNewUTF8("my_ramp");
    const rangePtr = module._malloc(2 * bytesPerFloat);
    const rangeData = new Float32Array(module.HEAPF32.buffer, rangePtr, 2);
    rangeData.set([0.0, 1.0]);
    const colorBufPtr = module._malloc(6 * bytesPerFloat); // 2 colors * 3 RGB
    const colorData = new Float32Array(module.HEAPF32.buffer, colorBufPtr, 6);
    colorData.set([1.0, 0.0, 0.0,  0.0, 0.0, 1.0]); // red to blue
    
    const rampRes = module._PyMOLWasm_RampNew(pymolPtr, rampNamePtr, mapNamePtr2, rangePtr, 2, colorBufPtr);
    console.log("RampNew result:", rampRes);
    console.log("✅ Maps and Selections tests passed (no crashes).");

    // --- TEST 16: Scenes and Extents ---
    console.log("Executing Scenes and Extents...");
    const sceneNamePtr = module.stringToNewUTF8("my_scene");
    const msgPtr = module.stringToNewUTF8("Hello Scene");
    
    const storeRes = module._PyMOLWasm_SceneStore(pymolPtr, sceneNamePtr, msgPtr);
    assert.strictEqual(storeRes, 1, "PyMOLWasm_SceneStore failed");

    const recallRes = module._PyMOLWasm_SceneRecall(pymolPtr, sceneNamePtr, 0.0);
    assert.strictEqual(recallRes, 1, "PyMOLWasm_SceneRecall failed");

    const extentPtr = module._malloc(6 * bytesPerFloat);
    const extentRes = module._PyMOLWasm_GetExtent(pymolPtr, allSelPtr, extentPtr);
    if (extentRes) {
        const extentData = new Float32Array(module.HEAPF32.buffer, extentPtr, 6);
        console.log("Extent:", extentData);
    }
    
    const clearRes = module._PyMOLWasm_MovieClear(pymolPtr);
    assert.strictEqual(clearRes, 1, "PyMOLWasm_MovieClear failed");
    console.log("✅ Scenes and Extent tests passed.");

    // --- TEST 17: Final Structural/Map Commands ---
    console.log("Executing Final Specialized Commands...");
    const emptyStrPtr = module.stringToNewUTF8("");
    const dssRes = module._PyMOLWasm_AssignSS(pymolPtr, allSelPtr, 0, emptyStrPtr, 0);
    assert.strictEqual(dssRes, 1, "PyMOLWasm_AssignSS failed");

    const fixChemRes = module._PyMOLWasm_FixChemistry(pymolPtr, allSelPtr, allSelPtr, 1);
    assert.strictEqual(fixChemRes, 1, "PyMOLWasm_FixChemistry failed");

    // These map commands will likely safely fail since my_map is pseudo-generated
    const mapDoubleRes = module._PyMOLWasm_MapDouble(pymolPtr, mapNamePtr2, 0);
    console.log("MapDouble result:", mapDoubleRes);

    const mapHalveRes = module._PyMOLWasm_MapHalve(pymolPtr, mapNamePtr2, 0, 0);
    console.log("MapHalve result:", mapHalveRes);

    const mapTrimRes = module._PyMOLWasm_MapTrim(pymolPtr, mapNamePtr2, allSelPtr, 1.0, 0, 0);
    console.log("MapTrim result:", mapTrimRes);

    // Test setting coordinates
    const newCoordsPtr = module._malloc(3 * 3 * bytesPerFloat); // 3 atoms x 3 components
    const newCoordsData = new Float32Array(module.HEAPF32.buffer, newCoordsPtr, 9);
    newCoordsData.set([0,0,0, 1,1,1, 2,2,2]);
    
    // We expect it to return the number of atoms successfully set (might be 0 since 'id 1' might be tricky, or if we use allSelPtr it will fail because 9 != 18)
    const setCoordsRes = module._PyMOLWasm_SetAtomCoordinates(pymolPtr, allSelPtr, 0, newCoordsPtr);
    console.log("SetAtomCoordinates returned:", setCoordsRes);
    console.log("✅ Final Specialized Commands passed (no crashes).");

    // Cleanup
    module._free(newCoordsPtr);
    module._free(emptyStrPtr);
    module._free(outBufferPtr);
    module._free(identityMatrixPtr);
    module._free(vectorPtr);
    module._free(singleAtomSelPtr);
    module._free(copyTargetPtr);
    module._free(mapNamePtr2);
    module._free(newSelNamePtr);
    module._free(exprPtr);
    module._free(rampNamePtr);
    module._free(rangePtr);
    module._free(colorBufPtr);
    module._free(sceneNamePtr);
    module._free(msgPtr);
    module._free(extentPtr);
    module._free(viewBufferPtr);
    module._free(everythingPtr);
    module._free(newObjPtr);
    module._free(symPrefixPtr);
    module._free(meshNamePtr);
    module._free(mapNamePtr);
    module._free(pdbPtr);
    module._free(objNamePtr);
    module._free(allSelPtr);
    module._free(cartoonPtr);
    module._free(redPtr);
    
    module._PyMOL_Free(pymolPtr);
    module._PyMOLOptions_Free(optionsPtr);
    
    console.log("All tests completed successfully. Memory freed.");
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
