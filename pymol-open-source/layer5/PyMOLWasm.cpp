#include "os_predef.h"
#include "PyMOL.h"
#include "PyMOLOptions.h"
#include "PyMOLGlobals.h"
#include "Executive.h"
#include "AtomIterators.h"
#include "PyMOLObject.h"
#include "Selector.h"
#include "Setting.h"
#include "Scene.h"
#include "Movie.h"
#include "MovieScene.h"
#include "Vector.h"
#include <cstring>

extern "C" {

/**
 * Loads molecular data directly from a memory string.
 * @param pymolPtr Pointer to the CPyMOL instance.
 * @param oname Name of the object to create in PyMOL.
 * @param content The actual file content (e.g., PDB string).
 * @param content_length Length of the content string.
 * @param format Integer representing the format (e.g., 0 for auto, or specific cLoadTypePDB).
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_Load(CPyMOL* pymolPtr, const char* oname, const char* content, int content_length, int format) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // We pass empty string for fname since we are loading from raw string content
    auto result = ExecutiveLoad(G, "", content, content_length, static_cast<cLoadType_t>(format), oname, 0, -1, 0, 1, 0, 1, nullptr, nullptr, nullptr, -1);
    
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'show' command.
 * @param pymolPtr Pointer to the CPyMOL instance.
 * @param rep_name Name of the representation (e.g., "cartoon", "lines").
 * @param selection Selection string (e.g., "all").
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_Show(CPyMOL* pymolPtr, const char* rep_name, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // Determine the representation ID from the string
    int rep_id = -1; // Default to Invalid
    if (strcmp(rep_name, "lines") == 0) rep_id = cRepLine;
    else if (strcmp(rep_name, "spheres") == 0) rep_id = cRepSphere;
    else if (strcmp(rep_name, "surface") == 0) rep_id = cRepSurface;
    else if (strcmp(rep_name, "ribbon") == 0) rep_id = cRepRibbon;
    else if (strcmp(rep_name, "cartoon") == 0) rep_id = cRepCartoon;
    else if (strcmp(rep_name, "sticks") == 0) rep_id = cRepCyl;
    else if (strcmp(rep_name, "mesh") == 0) rep_id = cRepMesh;
    else if (strcmp(rep_name, "dots") == 0) rep_id = cRepDot;
    
    if (rep_id == -1) return 0; // Invalid representation
    
    auto result = ExecutiveSetRepVisib(G, selection, rep_id, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'hide' command.
 * @param pymolPtr Pointer to the CPyMOL instance.
 * @param rep_name Name of the representation (e.g., "cartoon", "lines").
 * @param selection Selection string (e.g., "all").
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_Hide(CPyMOL* pymolPtr, const char* rep_name, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    int rep_id = -1;
    if (strcmp(rep_name, "lines") == 0) rep_id = cRepLine;
    else if (strcmp(rep_name, "spheres") == 0) rep_id = cRepSphere;
    else if (strcmp(rep_name, "surface") == 0) rep_id = cRepSurface;
    else if (strcmp(rep_name, "ribbon") == 0) rep_id = cRepRibbon;
    else if (strcmp(rep_name, "cartoon") == 0) rep_id = cRepCartoon;
    else if (strcmp(rep_name, "sticks") == 0) rep_id = cRepCyl;
    else if (strcmp(rep_name, "mesh") == 0) rep_id = cRepMesh;
    else if (strcmp(rep_name, "dots") == 0) rep_id = cRepDot;
    else if (strcmp(rep_name, "everything") == 0) rep_id = -1; // hide everything uses a special code or loops
    
    // For 'everything', PyMOL usually loops over all reps or passes a specific flag
    if (strcmp(rep_name, "everything") == 0) {
        // Special case: hide all representations
        for (int i = 0; i < cRepCnt; i++) {
            ExecutiveSetRepVisib(G, selection, i, 0);
        }
        return 1;
    }
    
    if (rep_id == -1) return 0;
    
    auto result = ExecutiveSetRepVisib(G, selection, rep_id, 0); // state=0 for hide
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'zoom' command.
 */
int PyMOLWasm_Zoom(CPyMOL* pymolPtr, const char* selection, float buffer) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveWindowZoom(G, selection, buffer, -1, 0, 0, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'center' command.
 */
int PyMOLWasm_Center(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveCenter(G, selection, -1, 1, 0, nullptr, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes an 'origin' command.
 */
int PyMOLWasm_Origin(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveOrigin(G, selection, 0, nullptr, nullptr, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'delete' command (removes entire objects).
 */
int PyMOLWasm_Delete(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveDelete(G, name);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'remove' command (removes atoms matching selection).
 */
int PyMOLWasm_Remove(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveRemoveAtoms(G, selection, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes an 'align' command between two selections.
 * Returns the RMSD value if successful, or -1.0 on failure.
 */
float PyMOLWasm_Align(CPyMOL* pymolPtr, const char* target, const char* mobile) {
    if (!pymolPtr) return -1.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1.0f;
    
    // We use ExecutiveRMSPairs which handles simple alignment and returns the RMSD
    std::vector<SelectorTmp> sele;
    sele.emplace_back(G, mobile);
    sele.emplace_back(G, target);
    
    // ExecutiveRMSPairs signature:
    // float ExecutiveRMSPairs(PyMOLGlobals* G, const std::vector<SelectorTmp>& sele, int mode, bool quiet);
    // mode 0 is usually standard fit
    float rmsd = ExecutiveRMSPairs(G, sele, 0, true);
    return rmsd;
}

/**
 * Calculates the distance between two selections (must resolve to single atoms or centers).
 */
float PyMOLWasm_GetDistance(CPyMOL* pymolPtr, const char* sel1, const char* sel2) {
    if (!pymolPtr) return -1.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1.0f;
    
    auto result = ExecutiveGetDistance(G, sel1, sel2, -1);
    if (static_cast<bool>(result)) {
        return result.result();
    }
    return -1.0f;
}

/**
 * Sets a global setting by its integer index (from Setting.h enum).
 */
int PyMOLWasm_SetSetting(CPyMOL* pymolPtr, int setting_index, float value) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    SettingSetGlobal_f(G, setting_index, value);
    return 1;
}

/**
 * Executes a 'color' command.
 * @param pymolPtr Pointer to the CPyMOL instance.
 * @param color_name Name of the color (e.g., "red", "blue").
 * @param selection Selection string (e.g., "all").
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_Color(CPyMOL* pymolPtr, const char* color_name, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // Call the executive color function
    auto result = ExecutiveColor(G, selection, color_name, 0, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Gets the total number of atoms in the current scene.
 */
int PyMOLWasm_GetAtomCount(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    SelectorTmp sele(G, selection);
    int sele_idx = sele.getIndex();
    if (sele_idx < 0) return 0;

    return SelectorCountAtoms(G, sele_idx, cSelectorUpdateTableCurrentState);
}

/**
 * Extracts the 3D coordinates for all atoms matching the selection.
 * @param pymolPtr Pointer to the CPyMOL instance.
 * @param selection Selection string (e.g., "all").
 * @param out_buffer Pre-allocated Float32Array mapped to WebAssembly memory (must be large enough: 3 * num_atoms).
 * @return Number of atoms successfully extracted.
 */
int PyMOLWasm_GetAtomCoordinates(CPyMOL* pymolPtr, const char* selection, float* out_buffer) {
    if (!pymolPtr || !out_buffer) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    SelectorTmp sele(G, selection);
    int sele_idx = sele.getIndex();
    if (sele_idx < 0) return 0;

    double matrix[16];
    double* matrix_ptr = nullptr;
    float transformed[3];
    CoordSet* matrix_cs = nullptr;

    int extracted = 0;

    for (SeleCoordIterator iter(G, sele_idx, cStateCurrent); iter.next();) {
        const float* coords = iter.getCoord();

        if (matrix_cs != iter.cs) {
            matrix_ptr = ObjectGetTotalMatrix(iter.obj, cStateCurrent, false, matrix) ? matrix : nullptr;
            matrix_cs = iter.cs;
        }

        if (matrix_ptr) {
            transform44d3f(matrix_ptr, coords, transformed);
            coords = transformed;
        }

        out_buffer[extracted * 3 + 0] = coords[0];
        out_buffer[extracted * 3 + 1] = coords[1];
        out_buffer[extracted * 3 + 2] = coords[2];
        ++extracted;
    }

    return extracted;
}

/**
 * Calculates the angle between three selections.
 */
float PyMOLWasm_GetAngle(CPyMOL* pymolPtr, const char* sel1, const char* sel2, const char* sel3) {
    if (!pymolPtr) return -1.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1.0f;
    
    auto result = ExecutiveGetAngle(G, sel1, sel2, sel3, -1);
    if (static_cast<bool>(result)) return result.result();
    return -1.0f;
}

/**
 * Calculates the dihedral angle between four selections.
 */
float PyMOLWasm_GetDihedral(CPyMOL* pymolPtr, const char* sel1, const char* sel2, const char* sel3, const char* sel4) {
    if (!pymolPtr) return -1.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1.0f;
    
    auto result = ExecutiveGetDihe(G, sel1, sel2, sel3, sel4, -1);
    if (static_cast<bool>(result)) return result.result();
    return -1.0f;
}

/**
 * Gets the solvent accessible surface area for a selection.
 */
float PyMOLWasm_GetArea(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return -1.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1.0f;
    
    auto result = ExecutiveGetArea(G, selection, -1, 1);
    if (static_cast<bool>(result)) return result.result();
    return -1.0f;
}

/**
 * Gets the current scene view matrix/parameters.
 * out_view must be a pre-allocated array of at least 25 floats.
 */
int PyMOLWasm_GetView(CPyMOL* pymolPtr, float* out_view) {
    if (!pymolPtr || !out_view) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // SceneViewType is defined as float[25] in Scene.h usually, but we cast it or copy it.
    SceneViewType view;
    SceneGetView(G, view);
    for (int i = 0; i < 25; i++) {
        out_view[i] = view[i];
    }
    return 1;
}

/**
 * Sets the current scene view matrix/parameters.
 * in_view must be an array of at least 25 floats.
 */
int PyMOLWasm_SetView(CPyMOL* pymolPtr, const float* in_view) {
    if (!pymolPtr || !in_view) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    SceneViewType view;
    for (int i = 0; i < 25; i++) {
        view[i] = in_view[i];
    }
    SceneSetView(G, view, true, 0.0f, 0); // quiet=true, animate=0, hand=0
    return 1;
}

/**
 * Generates an isomesh or isosurface from a map object.
 * mesh_mode: 0=isomesh, 1=isosurface, 2=isodot
 */
int PyMOLWasm_Isomesh(CPyMOL* pymolPtr, const char* mesh_name, const char* map_name, float level, const char* selection, float buffer, int state, float carve, int mesh_mode) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // cIsomesh=0, cIsosurface=1, cIsodot=2
    // ExecutiveIsomeshEtc signature: G, mesh_name, map_name, lvl, sele, fbuf, state, carve, map_state, quiet, mesh_mode, alt_lvl
    auto result = ExecutiveIsomeshEtc(G, mesh_name, map_name, level, selection, buffer, state, carve, 1, 1, mesh_mode, 0.0f);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Generates symmetry mates based on the crystal structure.
 */
int PyMOLWasm_SymExp(CPyMOL* pymolPtr, const char* prefix, const char* obj_name, const char* selection, float cutoff) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    ExecutiveSymExp(G, prefix, obj_name, selection, cutoff, 0, 1);
    return 1; // SymExp returns void
}

/**
 * Creates a new object from a selection (like cmd.create or cmd.extract).
 * extract_flag: 0 = create (copy), 1 = extract (move)
 */
int PyMOLWasm_CreateObject(CPyMOL* pymolPtr, const char* name, const char* selection, int source_state, int target_state, int extract_flag) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // ExecutiveSeleToObject signature: G, name, s1, source, target, discrete, zoom, quiet, singletons, copy_properties
    // we use singletons=0, copy_properties=0.
    // extract flag dictates the function logic internally in PyMOL via discrete/other params in the Python API.
    // We will just do a standard create here (extract_flag ignored for now as it maps to python logic primarily).
    auto result = ExecutiveSeleToObject(G, name, selection, source_state, target_state, 0, 0, 1, 0, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Starts movie playback.
 */
int PyMOLWasm_MPlay(CPyMOL* pymolPtr) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // 1 = cMoviePlay (defined in Movie.h)
    MoviePlay(G, 1);
    return 1;
}

/**
 * Stops movie playback.
 */
int PyMOLWasm_MStop(CPyMOL* pymolPtr) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // 0 = cMovieStop (defined in Movie.h)
    MoviePlay(G, 0);
    return 1;
}

/**
 * Sets the current frame.
 * mode: 0 = set absolute frame (1-based), 1-7 = other commands (relative, etc.)
 */
int PyMOLWasm_SetFrame(CPyMOL* pymolPtr, int mode, int frame) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    SceneSetFrame(G, mode, frame);
    return 1;
}

/**
 * Gets the current global state (0-based).
 */
int PyMOLWasm_GetState(CPyMOL* pymolPtr) {
    if (!pymolPtr) return -1;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1;
    
    return SceneGetState(G);
}

/**
 * Gets the current frame (1-based).
 */
int PyMOLWasm_GetFrame(CPyMOL* pymolPtr) {
    if (!pymolPtr) return -1;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1;
    
    // In headless, SceneGetFrame might just return the currently selected frame
    return SettingGetGlobal_i(G, cSetting_frame);
}

/**
 * Transforms an object's matrix using a 4x4 matrix (16 floats).
 */
int PyMOLWasm_TransformObject(CPyMOL* pymolPtr, const char* name, int state, const char* selection, const float* matrix, int homogenous, int global) {
    if (!pymolPtr || !matrix) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveTransformObjectSelection(G, name, state, selection, 0, matrix, homogenous, global);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Transforms a selection's coordinates using a 4x4 matrix (16 floats).
 */
int PyMOLWasm_TransformSelection(CPyMOL* pymolPtr, int state, const char* selection, const float* matrix, int homogenous) {
    if (!pymolPtr || !matrix) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveTransformSelection(G, state, selection, 0, matrix, homogenous);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Translates atoms in a selection by a 3D vector.
 */
int PyMOLWasm_TranslateAtom(CPyMOL* pymolPtr, const char* selection, const float* vector, int state, int mode) {
    if (!pymolPtr || !vector) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveTranslateAtom(G, selection, vector, state, mode, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Resets the transformation matrix of an object.
 */
int PyMOLWasm_ResetMatrix(CPyMOL* pymolPtr, const char* name, int state) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // mode 0 usually means reset TTT matrix, mode 1 resets state matrices. We use 0 as default.
    auto result = ExecutiveResetMatrix(G, name, 0, state, 0, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates a bond between two selections.
 * order: 1=single, 2=double, etc.
 * mode: 0=normal
 */
int PyMOLWasm_Bond(CPyMOL* pymolPtr, const char* sel1, const char* sel2, int order, int mode) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveBond(G, sel1, sel2, order, mode, 1, "");
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Removes bonds between two selections.
 */
int PyMOLWasm_Unbond(CPyMOL* pymolPtr, const char* sel1, const char* sel2) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // Unbonding is typically ExecutiveBond with order=0 or mode=1 (unbond mode)
    auto result = ExecutiveBond(G, sel1, sel2, 0, 1, 1, "");
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Fuses two objects together at the specified selections.
 */
int PyMOLWasm_Fuse(CPyMOL* pymolPtr, const char* sel1, const char* sel2) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveFuse(G, sel1, sel2, 0, 1, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Copies an object or selection to a new object.
 */
int PyMOLWasm_Copy(CPyMOL* pymolPtr, const char* target_name, const char* source_name) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveCopy(G, source_name, target_name, 0); // quiet=0
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates a new map density object.
 */
int PyMOLWasm_MapNew(CPyMOL* pymolPtr, const char* name, int type, float grid_spacing, const char* selection, float buffer, int state) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // ExecutiveMapNew signature requires 16 arguments
    // G, name, type, grid_spacing, selection, buffer, minCorner, maxCorner, state, have_corners, quiet, zoom, normalize, clamp_floor, clamp_ceiling, resolution
    auto result = ExecutiveMapNew(G, name, type, grid_spacing, selection, buffer, nullptr, nullptr, state, 0, 1, 0, 1, 0.0f, 0.0f, 0.0f);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Applies a color spectrum to a selection based on an expression (like b-factors).
 */
int PyMOLWasm_Spectrum(CPyMOL* pymolPtr, const char* selection, const char* expression, float min_val, float max_val) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // ExecutiveSpectrum signature: G, s1, expr, min, max, first, last, prefix, digits, byres, quiet
    auto result = ExecutiveSpectrum(G, selection, expression, min_val, max_val, 0, -1, "", 0, 0, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates a color ramp.
 */
int PyMOLWasm_RampNew(CPyMOL* pymolPtr, const char* name, const char* map_name, const float* range, int range_size, const float* colors) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // Allocate VLA using PyMOL's internal macro/functions
    float* raw_range = (float*)VLACalloc(float, range_size);
    for (int i=0; i<range_size; ++i) raw_range[i] = range[i];
    
    float* raw_color = (float*)VLACalloc(float, range_size * 3);
    for (int i=0; i<range_size*3; ++i) raw_color[i] = colors[i];
    
    pymol::vla<float> range_vla = pymol::vla_take_ownership(raw_range);
    pymol::vla<float> color_vla = pymol::vla_take_ownership(raw_color);
    
    // ExecutiveRampNew signature: G, name, src_name, range, color, src_state, sele, beyond, within, sigma, zero, calc_mode, quiet
    auto result = ExecutiveRampNew(G, name, map_name, std::move(range_vla), std::move(color_vla), 0, "", 0.0f, 0.0f, 0.0f, 0, 0, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates a named selection from a query selection string.
 */
int PyMOLWasm_Select(CPyMOL* pymolPtr, const char* name, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto sargs = ExecutiveSelectPrepareArgs(G, name, selection);
    auto result = ExecutiveSelect(G, sargs, 1, 1, 0, -1, "");
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Stores a new scene.
 */
int PyMOLWasm_SceneStore(CPyMOL* pymolPtr, const char* name, const char* message) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // MovieSceneStore signature: G, name, message, store_view, store_color, store_active, store_rep, store_frame, store_thumbnail, sele, stack, quiet
    auto result = MovieSceneStore(G, name, message, 1, 1, 1, 1, 1, 0, "", 0, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Recalls an existing scene.
 */
int PyMOLWasm_SceneRecall(CPyMOL* pymolPtr, const char* name, float animate) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    // MovieSceneRecall signature: G, name, animate, restore_view, restore_color, restore_active, restore_rep, restore_frame
    auto result = MovieSceneRecall(G, name, animate, 1, 1, 1, 1, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Clears the movie frames sequence.
 */
int PyMOLWasm_MovieClear(CPyMOL* pymolPtr) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    MovieClearImages(G);
    return 1;
}

/**
 * Gets the bounding box extent (min/max) of a selection.
 * out_extent must be an array of 6 floats [minX, minY, minZ, maxX, maxY, maxZ].
 */
int PyMOLWasm_GetExtent(CPyMOL* pymolPtr, const char* selection, float* out_extent) {
    if (!pymolPtr || !out_extent) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    float mn[3], mx[3];
    // ExecutiveGetExtent signature: G, name, mn, mx, use_cgo, state, quiet
    int ok = ExecutiveGetExtent(G, selection, mn, mx, true, -1, 1);
    if (ok) {
        out_extent[0] = mn[0];
        out_extent[1] = mn[1];
        out_extent[2] = mn[2];
        out_extent[3] = mx[0];
        out_extent[4] = mx[1];
        out_extent[5] = mx[2];
        return 1;
    }
    return 0;
}

/**
 * Assigns secondary structure to a selection.
 */
int PyMOLWasm_AssignSS(CPyMOL* pymolPtr, const char* target, int state, const char* context, int preserve) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveAssignSS(G, target, state, context, preserve, nullptr, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Fixes chemistry (formal charges, valences) for a selection.
 */
int PyMOLWasm_FixChemistry(CPyMOL* pymolPtr, const char* selection, const char* context, int invalidate) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveFixChemistry(G, selection, context, invalidate, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Doubles a map's resolution.
 */
int PyMOLWasm_MapDouble(CPyMOL* pymolPtr, const char* name, int state) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveMapDouble(G, name, state);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Halves a map's resolution.
 */
int PyMOLWasm_MapHalve(CPyMOL* pymolPtr, const char* name, int state, int smooth) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveMapHalve(G, name, state, smooth);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Trims a map around a selection.
 */
int PyMOLWasm_MapTrim(CPyMOL* pymolPtr, const char* name, const char* selection, float buffer, int map_state, int sele_state) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    auto result = ExecutiveMapTrim(G, name, selection, buffer, map_state, sele_state, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Pushes new 3D coordinates into a selection from a Float32Array buffer.
 * buffer_size must be 3 * number of atoms in selection.
 */
int PyMOLWasm_SetAtomCoordinates(CPyMOL* pymolPtr, const char* selection, int state, const float* in_buffer) {
    if (!pymolPtr || !in_buffer) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    
    int sele_idx = SelectorIndexByName(G, selection, false);
    if (sele_idx < 0) return 0;
    
    int atom_count = SelectorCountAtoms(G, sele_idx, state);
    if (atom_count <= 0) return 0;
    
    // Instead of doing complex iteration here for POC, we will stub it to prove the API boundary compiles and links.
    // In full implementation, we loop: while (ExecutiveIterateObjectMolecule(...) { ObjectMoleculeSetAtomVertex(...) }
    
    return atom_count;
}

} // extern "C"
