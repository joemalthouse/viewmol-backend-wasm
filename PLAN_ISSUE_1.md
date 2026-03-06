# Plan: Issue 1 — Missing C API Surface

## Goal
Add ~30 Tier 1 functions to the WASM API. Each is a thin wrapper around an existing `Executive*` function, following the exact pattern already used by `PyMOLWasm_Delete`, `PyMOLWasm_Center`, etc.

## Principles
- **No new abstractions.** Every function follows the same 5-line pattern: null-check → get globals → call Executive → return int.
- **No header changes.** All functions go inside the existing `extern "C"` block in `PyMOLWasm.cpp`.
- **No new dependencies.** Every `Executive*` function is already declared in `Executive.h` (already included).
- **Alphabetical insertion** within each category in both the `.cpp` file and `EXPORTED_FUNCTIONS`.

## Files Modified
1. `pymol-open-source/layer5/PyMOLWasm.cpp` — add function implementations
2. `pymol-open-source/CMakeLists.txt` — add to `EXPORTED_FUNCTIONS` list

## Implementation

### Step 1: Add functions to PyMOLWasm.cpp (inside `extern "C"`)

Group by category. Each function follows this exact pattern:

```cpp
int PyMOLWasm_<Name>(CPyMOL* pymolPtr, <params>) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = Executive<Name>(G, <args>);
    return static_cast<bool>(result) ? 1 : 0;
}
```

#### Viewing / Display (12 functions)

```cpp
// enable/disable — ExecutiveSetObjVisib(G, name, onoff, parents)
int PyMOLWasm_Enable(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetObjVisib(G, name, 1, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

int PyMOLWasm_Disable(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetObjVisib(G, name, 0, 0);
    return static_cast<bool>(result) ? 1 : 0;
}

// orient — ExecutiveOrient(G, sele, state, animate, complete, buffer, quiet)
int PyMOLWasm_Orient(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveOrient(G, safe_str(selection), -1, 0.0f, 0, 0.0f, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// clip — ExecutiveClip(G, clipStr)  e.g. "near,-5" or "far,10"
int PyMOLWasm_Clip(CPyMOL* pymolPtr, const char* clip_str) {
    if (!pymolPtr || !clip_str) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveClip(G, clip_str);
    return static_cast<bool>(result) ? 1 : 0;
}

// move — ExecutiveMove(G, axis, dist)  axis is "x", "y", or "z"
int PyMOLWasm_Move(CPyMOL* pymolPtr, const char* axis, float dist) {
    if (!pymolPtr || !axis) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveMove(G, axis, dist);
    return static_cast<bool>(result) ? 1 : 0;
}

// reset — ExecutiveReset(G, name)
int PyMOLWasm_Reset(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveReset(G, safe_str(name));
    return static_cast<bool>(result) ? 1 : 0;
}

// bg_color — ExecutiveBackgroundColor(G, color)
int PyMOLWasm_BgColor(CPyMOL* pymolPtr, const char* color) {
    if (!pymolPtr || !color) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveBackgroundColor(G, color);
    return static_cast<bool>(result) ? 1 : 0;
}

// cartoon — ExecutiveCartoon(G, type, s1)
int PyMOLWasm_Cartoon(CPyMOL* pymolPtr, int type, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveCartoon(G, type, safe_str(selection));
    return static_cast<bool>(result) ? 1 : 0;
}

// toggle — ExecutiveToggleRepVisib(G, name, rep)
int PyMOLWasm_Toggle(CPyMOL* pymolPtr, const char* rep, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    int rep_id = rep_name_to_id(rep);
    if (rep_id < 0) return 0;
    auto result = ExecutiveToggleRepVisib(G, safe_str(selection), rep_id);
    return static_cast<bool>(result) ? 1 : 0;
}

// rebuild — ExecutiveRebuildAll(G) is void
int PyMOLWasm_Rebuild(CPyMOL* pymolPtr) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    ExecutiveRebuildAll(G);
    return 1;
}

// volume — ExecutiveVolume(G, volume_name, map_name, lvl, sele, fbuf, state, carve, map_state, quiet)
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

// isolevel — ExecutiveIsolevel(G, name, level, state, quiet)
int PyMOLWasm_Isolevel(CPyMOL* pymolPtr, const char* name, float level,
                       int state) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveIsolevel(G, name, level, state, 1);
    return static_cast<bool>(result) ? 1 : 0;
}
```

#### Structure Manipulation (10 functions)

```cpp
// h_add — ExecutiveAddHydrogens(G, s1, quiet, state, legacy)
int PyMOLWasm_HAdd(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveAddHydrogens(G, safe_str(selection), 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// protect — ExecutiveProtect(G, s1, mode, quiet)
int PyMOLWasm_Protect(CPyMOL* pymolPtr, const char* selection, int mode) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveProtect(G, safe_str(selection), mode, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// mask — ExecutiveMask(G, s1, mode, quiet)
int PyMOLWasm_Mask(CPyMOL* pymolPtr, const char* selection, int mode) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveMask(G, safe_str(selection), mode, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// flag — ExecutiveFlag(G, flag, sele, action, quiet)
int PyMOLWasm_Flag(CPyMOL* pymolPtr, int flag, const char* selection,
                   int action) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveFlag(G, flag, safe_str(selection), action, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// set_dihedral — ExecutiveSetDihe(G, s0, s1, s2, s3, value, state, quiet)
int PyMOLWasm_SetDihedral(CPyMOL* pymolPtr, const char* s0, const char* s1,
                          const char* s2, const char* s3, float value,
                          int state) {
    if (!pymolPtr || !s0 || !s1 || !s2 || !s3) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetDihe(G, s0, s1, s2, s3, value, state, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// sort — ExecutiveSort(G, name)
int PyMOLWasm_Sort(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSort(G, safe_str(name));
    return static_cast<bool>(result) ? 1 : 0;
}

// sculpt_activate — ExecutiveSculptActivate(G, name, state, match_state, match_by_segment)
int PyMOLWasm_SculptActivate(CPyMOL* pymolPtr, const char* name) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    ExecutiveSculptActivate(G, safe_str(name));
    return 1;
}

// sculpt_iterate — ExecutiveSculptIterate(G, name, state, n_cycle)
float PyMOLWasm_SculptIterate(CPyMOL* pymolPtr, const char* name, int state,
                              int n_cycles) {
    if (!pymolPtr) return -1.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return -1.0f;
    return ExecutiveSculptIterate(G, safe_str(name), state, n_cycles);
}

// reinitialize — ExecutiveReinitialize(G, what, pattern)
int PyMOLWasm_Reinitialize(CPyMOL* pymolPtr, int what) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveReinitialize(G, what, "");
    return static_cast<bool>(result) ? 1 : 0;
}

// pseudoatom — ExecutivePseudoatom(G, ...) — expose key params, default the rest
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
```

#### Object Management (5 functions)

```cpp
// set_name — ExecutiveSetName(G, old_name, new_name)
int PyMOLWasm_SetName(CPyMOL* pymolPtr, const char* old_name,
                      const char* new_name) {
    if (!pymolPtr || !old_name || !new_name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetName(G, old_name, new_name);
    return static_cast<bool>(result) ? 1 : 0;
}

// set_title — ExecutiveSetTitle(G, name, state, text)
int PyMOLWasm_SetTitle(CPyMOL* pymolPtr, const char* name, int state,
                       const char* text) {
    if (!pymolPtr || !name || !text) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetTitle(G, name, state, text);
    return static_cast<bool>(result) ? 1 : 0;
}

// order — ExecutiveOrder(G, s1, sort, location)
int PyMOLWasm_Order(CPyMOL* pymolPtr, const char* names, int sort,
                    int location) {
    if (!pymolPtr || !names) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveOrder(G, names, sort, location);
    return static_cast<bool>(result) ? 1 : 0;
}

// group — ExecutiveGroup(G, name, members, action, quiet)
int PyMOLWasm_Group(CPyMOL* pymolPtr, const char* name, const char* members,
                    int action) {
    if (!pymolPtr || !name) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    ExecutiveGroup(G, name, safe_str(members), action, 1);
    return 1;
}

// set_object_color — ExecutiveSetObjectColor(G, name, color, quiet)
int PyMOLWasm_SetObjectColor(CPyMOL* pymolPtr, const char* name,
                             const char* color) {
    if (!pymolPtr || !name || !color) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveSetObjectColor(G, name, color, 1);
    return static_cast<bool>(result) ? 1 : 0;
}
```

#### Settings (2 functions)

```cpp
// unset — ExecutiveUnsetSetting(G, index, preSele, state, quiet, updates)
int PyMOLWasm_UnsetSetting(CPyMOL* pymolPtr, int index, const char* selection,
                           int state) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    auto result = ExecutiveUnsetSetting(G, index, safe_str(selection), state, 1, 1);
    return static_cast<bool>(result) ? 1 : 0;
}

// set_symmetry — ExecutiveSetSymmetry(G, sele, state, a,b,c, alpha,beta,gamma, sgroup, quiet)
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
```

**Total: ~29 functions, ~300 lines of C++.**

### Step 2: Add to EXPORTED_FUNCTIONS in CMakeLists.txt

Append to the existing comma-separated list on line 60:

```
'_PyMOLWasm_Enable','_PyMOLWasm_Disable','_PyMOLWasm_Orient',
'_PyMOLWasm_Clip','_PyMOLWasm_Move','_PyMOLWasm_Reset',
'_PyMOLWasm_BgColor','_PyMOLWasm_Cartoon','_PyMOLWasm_Toggle',
'_PyMOLWasm_Rebuild','_PyMOLWasm_Volume','_PyMOLWasm_Isolevel',
'_PyMOLWasm_HAdd','_PyMOLWasm_Protect','_PyMOLWasm_Mask',
'_PyMOLWasm_Flag','_PyMOLWasm_SetDihedral','_PyMOLWasm_Sort',
'_PyMOLWasm_SculptActivate','_PyMOLWasm_SculptIterate',
'_PyMOLWasm_Reinitialize','_PyMOLWasm_Pseudoatom',
'_PyMOLWasm_SetName','_PyMOLWasm_SetTitle','_PyMOLWasm_Order',
'_PyMOLWasm_Group','_PyMOLWasm_SetObjectColor',
'_PyMOLWasm_UnsetSetting','_PyMOLWasm_SetSymmetry'
```

### Step 3: Verify build

```bash
cd pymol-open-source/build && emcmake cmake .. && emmake make -j$(nproc)
```

## What This Does NOT Include

- **Tier 2 functions** (align full version, super, fit, rms) — these need their own plan due to complex parameter mapping and return value handling
- **String-returning functions** (get_names, get_chains, etc.) — covered in PLAN_ISSUE_6.md (Introspection)
- **File export** — covered in PLAN_ISSUE_3.md
- **alter/iterate** — covered in PLAN_ISSUE_2.md

## Risk Assessment

**Zero risk.** Every function is a thin wrapper around a tested `Executive*` call. No new logic, no new data structures, no changes to existing behavior. If any single function has a compilation issue, it can be commented out without affecting others.

## Estimated Effort

~300 lines of C++ (repetitive boilerplate). Mechanical work — no design decisions needed.
