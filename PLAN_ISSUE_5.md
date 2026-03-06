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

1. `pymol-open-source/layer1/Ray.h` — add `LabelRun` struct + `label_runs` vector to `_CRay`
2. `pymol-open-source/layer1/Ray.cpp` — add `beginLabelRun()`, `labelRunChar()`, `endLabelRun()` methods
3. `pymol-open-source/layer1/FontGLUT.cpp` — bracket the character loop with begin/end calls
4. `pymol-open-source/layer1/RayBackend.cpp` — serialize `label_runs` in `serializeScenePacketJSON()`
5. `pymol-open-source/layer1/RayBackend.h` — add `label_runs` to `ScenePacket` struct

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
void CRay::beginLabelRun(const float* origin, const float* normal,
                          const float* x_axis, const float* y_axis,
                          float scale, const float* color, float trans,
                          int font_id) {
    label_runs.emplace_back();
    current_label_run = &label_runs.back();
    copy3f(origin, current_label_run->origin);
    copy3f(normal, current_label_run->normal);
    copy3f(x_axis, current_label_run->x_axis);
    copy3f(y_axis, current_label_run->y_axis);
    current_label_run->scale = scale;
    copy3f(color, current_label_run->color);
    current_label_run->trans = trans;
    current_label_run->font_id = font_id;
}

void CRay::labelRunChar(int char_id) {
    if (current_label_run) {
        current_label_run->char_ids.push_back(char_id);
    } else {
        // Fallback: no active run, emit as individual primitive (backward compat)
        character(char_id);
    }
}

void CRay::endLabelRun() {
    current_label_run = nullptr;
}
```

### Step 3: Modify FontGLUT.cpp to use label runs

In `CFontGLUT::RenderRay()` (FontGLUT.cpp:416-436), the current code is:

```cpp
while ((c = *(st++))) {
    if ((c >= first) && (c < last)) {
        ch = font_info->ch[c - first];
        if (ch) {
            int id = CharacterFind(G, &fprnt);
            if (!id)
                id = CharacterNewFromBitmap(G, ...);
            if (id)
                ray->character(id);
        }
    }
}
```

Change to:

```cpp
// Capture label context before the loop
float label_origin[3], label_normal[3], label_x_axis[3], label_y_axis[3];
float label_scale, label_color[3], label_trans;
// These are available from the TextRenderRay context:
//   ray->TextPos (current text position)
//   ray->Wobble, ray->Trans, etc.
copy3f(ray->TextPos, label_origin);
// normal, x_axis, y_axis come from the screen-aligned basis vectors
// scale comes from the character sizing in TextRenderRay
// color comes from the current text color

ray->beginLabelRun(label_origin, label_normal, label_x_axis, label_y_axis,
                    label_scale, label_color, label_trans, I->Font.TextID);

while ((c = *(st++))) {
    if ((c >= first) && (c < last)) {
        ch = font_info->ch[c - first];
        if (ch) {
            int id = CharacterFind(G, &fprnt);
            if (!id)
                id = CharacterNewFromBitmap(G, ...);
            if (id)
                ray->labelRunChar(id);
        }
    }
}

ray->endLabelRun();
```

**Critical detail:** The origin, normal, axes, and scale must be extracted from the rendering context at the start of each label string. `TextRenderRay()` in `Text.cpp` sets up these values before calling `FontGLUT::RenderRay()`. Need to trace exactly which variables hold: (a) the 3D position of the label anchor, (b) the screen-aligned basis vectors, (c) the text scale factor, (d) the current color.

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

## Open Questions to Resolve During Implementation

1. **Where are the screen-aligned axes computed?** `TextRenderRay()` in `Text.cpp` sets up 3D text positioning. Need to trace how `ray->TextPos`, screen-right, and screen-up are established per label.

2. **Does `CFontGLUT::RenderRay()` advance `ray->TextPos` as it renders?** If so, `beginLabelRun` captures the *starting* position, and per-glyph advances are derivable from `char_metrics.advance`. This needs verification.

3. **Are there non-label uses of `CFontGLUT::RenderRay()`?** If other subsystems (e.g., distance labels, angle labels) also use this path, they should also benefit from batching.

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
