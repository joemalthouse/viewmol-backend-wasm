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
#include "SceneDef.h"
#include "SceneRay.h"
#include "SceneView.h"
#include "Ray.h"
#include "RayBackend.h"
#include "Color.h"
#include "Movie.h"
#include "MovieScene.h"
#include "Vector.h"
#include "Rep.h"
#include "P.h"
#include "Lex.h"
#include "Seq.h"
#include "MoleculeExporter.h"
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

/**
 * Serializes a vector of C-strings to a JSON array string.
 */
static std::string cstr_vec_to_json(const std::vector<const char*>& items) {
    std::string json = "[";
    for (size_t i = 0; i < items.size(); i++) {
        if (i > 0) json += ",";
        json += "\"";
        const char* s = items[i] ? items[i] : "";
        while (*s) {
            if (*s == '"' || *s == '\\') json += '\\';
            json += *s;
            s++;
        }
        json += "\"";
    }
    json += "]";
    return json;
}

/**
 * Allocates a malloc'd copy of a string and writes it to *out_ptr.
 * Returns the string length (excluding null terminator).
 */
static int alloc_output_string(const std::string& str, char** out_ptr) {
    char* buf = static_cast<char*>(malloc(str.size() + 1));
    if (!buf) return 0;
    std::memcpy(buf, str.c_str(), str.size() + 1);
    *out_ptr = buf;
    return static_cast<int>(str.size());
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

    int repmask = (rep_id == cRepAll) ? cRepBitmask : (1 << rep_id);
    auto result = ExecutiveSetRepVisMaskFromSele(G, safe_str(selection), repmask, 1);
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
        auto result = ExecutiveSetRepVisMaskFromSele(G, sel, cRepBitmask, 0);
        return static_cast<bool>(result) ? 1 : 0;
    }

    int rep_id = rep_name_to_id(rep_name);
    if (rep_id == -1) return 0;

    int repmask = (rep_id == cRepAll) ? cRepBitmask : (1 << rep_id);
    auto result = ExecutiveSetRepVisMaskFromSele(G, sel, repmask, 0);
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
 * Sets a per-object/selection setting.
 * @param setting_index Setting index from SettingInfo.h.
 * @param value Numeric value (float or int cast to float).
 * @param selection Selection or object name to apply the setting to.
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_SetSettingForSelection(CPyMOL* pymolPtr, int setting_index, float value, const char* selection) {
    if (!pymolPtr || !selection || !selection[0]) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    char value_str[64];
    snprintf(value_str, sizeof(value_str), "%g", value);
    return ExecutiveSetSettingFromString(G, setting_index, value_str,
                                         selection, -1 /* state */, 1 /* quiet */, 0 /* updates */);
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

    auto result = ExecutiveColorFromSele(G, safe_str(selection), color_name, 0, 0);
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
 * Rotates the scene view around the specified axis.
 * Equivalent to PyMOL's `turn axis, angle` command.
 * @param axis 'x', 'y', or 'z'.
 * @param angle Angle in degrees.
 */
int PyMOLWasm_Turn(CPyMOL* pymolPtr, char axis, float angle) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    SceneRotateAxis(G, angle, axis);
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
 * Palette lookup table — maps palette names to (prefix, digits, first, last).
 * Derived from pymol/constants_palette.py. Used by PyMOLWasm_Spectrum to call
 * ExecutiveSpectrum directly (PyMOL_Spectrum is behind _PYMOL_LIB guard).
 */
struct PaletteEntry {
    const char* name;
    const char* prefix;
    int digits;
    int first;
    int last;
};

static const PaletteEntry palette_table[] = {
    {"rainbow_cycle",       "o", 3,   0, 999},
    {"rainbow_cycle_rev",   "o", 3, 999,   0},
    {"rainbow",             "o", 3, 107, 893},
    {"rainbow_rev",         "o", 3, 893, 107},
    {"rainbow2",            "s", 3, 167, 833},
    {"rainbow2_rev",        "s", 3, 833, 167},
    {"gcbmry",              "r", 3, 166, 999},
    {"yrmbcg",              "r", 3, 999, 166},
    {"cbmr",                "r", 3, 166, 833},
    {"rmbc",                "r", 3, 833, 166},
    {"green_yellow_red",    "s", 3, 500, 833},
    {"blue_white_red",      "w", 3,  83, 167},
    {"red_white_blue",      "w", 3, 167,  83},
    {"blue_white_magenta",  "w", 3, 167, 500},
    {"magenta_white_blue",  "w", 3, 500, 167},
    {"red_white_green",     "w", 3, 833, 333},
    {"green_white_red",     "w", 3, 333, 833},
    {"blue_green",          "w", 3, 167, 333},
    {"green_blue",          "w", 3, 333, 167},
    {"yellow_cyan_white",   "s", 3, 333, 167},
    {"yellow_white_green",  "w", 3, 500, 333},
    {"green_white_yellow",  "w", 3, 333, 500},
    {"white_green_yellow",  "w", 3,   1, 500},
    {"white_magenta_green", "w", 3,   1, 333},
    {"green_white_magenta", "w", 3, 333,   1},
    {"white_yellow_green",  "w", 3,   1, 667},
    {"green_yellow_white",  "w", 3, 667,   1},
    {nullptr, nullptr, 0, 0, 0}  // sentinel
};

/**
 * Applies a color spectrum to a selection based on an expression.
 * @param selection Selection string (null-safe).
 * @param expression Expression to color by, e.g. "b" for b-factors, "count" for rainbow (null-safe).
 * @param palette Palette name, e.g. "rainbow", "red_white_blue" (null-safe, defaults to "rainbow").
 */
int PyMOLWasm_Spectrum(CPyMOL* pymolPtr, const char* selection, const char* expression, const char* palette, float min_val, float max_val) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);

    const char* pal = (palette && palette[0]) ? palette : "rainbow";

    // Look up palette in static table
    const char* prefix = "o";
    int digits = 3;
    int first = 107;
    int last = 893;

    for (const auto& entry : palette_table) {
        if (!entry.name) break;
        if (strcmp(entry.name, pal) == 0) {
            prefix = entry.prefix;
            digits = entry.digits;
            first = entry.first;
            last = entry.last;
            break;
        }
    }

    // Match native PyMOL behavior: when min==0 and max==0 (unspecified),
    // pass max=-1 so ExecutiveSpectrum auto-detects the range (it triggers
    // auto-detect when max < min).
    float eff_min = min_val;
    float eff_max = max_val;
    if (eff_min == 0.0f && eff_max == 0.0f) {
        eff_max = -1.0f;
    }

    auto result = ExecutiveSpectrum(G, safe_str(selection), safe_str(expression),
                                    eff_min, eff_max, first, last, prefix, digits,
                                    0 /* byres */, 1 /* quiet */);
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

/**
 * Extracts the ray scene as a JSON string for external GPU ray tracing.
 * Replicates SceneRay()'s primitive collection pipeline, then serialises
 * the CRay data via RayBackend into viewmol-ray-v2 JSON.
 *
 * @param width Ray image width (0 = use scene width).
 * @param height Ray image height (0 = use scene height).
 * @param out_ptr Pointer to a char* that will receive the malloc'd JSON buffer.
 *                Caller must free() this buffer when done.
 * @return Length of JSON (excluding null terminator), or 0 on failure.
 */
int PyMOLWasm_GetRayScene(CPyMOL* pymolPtr, int width, int height, char** out_ptr, int /*unused*/) {
    if (!pymolPtr || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

#ifdef _PYMOL_NO_RAY
    return 0;
#endif

    CScene *I = G->Scene;
    if (!I) return 0;

    // Set scene dimensions to match ray output (equivalent to cmd.viewport)
    // This ensures pixel_scale_value calculations match native PyMOL
    if (width > 0 && height > 0) {
        I->Width = width;
        I->Height = height;
    }

    // Update scene state
    SceneUpdate(G, false);

    // Determine dimensions
    int ray_width = width > 0 ? width : I->Width;
    int ray_height = height > 0 ? height : I->Height;
    if (ray_width <= 0 || ray_height <= 0) return 0;

    float fov = SettingGetGlobal_f(G, cSetting_field_of_view);
    int ortho = SettingGetGlobal_i(G, cSetting_ray_orthoscopic);
    if (ortho < 0)
        ortho = SettingGetGlobal_b(G, cSetting_ortho);

    float aspRat = ((float) ray_width) / ((float) ray_height);

    // Seed RNG for deterministic random table (matches native PyMOL headless)
    srand(0);

    // Create ray object
    CRay* ray = RayNew(G, 0); // no antialiasing for scene export
    if (!ray) return 0;

    // Set up view matrix (non-stereo)
    float rayView[16];
    float angle = 0.0f;
    SceneRaySetRayView(G, I, 0, rayView, &angle, 0.0f);

    // Compute viewing volume and call RayPrepare
    float view_height = (float)(fabs(I->m_view.pos().z) * tan((fov / 2.0) * cPI / 180.0));
    float view_width = view_height * aspRat;

    float pixel_scale_value = SettingGetGlobal_f(G, cSetting_ray_pixel_scale);
    if (pixel_scale_value < 0)
        pixel_scale_value = 1.0f;
    pixel_scale_value *= ((float) ray_height) / I->Height;

    if (ortho) {
        const float _1 = 1.0f;
        RayPrepare(ray, -view_width, view_width, -view_height, view_height,
                   I->m_view.m_clipSafe().m_front, I->m_view.m_clipSafe().m_back,
                   fov, I->m_view.pos(), rayView, I->m_view.rotMatrix(),
                   aspRat, ray_width, ray_height,
                   pixel_scale_value, ortho, _1, _1,
                   ((float) ray_height) / I->Height);
    } else {
        float pos_z = I->m_view.pos().z;
        if ((-pos_z) < I->m_view.m_clipSafe().m_front)
            pos_z = -I->m_view.m_clipSafe().m_front;

        float back_ratio = -I->m_view.m_clipSafe().m_back / pos_z;
        float back_height = back_ratio * view_height;
        float back_width = aspRat * back_height;
        RayPrepare(ray,
                   -back_width, back_width, -back_height, back_height,
                   I->m_view.m_clipSafe().m_front, I->m_view.m_clipSafe().m_back,
                   fov, I->m_view.pos(), rayView, I->m_view.rotMatrix(),
                   aspRat, ray_width, ray_height,
                   pixel_scale_value, ortho,
                   view_height / back_height,
                   I->m_view.m_clipSafe().m_front / I->m_view.m_clipSafe().m_back,
                   ((float) ray_height) / I->Height);
    }

    // Collect primitives from all objects
    {
        auto slot_vla = I->m_slots.data();
        RenderInfo info;
        info.ray = ray;
        info.ortho = ortho;
        info.vertex_scale = SceneGetScreenVertexScale(G, nullptr);
        info.use_shaders = SettingGetGlobal_b(G, cSetting_use_shaders);

        if (SettingGetGlobal_b(G, cSetting_dynamic_width)) {
            info.dynamic_width = true;
            info.dynamic_width_factor = SettingGetGlobal_f(G, cSetting_dynamic_width_factor);
            info.dynamic_width_min = SettingGetGlobal_f(G, cSetting_dynamic_width_min);
            info.dynamic_width_max = SettingGetGlobal_f(G, cSetting_dynamic_width_max);
        }

        for (auto* obj : I->Obj) {
            if (obj->type != cObjectGroup) {
                if (SceneGetDrawFlag(&I->grid, slot_vla, obj->grid_slot)) {
                    float color[3];
                    ColorGetEncoded(G, obj->Color, color);
                    RaySetContext(ray, obj->getRenderContext());
                    ray->color3fv(color);

                    auto icx = SettingGetWD<int>(
                        obj->Setting.get(), cSetting_ray_interior_color, cColorDefault);

                    if (icx == cColorDefault) {
                        ray->interiorColor3fv(color, true);
                    } else if (icx == cColorObject) {
                        ray->interiorColor3fv(color, false);
                    } else {
                        float icolor[3];
                        ColorGetEncoded(G, icx, icolor);
                        ray->interiorColor3fv(icolor, false);
                    }

                    info.state = ObjectGetCurrentState(obj, false);
                    obj->render(&info);
                }
            }
        }
    }

    // Build and serialize scene packet
    auto packet = pymol::ray::buildScenePacket(ray);
    std::string json = pymol::ray::serializeScenePacketJSON(packet);

    RayFree(ray);

    int json_len = static_cast<int>(json.size());

    // Allocate output buffer via malloc (caller frees)
    char* buf = static_cast<char*>(malloc(json_len + 1));
    if (!buf) return 0;

    std::memcpy(buf, json.c_str(), json_len + 1);
    *out_ptr = buf;
    return json_len;
}

/**
 * Labels atoms matching a selection with an expression.
 * Uses the alternate (non-Python) expression evaluator, supporting
 * properties: name, resn, resi, resv, chain, alt, elem, type, q, b,
 * segi, ID, rank, index, model, and literal strings in quotes.
 *
 * @param selection  Atom selection expression (e.g., "all", "name CA").
 * @param expression Label expression (e.g., "name", "resn+resi").
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_Label(CPyMOL* pymolPtr, const char* selection, const char* expression) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const char* sel = safe_str(selection);
    const char* expr = expression ? expression : "";

    auto result = ExecutiveLabel(G, sel, expr, 1, cExecutiveLabelEvalAlt);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Sets a setting using a string value, supporting color names (e.g. "red"),
 * on/off toggles, and other non-numeric setting values.
 *
 * @param setting_index  PyMOL setting index.
 * @param value          String value (e.g. "red", "on", "off").
 * @param selection      Optional selection/object name. Empty string for global.
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_SetSettingString(CPyMOL* pymolPtr, int setting_index,
                               const char* value, const char* selection) {
    if (!pymolPtr || !value) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const char* sel = selection ? selection : "";
    return ExecutiveSetSettingFromString(G, setting_index, value, sel, -1, 1, 1);
}

/**
 * Creates a distance measurement object between two selections.
 *
 * @param name     Name for the distance object.
 * @param sel1     First selection.
 * @param sel2     Second selection.
 * @param mode     Distance mode (0=all pairs, 1=min, etc.).
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_Distance(CPyMOL* pymolPtr, const char* name,
                       const char* sel1, const char* sel2, int mode) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const char* nm = safe_str(name);
    const char* s1 = safe_str(sel1);
    const char* s2 = safe_str(sel2);

    auto result = ExecutiveDistance(G, nm, s1, s2, mode, -1.0f, 1, 1, 0, -1, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

// ============================================================
// Viewing / Display
// ============================================================

/**
 * Enables (shows) an object in the object panel.
 * @param name Object name (must be non-null).
 */
int PyMOLWasm_Enable(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetObjVisib(G, name, 1, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Disables (hides) an object in the object panel.
 * @param name Object name (must be non-null).
 */
int PyMOLWasm_Disable(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetObjVisib(G, name, 0, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Orients the view to show a selection with its principal axes aligned.
 * @param selection Selection string (null-safe, defaults to "all").
 */
int PyMOLWasm_Orient(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveOrient(G, safe_str(selection), -1, 0.0f, 0, 0.0f, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Adjusts clipping planes.
 * @param mode Clipping mode: "near", "far", "move", "slab", "atoms", etc.
 * @param movement Distance to move the clipping plane (positive = away from camera).
 * @param selection Selection for atom-based clipping (null-safe).
 */
int PyMOLWasm_Clip(CPyMOL* pymolPtr, const char* mode, float movement,
                   const char* selection) {
    if (!pymolPtr || !mode) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = SceneClipFromMode(G, mode, movement, safe_str(selection), -1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Moves the camera along an axis.
 * @param axis Axis name: "x", "y", or "z" (must be non-null).
 * @param dist Distance to move.
 */
int PyMOLWasm_Move(CPyMOL* pymolPtr, const char* axis, float dist) {
    if (!pymolPtr || !axis) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveMove(G, axis, dist);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Resets the view or a named object to its initial state.
 * @param name Object name (null-safe, empty resets view).
 */
int PyMOLWasm_Reset(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveReset(G, safe_str(name));
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Sets the background color by name.
 * @param color Color name, e.g. "white", "black" (must be non-null).
 */
int PyMOLWasm_BgColor(CPyMOL* pymolPtr, const char* color) {
    if (!pymolPtr || !color) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveBackgroundColor(G, color);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Sets the cartoon type for a selection.
 * @param type Cartoon type (0=automatic, 1=loop, 2=rect, 3=oval, etc.).
 * @param selection Selection string (null-safe).
 */
int PyMOLWasm_Cartoon(CPyMOL* pymolPtr, int type, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveCartoon(G, type, safe_str(selection));
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Toggles the visibility of a representation for a selection.
 * @param rep Representation name (e.g. "cartoon", "sticks").
 * @param selection Selection string (null-safe).
 */
int PyMOLWasm_Toggle(CPyMOL* pymolPtr, const char* rep, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    int rep_id = rep_name_to_id(rep);
    if (rep_id < 0) return 0;
    auto result = ExecutiveToggleRepVisib(G, safe_str(selection), rep_id);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Forces a rebuild of all representations.
 */
int PyMOLWasm_Rebuild(CPyMOL* pymolPtr) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    ExecutiveRebuildAll(G);
    return 1;
}

/**
 * Creates a volume object from a map.
 * @param volume_name Name for the volume object (must be non-null).
 * @param map_name Source map name (must be non-null).
 * @param level Contour level.
 * @param selection Selection string (null-safe).
 * @param buffer Buffer distance around selection.
 * @param state Object state.
 * @param carve Carve distance (0 = no carving).
 * @param map_state Map state to use.
 */
int PyMOLWasm_Volume(CPyMOL* pymolPtr, const char* volume_name,
                     const char* map_name, float level, const char* selection,
                     float buffer, int state, float carve, int map_state) {
    if (!pymolPtr || !volume_name || !map_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveVolume(G, volume_name, map_name, level,
                                  safe_str(selection), buffer, state, carve,
                                  map_state, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Sets the contour level for an isomesh/isosurface object.
 * @param name Object name (must be non-null).
 * @param level New contour level.
 * @param state Object state (-1 for all).
 */
int PyMOLWasm_Isolevel(CPyMOL* pymolPtr, const char* name, float level,
                       int state) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveIsolevel(G, name, level, state, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// ============================================================
// Structure Manipulation
// ============================================================

/**
 * Adds hydrogens to a selection.
 * @param selection Selection string (null-safe, defaults to "all").
 */
int PyMOLWasm_HAdd(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveAddHydrogens(G, safe_str(selection), 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Protects or deprotects atoms from modification.
 * @param selection Selection string (null-safe).
 * @param mode 1 = protect, 0 = deprotect.
 */
int PyMOLWasm_Protect(CPyMOL* pymolPtr, const char* selection, int mode) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveProtect(G, safe_str(selection), mode, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Masks or unmasks atoms from selection.
 * @param selection Selection string (null-safe).
 * @param mode 1 = mask, 0 = unmask.
 */
int PyMOLWasm_Mask(CPyMOL* pymolPtr, const char* selection, int mode) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveMask(G, safe_str(selection), mode, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Sets atom flags.
 * @param flag Flag index.
 * @param selection Selection string (null-safe).
 * @param action 0 = reset, 1 = set, 2 = clear.
 */
int PyMOLWasm_Flag(CPyMOL* pymolPtr, int flag, const char* selection,
                   int action) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveFlag(G, flag, safe_str(selection), action, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Sets the dihedral angle between four atom selections.
 * @param s0, s1, s2, s3 Single-atom selections (must be non-null).
 * @param value Dihedral angle in degrees.
 * @param state Object state (0-based, or -1 for current).
 */
int PyMOLWasm_SetDihedral(CPyMOL* pymolPtr, const char* s0, const char* s1,
                          const char* s2, const char* s3, float value,
                          int state) {
    if (!pymolPtr || !s0 || !s1 || !s2 || !s3) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetDihe(G, s0, s1, s2, s3, value, state, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Sorts atoms within an object.
 * @param name Object name (null-safe).
 */
int PyMOLWasm_Sort(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSort(G, safe_str(name));
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Activates sculpting (energy minimization) for an object.
 * @param name Object name (null-safe).
 */
int PyMOLWasm_SculptActivate(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    ExecutiveSculptActivate(G, safe_str(name));
    return 1;
}

/**
 * Runs sculpting iterations on an object.
 * @param name Object name (null-safe).
 * @param state Object state (-1 for all).
 * @param n_cycles Number of sculpting cycles.
 * @return Total strain energy, or -1.0 on failure.
 */
float PyMOLWasm_SculptIterate(CPyMOL* pymolPtr, const char* name, int state,
                              int n_cycles) {
    if (!pymolPtr) return -1.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1.0f;
    return ExecutiveSculptIterate(G, safe_str(name), state, n_cycles);
}

/**
 * Reinitializes PyMOL state.
 * @param what What to reinitialize (0 = everything, 1 = settings, 2 = stored).
 */
int PyMOLWasm_Reinitialize(CPyMOL* pymolPtr, int what) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveReinitialize(G, what, "");
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates a pseudoatom in an object.
 * @param object_name Target object name (must be non-null).
 * @param selection Selection for positioning (null-safe).
 * @param name Atom name (null-safe).
 * @param resn Residue name (null-safe).
 * @param chain Chain identifier (null-safe).
 * @param pos 3D position array, or null to use selection center.
 * @param label_text Label text (null-safe).
 * @param state Target state (-1 for current).
 */
int PyMOLWasm_Pseudoatom(CPyMOL* pymolPtr, const char* object_name,
                         const char* selection, const char* name,
                         const char* resn, const char* chain,
                         const float* pos, const char* label_text,
                         int state) {
    if (!pymolPtr || !object_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutivePseudoatom(G, object_name, safe_str(selection),
        safe_str(name), safe_str(resn), "", safe_str(chain), "", "C",
        -1.0f, 1, 0.0f, 1.0f, safe_str(label_text), pos, -1, state, 0, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// ============================================================
// Object Management
// ============================================================

/**
 * Renames an object.
 * @param old_name Current name (must be non-null).
 * @param new_name New name (must be non-null).
 */
int PyMOLWasm_SetName(CPyMOL* pymolPtr, const char* old_name,
                      const char* new_name) {
    if (!pymolPtr || !old_name || !new_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetName(G, old_name, new_name);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Sets the title string for an object state.
 * @param name Object name (must be non-null).
 * @param state State index (0-based).
 * @param text Title text (must be non-null).
 */
int PyMOLWasm_SetTitle(CPyMOL* pymolPtr, const char* name, int state,
                       const char* text) {
    if (!pymolPtr || !name || !text) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetTitle(G, name, state, text);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Reorders objects in the object panel.
 * @param names Space-separated object names (must be non-null).
 * @param sort 0 = manual order, 1 = sort alphabetically.
 * @param location 0 = top, -1 = current, 1 = bottom.
 */
int PyMOLWasm_Order(CPyMOL* pymolPtr, const char* names, int sort,
                    int location) {
    if (!pymolPtr || !names) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveOrder(G, names, sort, location);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Creates or modifies an object group.
 * @param name Group name (must be non-null).
 * @param members Space-separated member names (null-safe).
 * @param action 0 = add, 1 = remove, 2 = open, 3 = close, 4 = toggle, 5 = auto, 6 = ungroup.
 */
int PyMOLWasm_Group(CPyMOL* pymolPtr, const char* name, const char* members,
                    int action) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    ExecutiveGroup(G, name, safe_str(members), action, 1);
    return 1;
}

/**
 * Sets the default color for an object.
 * @param name Object name (must be non-null).
 * @param color Color name (must be non-null).
 */
int PyMOLWasm_SetObjectColor(CPyMOL* pymolPtr, const char* name,
                             const char* color) {
    if (!pymolPtr || !name || !color) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetObjectColor(G, name, color, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// ============================================================
// Settings
// ============================================================

/**
 * Unsets a setting, reverting it to default.
 * @param index Setting index from SettingInfo.h.
 * @param selection Selection/object name (null-safe, empty for global).
 * @param state Object state (-1 for all).
 */
int PyMOLWasm_UnsetSetting(CPyMOL* pymolPtr, int index, const char* selection,
                           int state) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveUnsetSetting(G, index, safe_str(selection), state, 1, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

/**
 * Sets the crystallographic symmetry for an object.
 * @param selection Object/selection name (null-safe).
 * @param state Object state.
 * @param a, b, c Unit cell dimensions in Angstroms.
 * @param alpha, beta, gamma Unit cell angles in degrees.
 * @param sgroup Space group name (null-safe).
 */
int PyMOLWasm_SetSymmetry(CPyMOL* pymolPtr, const char* selection, int state,
                          float a, float b, float c,
                          float alpha, float beta, float gamma,
                          const char* sgroup) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetSymmetry(G, safe_str(selection), state, a, b, c,
                                       alpha, beta, gamma, safe_str(sgroup), 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// ============================================================
// File Export
// ============================================================

/**
 * Exports molecular data as a string in the specified format.
 * Supports: "pdb", "sdf", "cif", "mol2", "mol", "pqr", "xyz", "mae", "pmcif".
 *
 * @param format Format string (must be non-null).
 * @param selection Atom selection (null-safe, defaults to "all").
 * @param state State index (-1 for current, 0 for all).
 * @param out_ptr Receives malloc'd string buffer; caller must free().
 * @return Length of the output string, or 0 on failure.
 */
int PyMOLWasm_GetStr(CPyMOL* pymolPtr, const char* format,
                      const char* selection, int state, char** out_ptr) {
    if (!pymolPtr || !format || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto vla = MoleculeExporterGetStr(G, format, safe_str(selection),
                                       state, "", -1, -1, true);
    if (!vla) return 0;

    size_t len = vla.size();
    char* buf = static_cast<char*>(malloc(len + 1));
    if (!buf) return 0;
    std::memcpy(buf, vla.data(), len);
    buf[len] = '\0';
    *out_ptr = buf;
    return static_cast<int>(len);
}

// ============================================================
// Atom Property Access (alter/iterate equivalent)
// ============================================================

/**
 * Applies side effects after modifying an atom property.
 * Mirrors WrapperObjectAssignSubScript behavior in PyMOL.cpp.
 */
static void apply_property_side_effects(PyMOLGlobals* G, AtomInfoType* ai,
                                         const char* prop) {
    if (strcmp(prop, "elem") == 0) {
        AtomInfoAssignParameters(G, ai);
    } else if (strcmp(prop, "resv") == 0 || strcmp(prop, "resi") == 0) {
        ai->inscode = '\0';
    } else if (strcmp(prop, "ss") == 0) {
        if (ai->ssType[0] >= 'a' && ai->ssType[0] <= 'z')
            ai->ssType[0] -= ('a' - 'A');
    } else if (strcmp(prop, "formal_charge") == 0) {
        ai->chemFlag = 0;
    }
}

/**
 * Sets a float atom property for all atoms matching a selection.
 * Equivalent to `cmd.alter(selection, "property=value")` for float properties.
 *
 * @param selection Atom selection expression (null-safe).
 * @param property Property name: "b", "q", "vdw", "partial_charge", etc.
 * @param value Float value to set.
 * @return Number of atoms modified, or 0 on failure.
 */
int PyMOLWasm_SetAtomPropertyFloat(CPyMOL* pymolPtr, const char* selection,
                                    const char* property, float value) {
    if (!pymolPtr || !property) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info || info->Ptype != cPType_float) return 0;

    int count = 0;
    ObjectMolecule* prev_obj = nullptr;
    SeleAtomIterator iter(G, safe_str(selection));
    while (iter.next()) {
        AtomInfoType* ai = iter.getAtomInfo();
        float* field = (float*)((char*)ai + info->offset);
        *field = value;
        apply_property_side_effects(G, ai, property);
        if (iter.obj != prev_obj) {
            iter.obj->invalidate(cRepAll, cRepInvAll, -1);
            prev_obj = iter.obj;
        }
        count++;
    }
    if (count > 0) SeqChanged(G);
    return count;
}

/**
 * Sets an integer atom property for all atoms matching a selection.
 * Handles int, signed char, and unsigned int property types.
 *
 * @param selection Atom selection expression (null-safe).
 * @param property Property name: "color", "resv", "formal_charge", "numeric_type", etc.
 * @param value Integer value to set.
 * @return Number of atoms modified, or 0 on failure.
 */
int PyMOLWasm_SetAtomPropertyInt(CPyMOL* pymolPtr, const char* selection,
                                  const char* property, int value) {
    if (!pymolPtr || !property) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info) return 0;

    int count = 0;
    ObjectMolecule* prev_obj = nullptr;
    SeleAtomIterator iter(G, safe_str(selection));
    while (iter.next()) {
        AtomInfoType* ai = iter.getAtomInfo();
        switch (info->Ptype) {
            case cPType_int:
                *(int*)((char*)ai + info->offset) = value;
                break;
            case cPType_schar:
                *(signed char*)((char*)ai + info->offset) = static_cast<signed char>(value);
                break;
            case cPType_uint32:
                *(unsigned int*)((char*)ai + info->offset) = static_cast<unsigned int>(value);
                break;
            default:
                return 0;
        }
        apply_property_side_effects(G, ai, property);
        if (iter.obj != prev_obj) {
            iter.obj->invalidate(cRepAll, cRepInvAll, -1);
            prev_obj = iter.obj;
        }
        count++;
    }
    if (count > 0) SeqChanged(G);
    return count;
}

/**
 * Sets a string atom property for all atoms matching a selection.
 * Handles both lexicon-indexed strings (name, resn, chain, segi, etc.)
 * and fixed-length char arrays (elem, ss).
 *
 * @param selection Atom selection expression (null-safe).
 * @param property Property name: "name", "resn", "chain", "elem", "ss", "segi", etc.
 * @param value String value to set (must be non-null).
 * @return Number of atoms modified, or 0 on failure.
 */
int PyMOLWasm_SetAtomPropertyString(CPyMOL* pymolPtr, const char* selection,
                                      const char* property, const char* value) {
    if (!pymolPtr || !property || !value) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info) return 0;

    int count = 0;
    ObjectMolecule* prev_obj = nullptr;
    SeleAtomIterator iter(G, safe_str(selection));
    while (iter.next()) {
        AtomInfoType* ai = iter.getAtomInfo();
        switch (info->Ptype) {
            case cPType_int_as_string: {
                lexidx_t* field = (lexidx_t*)((char*)ai + info->offset);
                LexAssign(G, *field, value);
                break;
            }
            case cPType_string: {
                char* field = (char*)ai + info->offset;
                strncpy(field, value, info->maxlen);
                field[info->maxlen - 1] = '\0';
                break;
            }
            default:
                return 0;
        }
        apply_property_side_effects(G, ai, property);
        if (iter.obj != prev_obj) {
            iter.obj->invalidate(cRepAll, cRepInvAll, -1);
            prev_obj = iter.obj;
        }
        count++;
    }
    if (count > 0) SeqChanged(G);
    return count;
}

/**
 * Reads a float atom property from all atoms matching a selection.
 * Equivalent to `cmd.iterate(selection, "stored.list.append(property)")` for floats.
 *
 * @param selection Atom selection expression (null-safe).
 * @param property Property name: "b", "q", "vdw", "partial_charge", etc.
 * @param out_buf Pre-allocated float buffer.
 * @param buf_size Number of floats that fit in out_buf.
 * @return Number of atoms read, or 0 on failure.
 */
int PyMOLWasm_GetAtomPropertyFloat(CPyMOL* pymolPtr, const char* selection,
                                    const char* property, float* out_buf,
                                    int buf_size) {
    if (!pymolPtr || !property || !out_buf || buf_size <= 0) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info || info->Ptype != cPType_float) return 0;

    int count = 0;
    SeleAtomIterator iter(G, safe_str(selection));
    while (iter.next() && count < buf_size) {
        AtomInfoType* ai = iter.getAtomInfo();
        out_buf[count++] = *(float*)((char*)ai + info->offset);
    }
    return count;
}

/**
 * Reads an integer atom property from all atoms matching a selection.
 *
 * @param selection Atom selection expression (null-safe).
 * @param property Property name: "color", "resv", "formal_charge", etc.
 * @param out_buf Pre-allocated int buffer.
 * @param buf_size Number of ints that fit in out_buf.
 * @return Number of atoms read, or 0 on failure.
 */
int PyMOLWasm_GetAtomPropertyInt(CPyMOL* pymolPtr, const char* selection,
                                  const char* property, int* out_buf,
                                  int buf_size) {
    if (!pymolPtr || !property || !out_buf || buf_size <= 0) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info) return 0;

    int count = 0;
    SeleAtomIterator iter(G, safe_str(selection));
    while (iter.next() && count < buf_size) {
        AtomInfoType* ai = iter.getAtomInfo();
        switch (info->Ptype) {
            case cPType_int:
                out_buf[count++] = *(int*)((char*)ai + info->offset);
                break;
            case cPType_schar:
                out_buf[count++] = *(signed char*)((char*)ai + info->offset);
                break;
            case cPType_uint32:
                out_buf[count++] = static_cast<int>(*(unsigned int*)((char*)ai + info->offset));
                break;
            default:
                return 0;
        }
    }
    return count;
}

/**
 * Reads a string atom property from all atoms matching a selection.
 * Returns a JSON array of strings via a malloc'd buffer.
 *
 * @param selection Atom selection expression (null-safe).
 * @param property Property name: "name", "resn", "chain", "elem", "ss", etc.
 * @param out_ptr Pointer to a char* that will receive the malloc'd JSON buffer.
 *                Caller must free() this buffer when done.
 * @return Number of atoms read, or 0 on failure.
 */
int PyMOLWasm_GetAtomPropertyString(CPyMOL* pymolPtr, const char* selection,
                                      const char* property, char** out_ptr) {
    if (!pymolPtr || !property || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info) return 0;

    std::string json = "[";
    int count = 0;
    SeleAtomIterator iter(G, safe_str(selection));
    while (iter.next()) {
        AtomInfoType* ai = iter.getAtomInfo();
        const char* str_val = nullptr;

        switch (info->Ptype) {
            case cPType_int_as_string: {
                lexidx_t idx = *(lexidx_t*)((char*)ai + info->offset);
                str_val = LexStr(G, idx);
                break;
            }
            case cPType_string:
                str_val = (const char*)ai + info->offset;
                break;
            default:
                return 0;
        }

        if (count > 0) json += ",";
        json += "\"";
        // Escape any quotes or backslashes in the string value
        const char* s = str_val ? str_val : "";
        while (*s) {
            if (*s == '"' || *s == '\\') json += '\\';
            json += *s;
            s++;
        }
        json += "\"";
        count++;
    }
    json += "]";

    char* buf = static_cast<char*>(malloc(json.size() + 1));
    if (!buf) return 0;
    std::memcpy(buf, json.c_str(), json.size() + 1);
    *out_ptr = buf;
    return count;
}

// ============================================================
// Introspection / Queries
// ============================================================

/**
 * Returns a JSON array of object/selection names.
 * @param mode 0=all, 1=objects, 2=selections, 3=public, 4=groups, 5=non-groups.
 * @param out_ptr Receives malloc'd JSON string; caller must free().
 * @return Number of names, or 0 on failure.
 */
int PyMOLWasm_GetNames(CPyMOL* pymolPtr, int mode, char** out_ptr) {
    if (!pymolPtr || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveGetNames(G, mode, 0, "");
    if (!result) return 0;

    const auto& names = result.result();
    std::string json = cstr_vec_to_json(names);
    alloc_output_string(json, out_ptr);
    return static_cast<int>(names.size());
}

/**
 * Returns the type of a named object as a string.
 * @param name Object name (must be non-null).
 * @param out_ptr Receives malloc'd type string; caller must free().
 * @return Length of the type string, or 0 on failure.
 */
int PyMOLWasm_GetType(CPyMOL* pymolPtr, const char* name, char** out_ptr) {
    if (!pymolPtr || !name || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveGetType(G, name);
    if (!result) return 0;

    return alloc_output_string(result.result(), out_ptr);
}

/**
 * Returns the number of states in a selection/object.
 * @param selection Selection string (null-safe).
 */
int PyMOLWasm_CountStates(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    return ExecutiveCountStates(G, safe_str(selection));
}

/**
 * Returns a JSON array of chain identifiers for a selection.
 * @param selection Selection string (null-safe).
 * @param state Object state (-1 for current).
 * @param out_ptr Receives malloc'd JSON string; caller must free().
 * @return Number of chains, or 0 on failure.
 */
int PyMOLWasm_GetChains(CPyMOL* pymolPtr, const char* selection, int state,
                         char** out_ptr) {
    if (!pymolPtr || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveGetChains(G, safe_str(selection), state);
    if (!result) return 0;

    const auto& chains = result.result();
    std::string json = cstr_vec_to_json(chains);
    alloc_output_string(json, out_ptr);
    return static_cast<int>(chains.size());
}

/**
 * Gets a global float setting value.
 * @param index Setting index from SettingInfo.h.
 */
float PyMOLWasm_GetSettingFloat(CPyMOL* pymolPtr, int index) {
    if (!pymolPtr) return 0.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0.0f;
    return SettingGetGlobal_f(G, index);
}

/**
 * Gets a global integer setting value.
 * @param index Setting index from SettingInfo.h.
 */
int PyMOLWasm_GetSettingInt(CPyMOL* pymolPtr, int index) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    return SettingGetGlobal_i(G, index);
}

/**
 * Returns a JSON array of stored scene names.
 * @param out_ptr Receives malloc'd JSON string; caller must free().
 * @return Number of scenes, or 0 on failure.
 */
int PyMOLWasm_GetSceneList(CPyMOL* pymolPtr, char** out_ptr) {
    if (!pymolPtr || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto& order = MovieSceneGetOrder(G);
    std::string json = "[";
    for (size_t i = 0; i < order.size(); i++) {
        if (i > 0) json += ",";
        json += "\"";
        for (char c : order[i]) {
            if (c == '"' || c == '\\') json += '\\';
            json += c;
        }
        json += "\"";
    }
    json += "]";

    alloc_output_string(json, out_ptr);
    return static_cast<int>(order.size());
}

/**
 * Gets crystallographic symmetry for an object.
 * @param selection Object/selection name (null-safe).
 * @param state Object state.
 * @param out_params Pre-allocated array of 6 floats [a, b, c, alpha, beta, gamma].
 * @param out_sgroup Optional: receives malloc'd space group string; caller must free().
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_GetSymmetry(CPyMOL* pymolPtr, const char* selection, int state,
                           float* out_params, char** out_sgroup) {
    if (!pymolPtr || !out_params) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    float a, b, c, alpha, beta, gamma;
    char sgroup[64] = {};
    auto result = ExecutiveGetSymmetry(G, safe_str(selection), state,
                                        &a, &b, &c, &alpha, &beta, &gamma, sgroup);
    if (!result || !result.result()) return 0;

    out_params[0] = a; out_params[1] = b; out_params[2] = c;
    out_params[3] = alpha; out_params[4] = beta; out_params[5] = gamma;

    if (out_sgroup) {
        size_t len = strlen(sgroup);
        char* buf = static_cast<char*>(malloc(len + 1));
        if (buf) {
            std::memcpy(buf, sgroup, len + 1);
            *out_sgroup = buf;
        }
    }
    return 1;
}

/**
 * Gets the RGB color values for a named color.
 * @param color_name Color name, e.g. "red", "blue" (must be non-null).
 * @param out_rgb Pre-allocated array of 3 floats [R, G, B] in 0-1 range.
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_GetColorTuple(CPyMOL* pymolPtr, const char* color_name,
                              float* out_rgb) {
    if (!pymolPtr || !color_name || !out_rgb) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    int idx = ColorGetIndex(G, color_name);
    if (idx < 0) return 0;
    const float* rgb = ColorGet(G, idx);
    if (!rgb) return 0;
    out_rgb[0] = rgb[0]; out_rgb[1] = rgb[1]; out_rgb[2] = rgb[2];
    return 1;
}

/**
 * Gets the 4x4 transformation matrix for an object.
 * @param name Object name (must be non-null).
 * @param state Object state.
 * @param out_matrix Pre-allocated array of 16 doubles.
 * @return 1 on success, 0 on failure.
 */
int PyMOLWasm_GetObjectMatrix(CPyMOL* pymolPtr, const char* name, int state,
                               double* out_matrix) {
    if (!pymolPtr || !name || !out_matrix) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    double* matrix = nullptr;
    int ok = ExecutiveGetObjectMatrix(G, name, state, &matrix, 1);
    if (!ok || !matrix) return 0;
    std::memcpy(out_matrix, matrix, 16 * sizeof(double));
    return 1;
}

/**
 * Gets the title string for an object state.
 * @param name Object name (must be non-null).
 * @param state State index (0-based).
 * @param out_ptr Receives malloc'd title string; caller must free().
 * @return Length of the title string, or 0 on failure.
 */
int PyMOLWasm_GetTitle(CPyMOL* pymolPtr, const char* name, int state,
                        char** out_ptr) {
    if (!pymolPtr || !name || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const char* title = ExecutiveGetTitle(G, name, state);
    if (!title) return 0;

    return alloc_output_string(title, out_ptr);
}

} // extern "C"
