/*
 * Scene export for external GPU ray tracers.
 *
 * See RayBackend.h for overview.
 */

#include "RayBackend.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <unordered_set>

#include "Character.h"
#include "Color.h"
#include "Setting.h"

namespace pymol::ray {

namespace {

constexpr std::uint32_t kFlagNoLighting = 0x2;
constexpr std::uint32_t kFlagWobble = 0x4;

// Base64 encoding table
constexpr char kBase64[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

inline void base64Append(std::string& o, const unsigned char* data, std::size_t len)
{
  o += '"';
  std::size_t i = 0;
  for (; i + 2 < len; i += 3) {
    unsigned int triplet = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    o += kBase64[(triplet >> 18) & 0x3F];
    o += kBase64[(triplet >> 12) & 0x3F];
    o += kBase64[(triplet >>  6) & 0x3F];
    o += kBase64[triplet & 0x3F];
  }
  if (i < len) {
    unsigned int triplet = data[i] << 16;
    if (i + 1 < len) triplet |= data[i + 1] << 8;
    o += kBase64[(triplet >> 18) & 0x3F];
    o += kBase64[(triplet >> 12) & 0x3F];
    o += (i + 1 < len) ? kBase64[(triplet >> 6) & 0x3F] : '=';
    o += '=';
  }
  o += '"';
}

inline std::array<float, 3> toArr(const float* v)
{
  return {v[0], v[1], v[2]};
}

// Resolve a ramped color to concrete RGB at the given position.
// Ramp indices are encoded as negative values in c[0].
inline std::array<float, 3> resolveRampColor(
    PyMOLGlobals* G, const float* c, const float* pos)
{
  if (c[0] <= 0.0f) {
    float rgb[3];
    if (ColorGetRamped(G, static_cast<int>(c[0] - 0.1f), pos, rgb, -1))
      return {rgb[0], rgb[1], rgb[2]};
    return {1.0f, 1.0f, 1.0f};
  }
  return {c[0], c[1], c[2]};
}

// ---------- JSON helpers (no allocations, append-only) ----------

inline void jInt(std::string& o, int v)
{
  if (v == 0) { o += '0'; return; }
  char buf[12]; // -2147483648 is 11 chars + nul
  int pos = 11;
  bool neg = v < 0;
  unsigned int uv = neg ? static_cast<unsigned int>(-(v + 1)) + 1u
                        : static_cast<unsigned int>(v);
  while (uv > 0) { buf[pos--] = '0' + static_cast<char>(uv % 10); uv /= 10; }
  if (neg) buf[pos--] = '-';
  o.append(buf + pos + 1, static_cast<std::size_t>(11 - pos));
}

inline void jUint(std::string& o, std::uint32_t v)
{
  if (v == 0) { o += '0'; return; }
  char buf[11]; // 4294967295 is 10 chars + nul
  int pos = 10;
  while (v > 0) { buf[pos--] = '0' + static_cast<char>(v % 10); v /= 10; }
  o.append(buf + pos + 1, static_cast<std::size_t>(10 - pos));
}

// Fast float-to-string: writes up to 9 significant digits.
// For exact-zero and small integers (common in scene data) we
// short-circuit to avoid snprintf entirely.
inline void jFloat(std::string& o, float v)
{
  if (!std::isfinite(v)) { o += '0'; return; }
  if (v == 0.0f) { o += '0'; return; }

  // Fast path for small integers (very common: 0, 1, -1, 2, etc.)
  if (v == static_cast<float>(static_cast<int>(v)) &&
      v >= -999999.0f && v <= 999999.0f) {
    jInt(o, static_cast<int>(v));
    return;
  }

  char buf[32];
  int n = std::snprintf(buf, sizeof(buf), "%.9g", static_cast<double>(v));
  o.append(buf, n > 0 ? static_cast<std::size_t>(n) : 1);
}

template <std::size_t N>
inline void jFloatArray(std::string& o, const std::array<float, N>& a)
{
  o += '[';
  for (std::size_t i = 0; i < N; ++i) {
    if (i) o += ',';
    jFloat(o, a[i]);
  }
  o += ']';
}

inline void jVec3(std::string& o, const std::array<float, 3>& v)
{
  jFloat(o, v[0]); o += ',';
  jFloat(o, v[1]); o += ',';
  jFloat(o, v[2]);
}

} // namespace

// ---------------------------------------------------------------------------
// Build an in-memory ScenePacket from the CRay primitive list.
// ---------------------------------------------------------------------------

ScenePacket buildScenePacket(const CRay* ray)
{
  ScenePacket s{};
  for (int i = 0; i < 16; ++i) s.model_view[i] = ray->ModelView[i];
  for (int i = 0; i < 6; ++i)  s.volume[i] = ray->Volume[i];
  s.pos = {ray->Pos.x, ray->Pos.y, ray->Pos.z};
  s.fov = ray->Fov;
  s.width = ray->Width;
  s.height = ray->Height;
  s.orthoscopic = ray->Ortho;
  s.wobble = ray->Wobble;
  s.wobble_params = {ray->WobbleParam[0], ray->WobbleParam[1], ray->WobbleParam[2]};
  for (int i = 0; i < 256; ++i) s.random_table[i] = ray->Random[i];

  s.primitives.reserve(ray->NPrimitive);
  for (int i = 0; i < ray->NPrimitive; ++i) {
    const auto& p = ray->Primitive[i];
    PrimitivePacket pk{};  // zero-initialize all fields
    pk.type = static_cast<std::uint32_t>(p.type);
    pk.flags = (p.no_lighting ? kFlagNoLighting : 0u) |
               (p.wobble      ? kFlagWobble     : 0u);
    pk.trans = p.trans;

    // Copy only fields that are (a) initialized by the primitive creation
    // function in Ray.cpp AND (b) read by the GPU renderer.  Reading
    // uninitialized CPrimitive fields is undefined behavior; pk{} already
    // zero-initializes everything so uncopied fields are safely zero.
    //
    // Field initialization sources (Ray.cpp):
    //   sphere3fv:    r1, v1, c1, ic, trans, wobble, ramped, no_lighting
    //   cylinder3fv:  r1, cap1, cap2, v1, v2, c1, c2, ic, trans, wobble, ramped, no_lighting
    //   sausage3fv:   r1, v1, v2, c1, c2, ic, trans, wobble, ramped, no_lighting
    //   cone3fv:      r1, r2, cap1, cap2, v1, v2, c1, c2, ic, trans, wobble, ramped, no_lighting
    //   triangle3fv:  r1, v1, v2, v3, n0, n1, n2, n3, c1, c2, c3, ic, tr, trans, wobble, ramped, no_lighting
    //   character:    char_id, v1, v2, v3, n0, n1, n2, n3, c1, c2, c3, ic, trans, wobble, ramped, no_lighting
    //   ellipsoid3fv: r1, v1, n0, n1, n2, n3, c1, ic, trans, wobble, ramped, no_lighting
    switch (p.type) {
    case cPrimSphere:       // type 1: center + radius + color
      pk.r1 = p.r1;
      pk.v1 = toArr(p.v1);
      pk.c1 = toArr(p.c1);
      pk.ic = toArr(p.ic);
      break;
    case cPrimCylinder:     // type 2: endpoints + radius + caps + colors
      pk.r1 = p.r1;
      pk.cap1 = static_cast<std::uint32_t>(p.cap1);
      pk.cap2 = static_cast<std::uint32_t>(p.cap2);
      pk.v1 = toArr(p.v1);  pk.v2 = toArr(p.v2);
      pk.c1 = toArr(p.c1);  pk.c2 = toArr(p.c2);
      pk.ic = toArr(p.ic);
      break;
    case cPrimSausage:      // type 4: endpoints + radius + colors (no caps, no normals)
      pk.r1 = p.r1;
      pk.v1 = toArr(p.v1);  pk.v2 = toArr(p.v2);
      pk.c1 = toArr(p.c1);  pk.c2 = toArr(p.c2);
      pk.ic = toArr(p.ic);
      break;
    case cPrimCone:         // type 7: endpoints + two radii + caps + colors
      pk.r1 = p.r1;  pk.r2 = p.r2;
      pk.cap1 = static_cast<std::uint32_t>(p.cap1);
      pk.cap2 = static_cast<std::uint32_t>(p.cap2);
      pk.v1 = toArr(p.v1);  pk.v2 = toArr(p.v2);
      pk.c1 = toArr(p.c1);  pk.c2 = toArr(p.c2);
      pk.ic = toArr(p.ic);
      break;
    case cPrimTriangle:     // type 3: vertices + normals + colors + per-vertex trans
      pk.r1 = p.r1;
      pk.v1 = toArr(p.v1);  pk.v2 = toArr(p.v2);  pk.v3 = toArr(p.v3);
      pk.n0 = toArr(p.n0);  pk.n1 = toArr(p.n1);  pk.n2 = toArr(p.n2);  pk.n3 = toArr(p.n3);
      pk.c1 = toArr(p.c1);  pk.c2 = toArr(p.c2);  pk.c3 = toArr(p.c3);
      pk.ic = toArr(p.ic);
      pk.tr = toArr(p.tr);
      break;
    case cPrimCharacter:    // type 5: two textured triangles per glyph
      pk.char_id = p.char_id;
      pk.v1 = toArr(p.v1);  pk.v2 = toArr(p.v2);  pk.v3 = toArr(p.v3);
      pk.n0 = toArr(p.n0);  pk.n1 = toArr(p.n1);  pk.n2 = toArr(p.n2);  pk.n3 = toArr(p.n3);
      pk.c1 = toArr(p.c1);  pk.c2 = toArr(p.c2);  pk.c3 = toArr(p.c3);
      pk.ic = toArr(p.ic);
      break;
    case cPrimEllipsoid:    // type 6: center + 3 axes (n1,n2,n3) + axis scales (n0)
      pk.r1 = p.r1;
      pk.v1 = toArr(p.v1);
      pk.n0 = toArr(p.n0);  pk.n1 = toArr(p.n1);  pk.n2 = toArr(p.n2);  pk.n3 = toArr(p.n3);
      pk.c1 = toArr(p.c1);
      pk.ic = toArr(p.ic);
      break;
    default:  // safety fallback — copy only universally safe fields
      pk.v1 = toArr(p.v1);
      pk.c1 = toArr(p.c1);
      break;
    }

    // Resolve ramped colors so the GPU receives concrete RGB.
    if (p.ramped) {
      pk.c1 = resolveRampColor(ray->G, p.c1, p.v1);
      if (p.type == cPrimTriangle)
        pk.c3 = resolveRampColor(ray->G, p.c3, p.v3);
      if (p.type == cPrimTriangle || p.type == cPrimCylinder ||
          p.type == cPrimSausage  || p.type == cPrimCone)
        pk.c2 = resolveRampColor(ray->G, p.c2, p.v2);
    }

    s.primitives.emplace_back(pk);
  }

  // Copy label runs in v1 format (runs + glyphs arrays).
  for (const auto& run : ray->label_runs) {
    LabelRunPacket lrp;
    for (int i = 0; i < 3; ++i) {
      lrp.anchor[i] = run.origin[i];
      lrp.color[i]  = run.color[i];
      lrp.screen_offset[i] = run.screen_offset[i];
      lrp.indent_px[i] = run.indent_px[i];
    }
    lrp.color[3] = 1.0f - run.trans;  // alpha
    lrp.scale = run.v_scale;
    lrp.font_id = run.font_id;
    lrp.font_size = run.font_size;
    lrp.relative_mode = run.relative_mode;
    lrp.prim_start = run.prim_start;
    lrp.prim_count = run.prim_count;
    lrp.text = run.text;
    lrp.glyph_start = static_cast<int>(s.glyphs.size());
    lrp.glyph_count = static_cast<int>(run.glyphs.size());

    for (const auto& g : run.glyphs) {
      GlyphPacket gp;
      gp.char_id = g.char_id;
      gp.offset_px = {g.offset_px[0], g.offset_px[1]};
      gp.size_px = {g.size_px[0], g.size_px[1]};
      gp.advance_px = g.advance_px;
      gp.xorig = g.xorig;
      gp.yorig = g.yorig;
      s.glyphs.emplace_back(gp);
    }
    s.label_runs.emplace_back(std::move(lrp));
  }

  // Collect unique character bitmaps from both primitives and label runs
  // in a single pass.
  {
    std::unordered_set<int> char_ids;
    for (const auto& pk : s.primitives)
      if (pk.type == 5 && pk.char_id > 0) char_ids.insert(pk.char_id);
    for (const auto& gp : s.glyphs)
      if (gp.char_id > 0) char_ids.insert(gp.char_id);

    auto* charObj = ray->G->Character;
    if (charObj) {
      for (int cid : char_ids) {
        if (cid > charObj->MaxAlloc) continue;
        const auto& cr = charObj->Char[cid];
        if (!cr.Pixmap.buffer || cr.Pixmap.width <= 0 || cr.Pixmap.height <= 0)
          continue;
        CharBitmapPacket bp;
        bp.char_id = cid;
        bp.width = cr.Pixmap.width;
        bp.height = cr.Pixmap.height;
        std::size_t nbytes = static_cast<std::size_t>(bp.width) * bp.height * 4;
        bp.rgba_data.assign(cr.Pixmap.buffer, cr.Pixmap.buffer + nbytes);
        s.char_bitmaps.emplace_back(std::move(bp));
      }
    }
  }

  s.ray_improve_shadows = SettingGetGlobal_f(ray->G, cSetting_ray_improve_shadows);
  s.ray_shadow_fudge = SettingGetGlobal_f(ray->G, cSetting_ray_shadow_fudge);

  return s;
}

// ---------------------------------------------------------------------------
// Serialise a ScenePacket to a self-contained JSON string.
// ---------------------------------------------------------------------------

std::string serializeScenePacketJSON(const ScenePacket& scene)
{
  // Stride = 10 scalars + 12 vec3 = 46 floats per primitive.
  constexpr int kPrimStride = 46;

  std::string o;
  // Estimate: 256 header + ~480 per primitive + ~1.37x base64 for bitmaps + 256 for random_table
  std::size_t bitmap_est = 0;
  for (const auto& cb : scene.char_bitmaps)
    bitmap_est += static_cast<std::size_t>(cb.width) * cb.height * 4 * 4 / 3 + 64;
  o.reserve(512 + scene.primitives.size() * 480 + bitmap_est + 256 * 16);

  o += "{\"format\":\"viewmol-ray-v2\"";
  o += ",\"coordinate_space\":\"world\"";
  o += ",\"transform_mode\":\"world\"";

  o += ",\"width\":";    jInt(o, scene.width);
  o += ",\"height\":";   jInt(o, scene.height);
  o += ",\"orthoscopic\":"; jInt(o, scene.orthoscopic);
  o += ",\"fov\":";      jFloat(o, scene.fov);
  o += ",\"volume\":";   jFloatArray(o, scene.volume);
  o += ",\"pos\":";      jFloatArray(o, scene.pos);
  o += ",\"model_view\":"; jFloatArray(o, scene.model_view);

  o += ",\"primitive_stride\":"; jInt(o, kPrimStride);
  o += ",\"primitive_count\":";  jInt(o, static_cast<int>(scene.primitives.size()));
  o += ",\"primitives\":[";

  for (std::size_t pi = 0; pi < scene.primitives.size(); ++pi) {
    const auto& pk = scene.primitives[pi];
    if (pi) o += ',';

    jUint(o, pk.type);   o += ',';
    jUint(o, pk.flags);  o += ',';
    jFloat(o, pk.trans);  o += ',';
    jFloat(o, pk.r1);    o += ',';
    jFloat(o, pk.r2);    o += ',';
    jFloat(o, pk.l1);    o += ',';
    jInt(o, pk.char_id);  o += ',';
    jInt(o, pk.cull);     o += ',';
    jUint(o, pk.cap1);   o += ',';
    jUint(o, pk.cap2);

    const std::array<float, 3>* vecs[] = {
        &pk.v1, &pk.v2, &pk.v3, &pk.n0, &pk.n1, &pk.n2,
        &pk.n3, &pk.c1, &pk.c2, &pk.c3, &pk.ic, &pk.tr};
    for (auto* v : vecs) {
      o += ',';
      jVec3(o, *v);
    }
  }
  o += ']';

  // Character bitmaps (RGBA data as base64 for compactness).
  o += ",\"char_bitmaps\":[";
  for (std::size_t ci = 0; ci < scene.char_bitmaps.size(); ++ci) {
    if (ci) o += ',';
    const auto& cb = scene.char_bitmaps[ci];
    o += "{\"char_id\":"; jInt(o, cb.char_id);
    o += ",\"w\":";       jInt(o, cb.width);
    o += ",\"h\":";       jInt(o, cb.height);
    o += ",\"rgba_b64\":";
    base64Append(o, cb.rgba_data.data(), cb.rgba_data.size());
    o += '}';
  }
  o += ']';

  // Label runs v1 format: {runs, glyphs} for GPU ray tracer.
  o += ",\"label_runs_version\":1";
  o += ",\"label_runs\":{\"runs\":[";
  for (std::size_t li = 0; li < scene.label_runs.size(); ++li) {
    if (li) o += ',';
    const auto& lr = scene.label_runs[li];
    o += "{\"anchor\":";        jFloatArray(o, lr.anchor);
    o += ",\"color\":";         jFloatArray(o, lr.color);
    o += ",\"screen_offset\":"; jFloatArray(o, lr.screen_offset);
    o += ",\"indent_px\":";     jFloatArray(o, lr.indent_px);
    o += ",\"scale\":";         jFloat(o, lr.scale);
    o += ",\"font_id\":";       jInt(o, lr.font_id);
    o += ",\"font_size\":";     jFloat(o, lr.font_size);
    o += ",\"relative_mode\":"; jInt(o, lr.relative_mode);
    o += ",\"prim_start\":";    jInt(o, lr.prim_start);
    o += ",\"prim_count\":";    jInt(o, lr.prim_count);
    o += ",\"glyph_start\":";   jInt(o, lr.glyph_start);
    o += ",\"glyph_count\":";   jInt(o, lr.glyph_count);
    // JSON-escape text (only printable ASCII expected)
    o += ",\"text\":\"";
    for (char c : lr.text) {
      if (c == '"') o += "\\\"";
      else if (c == '\\') o += "\\\\";
      else o += c;
    }
    o += "\"}";
  }
  o += "],\"glyphs\":[";
  for (std::size_t gi = 0; gi < scene.glyphs.size(); ++gi) {
    if (gi) o += ',';
    const auto& g = scene.glyphs[gi];
    o += "{\"char_id\":";    jInt(o, g.char_id);
    o += ",\"offset_px\":";  jFloatArray(o, g.offset_px);
    o += ",\"size_px\":";    jFloatArray(o, g.size_px);
    o += ",\"advance_px\":"; jFloat(o, g.advance_px);
    o += ",\"xorig\":";      jFloat(o, g.xorig);
    o += ",\"yorig\":";      jFloat(o, g.yorig);
    o += '}';
  }
  o += "]}";

  // Wobble texture data.
  o += ",\"wobble\":";        jInt(o, scene.wobble);
  o += ",\"wobble_params\":"; jFloatArray(o, scene.wobble_params);
  o += ",\"random_table\":";  jFloatArray(o, scene.random_table);

  o += ",\"ray_improve_shadows\":"; jFloat(o, scene.ray_improve_shadows);
  o += ",\"ray_shadow_fudge\":";    jFloat(o, scene.ray_shadow_fudge);

  o += '}';
  return o;
}

} // namespace pymol::ray
