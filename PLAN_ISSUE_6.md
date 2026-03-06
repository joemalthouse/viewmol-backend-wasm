# Plan: Issue 6 — Introspection API

## Goal
Add 10 query functions that return structured data about the loaded scene — object names, types, chains, states, settings, symmetry, colors, bonds, scene list, and model data.

## Pattern
Functions returning simple scalars use `int`/`float` return values. Functions returning strings or arrays use the `GetRayScene` malloc pattern: `char** out_ptr` output parameter, caller frees, return value is length or count.

## Files Modified
1. `pymol-open-source/layer5/PyMOLWasm.cpp` — add 10 functions
2. `pymol-open-source/CMakeLists.txt` — add 10 entries to EXPORTED_FUNCTIONS

## Implementation

### Function 1: GetNames (~20 lines)

```cpp
int PyMOLWasm_GetNames(CPyMOL* pymolPtr, int mode, char** out_ptr) {
    if (!pymolPtr || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    // mode: 0=all, 1=objects, 2=selections, 3=public, 4=groups, 5=non-groups
    auto result = ExecutiveGetNames(G, mode, 0, "");
    if (!result) return 0;

    const auto& names = result.result();
    std::string json = "[";
    for (size_t i = 0; i < names.size(); i++) {
        if (i > 0) json += ",";
        json += "\"";
        // Escape any quotes in names (unlikely but defensive)
        const char* n = names[i];
        while (*n) {
            if (*n == '"') json += "\\\"";
            else json += *n;
            n++;
        }
        json += "\"";
    }
    json += "]";

    char* buf = (char*)malloc(json.size() + 1);
    if (!buf) return 0;
    memcpy(buf, json.c_str(), json.size() + 1);
    *out_ptr = buf;
    return (int)names.size();
}
```

**Mode values:** `0` = all names, `1` = objects only, `2` = selections only, `3` = public only, `4` = groups, `5` = non-groups.

### Function 2: GetType (~10 lines)

```cpp
int PyMOLWasm_GetType(CPyMOL* pymolPtr, const char* name, char** out_ptr) {
    if (!pymolPtr || !name || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveGetType(G, name);
    if (!result) return 0;

    const char* type_str = result.result();
    size_t len = strlen(type_str);
    char* buf = (char*)malloc(len + 1);
    if (!buf) return 0;
    memcpy(buf, type_str, len + 1);
    *out_ptr = buf;
    return (int)len;
}
```

### Function 3: CountStates (~5 lines)

```cpp
int PyMOLWasm_CountStates(CPyMOL* pymolPtr, const char* selection) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    return ExecutiveCountStates(G, safe_str(selection));
}
```

### Function 4: GetChains (~20 lines)

```cpp
int PyMOLWasm_GetChains(CPyMOL* pymolPtr, const char* selection, int state,
                         char** out_ptr) {
    if (!pymolPtr || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto result = ExecutiveGetChains(G, safe_str(selection), state);
    if (!result) return 0;

    const auto& chains = result.result();
    std::string json = "[";
    for (size_t i = 0; i < chains.size(); i++) {
        if (i > 0) json += ",";
        json += "\"";
        json += chains[i] ? chains[i] : "";
        json += "\"";
    }
    json += "]";

    char* buf = (char*)malloc(json.size() + 1);
    if (!buf) return 0;
    memcpy(buf, json.c_str(), json.size() + 1);
    *out_ptr = buf;
    return (int)chains.size();
}
```

### Function 5: GetSettingFloat / GetSettingInt (~10 lines total)

```cpp
float PyMOLWasm_GetSettingFloat(CPyMOL* pymolPtr, int index) {
    if (!pymolPtr) return 0.0f;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0.0f;
    return SettingGetGlobal_f(G, index);
}

int PyMOLWasm_GetSettingInt(CPyMOL* pymolPtr, int index) {
    if (!pymolPtr) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;
    return SettingGetGlobal_i(G, index);
}
```

### Function 6: GetSceneList (~20 lines)

```cpp
int PyMOLWasm_GetSceneList(CPyMOL* pymolPtr, char** out_ptr) {
    if (!pymolPtr || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto& order = MovieSceneGetOrder(G);
    std::string json = "[";
    for (size_t i = 0; i < order.size(); i++) {
        if (i > 0) json += ",";
        json += "\"" + order[i] + "\"";
    }
    json += "]";

    char* buf = (char*)malloc(json.size() + 1);
    if (!buf) return 0;
    memcpy(buf, json.c_str(), json.size() + 1);
    *out_ptr = buf;
    return (int)order.size();
}
```

### Function 7: GetSymmetry (~20 lines)

```cpp
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
        char* buf = (char*)malloc(len + 1);
        if (buf) {
            memcpy(buf, sgroup, len + 1);
            *out_sgroup = buf;
        }
    }
    return 1;
}
```

### Function 8: GetColorTuple (~10 lines)

```cpp
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
```

### Function 9: GetObjectMatrix (~15 lines)

```cpp
int PyMOLWasm_GetObjectMatrix(CPyMOL* pymolPtr, const char* name, int state,
                               double* out_matrix) {
    if (!pymolPtr || !name || !out_matrix) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    double* matrix = nullptr;
    int ok = ExecutiveGetObjectMatrix(G, name, state, &matrix, 1);
    if (!ok || !matrix) return 0;
    memcpy(out_matrix, matrix, 16 * sizeof(double));
    return 1;
}
```

### Function 10: GetTitle (~10 lines)

```cpp
int PyMOLWasm_GetTitle(CPyMOL* pymolPtr, const char* name, int state,
                        char** out_ptr) {
    if (!pymolPtr || !name || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const char* title = ExecutiveGetTitle(G, name, state);
    if (!title) return 0;

    size_t len = strlen(title);
    char* buf = (char*)malloc(len + 1);
    if (!buf) return 0;
    memcpy(buf, title, len + 1);
    *out_ptr = buf;
    return (int)len;
}
```

### EXPORTED_FUNCTIONS additions

```
'_PyMOLWasm_GetNames','_PyMOLWasm_GetType','_PyMOLWasm_CountStates',
'_PyMOLWasm_GetChains','_PyMOLWasm_GetSettingFloat','_PyMOLWasm_GetSettingInt',
'_PyMOLWasm_GetSceneList','_PyMOLWasm_GetSymmetry','_PyMOLWasm_GetColorTuple',
'_PyMOLWasm_GetObjectMatrix','_PyMOLWasm_GetTitle'
```

(11 entries — GetSettingFloat and GetSettingInt are separate.)

## Include Dependencies

All already included in PyMOLWasm.cpp:
- `Executive.h` — all `Executive*` functions
- `Setting.h` — `SettingGetGlobal_f/i`
- `Color.h` — `ColorGetIndex`, `ColorGet`
- `MovieScene.h` — `MovieSceneGetOrder`

## JSON String Serialization Helper

Multiple functions serialize `vector<const char*>` to JSON arrays. Factor into a reusable helper:

```cpp
static std::string vec_to_json_array(const std::vector<const char*>& items) {
    std::string json = "[";
    for (size_t i = 0; i < items.size(); i++) {
        if (i > 0) json += ",";
        json += "\"";
        const char* s = items[i] ? items[i] : "";
        while (*s) {
            if (*s == '"') json += "\\\"";
            else if (*s == '\\') json += "\\\\";
            else json += *s;
            s++;
        }
        json += "\"";
    }
    json += "]";
    return json;
}

static int return_json_string(const std::string& json, char** out_ptr) {
    char* buf = (char*)malloc(json.size() + 1);
    if (!buf) return 0;
    memcpy(buf, json.c_str(), json.size() + 1);
    *out_ptr = buf;
    return (int)json.size();
}
```

Then `GetNames`, `GetChains`, `GetSceneList` all simplify to:
```cpp
auto json = vec_to_json_array(result.result());
return return_json_string(json, out_ptr);
```

## Risk Assessment

**Zero risk.** All functions are read-only queries against existing data structures. No mutations, no new data structures, no changes to existing behavior.

## Estimated Effort

~200 lines of C++ (11 functions + 2 helpers). All mechanical wiring.

## Future Extension: GetBonds / GetModelJSON

Not included in this plan but noted for future work:

**GetBonds** (~35 lines): Iterate `ObjectMolecule::Bond` array, serialize `{index[0], index[1], order}` per bond. Requires `ExecutiveFindObjectMoleculeByName()`.

**GetModelJSON** (~150 lines): Full atom data readback. Iterate selection via `SeleAtomIterator`, read all `AtomInfoType` fields + coordinates, serialize to JSON. High value but significantly more code — deserves its own plan.
