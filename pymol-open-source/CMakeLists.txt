cmake_minimum_required(VERSION 3.13)
project(pymol_wasm)

set(CMAKE_CXX_STANDARD 17)

add_compile_definitions(
    _PYMOL_NOPY
    _PYMOL_NO_MAIN
    _PYMOL_NO_MSGPACKC
    _PYMOL_NUMPY
    _PYMOL_LIBPNG
    _PYMOL_FREETYPE
    _WEBGL
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

# Remove files that require specific dependencies or are strictly Python modules if necessary
# list(REMOVE_ITEM SRC_FILES "${CMAKE_CURRENT_SOURCE_DIR}/layer0/ccealignmodule.cpp")

# Emscripten specific link flags
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -s USE_LIBPNG=1 -s USE_FREETYPE=1 -Wno-narrowing")
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} --no-entry -s ERROR_ON_UNDEFINED_SYMBOLS=0 -s EXPORT_ALL=1 -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME=\"createPyMOL\" -s EXPORTED_RUNTIME_METHODS=\"['ccall', 'cwrap', 'stringToNewUTF8']\" -s USE_LIBPNG=1 -s USE_FREETYPE=1 -s USE_WEBGL2=1 -s LEGACY_GL_EMULATION=1 -lGL -s EXPORTED_FUNCTIONS=\"['_PyMOLOptions_New','_PyMOL_NewWithOptions','_PyMOL_Start','_PyMOL_Free','_PyMOLOptions_Free','_PyMOLWasm_Load','_PyMOLWasm_Show','_PyMOLWasm_Hide','_PyMOLWasm_Zoom','_PyMOLWasm_Center','_PyMOLWasm_Origin','_PyMOLWasm_Delete','_PyMOLWasm_Remove','_PyMOLWasm_Color','_PyMOLWasm_GetAtomCount','_PyMOLWasm_GetAtomCoordinates','_PyMOLWasm_Align','_PyMOLWasm_GetDistance','_PyMOLWasm_GetAngle','_PyMOLWasm_GetDihedral','_PyMOLWasm_GetArea','_PyMOLWasm_GetView','_PyMOLWasm_SetView','_PyMOLWasm_SetSetting','_PyMOLWasm_Isomesh','_PyMOLWasm_SymExp','_PyMOLWasm_CreateObject','_PyMOLWasm_MPlay','_PyMOLWasm_MStop','_PyMOLWasm_SetFrame','_PyMOLWasm_GetState','_PyMOLWasm_GetFrame','_PyMOLWasm_TransformObject','_PyMOLWasm_TransformSelection','_PyMOLWasm_TranslateAtom','_PyMOLWasm_ResetMatrix','_PyMOLWasm_Bond','_PyMOLWasm_Unbond','_PyMOLWasm_Fuse','_PyMOLWasm_Copy','_PyMOLWasm_MapNew','_PyMOLWasm_Spectrum','_PyMOLWasm_RampNew','_PyMOLWasm_Select','_PyMOLWasm_SceneStore','_PyMOLWasm_SceneRecall','_PyMOLWasm_MovieClear','_PyMOLWasm_GetExtent','_PyMOLWasm_AssignSS','_PyMOLWasm_FixChemistry','_PyMOLWasm_MapDouble','_PyMOLWasm_MapHalve','_PyMOLWasm_MapTrim','_PyMOLWasm_SetAtomCoordinates','_malloc','_free']\"")

add_executable(pymol_wasm ${SRC_FILES})
