# Plan: Issue 3 — File Export (GetStr)

## Goal
Add a single function `PyMOLWasm_GetStr` that exports molecular data as PDB, SDF, CIF, MOL2, or any other text format supported by `MoleculeExporterGetStr`.

## Why This Is Trivial
`MoleculeExporterGetStr()` already exists, compiles in WASM, has no `_WEBGL` guards, and returns an in-memory `pymol::vla<char>`. It just needs a thin C wrapper to expose it through the WASM boundary.

## Files Modified
1. `pymol-open-source/layer5/PyMOLWasm.cpp` — add 1 function (~15 lines)
2. `pymol-open-source/CMakeLists.txt` — add 1 entry to EXPORTED_FUNCTIONS

## Implementation

### Step 1: Add include (if not already present)

Check if `MoleculeExporter.h` is already included in PyMOLWasm.cpp. If not, add:
```cpp
#include "MoleculeExporter.h"
```

### Step 2: Add function to PyMOLWasm.cpp

```cpp
int PyMOLWasm_GetStr(CPyMOL* pymolPtr, const char* format,
                      const char* selection, int state, char** out_ptr) {
    if (!pymolPtr || !format || !out_ptr) return 0;
    *out_ptr = nullptr;
    PyMOLGlobals* G = PyMOL_GetGlobals(pymolPtr);
    if (!G) return 0;

    auto vla = MoleculeExporterGetStr(G, format, safe_str(selection),
                                       state, "", -1, -1, true);
    if (!vla) return 0;

    size_t len = VLAGetSize(vla);
    char* buf = (char*)malloc(len + 1);
    if (!buf) return 0;
    memcpy(buf, vla.data(), len);
    buf[len] = '\0';
    *out_ptr = buf;
    return (int)len;
}
```

**Signature breakdown:**
- `format`: `"pdb"`, `"sdf"`, `"cif"`, `"mol2"`, `"mol"`, `"pqr"`, `"xyz"`, `"mae"`, `"pmcif"`
- `selection`: atom selection string, defaults to `"all"` if empty
- `state`: `-1` for current state, `0` for all states
- `out_ptr`: receives malloc'd string; caller must `free()`
- **Returns:** length of string (0 on failure)

**Pattern:** Identical to `PyMOLWasm_GetRayScene` — malloc'd output buffer, length as return value.

### Step 3: Add to EXPORTED_FUNCTIONS in CMakeLists.txt

Add `'_PyMOLWasm_GetStr'` to the EXPORTED_FUNCTIONS list.

### Step 4: Verify build

```bash
cd pymol-open-source/build && emcmake cmake .. && emmake make -j$(nproc)
```

## JavaScript Usage

```javascript
const formatPtr = Module.stringToNewUTF8("pdb");
const selePtr = Module.stringToNewUTF8("all");
const outPtrPtr = Module._malloc(4);  // pointer to char*

const len = Module._PyMOLWasm_GetStr(pymol, formatPtr, selePtr, -1, outPtrPtr);
if (len > 0) {
    const strPtr = Module.HEAP32[outPtrPtr >> 2];
    const pdbString = Module.UTF8ToString(strPtr);
    Module._free(strPtr);
}

Module._free(outPtrPtr);
Module._free(selePtr);
Module._free(formatPtr);
```

## Supported Formats (All Already Work)

| Format | String | Class in MoleculeExporter.cpp |
|---|---|---|
| PDB | `"pdb"` | `MoleculeExporterPDB` (line 440) |
| PQR | `"pqr"` | `MoleculeExporterPQR` (line 601) |
| mmCIF | `"cif"` | `MoleculeExporterCIF` (line 623) |
| PyMOL CIF | `"pmcif"` | `MoleculeExporterPMCIF` (line 768) |
| MOL V2000 | `"mol"` | `MoleculeExporterMOL` (line 815) |
| SDF | `"sdf"` | `MoleculeExporterSDF` (line 944) |
| MOL2 | `"mol2"` | `MoleculeExporterMOL2` (line 1004) |
| Maestro | `"mae"` | `MoleculeExporterMAE` (line 1115) |
| XYZ | `"xyz"` | `MoleculeExporterXYZ` (line 1465) |

## What This Does NOT Cover
- **Binary formats** (MMTF, BinaryCIF) — require msgpackc library, excluded by `_PYMOL_NO_MSGPACKC`
- **Session files** (.pse/.psw) — require Python pickling, not implementable
- **Image export** (.png) — handled by the WebGPU renderer, outside this API

## Risk Assessment
**Zero risk.** One new function, no changes to existing code, uses a well-tested exporter.

## Estimated Effort
15 lines of C++. The simplest change in this entire issue set.
