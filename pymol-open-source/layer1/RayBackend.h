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

} // namespace pymol::ray

#endif
