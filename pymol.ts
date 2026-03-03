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
    _PyMOLWasm_GetAtomCoordinates(pymolPtr: number, selection: number, outBuffer: number, bufferSize: number): number;

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
    _PyMOLWasm_SetAtomCoordinates(pymolPtr: number, selection: number, state: number, inBuffer: number, bufferSize: number): number;
}

/** PDB string load format constant (cLoadTypePDBStr) */
export const LOAD_FORMAT_PDB_STR = 9;

/** Number of floats in a PyMOL scene view */
export const SCENE_VIEW_SIZE = 25;

/** Valid representation names for show/hide */
export type RepresentationName = 'lines' | 'spheres' | 'surface' | 'ribbon' | 'cartoon' | 'sticks' | 'mesh' | 'dots';

const textEncoder = new TextEncoder();

/**
 * Allocates a string in WASM memory via stringToNewUTF8.
 * Throws if allocation fails (returns 0).
 * Caller is responsible for freeing the returned pointer.
 */
function allocString(module: PyMOLModule, str: string): number {
    const ptr = module.stringToNewUTF8(str);
    if (ptr === 0) {
        throw new Error(`Failed to allocate WASM string for "${str.slice(0, 50)}"`);
    }
    return ptr;
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
        if (this.module !== null) {
            throw new Error("PyMOL already initialized — call destroy() first");
        }

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
            this.optionsPtr = 0;
            throw new Error("Failed to create PyMOL instance.");
        }

        try {
            this.module._PyMOL_Start(this.pymolPtr);
        } catch (e) {
            this.module._PyMOL_Free(this.pymolPtr);
            this.module._PyMOLOptions_Free(this.optionsPtr);
            this.pymolPtr = 0;
            this.optionsPtr = 0;
            throw e;
        }
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
        try {
            const contentPtr = allocString(m, content);
            try {
                const byteLength = textEncoder.encode(content).byteLength;
                return m._PyMOLWasm_Load(p, namePtr, contentPtr, byteLength, format) === 1;
            } finally {
                m._free(contentPtr);
            }
        } finally {
            m._free(namePtr);
        }
    }

    /**
     * Shows a representation for a selection.
     */
    show(rep: RepresentationName, selection: string = "all"): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const repPtr = allocString(m, rep);
        try {
            const selPtr = allocString(m, selection);
            try {
                return m._PyMOLWasm_Show(p, repPtr, selPtr) === 1;
            } finally {
                m._free(selPtr);
            }
        } finally {
            m._free(repPtr);
        }
    }

    /**
     * Hides a representation for a selection.
     */
    hide(rep: RepresentationName | 'everything', selection: string = "all"): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const repPtr = allocString(m, rep);
        try {
            const selPtr = allocString(m, selection);
            try {
                return m._PyMOLWasm_Hide(p, repPtr, selPtr) === 1;
            } finally {
                m._free(selPtr);
            }
        } finally {
            m._free(repPtr);
        }
    }

    /**
     * Colors a selection.
     */
    color(colorName: string, selection: string = "all"): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const colorPtr = allocString(m, colorName);
        try {
            const selPtr = allocString(m, selection);
            try {
                return m._PyMOLWasm_Color(p, colorPtr, selPtr) === 1;
            } finally {
                m._free(selPtr);
            }
        } finally {
            m._free(colorPtr);
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
        try {
            const count = m._PyMOLWasm_GetAtomCount(p, selPtr);
            if (count <= 0) return new Float32Array(0);

            const bufferFloats = count * 3;
            const bufPtr = m._malloc(bufferFloats * 4);
            if (bufPtr === 0) throw new Error("Failed to allocate coordinate buffer");
            try {
                const extracted = m._PyMOLWasm_GetAtomCoordinates(p, selPtr, bufPtr, bufferFloats);
                const result = new Float32Array(extracted * 3);
                result.set(new Float32Array(m.HEAPF32.buffer, bufPtr, extracted * 3));
                return result;
            } finally {
                m._free(bufPtr);
            }
        } finally {
            m._free(selPtr);
        }
    }

    /**
     * Sets atom coordinates from a Float32Array [x1,y1,z1, x2,y2,z2, ...].
     * @param coords Flat array of xyz coordinates (length must be divisible by 3).
     * @param selection Selection to set coordinates for.
     * @param state State index (-1 for current).
     * @returns Number of atoms successfully updated.
     */
    setAtomCoordinates(coords: Float32Array, selection: string = "all", state: number = -1): number {
        if (coords.length === 0) return 0;
        if (coords.length % 3 !== 0) {
            throw new Error(`Coordinate array length ${coords.length} is not divisible by 3`);
        }

        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        try {
            const bufPtr = m._malloc(coords.byteLength);
            if (bufPtr === 0) throw new Error("Failed to allocate coordinate buffer");
            try {
                new Float32Array(m.HEAPF32.buffer, bufPtr, coords.length).set(coords);
                return m._PyMOLWasm_SetAtomCoordinates(p, selPtr, state, bufPtr, coords.length);
            } finally {
                m._free(bufPtr);
            }
        } finally {
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
        try {
            const mPtr = allocString(m, mobile);
            try {
                return m._PyMOLWasm_Align(p, tPtr, mPtr);
            } finally {
                m._free(mPtr);
            }
        } finally {
            m._free(tPtr);
        }
    }

    /**
     * Gets the distance between two selections. Returns -1 on failure.
     */
    getDistance(sel1: string, sel2: string): number {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const s1Ptr = allocString(m, sel1);
        try {
            const s2Ptr = allocString(m, sel2);
            try {
                return m._PyMOLWasm_GetDistance(p, s1Ptr, s2Ptr);
            } finally {
                m._free(s2Ptr);
            }
        } finally {
            m._free(s1Ptr);
        }
    }

    /**
     * Gets the angle between three selections (in degrees). Returns -1 on failure.
     */
    getAngle(sel1: string, sel2: string, sel3: string): number {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const ptrs: number[] = [];
        try {
            ptrs.push(allocString(m, sel1));
            ptrs.push(allocString(m, sel2));
            ptrs.push(allocString(m, sel3));
            return m._PyMOLWasm_GetAngle(p, ptrs[0], ptrs[1], ptrs[2]);
        } finally {
            for (const ptr of ptrs) m._free(ptr);
        }
    }

    /**
     * Gets the dihedral angle between four selections (in degrees). Returns -1 on failure.
     */
    getDihedral(sel1: string, sel2: string, sel3: string, sel4: string): number {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const ptrs: number[] = [];
        try {
            ptrs.push(allocString(m, sel1));
            ptrs.push(allocString(m, sel2));
            ptrs.push(allocString(m, sel3));
            ptrs.push(allocString(m, sel4));
            return m._PyMOLWasm_GetDihedral(p, ptrs[0], ptrs[1], ptrs[2], ptrs[3]);
        } finally {
            for (const ptr of ptrs) m._free(ptr);
        }
    }

    /**
     * Gets the solvent accessible surface area for a selection. Returns -1 on failure.
     */
    getArea(selection: string = "all"): number {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        try {
            return m._PyMOLWasm_GetArea(p, selPtr);
        } finally {
            m._free(selPtr);
        }
    }

    /**
     * Gets the current scene view as a Float32Array of 25 floats.
     */
    getView(): Float32Array {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const bufPtr = m._malloc(SCENE_VIEW_SIZE * 4);
        if (bufPtr === 0) throw new Error("Failed to allocate view buffer");
        try {
            const ok = m._PyMOLWasm_GetView(p, bufPtr);
            if (!ok) throw new Error("GetView failed");
            const result = new Float32Array(SCENE_VIEW_SIZE);
            result.set(new Float32Array(m.HEAPF32.buffer, bufPtr, SCENE_VIEW_SIZE));
            return result;
        } finally {
            m._free(bufPtr);
        }
    }

    /**
     * Sets the scene view from a Float32Array of 25 floats.
     */
    setView(view: Float32Array): boolean {
        if (view.length !== SCENE_VIEW_SIZE) {
            throw new Error(`View array must have ${SCENE_VIEW_SIZE} elements, got ${view.length}`);
        }
        const m = this.getModule();
        const p = this.getInstancePtr();
        const bufPtr = m._malloc(SCENE_VIEW_SIZE * 4);
        if (bufPtr === 0) throw new Error("Failed to allocate view buffer");
        try {
            new Float32Array(m.HEAPF32.buffer, bufPtr, SCENE_VIEW_SIZE).set(view);
            return m._PyMOLWasm_SetView(p, bufPtr) === 1;
        } finally {
            m._free(bufPtr);
        }
    }

    /**
     * Gets the bounding box extent of a selection.
     * Returns [minX, minY, minZ, maxX, maxY, maxZ] or null on failure.
     */
    getExtent(selection: string = "all"): Float32Array | null {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        try {
            const bufPtr = m._malloc(6 * 4);
            if (bufPtr === 0) throw new Error("Failed to allocate extent buffer");
            try {
                const ok = m._PyMOLWasm_GetExtent(p, selPtr, bufPtr);
                if (!ok) return null;
                const result = new Float32Array(6);
                result.set(new Float32Array(m.HEAPF32.buffer, bufPtr, 6));
                return result;
            } finally {
                m._free(bufPtr);
            }
        } finally {
            m._free(selPtr);
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
        if (this.module) {
            if (this.pymolPtr) {
                this.module._PyMOL_Free(this.pymolPtr);
                this.pymolPtr = 0;
            }
            if (this.optionsPtr) {
                this.module._PyMOLOptions_Free(this.optionsPtr);
                this.optionsPtr = 0;
            }
            this.module = null;
        }
    }
}
