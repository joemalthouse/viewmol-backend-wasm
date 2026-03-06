# Plan: Issue 2 — alter/iterate via Property Enum API

## Goal
Provide `alter` and `iterate` equivalents for WASM without Python. Instead of evaluating arbitrary expressions like `"b=50.0"`, expose typed getter/setter functions that accept a property ID enum and a value.

## Why Not Just Un-guard the Existing Code
The `#ifdef _WEBGL` guards in `Executive.cpp` strip out `PyEval_EvalCode()` calls. The entire alter/iterate pipeline depends on Python's `eval()` to interpret expressions like `"chain='A'"`. There is no expression evaluator to substitute — the code compiles to a no-op. We need a fundamentally different approach.

## Design: Property Enum API

### The Existing Infrastructure (Already Works in WASM)

1. **`AtomPropertyInfo` table** — `layer5/PyMOL.cpp:663-705`, populated via `LEX_ATOM_PROP` macro. Maps property names to `{id, Ptype, offset, maxlen}`. Accessible via `PyMOL_GetAtomPropertyInfo(G, property_name)`. **No Python dependency.**

2. **`SeleAtomIterator`** — `layer3/AtomIterators.h:122`. Iterates atoms matching a selection, provides `getAtomInfo()` → `AtomInfoType*`. Used by existing `PyMOLWasm_SetAtomCoordinates`. **No Python dependency.**

3. **`LexAssign(G, field, value)`** — String interning for lexicon-indexed fields (name, resn, chain, segi, etc.). **No Python dependency.**

### API Surface (6 Functions)

```cpp
// Setters — apply value to all atoms matching selection
int PyMOLWasm_SetAtomPropertyFloat(CPyMOL* pymolPtr, const char* selection,
                                    const char* property, float value);
int PyMOLWasm_SetAtomPropertyInt(CPyMOL* pymolPtr, const char* selection,
                                  const char* property, int value);
int PyMOLWasm_SetAtomPropertyString(CPyMOL* pymolPtr, const char* selection,
                                      const char* property, const char* value);

// Getters — read values from all atoms matching selection into caller's buffer
int PyMOLWasm_GetAtomPropertyFloat(CPyMOL* pymolPtr, const char* selection,
                                    const char* property, float* out_buf,
                                    int buf_size);
int PyMOLWasm_GetAtomPropertyInt(CPyMOL* pymolPtr, const char* selection,
                                  const char* property, int* out_buf,
                                  int buf_size);
int PyMOLWasm_GetAtomPropertyString(CPyMOL* pymolPtr, const char* selection,
                                      const char* property, char** out_ptr);
```

**Property names** are the same strings PyMOL users already know: `"b"`, `"q"`, `"vdw"`, `"name"`, `"resn"`, `"chain"`, `"elem"`, `"ss"`, `"color"`, `"resv"`, `"formal_charge"`, etc.

### Why String Property Names (Not Integer IDs)

The `AtomPropertyInfo` table already provides `PyMOL_GetAtomPropertyInfo(G, name)` which maps names to `{Ptype, offset}`. Using string names:
- Matches PyMOL's existing naming convention
- Self-documenting API — `SetAtomPropertyFloat(p, "all", "b", 50.0)` reads clearly
- No need to expose/maintain a separate enum header
- Lookup is O(n) on ~30 properties — negligible cost vs. atom iteration

## Files Modified

1. `pymol-open-source/layer5/PyMOLWasm.cpp` — add 6 functions + 1 helper
2. `pymol-open-source/CMakeLists.txt` — add to EXPORTED_FUNCTIONS

## Implementation

### Step 1: Property Write Helper (private, not exported)

```cpp
#include "AtomInfo.h"   // AtomInfoType, AtomInfoAssignParameters
#include "Lex.h"        // LexAssign

// Side-effect handler — matches WrapperObjectAssignSubScript behavior
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
```

### Step 2: Float Setter

```cpp
int PyMOLWasm_SetAtomPropertyFloat(CPyMOL* pymolPtr, const char* selection,
                                    const char* property, float value) {
    if (!pymolPtr || !property) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info || info->Ptype != cPType_float) return 0;

    SelectorTmp tmpsele(G, safe_str(selection));
    int sele = tmpsele.getIndex();
    if (sele < 0) return 0;

    int count = 0;
    ObjectMolecule* prev_obj = nullptr;
    SeleAtomIterator iter(G, sele);
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
```

### Step 3: Int Setter

Same pattern as float, but handles `cPType_int`, `cPType_schar`, `cPType_uint32`:

```cpp
int PyMOLWasm_SetAtomPropertyInt(CPyMOL* pymolPtr, const char* selection,
                                  const char* property, int value) {
    if (!pymolPtr || !property) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info) return 0;

    SelectorTmp tmpsele(G, safe_str(selection));
    int sele = tmpsele.getIndex();
    if (sele < 0) return 0;

    int count = 0;
    ObjectMolecule* prev_obj = nullptr;
    SeleAtomIterator iter(G, sele);
    while (iter.next()) {
        AtomInfoType* ai = iter.getAtomInfo();
        switch (info->Ptype) {
            case cPType_int:
                *(int*)((char*)ai + info->offset) = value;
                break;
            case cPType_schar:
                *(signed char*)((char*)ai + info->offset) = (signed char)value;
                break;
            case cPType_uint32:
                *(unsigned int*)((char*)ai + info->offset) = (unsigned int)value;
                break;
            default:
                return 0;  // wrong type
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
```

### Step 4: String Setter

Handles both `cPType_int_as_string` (lexicon-indexed: name, resn, chain, segi, label, custom, textType) and `cPType_string` (fixed char arrays: elem, ss, alt):

```cpp
int PyMOLWasm_SetAtomPropertyString(CPyMOL* pymolPtr, const char* selection,
                                      const char* property, const char* value) {
    if (!pymolPtr || !property || !value) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info) return 0;

    SelectorTmp tmpsele(G, safe_str(selection));
    int sele = tmpsele.getIndex();
    if (sele < 0) return 0;

    int count = 0;
    ObjectMolecule* prev_obj = nullptr;
    SeleAtomIterator iter(G, sele);
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
```

### Step 5: Getters (Float/Int/String)

Float getter — fills caller-provided buffer:
```cpp
int PyMOLWasm_GetAtomPropertyFloat(CPyMOL* pymolPtr, const char* selection,
                                    const char* property, float* out_buf,
                                    int buf_size) {
    if (!pymolPtr || !property || !out_buf || buf_size <= 0) return 0;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info || info->Ptype != cPType_float) return 0;

    SelectorTmp tmpsele(G, safe_str(selection));
    int sele = tmpsele.getIndex();
    if (sele < 0) return 0;

    int count = 0;
    SeleAtomIterator iter(G, sele);
    while (iter.next() && count < buf_size) {
        AtomInfoType* ai = iter.getAtomInfo();
        out_buf[count++] = *(float*)((char*)ai + info->offset);
    }
    return count;
}
```

Int getter — analogous (handles int/schar/uint32, writes to int buffer).

String getter — returns JSON array via malloc'd buffer:
```cpp
int PyMOLWasm_GetAtomPropertyString(CPyMOL* pymolPtr, const char* selection,
                                      const char* property, char** out_ptr) {
    if (!pymolPtr || !property || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    const auto* info = PyMOL_GetAtomPropertyInfo(pymolPtr, property);
    if (!info) return 0;

    SelectorTmp tmpsele(G, safe_str(selection));
    int sele = tmpsele.getIndex();
    if (sele < 0) return 0;

    std::string json = "[";
    int count = 0;
    SeleAtomIterator iter(G, sele);
    while (iter.next()) {
        AtomInfoType* ai = iter.getAtomInfo();
        const char* str_val = nullptr;
        char tmp[8] = {};

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
        json += str_val ? str_val : "";
        json += "\"";
        count++;
    }
    json += "]";

    char* buf = (char*)malloc(json.size() + 1);
    if (!buf) return 0;
    memcpy(buf, json.c_str(), json.size() + 1);
    *out_ptr = buf;
    return count;
}
```

### Step 6: EXPORTED_FUNCTIONS

Add to CMakeLists.txt:
```
'_PyMOLWasm_SetAtomPropertyFloat','_PyMOLWasm_SetAtomPropertyInt',
'_PyMOLWasm_SetAtomPropertyString','_PyMOLWasm_GetAtomPropertyFloat',
'_PyMOLWasm_GetAtomPropertyInt','_PyMOLWasm_GetAtomPropertyString'
```

## Include Dependencies

Need to verify these are available (or add to existing includes in PyMOLWasm.cpp):
- `AtomInfo.h` — `AtomInfoType`, `AtomInfoAssignParameters`
- `Lex.h` — `LexAssign`, `LexStr`
- `PyMOL.h` — `PyMOL_GetAtomPropertyInfo` (already included)
- `AtomIterators.h` — `SeleAtomIterator` (already included)
- `Selector.h` — `SelectorTmp` (already included)

## Validation Checklist

Before calling complete:
1. `SetAtomPropertyFloat(p, "all", "b", 50.0)` sets all B-factors to 50
2. `SetAtomPropertyString(p, "chain A", "chain", "B")` renames chain A → B
3. `SetAtomPropertyString(p, "all", "elem", "C")` triggers `AtomInfoAssignParameters`
4. `GetAtomPropertyFloat(p, "all", "b", buf, 100)` returns B-factors in buffer
5. `GetAtomPropertyString(p, "chain A", "name", &ptr)` returns JSON `["CA","CB","N","C","O",...]`
6. Object invalidation fires after each setter call (representations update)

## What This Does NOT Cover

- **Conditional alter** (`"b = 50 if chain == 'A' else b"`) — not possible without expression eval. Users must use selection strings to target specific atoms.
- **Cross-property expressions** (`"b = q * 2"`) — not possible. Each call sets one property to one constant value.
- **Coordinate modification** (`alter_state` for x, y, z) — already handled by `PyMOLWasm_SetAtomCoordinates`. Could add `cPType_xyz_float` support later.

## Risk Assessment

**Low risk.** Uses existing tested infrastructure (`SeleAtomIterator`, `AtomPropertyInfo`, `LexAssign`). The critical part is side-effect handling — copied directly from `WrapperObjectAssignSubScript` in `PyMOL.cpp:1049-1064`.

## Estimated Effort

~250 lines of C++ total (6 exported functions + 1 private helper).
