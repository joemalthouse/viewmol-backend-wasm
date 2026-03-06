# Current Differences: WASM vs Native PyMOL

The core molecular engine (atom storage, bond computation, representation generation, coordinate transforms, settings) is the same C++ code. The WASM C API produces identical internal state to native PyMOL for all 100 tested scenarios (100/100 PASS, 99.27 dB mean PSNR). The differences below are gaps in the API surface and platform-level numerical precision.

## 1. Missing C API Surface

The WASM build exposes ~60 functions (55 WASM-specific + 5 lifecycle). Here's what's missing compared to native PyMOL's full command set:

### Currently exposed functions (for reference)

Load/IO: `Load`, `GetRayScene`
Representation: `Show`, `Hide`, `Color`, `Spectrum`, `RampNew`, `Label`
Camera: `Zoom`, `Center`, `Origin`, `Turn`, `GetView`, `SetView`
Objects: `Delete`, `Remove`, `Copy`, `CreateObject`, `Select`
Measurements: `GetDistance`, `Distance`, `GetAngle`, `GetDihedral`, `GetArea`
Queries: `GetAtomCount`, `GetAtomCoordinates`, `GetExtent`, `GetState`, `GetFrame`
Settings: `SetSetting`, `SetSettingForSelection`, `SetSettingString`
Transforms: `TransformObject`, `TransformSelection`, `TranslateAtom`, `ResetMatrix`
Alignment: `Align`
Bonds: `Bond`, `Unbond`, `Fuse`
Maps: `MapNew`, `MapDouble`, `MapHalve`, `MapTrim`, `Isomesh` (supports mesh_mode: 0=isomesh, 1=isosurface, 2=isodot)
Scenes: `SceneStore`, `SceneRecall`, `MovieClear`
Animation: `MPlay`, `MStop`, `SetFrame`
Coordinates: `SetAtomCoordinates`
Structure: `AssignSS`, `FixChemistry`
Symmetry: `SymExp`
Lifecycle: `PyMOLOptions_New`, `PyMOL_NewWithOptions`, `PyMOL_Start`, `PyMOL_Free`, `PyMOLOptions_Free`

### Structure manipulation (missing)
- `alter` / `alter_state` — modify atom properties (b-factor, occupancy, name, resn, chain, etc.)
- `iterate` / `iterate_state` — read atom properties programmatically
- `sculpt_activate` / `sculpt_iterate` — real-time energy minimization
- `clean` — geometry cleanup
- `h_add` / `h_fill` — add hydrogens
- `remove_picked` — remove picked atoms
- `protect` / `deprotect` — atom protection from modification
- `flag` — set atom flags
- `edit` — enter editing mode for bond/atom manipulation

### File I/O (missing)
- `save` / `export` — write PDB, SDF, MOL2, etc. (no `get_pdbstr`, `get_sdfstr`, etc.)
- `png` / `mpng` — image export (handled externally via WebGPU, but no molecule file export)
- `log` / `log_close` — command logging
- `fetch` — download from PDB/RCSB (would need network access)

### Selections & queries (missing)
- `get_model` / `get_object_list` — introspect loaded objects
- `get_names` — list all object/selection names
- `get_chains` / `get_residues` — structural queries
- `id_atom` / `index` — atom identification
- `phi_psi` — Ramachandran angles

Note: `count_atoms` is available via `GetAtomCount(selection)` which accepts full selection strings and is functionally complete.

### Movie/animation (missing)
- `mset` / `mdo` / `mappend` — movie frame scripting
- `mclear` exists but `mmatrix` / `mview` don't
- `morph` — trajectory morphing
- Frame-by-frame scene manipulation

### Maps & volumes (partially missing)
- `volume` / `volume_color` — volumetric rendering
- `map_set` / `map_set_border` — map manipulation
- `gradient` — gradient map generation

Note: `map_generate` equivalent exists as `MapNew`. `isosurface` and `isodot` are available via the `Isomesh` function's `mesh_mode` parameter (0=isomesh, 1=isosurface, 2=isodot).

### Advanced rendering settings (missing)
- `set_color` — define custom RGB colors by name
- `set_object_color` — per-object default color
- `util.cbaw` / `util.cbc` / `util.ss` — color utility shortcuts
- `rebuild` — force representation rebuild

Note: `bg_color` is available via `SetSettingString(bg_rgb_index, "colorname")` or `SetSetting(bg_rgb_index, value)`.

### Alignment & superposition (missing)
- `super` — structure-based superposition (only `align` exists)
- `cealign` — CE alignment
- `pair_fit` — atom pair fitting
- `fit` — RMS fitting
- `rms` / `rms_cur` — RMS calculation

### Symmetry (missing)
- `symexp` exists but `set_symmetry` / `get_symmetry` don't
- Space group manipulation

### Scenes & states (partially missing)
- `get_scene_list` — enumerate stored scenes
- Multi-state manipulation (`split_states`, `join_states`, `create` with state selection)

Note: `SceneStore` accepts a `message` parameter, so scene messages are supported. Store and recall are functional.

## 2. No `alter` / `iterate` — The Big Gap

This is the most significant missing capability. In native PyMOL, `alter` and `iterate` are how you programmatically read/write atom properties:

```python
cmd.alter("chain A", "b=50.0")           # set B-factors
cmd.alter("resn ALA", "color=4")         # per-atom color
cmd.iterate("all", "print(name, resn)")  # read properties
cmd.alter_state(1, "all", "(x,y,z)=(x+1,y,z)")  # translate atoms
```

These execute arbitrary Python expressions per-atom. The WASM equivalent would need either:
- Individual C functions for each property (`SetBFactor`, `SetOccupancy`, `SetChain`, etc.)
- A generic `SetAtomProperty(pymol, selection, property_enum, value)` function that switches on property type

`SetAtomCoordinates` already exists as a precedent for the coordinate case.

## 3. No File Export

`PyMOLWasm_Load` writes to the Emscripten VFS and loads, but there's no reverse path. Adding `PyMOLWasm_Save` would call `ExecutiveSaveSession` / `MoleculeExport` and read the result back from the VFS into a caller-provided buffer (same pattern as `GetRayScene`).

The native Python layer has extensive export functions (`get_pdbstr`, `get_sdfstr`, `get_cifstr`, `get_mol2str`, `get_str`, `get_bytes`, `save`, `get_session`, etc. in `exporting.py`) but none are exposed through the WASM C API.

## 4. ARM64 FMA Float Precision

Confirmed: 4,157 FMA instructions in the native binary. The isosurface pipeline (`Isosurf.cpp` → `IsosurfInterpolate`, `RepMesh.cpp` → grid construction) produces vertex coordinates that differ by ~3e-5 between native ARM64 and WASM. This is inherent to the platform — not fixable without either:
- Rebuilding native PyMOL from source with `-ffp-contract=off` (disabling FMA)
- Or accepting the difference (current approach, `knownPlatformPsnr: 45`)

On x86_64 hosts, this difference would likely vanish since both paths would use SSE without FMA (unless AVX2+FMA3 is enabled).

Note: The CMakeLists.txt does not set any `-ffp-contract` or `-ffast-math` flags. The FMA differences arise from the compiler's default behavior on ARM64 targets. Only one test case (`wasm_isomesh_carve`) uses `knownPlatformPsnr: 45` to accommodate this.

## 5. No `label_runs` Batching

The native fork adds a `label_runs` vector to `CRay` that groups consecutive character primitives into runs (text string + position + style). The WASM build processes labels as individual `cPrimCharacter` primitives (one per glyph) in `RayBackend.cpp`. This works correctly — labels render identically (99 dB) — but the per-glyph approach sends more data over the wire than a batched text run would.

Note: `label_runs` does not exist anywhere in this repository's source code. It is described as a feature of an external native fork. The `CRay` struct in this codebase has no `label_runs` field. The current implementation collects unique character bitmaps (`CharBitmapPacket`) from `cPrimCharacter` primitives and serializes them individually in the JSON scene packet.

## 6. Missing Introspection

No way to query the current state from the WASM side:
- What objects are loaded? What representations are active?
- What's the current color of selection X?
- What settings are currently set?
- `get_model` equivalent for reading atom data back

`GetView` / `GetExtent` / `GetAtomCount` / `GetAtomCoordinates` / `GetAngle` / `GetDihedral` / `GetDistance` / `GetArea` / `GetState` / `GetFrame` exist, but there's no general-purpose introspection.

The native Python layer (`querying.py`) has extensive introspection: `get_names`, `get_object_list`, `get_type`, `get_chains`, `get_model`, `get_bonds`, `get_color_tuple`, `get_setting`, `get_scene_list`, `count_states`, `get_symmetry`, `get_property`, etc. — none of which are exposed through the WASM C API.
