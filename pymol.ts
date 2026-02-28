/**
 * Minimal Emscripten module interface (avoids requiring @types/emscripten).
 */
interface EmscriptenModuleBase {
    noInitialRun?: boolean;
    print?(text: string): void;
    printErr?(text: string): void;
}

/**
 * Interface representing the WebAssembly PyMOL Module compiled via Emscripten.
 * Declares all exported C functions and Emscripten runtime helpers.
 */
export interface PyMOLModule extends EmscriptenModuleBase {
    ccall(ident: string, returnType: string | null, argTypes: string[], args: unknown[]): unknown;
    cwrap(ident: string, returnType: string | null, argTypes: string[]): (...args: unknown[]) => unknown;

    // Emscripten memory views
    HEAPF32: Float32Array;
    HEAP8: Int8Array;
    HEAPU8: Uint8Array;

    // Emscripten helpers
    stringToNewUTF8(str: string): number;

    // Memory management
    _malloc(size: number): number;
    _free(ptr: number): void;

    // Core PyMOL lifecycle
    _PyMOLOptions_New(): number;
    _PyMOL_NewWithOptions(optionsPtr: number): number;
    _PyMOL_Start(pymolPtr: number): void;
    _PyMOL_Free(pymolPtr: number): void;
    _PyMOLOptions_Free(optionsPtr: number): void;

    // Data loading
    _PyMOLWasm_Load(pymolPtr: number, oname: number, content: number, contentLength: number, format: number): number;

    // Representation
    _PyMOLWasm_Show(pymolPtr: number, repName: number, selection: number): number;
    _PyMOLWasm_Hide(pymolPtr: number, repName: number, selection: number): number;
    _PyMOLWasm_Color(pymolPtr: number, colorName: number, selection: number): number;

    // Queries
    _PyMOLWasm_GetAtomCount(pymolPtr: number, selection: number): number;
    _PyMOLWasm_GetAtomCoordinates(pymolPtr: number, selection: number, outBuffer: number): number;

    // Camera
    _PyMOLWasm_Zoom(pymolPtr: number, selection: number, buffer: number): number;
    _PyMOLWasm_Center(pymolPtr: number, selection: number): number;
    _PyMOLWasm_Origin(pymolPtr: number, selection: number): number;

    // Object management
    _PyMOLWasm_Delete(pymolPtr: number, name: number): number;
    _PyMOLWasm_Remove(pymolPtr: number, selection: number): number;
    _PyMOLWasm_Copy(pymolPtr: number, targetName: number, sourceName: number): number;
    _PyMOLWasm_CreateObject(pymolPtr: number, name: number, selection: number, sourceState: number, targetState: number, extractFlag: number): number;

    // Alignment
    _PyMOLWasm_Align(pymolPtr: number, target: number, mobile: number): number;

    // Measurements
    _PyMOLWasm_GetDistance(pymolPtr: number, sel1: number, sel2: number): number;
    _PyMOLWasm_GetAngle(pymolPtr: number, sel1: number, sel2: number, sel3: number): number;
    _PyMOLWasm_GetDihedral(pymolPtr: number, sel1: number, sel2: number, sel3: number, sel4: number): number;
    _PyMOLWasm_GetArea(pymolPtr: number, selection: number): number;

    // Settings
    _PyMOLWasm_SetSetting(pymolPtr: number, settingIndex: number, value: number): number;

    // View matrix
    _PyMOLWasm_GetView(pymolPtr: number, outView: number): number;
    _PyMOLWasm_SetView(pymolPtr: number, inView: number): number;

    // Selections
    _PyMOLWasm_Select(pymolPtr: number, name: number, selection: number): number;

    // Transformations
    _PyMOLWasm_TransformObject(pymolPtr: number, name: number, state: number, selection: number, matrix: number, homogenous: number, global: number): number;
    _PyMOLWasm_TransformSelection(pymolPtr: number, state: number, selection: number, matrix: number, homogenous: number): number;
    _PyMOLWasm_TranslateAtom(pymolPtr: number, selection: number, vector: number, state: number, mode: number): number;
    _PyMOLWasm_ResetMatrix(pymolPtr: number, name: number, state: number): number;

    // Bonds
    _PyMOLWasm_Bond(pymolPtr: number, sel1: number, sel2: number, order: number, mode: number): number;
    _PyMOLWasm_Unbond(pymolPtr: number, sel1: number, sel2: number): number;
    _PyMOLWasm_Fuse(pymolPtr: number, sel1: number, sel2: number): number;

    // Maps
    _PyMOLWasm_MapNew(pymolPtr: number, name: number, type: number, gridSpacing: number, selection: number, buffer: number, state: number): number;
    _PyMOLWasm_MapDouble(pymolPtr: number, name: number, state: number): number;
    _PyMOLWasm_MapHalve(pymolPtr: number, name: number, state: number, smooth: number): number;
    _PyMOLWasm_MapTrim(pymolPtr: number, name: number, selection: number, buffer: number, mapState: number, seleState: number): number;
    _PyMOLWasm_Isomesh(pymolPtr: number, meshName: number, mapName: number, level: number, selection: number, buffer: number, state: number, carve: number, meshMode: number): number;

    // Coloring
    _PyMOLWasm_Spectrum(pymolPtr: number, selection: number, expression: number, minVal: number, maxVal: number): number;
    _PyMOLWasm_RampNew(pymolPtr: number, name: number, mapName: number, range: number, rangeSize: number, colors: number): number;

    // Scenes
    _PyMOLWasm_SceneStore(pymolPtr: number, name: number, message: number): number;
    _PyMOLWasm_SceneRecall(pymolPtr: number, name: number, animate: number): number;

    // Animation
    _PyMOLWasm_MPlay(pymolPtr: number): number;
    _PyMOLWasm_MStop(pymolPtr: number): number;
    _PyMOLWasm_SetFrame(pymolPtr: number, mode: number, frame: number): number;
    _PyMOLWasm_GetState(pymolPtr: number): number;
    _PyMOLWasm_GetFrame(pymolPtr: number): number;
    _PyMOLWasm_MovieClear(pymolPtr: number): number;

    // Spatial
    _PyMOLWasm_GetExtent(pymolPtr: number, selection: number, outExtent: number): number;
    _PyMOLWasm_SymExp(pymolPtr: number, prefix: number, objName: number, selection: number, cutoff: number): number;

    // Structural
    _PyMOLWasm_AssignSS(pymolPtr: number, target: number, state: number, context: number, preserve: number): number;
    _PyMOLWasm_FixChemistry(pymolPtr: number, selection: number, context: number, invalidate: number): number;

    // Coordinates
    _PyMOLWasm_SetAtomCoordinates(pymolPtr: number, selection: number, state: number, inBuffer: number): number;
}

/** PDB string load format constant (cLoadTypePDBStr) */
export const LOAD_FORMAT_PDB_STR = 9;

/** Valid representation names for show/hide */
export type RepresentationName = 'lines' | 'spheres' | 'surface' | 'ribbon' | 'cartoon' | 'sticks' | 'mesh' | 'dots';

/**
 * Helper to allocate a string in WASM memory, call a function, and free it.
 * Returns the allocated pointer. Caller is responsible for freeing.
 */
function allocString(module: PyMOLModule, str: string): number {
    return module.stringToNewUTF8(str);
}

export class PyMOLHeadless {
    private module: PyMOLModule | null = null;
    private optionsPtr: number = 0;
    private pymolPtr: number = 0;

    constructor() {}

    /** Returns the underlying WASM module for direct access. */
    getModule(): PyMOLModule {
        if (!this.module) throw new Error("PyMOL not initialized");
        return this.module;
    }

    /** Returns the CPyMOL instance pointer. */
    getInstancePtr(): number {
        if (!this.pymolPtr) throw new Error("PyMOL not initialized");
        return this.pymolPtr;
    }

    /**
     * Initializes the WebAssembly module and starts the PyMOL core.
     * @param createPyMOL The factory function exported by Emscripten (e.g., from pymol_wasm.js)
     */
    async init(createPyMOL: (moduleArgs?: Partial<PyMOLModule>) => Promise<PyMOLModule>) {
        this.module = await createPyMOL({
            noInitialRun: true,
            print: (text: string) => console.log('[PyMOL]', text),
            printErr: (text: string) => console.error('[PyMOL Err]', text)
        });

        this.optionsPtr = this.module._PyMOLOptions_New();
        if (this.optionsPtr === 0) {
            throw new Error("Failed to allocate PyMOL options.");
        }

        this.pymolPtr = this.module._PyMOL_NewWithOptions(this.optionsPtr);
        if (this.pymolPtr === 0) {
            this.module._PyMOLOptions_Free(this.optionsPtr);
            throw new Error("Failed to create PyMOL instance.");
        }

        this.module._PyMOL_Start(this.pymolPtr);
    }

    /**
     * Loads molecular data from a string buffer.
     * @param objectName Name for the loaded object.
     * @param content PDB/SDF/etc string content.
     * @param format Load format constant (default: PDB string = 9).
     * @returns true on success.
     */
    load(objectName: string, content: string, format: number = LOAD_FORMAT_PDB_STR): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const namePtr = allocString(m, objectName);
        const contentPtr = allocString(m, content);
        try {
            return m._PyMOLWasm_Load(p, namePtr, contentPtr, content.length, format) === 1;
        } finally {
            m._free(namePtr);
            m._free(contentPtr);
        }
    }

    /**
     * Shows a representation for a selection.
     */
    show(rep: RepresentationName, selection: string = "all"): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const repPtr = allocString(m, rep);
        const selPtr = allocString(m, selection);
        try {
            return m._PyMOLWasm_Show(p, repPtr, selPtr) === 1;
        } finally {
            m._free(repPtr);
            m._free(selPtr);
        }
    }

    /**
     * Hides a representation for a selection.
     */
    hide(rep: RepresentationName | 'everything', selection: string = "all"): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const repPtr = allocString(m, rep);
        const selPtr = allocString(m, selection);
        try {
            return m._PyMOLWasm_Hide(p, repPtr, selPtr) === 1;
        } finally {
            m._free(repPtr);
            m._free(selPtr);
        }
    }

    /**
     * Colors a selection.
     */
    color(colorName: string, selection: string = "all"): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const colorPtr = allocString(m, colorName);
        const selPtr = allocString(m, selection);
        try {
            return m._PyMOLWasm_Color(p, colorPtr, selPtr) === 1;
        } finally {
            m._free(colorPtr);
            m._free(selPtr);
        }
    }

    /**
     * Returns the number of atoms matching a selection.
     */
    getAtomCount(selection: string = "all"): number {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        try {
            return m._PyMOLWasm_GetAtomCount(p, selPtr);
        } finally {
            m._free(selPtr);
        }
    }

    /**
     * Extracts atom coordinates as a Float32Array [x1,y1,z1, x2,y2,z2, ...].
     */
    getAtomCoordinates(selection: string = "all"): Float32Array {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        const count = m._PyMOLWasm_GetAtomCount(p, selPtr);
        const bufferSize = count * 3 * 4; // 3 floats * 4 bytes
        const bufPtr = m._malloc(bufferSize);
        try {
            const extracted = m._PyMOLWasm_GetAtomCoordinates(p, selPtr, bufPtr);
            const result = new Float32Array(extracted * 3);
            result.set(new Float32Array(m.HEAPF32.buffer, bufPtr, extracted * 3));
            return result;
        } finally {
            m._free(bufPtr);
            m._free(selPtr);
        }
    }

    /**
     * Zooms the camera to fit a selection.
     */
    zoom(selection: string = "all", buffer: number = 0): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        try {
            return m._PyMOLWasm_Zoom(p, selPtr, buffer) === 1;
        } finally {
            m._free(selPtr);
        }
    }

    /**
     * Centers the camera on a selection.
     */
    center(selection: string = "all"): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        try {
            return m._PyMOLWasm_Center(p, selPtr) === 1;
        } finally {
            m._free(selPtr);
        }
    }

    /**
     * Sets the origin to a selection.
     */
    origin(selection: string = "all"): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        try {
            return m._PyMOLWasm_Origin(p, selPtr) === 1;
        } finally {
            m._free(selPtr);
        }
    }

    /**
     * Deletes an object by name.
     */
    delete(name: string): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const namePtr = allocString(m, name);
        try {
            return m._PyMOLWasm_Delete(p, namePtr) === 1;
        } finally {
            m._free(namePtr);
        }
    }

    /**
     * Removes atoms matching a selection.
     */
    remove(selection: string): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        try {
            return m._PyMOLWasm_Remove(p, selPtr) === 1;
        } finally {
            m._free(selPtr);
        }
    }

    /**
     * Aligns mobile onto target. Returns RMSD or -1 on failure.
     */
    align(target: string, mobile: string): number {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const tPtr = allocString(m, target);
        const mPtr = allocString(m, mobile);
        try {
            return m._PyMOLWasm_Align(p, tPtr, mPtr);
        } finally {
            m._free(tPtr);
            m._free(mPtr);
        }
    }

    /**
     * Sets a global setting by index.
     */
    setSetting(settingIndex: number, value: number): boolean {
        const m = this.getModule();
        return m._PyMOLWasm_SetSetting(this.getInstancePtr(), settingIndex, value) === 1;
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
