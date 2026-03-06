# Plan: Issue 5 — label_runs Batching

## Goal
Replace per-glyph `cPrimCharacter` primitives with batched `LabelRun` objects, reducing JSON payload by ~94-95% for labeled scenes.

## Current Pipeline (Per-Glyph)

```
RepLabel::render()
  → TextRenderRay()
    → CFontGLUT::RenderRay()      // loops over each char in label string
      → ray->character(id)         // creates 2 CPrimitive entries per glyph
        → CPrimitive[2]            // 2 triangles = 1 textured quad
          → PrimitivePacket        // 46 floats each = 92 floats per glyph
            → JSON                 // ~700-960 bytes per glyph
```

For "ALA 123" (7 chars): 14 primitives → ~5,600–6,700 bytes of JSON.

## Target Pipeline (Per-Label)

```
RepLabel::render()
  → TextRenderRay()
    → CFontGLUT::RenderRay()
      → ray->beginLabelRun(...)    // NEW: start accumulating
      → for each char:
        → ray->labelRunChar(id)    // NEW: append char_id to current run
      → ray->endLabelRun()         // NEW: finalize run
        → LabelRun stored in CRay::label_runs
          → JSON                   // ~250-350 bytes per label
```

For "ALA 123": 1 LabelRun → ~300 bytes of JSON. **94-95% reduction.**

## Files Modified

1. `pymol-open-source/layer1/Ray.h` — add `LabelRun` struct + `label_runs` vector + `current_label_run` to `_CRay`
2. `pymol-open-source/layer1/Ray.cpp` — add `beginLabelRun()`, `labelRunChar()`, `endLabelRun()` methods
3. `pymol-open-source/layer1/FontGLUT.cpp` — single `if` guard: `character()` vs `labelRunChar()`
4. `pymol-open-source/layer2/RepLabel.cpp` — bracket per-label loop with `beginLabelRun`/`endLabelRun`
5. `pymol-open-source/layer1/RayBackend.cpp` — serialize `label_runs` in `serializeScenePacketJSON()`
6. `pymol-open-source/layer1/RayBackend.h` — add `label_runs` to `ScenePacket` struct

## Implementation

### Step 1: Define LabelRun struct in Ray.h

Add inside `Ray.h`, before the `_CRay` struct:

```cpp
struct LabelRun {
    float origin[3];       // 3D anchor point of the label
    float normal[3];       // screen-facing normal (z-axis)
    float x_axis[3];       // screen-right in world coords
    float y_axis[3];       // screen-up in world coords
    float scale;           // world-units-per-pixel at this depth
    float color[3];        // text color RGB
    float trans;           // transparency (0 = opaque)
    std::vector<int> char_ids;  // per-glyph bitmap IDs
    int font_id;           // GLUT font identifier
};
```

Add to `_CRay` struct:

```cpp
std::vector<LabelRun> label_runs;
LabelRun* current_label_run = nullptr;  // non-null while accumulating
```

### Step 2: Add accumulation methods to CRay (Ray.cpp)

```cpp
void CRay::beginLabelRun(int font_id) {
    label_runs.emplace_back();
    current_label_run = &label_runs.back();
    // Capture rendering context at label start
    float* v = TextGetPos(G);
    copy3f(v, current_label_run->origin);
    if (TTTFlag) {
        transformTTT44f3f(glm::value_ptr(TTT), current_label_run->origin,
                          current_label_run->origin);
    }
    current_label_run->v_scale =
        RayGetScreenVertexScale(this, current_label_run->origin) / Sampling;
    RayApplyContextToVertex(this, current_label_run->origin);

    // Screen-aligned axes (same computation as character())
    float xn[3] = {1,0,0}, yn[3] = {0,1,0}, zn[3] = {0,0,1};
    RayApplyMatrixInverse33(1, (float3*)xn, glm::value_ptr(Rotation), (float3*)xn);
    RayApplyMatrixInverse33(1, (float3*)yn, glm::value_ptr(Rotation), (float3*)yn);
    RayApplyMatrixInverse33(1, (float3*)zn, glm::value_ptr(Rotation), (float3*)zn);
    copy3f(xn, current_label_run->x_axis);
    copy3f(yn, current_label_run->y_axis);
    copy3f(zn, current_label_run->normal);

    current_label_run->trans = Trans;
    copy3f(IntColor, current_label_run->color);
    current_label_run->font_id = font_id;
}

void CRay::labelRunChar(int char_id) {
    if (current_label_run) {
        current_label_run->char_ids.push_back(char_id);
        // Still advance the text cursor (needed for multi-line labels and
        // for RepLabelRenderRayBackground which reads TextGetPos after rendering)
        float xorig, yorig, advance;
        int w, h;
        CharacterGetGeometry(G, char_id, &w, &h, &xorig, &yorig, &advance);
        float vt[3];
        float scale = current_label_run->v_scale * advance;
        scale3f(current_label_run->x_axis, scale, vt);
        float* v = TextGetPos(G);
        add3f(v, vt, vt);
        TextSetPos(G, vt);
    } else {
        character(char_id);  // fallback to per-glyph primitives
    }
}

void CRay::endLabelRun() {
    if (current_label_run && current_label_run->char_ids.empty()) {
        label_runs.pop_back();  // discard empty runs
    }
    current_label_run = nullptr;
}
```

### Step 3: Bracket at RepLabelRenderRay level (NOT FontGLUT)

The natural label boundary is in `RepLabelRenderRay()` (RepLabel.cpp:1228-1288), which loops over labels and calls `TextRenderRay()` for each one. **This is the proper place** — `FontGLUT::RenderRay` is a generic text renderer that shouldn't know about label batching.

In `RepLabelRenderRay()`, the per-label loop currently looks like:
```cpp
for (int c = 0; c < I->N; c++) {
    auto& l = I->L[c];
    if (l) {
        TextSetPosNColor(G, tCenter, I->labelV[c].color);
        TextRenderRay(G, ray, font_id, st, font_size, I->labelV[c].position,
            (draw_var ? 1 : 0), I->labelV[c].getRelativeMode());
        if (draw_var) {
            RepLabelRenderRayBackground(I, info, I->labelV[c].color, draw_var);
        }
    }
}
```

Change to:
```cpp
for (int c = 0; c < I->N; c++) {
    auto& l = I->L[c];
    if (l) {
        TextSetPosNColor(G, tCenter, I->labelV[c].color);
        ray->beginLabelRun(font_id);                          // NEW
        TextRenderRay(G, ray, font_id, st, font_size, I->labelV[c].position,
            (draw_var ? 1 : 0), I->labelV[c].getRelativeMode());
        ray->endLabelRun();                                    // NEW
        if (draw_var) {
            RepLabelRenderRayBackground(I, info, I->labelV[c].color, draw_var);
        }
    }
}
```

**Why this is better than bracketing in FontGLUT:**
- `RepLabelRenderRay` owns the per-label iteration — it knows label boundaries
- `FontGLUT::RenderRay` is generic text rendering — it renders any string, not just labels
- Distance/angle labels (`RepDistDash`, `RepAngle`) also call `TextRenderRay` — they could optionally benefit too without changing `FontGLUT`
- `beginLabelRun` captures `TextGetPos()` which was just set by `TextSetPosNColor()` — guaranteed correct

**Inside FontGLUT::RenderRay, `ray->character(id)` is replaced with `ray->labelRunChar(id)`:**
```cpp
// In FontGLUT.cpp, change:
    ray->character(id);
// To:
    if (ray->current_label_run)
        ray->labelRunChar(id);
    else
        ray->character(id);
```

This is the **only change** to FontGLUT — a single `if` statement. The batching logic lives entirely in `CRay` and `RepLabel`.

### Step 3b: Add `#include "RepLabel.h"` if needed

`RepLabel.cpp` already includes `Ray.h` (for `CRay`), so `beginLabelRun`/`endLabelRun` are accessible.

### Step 4: Serialize label_runs in RayBackend.cpp

In `buildScenePacket()`, after collecting primitives, also copy label_runs:

```cpp
// In ScenePacket struct (RayBackend.h), add:
std::vector<LabelRun> label_runs;

// In buildScenePacket(), add after primitive collection:
packet.label_runs = ray->label_runs;
```

In `serializeScenePacketJSON()`, add a new `"label_runs"` section:

```cpp
// After primitives array, add:
json += ",\"label_runs\":[";
for (size_t i = 0; i < packet.label_runs.size(); i++) {
    if (i > 0) json += ",";
    const auto& run = packet.label_runs[i];
    json += "{\"origin\":[";
    json += fmt(run.origin[0]) + "," + fmt(run.origin[1]) + "," + fmt(run.origin[2]);
    json += "],\"normal\":[";
    json += fmt(run.normal[0]) + "," + fmt(run.normal[1]) + "," + fmt(run.normal[2]);
    json += "],\"x_axis\":[";
    json += fmt(run.x_axis[0]) + "," + fmt(run.x_axis[1]) + "," + fmt(run.x_axis[2]);
    json += "],\"y_axis\":[";
    json += fmt(run.y_axis[0]) + "," + fmt(run.y_axis[1]) + "," + fmt(run.y_axis[2]);
    json += "],\"scale\":" + fmt(run.scale);
    json += ",\"color\":[";
    json += fmt(run.color[0]) + "," + fmt(run.color[1]) + "," + fmt(run.color[2]);
    json += "],\"trans\":" + fmt(run.trans);
    json += ",\"font_id\":" + std::to_string(run.font_id);
    json += ",\"char_ids\":[";
    for (size_t j = 0; j < run.char_ids.size(); j++) {
        if (j > 0) json += ",";
        json += std::to_string(run.char_ids[j]);
    }
    json += "]}";
}
json += "]";
```

### Step 5: Character bitmaps remain as-is

The `chars` section of the JSON already serializes unique glyph bitmaps. Label runs reference these same `char_id`s. No change needed to bitmap serialization.

### Step 6: Stop emitting cPrimCharacter primitives

When `current_label_run` is non-null, `labelRunChar()` appends to the run instead of calling `character()`. This means no `cPrimCharacter` primitives are created for labels. The old path remains as a fallback if `beginLabelRun` was never called (e.g., for non-label text rendering if any exists).

## GPU Renderer Changes (Out of Scope for C++ Plan)

The GPU renderer (TypeScript/WebGPU) must be updated to:
1. Parse the `label_runs` JSON array
2. For each run, compute per-glyph quad vertices from: `origin + advance_i * x_axis * scale`
3. Look up glyph dimensions from `char_metrics` (bitmap `w`/`h` already in `chars` section)
4. Render textured quads using the same glyph atlas

This is the most complex part but lives outside the C++ codebase.

## Resolved Design Questions

1. **Screen-aligned axes:** Computed in `CRay::beginLabelRun()` using the same `RayApplyMatrixInverse33` code from `CRay::character()`. Extracted from `CRay::Rotation` matrix.

2. **Text cursor advancement:** `labelRunChar()` advances `TextGetPos()` using `CharacterGetGeometry` for `advance` — same math as `character()` but without creating primitives. This is critical because `RepLabelRenderRayBackground` reads `TextGetPos()` after rendering to compute background dimensions.

3. **Non-label uses of FontGLUT:** Distance labels, angle labels, and dihedral labels also use `TextRenderRay`. They could benefit from batching too. The `if (ray->current_label_run)` guard in FontGLUT means they still work via the old `character()` path unless their `Rep*` classes opt in with `beginLabelRun`/`endLabelRun`.

## Risk Assessment

**Medium risk.** The rendering pipeline is well-understood, but:
- Extracting the correct 3D basis vectors from the text rendering context requires careful tracing
- If the fallback path (`character()` for non-label text) has edge cases, it could break
- The GPU renderer changes are the majority of the effort and are not covered here

## Estimated Effort

~150 lines of C++ across 5 files. The C++ side is straightforward once the text rendering context is understood. The GPU renderer changes (TypeScript) are estimated at ~100-200 lines additionally.

## Verification

After implementation:
1. Run `wasm_rep_label*` parity tests — label scenes should still render identically
2. Measure JSON size for a labeled scene before/after — expect ~94-95% reduction for the label portion
3. Verify that non-label primitives (spheres, surfaces, etc.) are unaffected
