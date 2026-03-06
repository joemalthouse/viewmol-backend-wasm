import re

with open("layer1/PConv.h", "r") as f:
    content = f.read()

# We can just wrap the implementation of PConvFromPyObject with #ifndef _PYMOL_NOPY
# and provide empty stubs if _PYMOL_NOPY is defined.

# Actually, the simplest fix is to add a dummy `data()` to the mock macro.
