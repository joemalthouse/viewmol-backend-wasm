const createPyMOL = require('./pymol-open-source/pymol_wasm.js');

async function runTest() {
    console.log("Loading PyMOL WebAssembly module...");
    const module = await createPyMOL({
        print: (text) => console.log('[PyMOL]', text),
        printErr: (text) => console.error('[PyMOL Err]', text)
    });
    
    console.log("Module loaded successfully. Allocating options...");
    const optionsPtr = module._PyMOLOptions_New();
    console.log("Options struct allocated at memory address:", optionsPtr);

    console.log("Initializing core PyMOL instance...");
    const pymolPtr = module._PyMOL_NewWithOptions(optionsPtr);
    console.log("Core instance allocated at memory address:", pymolPtr);

    console.log("Starting PyMOL headless engine...");
    module._PyMOL_Start(pymolPtr);
    console.log("Engine started! No runtime errors encountered.");

    // Cleanup
    module._PyMOL_Free(pymolPtr);
    module._PyMOLOptions_Free(optionsPtr);
    console.log("Resources freed. Test complete.");
}

runTest().catch(console.error);
