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
    UTF8ToString(ptr: number): string;

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
    _PyMOLWasm_Turn(pymolPtr: number, axis: number, angle: number): number;

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
    _PyMOLWasm_SetSettingForSelection(pymolPtr: number, settingIndex: number, value: number, selection: number): number;
    _PyMOLWasm_SetSettingString(pymolPtr: number, settingIndex: number, value: number, selection: number): number;

    // Labels
    _PyMOLWasm_Label(pymolPtr: number, selection: number, expression: number): number;

    // Measurements
    _PyMOLWasm_Distance(pymolPtr: number, name: number, sel1: number, sel2: number, mode: number): number;

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
    _PyMOLWasm_Spectrum(pymolPtr: number, selection: number, expression: number, palette: number, minVal: number, maxVal: number): number;
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

    // Ray scene export (out_ptr is a pointer to a char* that receives a malloc'd buffer)
    _PyMOLWasm_GetRayScene(pymolPtr: number, width: number, height: number, outPtr: number, unused: number): number;

    // --- Issue 1: Viewing / Display ---
    _PyMOLWasm_Enable(pymolPtr: number, name: number): number;
    _PyMOLWasm_Disable(pymolPtr: number, name: number): number;
    _PyMOLWasm_Orient(pymolPtr: number, selection: number): number;
    _PyMOLWasm_Clip(pymolPtr: number, mode: number, movement: number, selection: number): number;
    _PyMOLWasm_Move(pymolPtr: number, axis: number, dist: number): number;
    _PyMOLWasm_Reset(pymolPtr: number, name: number): number;
    _PyMOLWasm_BgColor(pymolPtr: number, color: number): number;
    _PyMOLWasm_Cartoon(pymolPtr: number, type: number, selection: number): number;
    _PyMOLWasm_Toggle(pymolPtr: number, rep: number, selection: number): number;
    _PyMOLWasm_Rebuild(pymolPtr: number): number;
    _PyMOLWasm_Volume(pymolPtr: number, volumeName: number, mapName: number, level: number, selection: number, buffer: number, state: number, carve: number, mapState: number): number;
    _PyMOLWasm_Isolevel(pymolPtr: number, name: number, level: number, state: number): number;

    // --- Issue 1: Structure Manipulation ---
    _PyMOLWasm_HAdd(pymolPtr: number, selection: number): number;
    _PyMOLWasm_Protect(pymolPtr: number, selection: number, mode: number): number;
    _PyMOLWasm_Mask(pymolPtr: number, selection: number, mode: number): number;
    _PyMOLWasm_Flag(pymolPtr: number, flag: number, selection: number, action: number): number;
    _PyMOLWasm_SetDihedral(pymolPtr: number, s0: number, s1: number, s2: number, s3: number, value: number, state: number): number;
    _PyMOLWasm_Sort(pymolPtr: number, name: number): number;
    _PyMOLWasm_SculptActivate(pymolPtr: number, name: number): number;
    _PyMOLWasm_SculptIterate(pymolPtr: number, name: number, state: number, nCycles: number): number;
    _PyMOLWasm_Reinitialize(pymolPtr: number, what: number): number;
    _PyMOLWasm_Pseudoatom(pymolPtr: number, objectName: number, selection: number, name: number, resn: number, chain: number, pos: number, labelText: number, state: number): number;

    // --- Issue 1: Object Management ---
    _PyMOLWasm_SetName(pymolPtr: number, oldName: number, newName: number): number;
    _PyMOLWasm_SetTitle(pymolPtr: number, name: number, state: number, text: number): number;
    _PyMOLWasm_Order(pymolPtr: number, names: number, sort: number, location: number): number;
    _PyMOLWasm_Group(pymolPtr: number, name: number, members: number, action: number): number;
    _PyMOLWasm_SetObjectColor(pymolPtr: number, name: number, color: number): number;

    // --- Issue 1: Settings ---
    _PyMOLWasm_UnsetSetting(pymolPtr: number, index: number, selection: number, state: number): number;
    _PyMOLWasm_SetSymmetry(pymolPtr: number, selection: number, state: number, a: number, b: number, c: number, alpha: number, beta: number, gamma: number, sgroup: number): number;

    // --- Issue 2: Atom Property Access ---
    _PyMOLWasm_SetAtomPropertyFloat(pymolPtr: number, selection: number, property: number, value: number): number;
    _PyMOLWasm_SetAtomPropertyInt(pymolPtr: number, selection: number, property: number, value: number): number;
    _PyMOLWasm_SetAtomPropertyString(pymolPtr: number, selection: number, property: number, value: number): number;
    _PyMOLWasm_GetAtomPropertyFloat(pymolPtr: number, selection: number, property: number, outBuf: number, bufSize: number): number;
    _PyMOLWasm_GetAtomPropertyInt(pymolPtr: number, selection: number, property: number, outBuf: number, bufSize: number): number;
    _PyMOLWasm_GetAtomPropertyString(pymolPtr: number, selection: number, property: number, outPtr: number): number;

    // --- Issue 3: File Export ---
    _PyMOLWasm_GetStr(pymolPtr: number, format: number, selection: number, state: number, outPtr: number): number;

    // --- Issue 6: Introspection ---
    _PyMOLWasm_GetNames(pymolPtr: number, mode: number, outPtr: number): number;
    _PyMOLWasm_GetType(pymolPtr: number, name: number, outPtr: number): number;
    _PyMOLWasm_CountStates(pymolPtr: number, selection: number): number;
    _PyMOLWasm_GetChains(pymolPtr: number, selection: number, state: number, outPtr: number): number;
    _PyMOLWasm_GetSettingFloat(pymolPtr: number, index: number): number;
    _PyMOLWasm_GetSettingInt(pymolPtr: number, index: number): number;
    _PyMOLWasm_GetSceneList(pymolPtr: number, outPtr: number): number;
    _PyMOLWasm_GetSymmetry(pymolPtr: number, selection: number, state: number, outParams: number, outSgroup: number): number;
    _PyMOLWasm_GetColorTuple(pymolPtr: number, colorName: number, outRgb: number): number;
    _PyMOLWasm_GetObjectMatrix(pymolPtr: number, name: number, state: number, outMatrix: number): number;
    _PyMOLWasm_GetTitle(pymolPtr: number, name: number, state: number, outPtr: number): number;

    // Emscripten HEAP32 view for reading pointers
    HEAP32: Int32Array;
    HEAPF64: Float64Array;
}

/** PDB string load format constant (cLoadTypePDBStr) */
export const LOAD_FORMAT_PDB_STR = 9;

/** Number of floats in a PyMOL scene view */
export const SCENE_VIEW_SIZE = 25;

/** Valid representation names for show/hide */
export type RepresentationName = 'lines' | 'spheres' | 'surface' | 'ribbon' | 'cartoon' | 'sticks' | 'mesh' | 'dots' | 'nb_spheres' | 'nonbonded' | 'ellipsoids' | 'ellipsoid' | 'dashes' | 'labels' | 'cell' | 'cgo';

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
            // Encode once, write directly to WASM memory (avoids double-encode
            // from stringToNewUTF8 + textEncoder.encode for byte length).
            const encoded = textEncoder.encode(content);
            const contentPtr = m._malloc(encoded.length + 1);
            if (contentPtr === 0) throw new Error("Failed to allocate content buffer");
            try {
                m.HEAPU8.set(encoded, contentPtr);
                m.HEAPU8[contentPtr + encoded.length] = 0;
                return m._PyMOLWasm_Load(p, namePtr, contentPtr, encoded.length, format) === 1;
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
     * Rotates the view around an axis. Equivalent to `turn axis, angle`.
     */
    turn(axis: 'x' | 'y' | 'z', angle: number): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        return m._PyMOLWasm_Turn(p, axis.charCodeAt(0), angle) === 1;
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
        const s1 = allocString(m, sel1);
        try {
            const s2 = allocString(m, sel2);
            try {
                const s3 = allocString(m, sel3);
                try {
                    return m._PyMOLWasm_GetAngle(p, s1, s2, s3);
                } finally { m._free(s3); }
            } finally { m._free(s2); }
        } finally { m._free(s1); }
    }

    /**
     * Gets the dihedral angle between four selections (in degrees). Returns -1 on failure.
     */
    getDihedral(sel1: string, sel2: string, sel3: string, sel4: string): number {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const s1 = allocString(m, sel1);
        try {
            const s2 = allocString(m, sel2);
            try {
                const s3 = allocString(m, sel3);
                try {
                    const s4 = allocString(m, sel4);
                    try {
                        return m._PyMOLWasm_GetDihedral(p, s1, s2, s3, s4);
                    } finally { m._free(s4); }
                } finally { m._free(s3); }
            } finally { m._free(s2); }
        } finally { m._free(s1); }
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
     * Sets a global setting by index, or a per-object setting if selection is provided.
     */
    setSetting(settingIndex: number, value: number, selection?: string): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        if (selection) {
            const selPtr = allocString(m, selection);
            try {
                return m._PyMOLWasm_SetSettingForSelection(p, settingIndex, value, selPtr) === 1;
            } finally {
                m._free(selPtr);
            }
        }
        return m._PyMOLWasm_SetSetting(p, settingIndex, value) === 1;
    }

    /**
     * Sets a setting using a string value, supporting color names (e.g. "red"),
     * on/off toggles, and other non-numeric setting values.
     */
    setSettingString(settingIndex: number, value: string, selection?: string): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const valPtr = allocString(m, value);
        try {
            const selPtr = allocString(m, selection || '');
            try {
                return m._PyMOLWasm_SetSettingString(p, settingIndex, valPtr, selPtr) === 1;
            } finally {
                m._free(selPtr);
            }
        } finally {
            m._free(valPtr);
        }
    }

    /**
     * Labels atoms matching a selection with an expression.
     * Uses the alternate (non-Python) expression evaluator supporting:
     * name, resn, resi, resv, chain, alt, elem, type, q, b, segi, ID, rank, index, model.
     */
    label(selection: string, expression: string): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const selPtr = allocString(m, selection);
        try {
            const exprPtr = allocString(m, expression);
            try {
                return m._PyMOLWasm_Label(p, selPtr, exprPtr) === 1;
            } finally {
                m._free(exprPtr);
            }
        } finally {
            m._free(selPtr);
        }
    }

    /**
     * Creates a distance measurement object between two selections.
     */
    distance(name: string, sel1: string, sel2: string, mode: number = 0): boolean {
        const m = this.getModule();
        const p = this.getInstancePtr();
        const namePtr = allocString(m, name);
        try {
            const s1Ptr = allocString(m, sel1);
            try {
                const s2Ptr = allocString(m, sel2);
                try {
                    return m._PyMOLWasm_Distance(p, namePtr, s1Ptr, s2Ptr, mode) === 1;
                } finally {
                    m._free(s2Ptr);
                }
            } finally {
                m._free(s1Ptr);
            }
        } finally {
            m._free(namePtr);
        }
    }

    /**
     * Extracts the ray scene as a JSON string for external GPU ray tracing.
     * Returns a viewmol-ray-v2 JSON string containing all primitives,
     * camera parameters, and character bitmaps.
     *
     * @param width Ray image width (0 = use scene width).
     * @param height Ray image height (0 = use scene height).
     * @returns JSON string with ray scene data.
     */
    getRayScene(width: number = 0, height: number = 0): string {
        const m = this.getModule();
        const p = this.getInstancePtr();

        // Allocate a pointer-sized slot to receive the output buffer address
        const outPtrPtr = m._malloc(4);
        if (outPtrPtr === 0) throw new Error("Failed to allocate pointer slot");

        try {
            m.HEAP32[outPtrPtr >> 2] = 0;
            const jsonLen = m._PyMOLWasm_GetRayScene(p, width, height, outPtrPtr, 0);

            if (jsonLen === 0) {
                throw new Error("GetRayScene failed — no scene data available");
            }

            const bufPtr = m.HEAP32[outPtrPtr >> 2];
            if (bufPtr === 0) {
                throw new Error("GetRayScene returned null buffer");
            }

            try {
                return m.UTF8ToString(bufPtr);
            } finally {
                m._free(bufPtr);
            }
        } finally {
            m._free(outPtrPtr);
        }
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
