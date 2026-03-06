# Plan: Issue 4 — ARM64 FMA Float Precision

## Goal
Document the root cause and determine whether any action is needed.

## Root Cause
Emscripten/Clang defaults to `-ffp-contract=off` (no FMA). Apple Clang on ARM64 defaults to `-ffp-contract=on` (freely contracts `a*b+c` → `fmadd`). This causes ~3e-5 per-vertex differences in isosurface interpolation, measurable as a PSNR drop in the `wasm_rep_mesh` test.

## Affected Code
- `IsosurfInterpolate` (layer2/Isosurf.cpp:126-134) — 14 call sites
- `FieldInterpolatef` (layer2/Field.cpp:186) — 8 FMA candidates
- `RepMeshNew` grid construction (layer2/RepMesh.cpp:970-1053)
- `RepMeshGetSolventDots` (layer2/RepMesh.cpp:1257-1260)

## Affected Tests
Only 1 of 100 test cases: `wasm_rep_mesh` (tests/wasm-parity-cases.ts:243), which uses `knownPlatformPsnr: 45` instead of the default 60 dB threshold.

## Options

### Option A: Accept the difference (Recommended)
- **Do nothing.** The WASM code is correct IEEE 754.
- The `knownPlatformPsnr: 45` accommodation is already in place.
- On x86_64 reference builds (no FMA by default), both paths match.

### Option B: Add pragma to native build
If you control the native reference build, add to `Isosurf.cpp`, `Field.cpp`, and `RepMesh.cpp`:
```cpp
#pragma clang fp contract(off)
```
This forces the native ARM64 build to match WASM behavior. Slight performance reduction (FMA is ~1 cycle vs ~2 for separate mul+add), but isosurface computation is not the bottleneck.

### Option C: Add `-ffp-contract=off` globally to native CMake
```cmake
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -ffp-contract=off")
```
More sweeping — affects all code, not just isosurface. Not recommended unless you want exact cross-platform reproducibility everywhere.

## Recommendation
**Option A.** This is a platform characteristic, not a bug. The WASM build is standards-compliant. The test already accommodates the difference. No code changes needed.

## Files Modified
None.

## Estimated Effort
0 lines. This plan is documentation-only.
