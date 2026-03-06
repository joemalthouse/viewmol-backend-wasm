cmake_minimum_required(VERSION 3.13)
project(pymol_wasm)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Default to Release if no build type specified (allows debug builds via -DCMAKE_BUILD_TYPE=Debug)
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

add_compile_definitions(
    _PYMOL_NOPY
    _PYMOL_NO_MAIN
    _PYMOL_NO_MSGPACKC
    _PYMOL_NUMPY
    _PYMOL_LIBPNG
    _PYMOL_FREETYPE
    _WEBGL
    _WEBGL_INCLUDE_DEFAULT_FONT
)

include_directories(
    include
    layer0
    layer1
    layer2
    layer3
    layer4
    layer5
    layerGraphics
    layerGraphics/gl
    build/generated
    ov/src
    contrib/pocketfft
    ../glm
)

file(GLOB_RECURSE SRC_FILES
    "layer0/*.cpp" "layer0/*.c"
    "layer1/*.cpp" "layer1/*.c"
    "layer2/*.cpp" "layer2/*.c"
    "layer3/*.cpp" "layer3/*.c"
    "layer4/*.cpp" "layer4/*.c"
    "layer5/*.cpp" "layer5/*.c"
    "layerGraphics/*.cpp" "layerGraphics/*.c"
    "layerGraphics/gl/*.cpp" "layerGraphics/gl/*.c"
    "ov/src/*.cpp" "ov/src/*.c"
    "build/generated/*.cpp"
)

# Emscripten compile flags
# -O3: maximum optimization (vs CMake Release default -O2)
# -flto: link-time optimization for cross-TU inlining (significant for WASM)
# -Wno-narrowing: required by upstream PyMOL code (implicit float-to-int conversions in legacy layers)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -flto -s USE_LIBPNG=1 -s USE_FREETYPE=1 -Wno-narrowing")

# Emscripten link flags
# LEGACY_GL_EMULATION: required by upstream PyMOL — it uses OpenGL 1.x fixed-function calls
# INITIAL_MEMORY/MAXIMUM_MEMORY: 64MB initial, 512MB cap — prevents unbounded growth
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -O3 -flto --no-entry -s ERROR_ON_UNDEFINED_SYMBOLS=0 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=67108864 -s MAXIMUM_MEMORY=536870912 -s MODULARIZE=1 -s EXPORT_NAME=\"createPyMOL\" -s EXPORTED_RUNTIME_METHODS=\"['ccall', 'cwrap', 'stringToNewUTF8', 'UTF8ToString', 'HEAPF32', 'HEAPF64', 'HEAP32', 'HEAPU8', 'wasmMemory']\" -s USE_LIBPNG=1 -s USE_FREETYPE=1 -s USE_WEBGL2=1 -s LEGACY_GL_EMULATION=1 -lGL -s EXPORTED_FUNCTIONS=\"['_PyMOLOptions_New','_PyMOL_NewWithOptions','_PyMOL_Start','_PyMOL_Free','_PyMOLOptions_Free','_PyMOLWasm_Load','_PyMOLWasm_Show','_PyMOLWasm_Hide','_PyMOLWasm_Zoom','_PyMOLWasm_Center','_PyMOLWasm_Origin','_PyMOLWasm_Delete','_PyMOLWasm_Remove','_PyMOLWasm_Color','_PyMOLWasm_GetAtomCount','_PyMOLWasm_GetAtomCoordinates','_PyMOLWasm_Align','_PyMOLWasm_GetDistance','_PyMOLWasm_GetAngle','_PyMOLWasm_GetDihedral','_PyMOLWasm_GetArea','_PyMOLWasm_GetView','_PyMOLWasm_SetView','_PyMOLWasm_Turn','_PyMOLWasm_SetSetting','_PyMOLWasm_SetSettingForSelection','_PyMOLWasm_Isomesh','_PyMOLWasm_SymExp','_PyMOLWasm_CreateObject','_PyMOLWasm_MPlay','_PyMOLWasm_MStop','_PyMOLWasm_SetFrame','_PyMOLWasm_GetState','_PyMOLWasm_GetFrame','_PyMOLWasm_TransformObject','_PyMOLWasm_TransformSelection','_PyMOLWasm_TranslateAtom','_PyMOLWasm_ResetMatrix','_PyMOLWasm_Bond','_PyMOLWasm_Unbond','_PyMOLWasm_Fuse','_PyMOLWasm_Copy','_PyMOLWasm_MapNew','_PyMOLWasm_Spectrum','_PyMOLWasm_RampNew','_PyMOLWasm_Select','_PyMOLWasm_SceneStore','_PyMOLWasm_SceneRecall','_PyMOLWasm_MovieClear','_PyMOLWasm_GetExtent','_PyMOLWasm_AssignSS','_PyMOLWasm_FixChemistry','_PyMOLWasm_MapDouble','_PyMOLWasm_MapHalve','_PyMOLWasm_MapTrim','_PyMOLWasm_SetAtomCoordinates','_PyMOLWasm_GetRayScene','_PyMOLWasm_Label','_PyMOLWasm_SetSettingString','_PyMOLWasm_Distance','_PyMOLWasm_Enable','_PyMOLWasm_Disable','_PyMOLWasm_Orient','_PyMOLWasm_Clip','_PyMOLWasm_Move','_PyMOLWasm_Reset','_PyMOLWasm_BgColor','_PyMOLWasm_Cartoon','_PyMOLWasm_Toggle','_PyMOLWasm_Rebuild','_PyMOLWasm_Volume','_PyMOLWasm_Isolevel','_PyMOLWasm_HAdd','_PyMOLWasm_Protect','_PyMOLWasm_Mask','_PyMOLWasm_Flag','_PyMOLWasm_SetDihedral','_PyMOLWasm_Sort','_PyMOLWasm_SculptActivate','_PyMOLWasm_SculptIterate','_PyMOLWasm_Reinitialize','_PyMOLWasm_Pseudoatom','_PyMOLWasm_SetName','_PyMOLWasm_SetTitle','_PyMOLWasm_Order','_PyMOLWasm_Group','_PyMOLWasm_SetObjectColor','_PyMOLWasm_UnsetSetting','_PyMOLWasm_SetSymmetry','_PyMOLWasm_GetStr','_PyMOLWasm_SetAtomPropertyFloat','_PyMOLWasm_SetAtomPropertyInt','_PyMOLWasm_SetAtomPropertyString','_PyMOLWasm_GetAtomPropertyFloat','_PyMOLWasm_GetAtomPropertyInt','_PyMOLWasm_GetAtomPropertyString','_PyMOLWasm_GetNames','_PyMOLWasm_GetType','_PyMOLWasm_CountStates','_PyMOLWasm_GetChains','_PyMOLWasm_GetSettingFloat','_PyMOLWasm_GetSettingInt','_PyMOLWasm_GetSceneList','_PyMOLWasm_GetSymmetry','_PyMOLWasm_GetColorTuple','_PyMOLWasm_GetObjectMatrix','_PyMOLWasm_GetTitle','_malloc','_free']\"")

add_executable(pymol_wasm ${SRC_FILES})
