# Deep Dive Analysis: WASM vs Native PyMOL — Per-Issue Breakdown

Each section examines the actual code, identifies what differs from open-source PyMOL, and assesses what can be implemented.

---

## Issue 1: Missing C API Surface

### What WASM Exposes (62 functions total)

The WASM API is defined in `pymol-open-source/layer5/PyMOLWasm.cpp` (1162 lines) and exported via `EXPORTED_FUNCTIONS` in `pymol-open-source/CMakeLists.txt`.

**57 WASM-specific functions:**

| Function | Wraps (C++ layer) | Category |
|---|---|---|
| `PyMOLWasm_Load` | `ExecutiveLoad()` | I/O |
| `PyMOLWasm_Show` | `ExecutiveSetRepVisMaskFromSele()` | Representation |
| `PyMOLWasm_Hide` | `ExecutiveSetRepVisMaskFromSele()` | Representation |
| `PyMOLWasm_Color` | `ExecutiveColorFromSele()` | Representation |
| `PyMOLWasm_Spectrum` | `ExecutiveSpectrum()` | Representation |
| `PyMOLWasm_RampNew` | `ExecutiveRampNew()` | Representation |
| `PyMOLWasm_Label` | `ExecutiveLabel()` | Representation |
| `PyMOLWasm_Zoom` | `ExecutiveWindowZoom()` | Camera |
| `PyMOLWasm_Center` | `ExecutiveCenter()` | Camera |
| `PyMOLWasm_Origin` | `ExecutiveOrigin()` | Camera |
| `PyMOLWasm_Turn` | `SceneRotateAxis()` | Camera |
| `PyMOLWasm_GetView` | `SceneGetView()` | Camera |
| `PyMOLWasm_SetView` | `SceneSetView()` | Camera |
| `PyMOLWasm_Delete` | `ExecutiveDelete()` | Objects |
| `PyMOLWasm_Remove` | `ExecutiveRemoveAtoms()` | Objects |
| `PyMOLWasm_Copy` | `ExecutiveCopy()` | Objects |
| `PyMOLWasm_CreateObject` | `ExecutiveSeleToObject()` | Objects |
| `PyMOLWasm_Select` | `ExecutiveSelect()` | Objects |
| `PyMOLWasm_GetDistance` | `ExecutiveGetDistance()` | Measurements |
| `PyMOLWasm_Distance` | `ExecutiveDistance()` | Measurements |
| `PyMOLWasm_GetAngle` | `ExecutiveGetAngle()` | Measurements |
| `PyMOLWasm_GetDihedral` | `ExecutiveGetDihe()` | Measurements |
| `PyMOLWasm_GetArea` | `ExecutiveGetArea()` | Measurements |
| `PyMOLWasm_GetAtomCount` | `SelectorCountAtoms()` | Queries |
| `PyMOLWasm_GetAtomCoordinates` | `SeleCoordIterator` | Queries |
| `PyMOLWasm_GetExtent` | `ExecutiveGetExtent()` | Queries |
| `PyMOLWasm_GetState` | `SceneGetState()` | Queries |
| `PyMOLWasm_GetFrame` | `SettingGetGlobal_i(cSetting_frame)` | Queries |
| `PyMOLWasm_SetSetting` | `SettingSetGlobal_f()` | Settings |
| `PyMOLWasm_SetSettingForSelection` | `ExecutiveSetSettingFromString()` | Settings |
| `PyMOLWasm_SetSettingString` | `ExecutiveSetSettingFromString()` | Settings |
| `PyMOLWasm_TransformObject` | `ExecutiveTransformObjectSelection()` | Transforms |
| `PyMOLWasm_TransformSelection` | `ExecutiveTransformSelection()` | Transforms |
| `PyMOLWasm_TranslateAtom` | `ExecutiveTranslateAtom()` | Transforms |
| `PyMOLWasm_ResetMatrix` | `ExecutiveResetMatrix()` | Transforms |
| `PyMOLWasm_Align` | `ExecutiveRMSPairs()` | Alignment |
| `PyMOLWasm_Bond` | `ExecutiveBond()` | Bonds |
| `PyMOLWasm_Unbond` | `ExecutiveBond(order=0, mode=1)` | Bonds |
| `PyMOLWasm_Fuse` | `ExecutiveFuse()` | Bonds |
| `PyMOLWasm_MapNew` | `ExecutiveMapNew()` | Maps |
| `PyMOLWasm_MapDouble` | `ExecutiveMapDouble()` | Maps |
| `PyMOLWasm_MapHalve` | `ExecutiveMapHalve()` | Maps |
| `PyMOLWasm_MapTrim` | `ExecutiveMapTrim()` | Maps |
| `PyMOLWasm_Isomesh` | `ExecutiveIsomeshEtc()` | Maps |
| `PyMOLWasm_SceneStore` | `MovieSceneStore()` | Scenes |
| `PyMOLWasm_SceneRecall` | `MovieSceneRecall()` | Scenes |
| `PyMOLWasm_MovieClear` | `MovieClearImages()` | Animation |
| `PyMOLWasm_MPlay` | `MoviePlay(G, 1)` | Animation |
| `PyMOLWasm_MStop` | `MoviePlay(G, 0)` | Animation |
| `PyMOLWasm_SetFrame` | `SceneSetFrame()` | Animation |
| `PyMOLWasm_SetAtomCoordinates` | `SeleCoordIterator` (write) | Coordinates |
| `PyMOLWasm_AssignSS` | `ExecutiveAssignSS()` | Structure |
| `PyMOLWasm_FixChemistry` | `ExecutiveFixChemistry()` | Structure |
| `PyMOLWasm_SymExp` | `ExecutiveSymExp()` | Symmetry |
| `PyMOLWasm_GetRayScene` | `RayPrepare()` + `buildScenePacket()` | Export |

**5 lifecycle functions:** `PyMOLOptions_New`, `PyMOL_NewWithOptions`, `PyMOL_Start`, `PyMOL_Free`, `PyMOLOptions_Free`

### What Native PyMOL Exposes (that WASM doesn't)

Native PyMOL's Python `cmd` module (`modules/pymol/`) exposes ~200+ commands via `Cmd.cpp` (layer4) which calls `Executive*` functions (layer3). The key missing categories and their C++ backing:

#### Structure Manipulation
| Missing Command | C++ Function | Difficulty |
|---|---|---|
| `alter` / `iterate` | `ExecutiveIterate()` — **exists but gutted by `#ifdef _WEBGL`** | Medium (see Issue 2) |
| `alter_state` / `iterate_state` | `ExecutiveIterateState()` — **also gutted** | Medium |
| `h_add` | `ExecutiveAddHydrogens()` — **exists in header** | Easy: 5-line wrapper |
| `sculpt_activate` | `ExecutiveSculptActivate()` — **exists** | Easy |
| `sculpt_iterate` | `ExecutiveSculptIterate()` — **exists** | Easy |
| `protect` / `deprotect` | `ExecutiveProtect()` — **exists** | Easy |
| `flag` | `ExecutiveFlag()` — **exists** | Easy |
| `rebuild` | `ExecutiveRebuildAll()` — **exists, void function** | Trivial |

#### File Export
| Missing Command | C++ Function | Difficulty |
|---|---|---|
| `get_pdbstr` / `get_str` | `MoleculeExporterGetStr()` — **exists and compiles** | Easy (see Issue 3) |
| `save` | `MoleculeExporterGetStr()` + VFS write | Easy |

#### Alignment & Fitting
| Missing Command | C++ Function | Difficulty |
|---|---|---|
| `super` | `ExecutiveAlign()` (same as align, different params) | Easy: same function, `transform=1` |
| `fit` / `rms` / `rms_cur` | `ExecutiveRMS()` — **exists** | Easy |
| `pair_fit` | `ExecutiveRMSPairs()` — **already partially used by Align** | Easy |
| `cealign` | Requires `layer4/CEAlign.cpp` | Medium: separate algorithm |

#### Symmetry
| Missing Command | C++ Function | Difficulty |
|---|---|---|
| `get_symmetry` | `ExecutiveGetSymmetry()` — **exists, returns floats** | Easy |
| `set_symmetry` | `ExecutiveSetSymmetry()` — **exists** | Easy |

#### Rendering
| Missing Command | C++ Function | Difficulty |
|---|---|---|
| `set_color` | `ColorGetIndex()` + `ColorDef()` in `layer1/Color.cpp` | Easy |
| `set_object_color` | `ExecutiveSetObjectColor()` — **exists** | Easy |
| `volume` | `ExecutiveVolume()` — **exists** | Medium: needs volume color ramp |

### Implementation Assessment

**Trivial (< 10 lines each, just wire up existing Executive* calls):** `rebuild`, `h_add`, `protect`/`deprotect`, `flag`, `sculpt_activate`, `sculpt_iterate`, `set_color`, `set_object_color`, `get_symmetry`, `set_symmetry`

**Easy (10-30 lines, pattern matches existing WASM functions):** `get_str`/`save` (file export), `super`, `fit`/`rms`, `pair_fit`, `count_states`, `orient`

**Medium (new logic or data marshaling):** `alter`/`iterate` (needs non-Python evaluator), `cealign`, `volume`/`volume_color`

---

## Issue 2: No `alter` / `iterate` — The Big Gap

### How Native PyMOL Implements It

**Call chain:** `cmd.alter(selection, expression)` → `Cmd.cpp` `Cmd_alter()` → `ExecutiveIterate()` (layer3/Executive.cpp:10182)

**The critical code** in `Executive.cpp`:
```cpp
pymol::Result<int> ExecutiveIterate(PyMOLGlobals* G, const char* str1,
    const char* expr, int read_only, int quiet, PyObject* space)
{
  ObjectMoleculeOpRec op1;
  ObjectMoleculeOpRecInit(&op1);
#ifdef _WEBGL              // <--- THIS IS THE PROBLEM
#endif                     // <--- Empty block — Python eval stripped out
  SelectorTmp tmpsele1(G, str1);
  int sele1 = tmpsele1.getIndex();
  op1.i1 = 0;
  if (sele1 >= 0) {
    op1.code = OMOP_ALTR;
    op1.i2 = read_only;
#ifdef _WEBGL              // <--- Python expression pointer not set
#else
    op1.s1 = expr;         // expression string
    op1.py_ob1 = space;    // Python namespace
#endif
    ExecutiveObjMolSeleOp(G, sele1, &op1);
  }
}
```

The function **exists and compiles** in the WASM build, but the `_WEBGL` guards strip out the Python expression (`op1.s1 = expr`) so it does nothing. The same applies to `ExecutiveIterateState()`.

### AtomInfoType Struct (layer2/AtomInfo.h:248-380)

Every atom has these modifiable fields:

| Field | Type | PyMOL Property Name |
|---|---|---|
| `b` | `float` | B-factor |
| `q` | `float` | Occupancy |
| `vdw` | `float` | Van der Waals radius |
| `partialCharge` | `float` | Partial charge |
| `color` | `int` | Color index |
| `resv` | `int` | Residue number |
| `formalCharge` | `signed char` | Formal charge |
| `flags` | `unsigned int` | Atom flags |
| `visRep` | `int` | Representation visibility bitmask |
| `protons` | `signed char` | Atomic number |
| `geom` | `signed char` | Geometry type |
| `valence` | `signed char` | Valence/degree |
| `cartoon` | `signed char` | Cartoon type |
| `hetatm` | `bool` | HETATM flag |
| `segi` | `lexidx_t` | Segment ID (lexicon index) |
| `chain` | `lexidx_t` | Chain (lexicon index) |
| `resn` | `lexidx_t` | Residue name (lexicon index) |
| `name` | `lexidx_t` | Atom name (lexicon index) |
| `label` | `lexidx_t` | Label text (lexicon index) |
| `textType` | `lexidx_t` | Text type (lexicon index) |
| `custom` | `lexidx_t` | Custom property (lexicon index) |
| `elem` | `ElemName` (char[5]) | Element symbol |
| `ssType` | `SSType` (char[2]) | Secondary structure type |
| `alt` | `Chain` (char[2]) | Alternate conformation |
| `inscode` | `char` | Insertion code |
| `stereo` | `unsigned char:2` | Stereochemistry |

Note: String properties (segi, chain, resn, name) use `lexidx_t` — a lexicon index, not a raw string. Setting them requires `LexAssign(G, ai->field, "value")`.

### Existing Precedent: SetAtomCoordinates

`PyMOLWasm_SetAtomCoordinates` (PyMOLWasm.cpp:916-941) iterates atoms via `SeleCoordIterator` and writes coordinates. An `alter`-like function would use the same `SeleCoordIterator` pattern but write to `AtomInfoType` fields instead.

### What Can Be Implemented

**Option A: Property-specific functions** (simplest)
```cpp
// Example: SetBFactor(pymol, "chain A", 50.0)
int PyMOLWasm_SetBFactor(CPyMOL* pymolPtr, const char* selection, float value) {
    // iterate matching atoms, set ai->b = value
}
```
Pro: Type-safe, simple. Con: One function per property = API bloat.

**Option B: Generic SetAtomProperty with enum** (recommended)
```cpp
enum AtomProperty { kPropB, kPropQ, kPropVdw, kPropColor, kPropCharge, ... };
int PyMOLWasm_SetAtomProperty(CPyMOL* pymolPtr, const char* selection,
                               int property, float value);
int PyMOLWasm_SetAtomPropertyStr(CPyMOL* pymolPtr, const char* selection,
                                  int property, const char* value);
```
Pro: Single function covers all properties. Con: Need separate float/string variants.

**Option C: Re-enable ExecutiveIterate with a non-Python evaluator** (most complete)

The WASM build already uses `cExecutiveLabelEvalAlt` in `PyMOLWasm_Label` — an alternate expression evaluator that doesn't need Python. A similar alternate evaluator for `alter` would support simple assignments like `b=50.0` or `chain='B'` without CPython.

This would require writing a mini-expression parser in C++ that handles:
- `b=50.0`, `q=1.0`, `color=4` (numeric assignments)
- `chain='A'`, `resn='ALA'`, `name='CA'` (string assignments)
- `ss='H'`, `elem='C'` (short string assignments)

**Difficulty: Medium.** The iterator infrastructure exists; the gap is the expression evaluator. Option B is ~50 lines per property for a dozen properties. Option C is ~200-300 lines for a mini-parser.

### Read-Only Iteration (iterate)

For read-only queries, the WASM API needs functions that return atom property data:
```cpp
int PyMOLWasm_GetAtomProperty(CPyMOL* pymolPtr, const char* selection,
                               int property, float* out_buffer, int buffer_size);
```
This follows the exact pattern of `GetAtomCoordinates` but reads from `AtomInfoType` fields instead of `CoordSet`.

---

## Issue 3: No File Export

### How Native PyMOL Exports Files

**Call chain:** `cmd.get_str(format, selection)` → `Cmd.cpp` `CmdGetStr()` (line 3891) → `MoleculeExporterGetStr()`

**Key function:** `MoleculeExporterGetStr()` in `layer3/MoleculeExporter.cpp` (line 1948)

```cpp
pymol::vla<char> MoleculeExporterGetStr(PyMOLGlobals* G,
    const char* format,      // "pdb", "sdf", "mol2", "cif", "mol", "xyz", "mae"
    const char* selection,   // default "all"
    int state,               // -1 for current
    const char* ref_object,
    int ref_state,
    int multi,
    bool quiet);
```

**This function exists, compiles, and works in the WASM build.** It has no `_WEBGL` guards. It returns a `pymol::vla<char>` (variable-length array of characters) — essentially a C string. The export logic is **entirely decoupled from file I/O** — it produces an in-memory buffer, and the Python `cmd.save()` is what writes that buffer to disk.

**Supported export formats** (from MoleculeExporter.cpp classes):
| Format String | Exporter Class | Line | Description |
|---|---|---|---|
| `"pdb"` | `MoleculeExporterPDB` | 440 | Standard PDB format |
| `"pqr"` | `MoleculeExporterPQR` | 601 | PDB with charge/radius |
| `"cif"` | `MoleculeExporterCIF` | 623 | mmCIF format |
| `"pmcif"` | `MoleculeExporterPMCIF` | 768 | PyMOL-extended CIF |
| `"mol"` | `MoleculeExporterMOL` | 815 | MDL MOL (V2000) |
| `"sdf"` | `MoleculeExporterSDF` | 944 | Structure-Data Format |
| `"mol2"` | `MoleculeExporterMOL2` | 1004 | Sybyl MOL2 |
| `"mae"` | `MoleculeExporterMAE` | 1115 | Maestro format |
| `"xyz"` | `MoleculeExporterXYZ` | 1465 | XYZ coordinate format |

**Note on binary formats:** MMTF (`MoleculeExporterMMTF`, line 1511) and BinaryCIF (`MoleculeExporterBCIF`, line 1639) exist but are gated behind `_PYMOL_NO_MSGPACKC`, which IS defined in this build. They cannot be used without adding the msgpackc dependency.

### No VFS Involved

Despite what one might assume, **no Emscripten VFS is used** in either direction:
- **Load:** `PyMOLWasm_Load` passes content directly as `const char* content` with `content_length`. `ExecutiveLoad()` receives it as an in-memory buffer (empty string `""` as the filename argument means "use the content buffer").
- **Export:** `MoleculeExporterGetStr()` returns data directly as a `pymol::vla<char>` in memory — no file is ever written.

### How GetRayScene Works (the precedent pattern)

`PyMOLWasm_GetRayScene` (PyMOLWasm.cpp:954-1096) returns a `malloc`'d string via an output pointer:
```cpp
int PyMOLWasm_GetRayScene(CPyMOL* pymolPtr, int width, int height,
                           char** out_ptr, int unused) {
    // ... build JSON string ...
    char* buf = (char*)malloc(json_len + 1);
    memcpy(buf, json.c_str(), json_len + 1);
    *out_ptr = buf;
    return json_len;
}
```

### Implementing File Export

A `PyMOLWasm_GetStr` function following the same pattern:

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

    int len = VLAGetSize(vla);
    char* buf = (char*)malloc(len + 1);
    if (!buf) return 0;
    memcpy(buf, vla.data(), len);
    buf[len] = '\0';
    *out_ptr = buf;
    return len;
}
```

**Difficulty: Trivial.** ~15 lines. The export engine is fully functional — it just needs a WASM wrapper. The Emscripten VFS is not needed; `MoleculeExporterGetStr` returns data directly in memory.

### What's NOT Exportable
- **Session files (.pse/.psw):** There is **no `ExecutiveSaveSession` in this codebase.** The only `ExecutiveSave*` function is `ExecutiveSaveUndo()` (Executive.cpp:8079), which is unrelated. Session save is entirely Python-side: `cmd.get_session()` returns a Python dict, which is then pickled via `cPickle.dumps`. **Not implementable** in the WASM build without either re-implementing session serialization in C++ or embedding a Python runtime.
- **Binary formats (MMTF, BinaryCIF):** Require the msgpackc library, which is excluded by the `_PYMOL_NO_MSGPACKC` define.
- **Image export (.png):** Handled externally by WebGPU renderer, not relevant to the molecular data API.

---

## Issue 4: ARM64 FMA Float Precision

### Build Configuration

**CMakeLists.txt** (pymol-open-source/CMakeLists.txt):
```cmake
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s USE_LIBPNG=1 -s USE_FREETYPE=1 -Wno-narrowing")
```

**No floating-point flags are set.** No `-ffp-contract`, no `-ffast-math`, no `-fno-fast-math`. The issue is not in WASM's build flags — it's in the **native** PyMOL binary's compilation, where the ARM64 compiler defaults to `-ffp-contract=fast` (allowing FMA fusion).

### The Affected Code Path

**`IsosurfInterpolate()`** in `layer0/Isosurf.cpp:126-132`:
```cpp
static void IsosurfInterpolate(CIsosurf* I, float* v1, float* l1,
                                float* v2, float* l2, float* pt) {
    float ratio;
    ratio = (I->Level - *l1) / (*l2 - *l1);   // FMA candidate: Level - l1
    pt[0] = v1[0] + (v2[0] - v1[0]) * ratio;  // FMA candidate: (v2-v1)*ratio + v1
    pt[1] = v1[1] + (v2[1] - v1[1]) * ratio;  // FMA candidate
    pt[2] = v1[2] + (v2[2] - v1[2]) * ratio;  // FMA candidate
}
```

The expression `v1[i] + (v2[i] - v1[i]) * ratio` is the classic FMA pattern:
- **With FMA:** `fma(v2[i] - v1[i], ratio, v1[i])` — one rounding at the end
- **Without FMA (WASM):** `tmp = (v2[i] - v1[i]) * ratio; result = v1[i] + tmp` — two roundings

This function is called **thousands of times** per isosurface (once per edge intersection in the marching cubes grid). The ~3e-5 per-vertex differences accumulate to visible sub-pixel edge shifts.

### Where It's Called

`IsosurfInterpolate` appears 14 times in `Isosurf.cpp`, in the edge-finding loops:
- Lines 1459, 1474, 1505, 1521, 1550, 1566 (first pass)
- Lines 1954, 1965, 1990, 2001, 2027, 2038 (second pass)

Each call interpolates along one grid edge to find where the isosurface crosses.

### Test Impact

Only **one test case** is affected: `wasm_isomesh_carve` in `tests/wasm-parity-cases.ts:262`:
```typescript
knownPlatformPsnr: 45,
```

The test harness uses this override at `tests/wasm-parity.ts:782`:
```typescript
const passThreshold = testCase.knownPlatformPsnr ?? 60;
```

All other 99 test cases pass at the default 60 dB threshold.

### Can It Be Fixed?

| Approach | Feasibility | Impact |
|---|---|---|
| Add `-ffp-contract=off` to WASM build | No effect — WASM doesn't have FMA | None |
| Add `-ffp-contract=off` to native build | Would fix it if you rebuild native PyMOL | Requires native rebuild |
| Add `#pragma STDC FP_CONTRACT OFF` to Isosurf.cpp | Only affects native build on recompile | Targeted fix |
| Accept the difference | Current approach | `knownPlatformPsnr: 45` |

**Verdict:** This is inherent to platform differences. The WASM code is correct. The difference only manifests when comparing against an ARM64-compiled native binary. On x86_64 (no FMA by default), both paths would likely match.

---

## Issue 5: No `label_runs` Batching

### Complete Data Flow: Label String to JSON

#### Step 1: Label Creation
`RepLabel::render()` (layer2/RepLabel.cpp) → calls `TextRenderRay()` for each labeled atom.

#### Step 2: Text → Individual Glyphs
`TextRenderRay()` (layer1/Text.cpp) → `CFontGLUT::RenderRay()` (layer1/FontGLUT.cpp:416-436):
```cpp
while ((c = *(st++))) {          // For each character in the string
    if ((c >= first) && (c < last)) {
        ch = font_info->ch[c - first];
        if (ch) {
            int id = CharacterFind(G, &fprnt);
            if (!id)
                id = CharacterNewFromBitmap(G, ch->width, ch->height, ...);
            if (id)
                ray->character(id);   // ONE primitive per glyph
        }
    }
}
```

#### Step 3: CRay::character() Creates TWO Primitives Per Glyph
`CRay::character()` (layer1/Ray.cpp:6713-6842):
- Creates **two CPrimitive entries** (two triangles forming a textured quad)
- Each primitive is 172 bytes in memory (`sizeof(CPrimitive)`)
- Encodes glyph bitmap coordinates in the `c1`/`c2`/`c3` color fields
- Advances the text cursor position in 3D space

**Per glyph: 2 primitives = 344 bytes in CPrimitive array**

#### Step 4: Serialization in RayBackend.cpp
`buildScenePacket()` (layer1/RayBackend.cpp:91-225):
- Copies each primitive into a `PrimitivePacket` (10 scalars + 12 vec3s = 46 values = 184 bytes)
- For `cPrimCharacter`: copies `char_id`, `v1`, `v2`, `v3`, `n0`-`n3`, `c1`-`c3`, `ic`
- Collects unique character bitmaps from the `Character` cache

`serializeScenePacketJSON()` (RayBackend.cpp:231-307):
- Each primitive = 46 floats in the flat JSON array using `%.9g` format
- Each float averages ~8-12 chars in JSON

**Per glyph JSON cost: 2 primitives x ~350-480 bytes = ~700-960 bytes of JSON**

#### Step 5: Character Bitmaps
Each unique glyph bitmap is serialized as:
```json
{"char_id":42,"w":8,"h":13,"rgba":[0,0,0,0, ... 416 values ...]}
```
A typical 8x13 GLUT font glyph = 416 RGBA bytes = ~1,200-1,600 chars of JSON. Bitmaps are deduplicated (only unique `char_id`s), so a 10-character label "RESIDUE CA" with 7 unique characters sends 7 bitmaps.

#### What's Redundant Across Glyphs in One Label

For all glyphs in a single label, the following are **identical or derivable**:
- **n0, n1, n2, n3**: All four normals = same screen-facing z-normal. 24 floats repeated per glyph.
- **ic** (interior color): Same for the entire label. 6 floats repeated.
- **trans, wobble, flags**: Same for entire label.
- **c1, c2, c3**: Encode glyph pixel dimensions — derivable from `char_id`'s bitmap.
- **v1, v2, v3**: Each glyph's quad is computable client-side from: label origin + glyph index + advance + screen-aligned axes + glyph dimensions.

### Current CRay Struct (Ray.h:107-182)

The `_CRay` struct has **NO `label_runs` field.** The relevant fields are:
- `CPrimitive *Primitive` — flat array of all primitives (spheres, triangles, characters, etc.)
- `int NPrimitive` — count
- No grouping, no metadata about text runs

### Byte Count Comparison

For "ALA 123" (7 characters):

| Approach | JSON bytes |
|---|---|
| Current: 14 `cPrimCharacter` primitives | ~5,600-6,700 |
| label_runs: 1 batched object | ~250-350 |
| **Savings** | **~94-95%** |

### What label_runs Would Look Like

A hypothetical `label_runs` JSON design:
```json
{
  "label_runs": [
    {
      "text": "ALA 123",
      "origin": [x, y, z],
      "normal": [nx, ny, nz],
      "x_axis": [xx, xy, xz],
      "y_axis": [yx, yy, yz],
      "scale": 0.0123,
      "color": [r, g, b],
      "trans": 0.0,
      "char_ids": [12, 45, 12, 67, 89, 90, 91],
      "font_id": 5
    }
  ],
  "char_metrics": {
    "12": {"w": 8, "h": 13, "xorig": 0, "yorig": 11, "advance": 8}
  }
}
```

The GPU renderer would compute quad vertices from origin + per-glyph advance along `x_axis`, looking up `char_metrics` for dimensions. This eliminates transmitting all v1/v2/v3 vertices and repeated normals.

**C++ struct equivalent:**
```cpp
struct LabelRun {
    std::string text;          // "ALA 42"
    float position[3];         // 3D anchor point
    float normal[3];           // screen-facing z-normal
    float x_axis[3];           // screen-right in world space
    float y_axis[3];           // screen-up in world space
    float scale;               // world-units-per-pixel at this depth
    float color[3];            // text color
    float trans;               // transparency
    std::vector<int> char_ids; // per-glyph bitmap IDs
    int font_id;               // GLUT font ID
};
std::vector<LabelRun> label_runs;  // Added to CRay
```

**Benefits of batching:**
- A 7-char label → 1 LabelRun (~300 bytes) instead of 14 primitives (~6,000 bytes JSON)
- **94-95% reduction** in JSON size for label-heavy scenes
- GPU renderer can use native text layout instead of per-glyph texture quads

**Costs:**
- Must modify `CRay::character()` to accumulate into runs instead of individual primitives
- Must track text cursor state across character calls (position, color, font)
- GPU renderer must implement text layout (currently handled by the glyph quad approach)
- `FontGLUT::RenderRay()` calls `ray->character()` per glyph with no context about grouping — runs would need bracketing (`beginTextRun()` / `endTextRun()`)
- Must add per-glyph metrics (`xorig`, `yorig`, `advance`) to the serialized scene

### Implementation Difficulty

**Medium-Hard.** The primary challenge is that `CFontGLUT::RenderRay()` has no concept of "text runs" — it processes characters individually. Adding batching requires:
1. Adding `beginTextRun()`/`endTextRun()` to `CRay` (~20 lines)
2. Modifying `FontGLUT::RenderRay()` to bracket its character loop (~5 lines)
3. Accumulating text in `CRay` instead of creating individual primitives (~50 lines)
4. Serializing `label_runs` in `RayBackend.cpp` (~30 lines)
5. Updating GPU renderer to handle text runs (~100+ lines)

Total: ~200+ lines of C++ changes across 4 files.

---

## Issue 6: Missing Introspection

### What Exists in WASM

| Function | Returns | Used For |
|---|---|---|
| `GetView` | 25 floats (view matrix) | Camera state |
| `GetExtent` | 6 floats (bounding box) | Spatial bounds |
| `GetAtomCount` | int | Selection size |
| `GetAtomCoordinates` | float array | Atom positions |
| `GetAngle` | float | Angle measurement |
| `GetDihedral` | float | Dihedral angle |
| `GetDistance` | float | Distance measurement |
| `GetArea` | float | Surface area |
| `GetState` | int | Current state index |
| `GetFrame` | int | Current frame number |

### What's Missing and Where It Lives in C++

#### Object/Selection Listing

**`get_names`** → `ExecutiveGetNames()` (Executive.cpp:8849-8878)
```cpp
pymol::Result<std::vector<const char*>> ExecutiveGetNames(
    PyMOLGlobals* G, int mode, int enabled_only, const char* s0)
```
Returns a vector of `const char*` pointers to object/selection names. Supports modes: all, objects-only, selections-only, public-only, groups, non-groups.

**WASM wrapper pattern:**
```cpp
int PyMOLWasm_GetNames(CPyMOL* pymolPtr, int mode, char** out_ptr) {
    auto result = ExecutiveGetNames(G, mode, 0, "");
    // Serialize vector<const char*> to JSON array string
    // Return via malloc'd buffer (same as GetRayScene)
}
```
**Difficulty: Easy** (~20 lines). The function exists, returns simple data.

#### Object Type Queries

**`get_type`** → `ExecutiveGetType()` (Executive.h:527)
```cpp
pymol::Result<char const*> ExecutiveGetType(PyMOLGlobals* G, const char* name);
```
Returns "object:molecule", "object:map", "selection", etc.

**Difficulty: Trivial** (~10 lines).

#### Chain Listing

**`get_chains`** → `ExecutiveGetChains()` (Executive.h:475)
```cpp
pymol::Result<std::vector<const char*>> ExecutiveGetChains(
    PyMOLGlobals* G, const char* sele, int state);
```
Returns list of unique chain identifiers for atoms matching selection.

**Difficulty: Easy** (~15 lines). Same serialization pattern as `get_names`.

#### State Counting

**`count_states`** → `ExecutiveCountStates()` (Executive.h:490)
```cpp
int ExecutiveCountStates(PyMOLGlobals* G, const char* s1);
```
Returns number of states for objects matching selection.

**Difficulty: Trivial** (~5 lines).

#### Settings Query

**`get_setting`** → `ExecutiveGetSettingFromString()` (Executive.h:388)
```cpp
int ExecutiveGetSettingFromString(PyMOLGlobals* G, PyMOLreturn_value* result,
    int index, const char* sele, int state, int quiet);
```
Note: Uses `PyMOLreturn_value` which is a union type — would need adaptation for WASM. Alternatively, use the lower-level `SettingGetGlobal_f/i/s` functions directly.

**Simpler WASM approach:**
```cpp
float PyMOLWasm_GetSettingFloat(CPyMOL* pymolPtr, int setting_index) {
    return SettingGetGlobal_f(G, setting_index);
}
int PyMOLWasm_GetSettingInt(CPyMOL* pymolPtr, int setting_index) {
    return SettingGetGlobal_i(G, setting_index);
}
```
**Difficulty: Trivial** (~5 lines each).

#### Symmetry Data

**`get_symmetry`** → `ExecutiveGetSymmetry()` (Executive.h:660)
```cpp
pymol::Result<bool> ExecutiveGetSymmetry(PyMOLGlobals* G, const char* sele,
    int state, float* a, float* b, float* c, float* alpha, float* beta,
    float* gamma, char* sgroup);
```
Returns unit cell parameters and space group.

**Difficulty: Easy** (~15 lines). Output is 6 floats + a string.

#### Scene Listing

**`get_scene_list`** — No direct C++ function found in Executive.h. Scenes are stored in `MovieScene` objects. Would need to iterate the scene list.

Search needed in `MovieScene.cpp`/`MovieScene.h`.

**Difficulty: Medium** — needs to find scene enumeration API.

#### Color Queries

**`get_color_tuple`** → `ColorGet()` in `layer1/Color.cpp`
```cpp
void ColorGetRaw(PyMOLGlobals* G, int index, float* rgb);  // or similar
```

**Difficulty: Easy** (~10 lines).

#### Model Data (get_model equivalent)

The most complex missing introspection. Native `get_model` returns a full Python ChemPy model object with all atom properties, bonds, coordinates. The C++ backing is `ExecutiveSeleToChemPyModel()` — but it returns `PyObject*`, making it Python-dependent.

**WASM alternative:** Serialize atom data to JSON:
```cpp
int PyMOLWasm_GetModelJSON(CPyMOL* pymolPtr, const char* selection,
                            int state, char** out_ptr) {
    // Iterate selection, build JSON with atom properties + bonds + coords
}
```
This would iterate atoms via `SeleAtomIterator`, read `AtomInfoType` fields, and serialize. ~100-150 lines.

**Difficulty: Medium** (but very high value).

### Priority-Ordered Implementation Plan

| Priority | Function | Lines | Value |
|---|---|---|---|
| 1 | `GetNames` | ~20 | Enables object listing |
| 2 | `GetType` | ~10 | Object type identification |
| 3 | `CountStates` | ~5 | Multi-state queries |
| 4 | `GetChains` | ~15 | Structure exploration |
| 5 | `GetSettingFloat` / `GetSettingInt` | ~10 | Setting readback |
| 6 | `GetSymmetry` | ~15 | Crystallographic data |
| 7 | `GetColorTuple` | ~10 | Color queries |
| 8 | `GetModelJSON` | ~150 | Full atom data readback |

Total: ~235 lines to add comprehensive introspection.

---

## Summary: What Can Be Implemented

| Issue | Effort | Files to Modify |
|---|---|---|
| 1. Missing API (trivial functions) | ~150 lines | `PyMOLWasm.cpp`, `CMakeLists.txt` |
| 2. alter/iterate | ~200-300 lines | `PyMOLWasm.cpp`, `CMakeLists.txt` (new evaluator or property enum) |
| 3. File export | ~15 lines | `PyMOLWasm.cpp`, `CMakeLists.txt` |
| 4. FMA precision | 0 lines (accept) | None (platform inherent) |
| 5. label_runs batching | ~200+ lines | `Ray.h`, `Ray.cpp`, `FontGLUT.cpp`, `RayBackend.cpp`, `RayBackend.h` |
| 6. Introspection | ~235 lines | `PyMOLWasm.cpp`, `CMakeLists.txt` |

**Quickest wins:** File export (Issue 3, 15 lines) and trivial API additions (Issue 1, ~10 lines each).

**Highest impact:** Introspection (Issue 6) and alter/iterate (Issue 2).

**Not fixable in WASM:** FMA precision (Issue 4) — inherent to platform.

**Most complex:** label_runs batching (Issue 5) — touches the rendering pipeline across 5 files.
