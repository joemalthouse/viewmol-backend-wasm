/*
 * Scene export for external GPU ray tracers.
 *
 * Serialises the CRay primitive list, character bitmaps, and camera
 * parameters into a self-contained JSON blob that can be consumed by
 * a WebGPU (or other) compute-shader ray tracer.
 */

#ifndef _H_RayBackend
#define _H_RayBackend

#include <array>
#include <cstdint>
#include <string>
#include <vector>

#include "Ray.h"

namespace pymol::ray {

struct PrimitivePacket {
  std::uint32_t type{};
  std::uint32_t flags{};
  float trans{};
  float r1{};
  float r2{};
  float l1{};
  int char_id{};
  int cull{};
  std::uint32_t cap1{};
  std::uint32_t cap2{};
  std::array<float, 3> v1{}, v2{}, v3{};
  std::array<float, 3> n0{}, n1{}, n2{}, n3{};
  std::array<float, 3> c1{}, c2{}, c3{};
  std::array<float, 3> ic{};
  std::array<float, 3> tr{};
};

struct CharBitmapPacket {
  int char_id{};
  int width{};
  int height{};
  std::vector<unsigned char> rgba_data; // RGBA32, row-major, 4*w*h bytes
};

struct GlyphPacket {
  int char_id{};
  std::array<float, 2> offset_px{};
  std::array<float, 2> size_px{};
  float advance_px{};
  float xorig{};
  float yorig{};
};

struct LabelRunPacket {
  std::array<float, 3> anchor{};
  std::array<float, 4> color{};    // RGBA (alpha = 1 - trans)
  std::array<float, 3> screen_offset{};
  std::array<float, 3> indent_px{};
  float scale{};
  int font_id{};
  float font_size{};
  int relative_mode{};
  int prim_start{};
  int prim_count{};
  int glyph_start{};               // index into ScenePacket::glyphs
  int glyph_count{};
  std::string text;
};

struct ScenePacket {
  std::array<float, 16> model_view{};
  std::array<float, 6> volume{};
  std::array<float, 3> pos{};
  float fov{};
  int width{};
  int height{};
  int orthoscopic{};
  int wobble{};
  std::array<float, 3> wobble_params{};
  std::array<float, 256> random_table{};
  std::vector<PrimitivePacket> primitives{};
  std::vector<CharBitmapPacket> char_bitmaps{};
  std::vector<LabelRunPacket> label_runs{};
  std::vector<GlyphPacket> glyphs{};
  float ray_improve_shadows{0.1f};
  float ray_shadow_fudge{0.001f};
};

ScenePacket buildScenePacket(const CRay* ray);
std::string serializeScenePacketJSON(const ScenePacket& scene);

// ---------------------------------------------------------------------------
// Binary scene format ("viewmol-ray-bin-v1")
//
// Eliminates JSON serialization/parsing overhead by writing primitives as
// packed float32 arrays directly uploadable to WebGPU storage buffers.
//
// Layout (all multi-byte values are little-endian):
//   [BinarySceneHeader]           — fixed 1200-byte header
//   [float32 × 46 × primCount]   — primitive data (GPU-ready)
//   [BinaryCharBitmapHeader × charCount] + [RGBA data per char]
//   [BinaryLabelRunHeader × runCount]
//   [BinaryGlyphHeader × glyphCount]
//   [label text data (null-terminated strings)]
//
// The primitive section can be uploaded directly to a WebGPU storage
// buffer without repacking — each primitive is 46 × 4 = 184 bytes,
// matching the JSON stride but as raw IEEE 754 floats.
// ---------------------------------------------------------------------------

struct BinarySceneHeader {
  char     magic[16];        // "viewmol-bin-v1\0\0"
  uint32_t header_size;      // sizeof(BinarySceneHeader)
  uint32_t prim_stride;      // 46 (floats per primitive)
  uint32_t prim_count;
  uint32_t prim_offset;      // byte offset from start of buffer
  uint32_t char_count;
  uint32_t char_offset;      // byte offset to char bitmap headers
  uint32_t run_count;
  uint32_t run_offset;       // byte offset to label run headers
  uint32_t glyph_count;
  uint32_t glyph_offset;     // byte offset to glyph headers
  uint32_t text_offset;      // byte offset to label text data
  uint32_t total_size;       // total buffer size in bytes
  // Camera / scene metadata (same as JSON header fields)
  float    model_view[16];
  float    volume[6];
  float    pos[3];
  float    fov;
  int32_t  width;
  int32_t  height;
  int32_t  orthoscopic;
  int32_t  wobble;
  float    wobble_params[3];
  float    ray_improve_shadows;
  float    ray_shadow_fudge;
  float    random_table[256];
  uint32_t _pad[2];          // pad to 8-byte alignment
};

struct BinaryCharBitmapHeader {
  int32_t  char_id;
  int32_t  width;
  int32_t  height;
  uint32_t data_offset;      // byte offset from start of buffer to RGBA data
  uint32_t data_size;        // 4 * width * height
};

struct BinaryLabelRunHeader {
  float    anchor[3];
  float    color[4];          // RGBA
  float    screen_offset[3];
  float    indent_px[3];
  float    scale;
  int32_t  font_id;
  float    font_size;
  int32_t  relative_mode;
  int32_t  prim_start;
  int32_t  prim_count;
  int32_t  glyph_start;
  int32_t  glyph_count;
  uint32_t text_offset;       // byte offset into text section
  uint32_t text_length;       // length excluding null terminator
};

struct BinaryGlyphHeader {
  int32_t  char_id;
  float    offset_px[2];
  float    size_px[2];
  float    advance_px;
  float    xorig;
  float    yorig;
};

// Serialises a ScenePacket to binary format. Returns the raw buffer.
std::vector<unsigned char> serializeScenePacketBinary(const ScenePacket& scene);

} // namespace pymol::ray

#endif
