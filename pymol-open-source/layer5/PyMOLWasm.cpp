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
#include "SceneView.h"
#include "Movie.h"
#include "MovieScene.h"
#include "Vector.h"
#include "Rep.h"
#include <cstring>
#include <climits>

// Compile-time guard: many functions assume the view is exactly 25 floats
static_assert(cSceneViewSize == 25, "SceneView size changed — update GetView/SetView buffer sizes");

/**
 * Returns "" if str is null. Safe for PyMOL selection parameters that
 * accept empty string as "all" or "no selection".
 */
static inline const char* safe_str(const char* str) {
    return str ? str : "";
}

/**
 * Maps a human-readable representation name to its internal integer ID.
 * Returns -1 for unrecognized names.
 */
static int rep_name_to_id(const char* rep_name) {
    if (!rep_name) return -1;
    if (strcmp(rep_name, "lines") == 0) return cRepLine;
    if (strcmp(rep_name, "spheres") == 0) return cRepSphere;
    if (strcmp(rep_name, "surface") == 0) return cRepSurface;
    if (strcmp(rep_name, "ribbon") == 0) return cRepRibbon;
    if (strcmp(rep_name, "cartoon") == 0) return cRepCartoon;
    if (strcmp(rep_name, "sticks") == 0) return cRepCyl;
    if (strcmp(rep_name, "mesh") == 0) return cRepMesh;
    if (strcmp(rep_name, "dots") == 0) return cRepDot;
    if (strcmp(rep_name, "labels") == 0) return cRepLabel;
    if (strcmp(rep_name, "nonbonded") == 0) return cRepNonbonded;
    if (strcmp(rep_name, "cell") == 0) return cRepCell;
    if (strcmp(rep_name, "cgo") == 0) return cRepCGO;
    if (strcmp(rep_name, "ellipsoids") == 0) return cRepEllipsoid;
    return -1;
}

extern "C" {

/**
 * Loads molecular data directly from a memory string.
 * @param pymolPtr Pointer to the CPyMOL instance.
 * @param oname Name of the object to create in PyMOL (must be non-null).
 * @param content The actual file content (must be non-null).
 * @param content_length Length of the content string (must be >= 0).
 * @param format Integer representing the format (e.g., 0 for auto, or specific cLoadTypePDB).
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_Load(CPyMOL* pymolPtr, const char* oname, const char* content, int content_length, int format) {
    if (!pymolPtr || !oname || !content || content_length < 0) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveLoad(G, "", content, content_length, static_cast<cLoadType_t>(format), oname, 0, -1, 0, 1, 0, 1, nullptr, nullptr, nullptr, -1);

    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'show' command.
 * @param rep_name Name of the representation (must be non-null).
 * @param selection Selection string (null-safe, defaults to "").
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_Show(CPyMOL* pymolPtr, const char* rep_name, const char* selection) {
    if (!pymolPtr || !rep_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    int rep_id = rep_name_to_id(rep_name);
    if (rep_id == -1) return 0;

    auto result = ExecutiveSetRepVisib(G, safe_str(selection), rep_id, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'hide' command.
 * @param rep_name Name of the representation (must be non-null), or "everything" to hide all.
 * @param selection Selection string (null-safe, defaults to "").
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_Hide(CPyMOL* pymolPtr, const char* rep_name, const char* selection) {
    if (!pymolPtr || !rep_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const char* sel = safe_str(selection);

    // Special case: hide all representations
    if (strcmp(rep_name, "everything") == 0) {
        for (int i = 0; i < cRepCnt; i++) {
            ExecutiveSetRepVisib(G, sel, i, 0);
        }
        return 1;
    }

    int rep_id = rep_name_to_id(rep_name);
    if (rep_id == -1) return 0;

    auto result = ExecutiveSetRepVisib(G, sel, rep_id, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'zoom' command.
 */
int PyMOLWasm_Zoom(CPyMOL* pymolPtr, const char* selection, float buffer) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveWindowZoom(G, safe_str(selection), buffer, -1, 0, 0, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'center' command.
 */
int PyMOLWasm_Center(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveCenter(G, safe_str(selection), -1, 1, 0, nullptr, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes an 'origin' command.
 */
int PyMOLWasm_Origin(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveOrigin(G, safe_str(selection), 0, nullptr, nullptr, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes a 'delete' command (removes entire objects).
 * @param name Object name (must be non-null).
 */
int PyMOLWasm_Delete(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr || !name) return 0;
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

    auto result = ExecutiveRemoveAtoms(G, safe_str(selection), 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Executes an 'align' command between two selections.
 * @param target Target selection (must be non-null).
 * @param mobile Mobile selection (must be non-null).
 * @return RMSD value on success, -1.0 on failure.
 */
float PyMOLWasm_Align(CPyMOL* pymolPtr, const char* target, const char* mobile) {
    if (!pymolPtr || !target || !mobile) return -1.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1.0f;

    std::vector<SelectorTmp> sele;
    sele.emplace_back(G, mobile);
    sele.emplace_back(G, target);

    float rmsd = ExecutiveRMSPairs(G, sele, 0, true);
    return rmsd;
}

/**
 * Calculates the distance between two selections.
 * @param sel1 First selection (must be non-null).
 * @param sel2 Second selection (must be non-null).
 */
float PyMOLWasm_GetDistance(CPyMOL* pymolPtr, const char* sel1, const char* sel2) {
    if (!pymolPtr || !sel1 || !sel2) return -1.0f;
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
 * @param color_name Color name (must be non-null).
 * @param selection Selection string (null-safe, defaults to "").
 */
int PyMOLWasm_Color(CPyMOL* pymolPtr, const char* color_name, const char* selection) {
    if (!pymolPtr || !color_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveColor(G, safe_str(selection), color_name, 0, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Gets the total number of atoms in the current scene.
 */
int PyMOLWasm_GetAtomCount(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    SelectorTmp sele(G, safe_str(selection));
    int sele_idx = sele.getIndex();
    if (sele_idx < 0) return 0;

    return SelectorCountAtoms(G, sele_idx, cSelectorUpdateTableCurrentState);
}

/**
 * Extracts the 3D coordinates for all atoms matching the selection.
 * @param out_buffer Pre-allocated Float32Array mapped to WebAssembly memory.
 * @param buffer_size Number of floats that fit in out_buffer (must be >= 3 * num_atoms).
 * @return Number of atoms successfully extracted.
 */
int PyMOLWasm_GetAtomCoordinates(CPyMOL* pymolPtr, const char* selection, float* out_buffer, int buffer_size) {
    if (!pymolPtr || !out_buffer || buffer_size < 3) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    SelectorTmp sele(G, safe_str(selection));
    int sele_idx = sele.getIndex();
    if (sele_idx < 0) return 0;

    double matrix[16];
    double* matrix_ptr = nullptr;
    float transformed[3];
    CoordSet* matrix_cs = nullptr;

    int extracted = 0;
    int max_atoms = buffer_size / 3;

    for (SeleCoordIterator iter(G, sele_idx, cStateCurrent); iter.next();) {
        if (extracted >= max_atoms) break;

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
 * @param sel1, sel2, sel3 Selection strings (must be non-null).
 */
float PyMOLWasm_GetAngle(CPyMOL* pymolPtr, const char* sel1, const char* sel2, const char* sel3) {
    if (!pymolPtr || !sel1 || !sel2 || !sel3) return -1.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1.0f;

    auto result = ExecutiveGetAngle(G, sel1, sel2, sel3, -1);
    if (static_cast<bool>(result)) return result.result();
    return -1.0f;
}

/**
 * Calculates the dihedral angle between four selections.
 * @param sel1, sel2, sel3, sel4 Selection strings (must be non-null).
 */
float PyMOLWasm_GetDihedral(CPyMOL* pymolPtr, const char* sel1, const char* sel2, const char* sel3, const char* sel4) {
    if (!pymolPtr || !sel1 || !sel2 || !sel3 || !sel4) return -1.0f;
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

    auto result = ExecutiveGetArea(G, safe_str(selection), -1, 1);
    if (static_cast<bool>(result)) return result.result();
    return -1.0f;
}

/**
 * Gets the current scene view matrix/parameters.
 * out_view must be a pre-allocated array of at least cSceneViewSize (25) floats.
 */
int PyMOLWasm_GetView(CPyMOL* pymolPtr, float* out_view) {
    if (!pymolPtr || !out_view) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    SceneViewType view;
    SceneGetView(G, view);
    for (int i = 0; i < cSceneViewSize; i++) {
        out_view[i] = view[i];
    }
    return 1;
}

/**
 * Sets the current scene view matrix/parameters.
 * in_view must be an array of at least cSceneViewSize (25) floats.
 */
int PyMOLWasm_SetView(CPyMOL* pymolPtr, const float* in_view) {
    if (!pymolPtr || !in_view) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    SceneViewType view;
    for (int i = 0; i < cSceneViewSize; i++) {
        view[i] = in_view[i];
    }
    SceneSetView(G, view, true, 0.0f, 0);
    return 1;
}

/**
 * Generates an isomesh or isosurface from a map object.
 * @param mesh_name Name for the new mesh (must be non-null).
 * @param map_name Source map object name (must be non-null).
 * @param selection Selection string (null-safe).
 * mesh_mode: 0=isomesh, 1=isosurface, 2=isodot
 */
int PyMOLWasm_Isomesh(CPyMOL* pymolPtr, const char* mesh_name, const char* map_name, float level, const char* selection, float buffer, int state, float carve, int mesh_mode) {
    if (!pymolPtr || !mesh_name || !map_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveIsomeshEtc(G, mesh_name, map_name, level, safe_str(selection), buffer, state, carve, 1, 1, mesh_mode, 0.0f);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Generates symmetry mates based on the crystal structure.
 * @param prefix Prefix for generated objects (must be non-null).
 * @param obj_name Source object name (must be non-null).
 * @param selection Selection string (null-safe).
 */
int PyMOLWasm_SymExp(CPyMOL* pymolPtr, const char* prefix, const char* obj_name, const char* selection, float cutoff) {
    if (!pymolPtr || !prefix || !obj_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    ExecutiveSymExp(G, prefix, obj_name, safe_str(selection), cutoff, 0, 1);
    return 1;
}

/**
 * Creates a new object from a selection.
 * @param name Name for the new object (must be non-null).
 * @param selection Source selection (null-safe).
 */
int PyMOLWasm_CreateObject(CPyMOL* pymolPtr, const char* name, const char* selection, int source_state, int target_state, int extract_flag) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveSeleToObject(G, name, safe_str(selection), source_state, target_state, 0, 0, 1, 0, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Starts movie playback.
 */
int PyMOLWasm_MPlay(CPyMOL* pymolPtr) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

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

    return SettingGetGlobal_i(G, cSetting_frame);
}

/**
 * Transforms an object's matrix using a 4x4 matrix (16 floats).
 * @param name Object name (must be non-null).
 * @param selection Selection string (null-safe).
 * @param matrix 4x4 transformation matrix (must be non-null).
 */
int PyMOLWasm_TransformObject(CPyMOL* pymolPtr, const char* name, int state, const char* selection, const float* matrix, int homogenous, int global) {
    if (!pymolPtr || !name || !matrix) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveTransformObjectSelection(G, name, state, safe_str(selection), 0, matrix, homogenous, global);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Transforms a selection's coordinates using a 4x4 matrix (16 floats).
 * @param selection Selection string (null-safe).
 * @param matrix 4x4 transformation matrix (must be non-null).
 */
int PyMOLWasm_TransformSelection(CPyMOL* pymolPtr, int state, const char* selection, const float* matrix, int homogenous) {
    if (!pymolPtr || !matrix) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveTransformSelection(G, state, safe_str(selection), 0, matrix, homogenous);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Translates atoms in a selection by a 3D vector.
 * @param selection Selection string (null-safe).
 * @param vector 3D translation vector (must be non-null).
 */
int PyMOLWasm_TranslateAtom(CPyMOL* pymolPtr, const char* selection, const float* vector, int state, int mode) {
    if (!pymolPtr || !vector) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveTranslateAtom(G, safe_str(selection), vector, state, mode, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Resets the transformation matrix of an object.
 * @param name Object name (must be non-null).
 */
int PyMOLWasm_ResetMatrix(CPyMOL* pymolPtr, const char* name, int state) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveResetMatrix(G, name, 0, state, 0, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates a bond between two selections.
 * @param sel1, sel2 Selection strings (must be non-null).
 */
int PyMOLWasm_Bond(CPyMOL* pymolPtr, const char* sel1, const char* sel2, int order, int mode) {
    if (!pymolPtr || !sel1 || !sel2) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveBond(G, sel1, sel2, order, mode, 1, "");
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Removes bonds between two selections.
 * @param sel1, sel2 Selection strings (must be non-null).
 */
int PyMOLWasm_Unbond(CPyMOL* pymolPtr, const char* sel1, const char* sel2) {
    if (!pymolPtr || !sel1 || !sel2) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveBond(G, sel1, sel2, 0, 1, 1, "");
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Fuses two objects together at the specified selections.
 * @param sel1, sel2 Selection strings (must be non-null).
 */
int PyMOLWasm_Fuse(CPyMOL* pymolPtr, const char* sel1, const char* sel2) {
    if (!pymolPtr || !sel1 || !sel2) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveFuse(G, sel1, sel2, 0, 1, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Copies an object or selection to a new object.
 * @param target_name Destination name (must be non-null).
 * @param source_name Source name (must be non-null).
 */
int PyMOLWasm_Copy(CPyMOL* pymolPtr, const char* target_name, const char* source_name) {
    if (!pymolPtr || !target_name || !source_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveCopy(G, source_name, target_name, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates a new map density object.
 * @param name Map name (must be non-null).
 * @param selection Selection string (null-safe).
 */
int PyMOLWasm_MapNew(CPyMOL* pymolPtr, const char* name, int type, float grid_spacing, const char* selection, float buffer, int state) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveMapNew(G, name, type, grid_spacing, safe_str(selection), buffer, nullptr, nullptr, state, 0, 1, 0, 1, 0.0f, 0.0f, 0.0f);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Applies a color spectrum to a selection based on an expression.
 * @param selection Selection string (null-safe).
 * @param expression Expression to color by, e.g. "b" for b-factors (null-safe).
 */
int PyMOLWasm_Spectrum(CPyMOL* pymolPtr, const char* selection, const char* expression, float min_val, float max_val) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveSpectrum(G, safe_str(selection), safe_str(expression), min_val, max_val, 0, -1, "", 0, 0, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates a color ramp.
 * @param name Ramp name (must be non-null).
 * @param map_name Source map name (must be non-null).
 * @param range Array of range values (must be non-null).
 * @param range_size Number of range values (must be > 0 and <= INT_MAX/3).
 * @param colors Array of RGB color values, 3 per range value (must be non-null).
 */
int PyMOLWasm_RampNew(CPyMOL* pymolPtr, const char* name, const char* map_name, const float* range, int range_size, const float* colors) {
    if (!pymolPtr || !name || !map_name || !range || !colors) return 0;
    if (range_size <= 0 || range_size > INT_MAX / 3) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    float* raw_range = (float*)VLACalloc(float, range_size);
    if (!raw_range) return 0;
    for (int i = 0; i < range_size; ++i) raw_range[i] = range[i];

    float* raw_color = (float*)VLACalloc(float, range_size * 3);
    if (!raw_color) {
        VLAFreeP(raw_range);
        return 0;
    }
    for (int i = 0; i < range_size * 3; ++i) raw_color[i] = colors[i];

    pymol::vla<float> range_vla = pymol::vla_take_ownership(raw_range);
    pymol::vla<float> color_vla = pymol::vla_take_ownership(raw_color);

    auto result = ExecutiveRampNew(G, name, map_name, std::move(range_vla), std::move(color_vla), 0, "", 0.0f, 0.0f, 0.0f, 0, 0, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates a named selection from a query selection string.
 * @param name Selection name (must be non-null).
 * @param selection Query string (null-safe).
 */
int PyMOLWasm_Select(CPyMOL* pymolPtr, const char* name, const char* selection) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto sargs = ExecutiveSelectPrepareArgs(G, name, safe_str(selection));
    auto result = ExecutiveSelect(G, sargs, 1, 1, 0, -1, "");
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Stores a new scene.
 * @param name Scene name (must be non-null).
 * @param message Scene message (null-safe).
 */
int PyMOLWasm_SceneStore(CPyMOL* pymolPtr, const char* name, const char* message) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = MovieSceneStore(G, name, safe_str(message), 1, 1, 1, 1, 1, 0, "", 0, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Recalls an existing scene.
 * @param name Scene name (must be non-null).
 */
int PyMOLWasm_SceneRecall(CPyMOL* pymolPtr, const char* name, float animate) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

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
    int ok = ExecutiveGetExtent(G, safe_str(selection), mn, mx, true, -1, 1);
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
 * @param target Target selection (null-safe).
 * @param context Context selection (null-safe).
 */
int PyMOLWasm_AssignSS(CPyMOL* pymolPtr, const char* target, int state, const char* context, int preserve) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveAssignSS(G, safe_str(target), state, safe_str(context), preserve, nullptr, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Fixes chemistry (formal charges, valences) for a selection.
 * @param selection Selection string (null-safe).
 * @param context Context selection (null-safe).
 */
int PyMOLWasm_FixChemistry(CPyMOL* pymolPtr, const char* selection, const char* context, int invalidate) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveFixChemistry(G, safe_str(selection), safe_str(context), invalidate, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Doubles a map's resolution.
 * @param name Map name (must be non-null).
 */
int PyMOLWasm_MapDouble(CPyMOL* pymolPtr, const char* name, int state) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveMapDouble(G, name, state);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Halves a map's resolution.
 * @param name Map name (must be non-null).
 */
int PyMOLWasm_MapHalve(CPyMOL* pymolPtr, const char* name, int state, int smooth) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveMapHalve(G, name, state, smooth);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Trims a map around a selection.
 * @param name Map name (must be non-null).
 * @param selection Selection string (null-safe).
 */
int PyMOLWasm_MapTrim(CPyMOL* pymolPtr, const char* name, const char* selection, float buffer, int map_state, int sele_state) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveMapTrim(G, name, safe_str(selection), buffer, map_state, sele_state, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Pushes new 3D coordinates into a selection from a Float32Array buffer.
 * @param selection Selection string (null-safe).
 * @param in_buffer Input coordinate buffer (must be non-null).
 * @param buffer_size Number of floats in in_buffer (must be >= 3).
 * @return Number of atoms successfully set.
 */
int PyMOLWasm_SetAtomCoordinates(CPyMOL* pymolPtr, const char* selection, int state, const float* in_buffer, int buffer_size) {
    if (!pymolPtr || !in_buffer || buffer_size < 3) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    SelectorTmp sele(G, safe_str(selection));
    int sele_idx = sele.getIndex();
    if (sele_idx < 0) return 0;

    int set_count = 0;
    int max_atoms = buffer_size / 3;

    for (SeleCoordIterator iter(G, sele_idx, state == -1 ? cStateCurrent : state); iter.next();) {
        if (set_count >= max_atoms) break;

        float* coords = iter.getCoord();
        if (coords) {
            coords[0] = in_buffer[set_count * 3 + 0];
            coords[1] = in_buffer[set_count * 3 + 1];
            coords[2] = in_buffer[set_count * 3 + 2];
            ++set_count;
        }
    }

    return set_count;
}

} // extern "C"
