/// <reference types="emscripten" />

/**
 * Interface representing the WebAssembly PyMOL Module compiled via Emscripten.
 */
export interface PyMOLModule extends EmscriptenModule {
    ccall: typeof ccall;
    cwrap: typeof cwrap;
    
    // Core PyMOL C API exposed via WebAssembly
    _PyMOLOptions_New: () => number;
    _PyMOL_NewWithOptions: (optionsPtr: number) => number;
    _PyMOL_Start: (pymolPtr: number) => void;
    _PyMOL_Free: (pymolPtr: number) => void;
    _PyMOLOptions_Free: (optionsPtr: number) => void;
}

export class PyMOLHeadless {
    private module: PyMOLModule | null = null;
    private optionsPtr: number = 0;
    private pymolPtr: number = 0;

    constructor() {}

    /**
     * Initializes the WebAssembly module and starts the PyMOL core.
     * @param createPyMOL The factory function exported by Emscripten (e.g., from pymol_wasm.js)
     */
    async init(createPyMOL: (moduleArgs?: Partial<PyMOLModule>) => Promise<PyMOLModule>) {
        // Load the module with headless/no-canvas settings
        this.module = await createPyMOL({
            noInitialRun: true,
            print: (text: string) => console.log('[PyMOL]', text),
            printErr: (text: string) => console.error('[PyMOL Err]', text)
        });

        // Initialize PyMOL options
        this.optionsPtr = this.module._PyMOLOptions_New();
        if (this.optionsPtr === 0) {
            throw new Error("Failed to allocate PyMOL options.");
        }

        // Create the PyMOL instance
        this.pymolPtr = this.module._PyMOL_NewWithOptions(this.optionsPtr);
        if (this.pymolPtr === 0) {
            this.module._PyMOLOptions_Free(this.optionsPtr);
            throw new Error("Failed to create PyMOL instance.");
        }

        // Start the engine
        this.module._PyMOL_Start(this.pymolPtr);
        console.log("PyMOL headless engine started successfully.");
    }

    /**
     * Executes a PyMOL command string (e.g., 'load 1foo.pdb')
     * Note: Full command parsing normally requires Python, but core API wrappers
     * can be added here to load data directly via C API if necessary.
     */
    executeCommand(cmd: string) {
        if (!this.module || !this.pymolPtr) throw new Error("PyMOL not initialized");
        
        // As Python is stripped, standard text commands won't route through layer5 python parser.
        // We will need to map directly to layer4/layer3 C++ functions here for WebGPU data extraction.
        console.warn("Direct command parsing is disabled in No-Python build. Use direct C++ API wrappers instead.");
    }

    /**
     * Free resources when done.
     */
    destroy() {
        if (this.module && this.pymolPtr) {
            this.module._PyMOL_Free(this.pymolPtr);
            this.module._PyMOLOptions_Free(this.optionsPtr);
            this.pymolPtr = 0;
            this.optionsPtr = 0;
        }
    }
}
