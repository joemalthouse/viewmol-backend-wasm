

/* 
A* -------------------------------------------------------------------
B* This file contains source code for the PyMOL computer program
C* Copyright (c) Schrodinger, LLC. 
D* -------------------------------------------------------------------
E* It is unlawful to modify or remove this copyright notice.
F* -------------------------------------------------------------------
G* Please see the accompanying LICENSE file for further information. 
H* -------------------------------------------------------------------
I* Additional authors of this source file include:
-* 
-* 
-*
Z* -------------------------------------------------------------------
*/
#ifndef _H_os_python
#define _H_os_python

#include "os_predef.h"

#include <memory>

#ifdef _PYMOL_NOPY
typedef int PyObject;
#undef _PYMOL_NUMPY

class SomeString {
public:
  SomeString(const char * s) {}
  inline const char * data()    const { return ""; }
  inline const char * c_str()   const { return ""; }
  operator const char * ()      const { return ""; }
  inline size_t length()        const { return 0; }
};

#define PyInt_FromLong(x) (PyObject*)nullptr
#define PyFloat_FromDouble(x) (PyObject*)nullptr
#define PyString_FromString(x) (PyObject*)nullptr
#define PyList_New(x) (PyObject*)nullptr
#define PyTuple_New(x) (PyObject*)nullptr
#define PyInt_AsLong(x) 0
#define PyErr_Occurred() 0
#define PyFloat_AsDouble(x) 0.0
#define PyString_AsSomeString(x) SomeString("")
#define PyBytes_Check(x) 0
#define PyBytes_Size(x) 0
#define PyBytes_AsSomeString(x) SomeString("")
#define PyTuple_SET_ITEM(o, i, v)
#define PyList_SetItem(o, i, v)
#define PyList_SET_ITEM(o, i, v)
#define Py_RETURN_NONE return (PyObject*)nullptr
#define PyList_GET_ITEM(o, i) (PyObject*)nullptr
#define PyList_GetItem(o, i) (PyObject*)nullptr
#define PyList_Size(o) 0
#define PyList_Check(o) 0
#define Py_DECREF(o)
#define PyDict_GetItemString(p, key) (PyObject*)nullptr
#define PyString_FromStringAndSize(buf, len) (PyObject*)nullptr
#define PyBool_FromLong(x) (PyObject*)nullptr
#define PyTuple_SetItem(t, i, v)
#define PyList_Append(l, i) 0
#define Py_None (PyObject*)nullptr
#define PyObject_CallMethod(o, m, f, ...) (PyObject*)nullptr
#define PyObject_CallFunction(o, f, ...) (PyObject*)nullptr
#define Py_True (PyObject*)1
#define Py_False (PyObject*)0
#define PyDict_SetItemString(d, k, v) 0
#define Py_INCREF(o)
#define Py_XDECREF(o)
#define PyImport_ImportModule(n) (PyObject*)nullptr
#define PyObject_HasAttrString(o, a) 0
#define PyObject_GetAttrString(o, a) (PyObject*)nullptr
#define PyCapsule_CheckExact(o) 0
#define PyCapsule_GetPointer(o, n) nullptr
#define PyString_Check(o) 0
#define PyString_Size(o) 0
#define PyLong_Check(o) 0
#define PyLong_AsLongLong(o) 0
#define PyInt_Check(o) 0
#define PyBool_Check(o) 0
#define PyFloat_Check(o) 0
#define PyNumber_Float(o) (PyObject*)nullptr
#define PyNumber_Int(o) (PyObject*)nullptr
#define PyObject_Str(o) (PyObject*)nullptr
#define PyObject_SetAttrString(o, a, v) 0
#define PyTuple_Check(o) 0
#define PyTuple_Size(o) 0
#define PyBytes_FromStringAndSize(b, l) (PyObject*)nullptr
#define PyGILState_Check() 1
#define PyString_AsString(o) ""
#define Py_EQ 2
#define PyObject_RichCompareBool(o1, o2, op) 0
#define PyList_SetSlice(l, low, high, v) 0
#define PyDict_New() (PyObject*)nullptr
#define PyErr_Print()
#define PyDict_Check(o) 0
#else

// Python.h will redefine those, undef to avoid compiler warning
#undef _POSIX_C_SOURCE
#undef _XOPEN_SOURCE

#include"Python.h"
#include<pythread.h>

#include <string.h>

# define PyInt_Check            PyLong_Check
# define PyInt_FromLong         PyLong_FromLong
# define PyInt_AsLong           PyLong_AsLong
# define PyInt_AS_LONG          PyLong_AS_LONG

# define PyNumber_Int           PyNumber_Long

# define PyString_Check                 PyUnicode_Check
# define PyString_Size                  PyUnicode_GetLength
# define PyString_GET_SIZE              PyUnicode_GetLength
# define PyString_FromString            PyUnicode_FromString
# define PyString_FromStringAndSize     PyUnicode_FromStringAndSize
# define PyString_InternFromString      PyUnicode_InternFromString
# define PyString_AsString              PyUnicode_AsUTF8
# define PyString_AS_STRING             PyUnicode_AsUTF8

/**
 * For compatibility with the pickletools, this type represents
 * an optionally owned C string and has to be returned by value.
 */
class SomeString {
  const char * m_str;
  mutable int m_length;
public:
  SomeString(const char * s, int len=-1) : m_str(s), m_length(len) {}
  inline const char * data()    const { return m_str; }
  inline const char * c_str()   const { return m_str; }
  operator const char * ()      const { return m_str; } // allows assignment to std::string
  inline size_t length()        const {
    if (m_length == -1) {
      m_length = m_str ? strlen(m_str) : 0;
    }
    return m_length;
  }
};

inline SomeString PyString_AsSomeString(PyObject * o) {
  return PyString_AsString(o);
}

inline SomeString PyBytes_AsSomeString(PyObject * o) {
  return SomeString(PyBytes_AsString(o), PyBytes_Size(o));
}

namespace pymol {
/**
 * Destruction policy for unique_ptr<PyObject, pymol::pyobject_delete>
 *
 * Must only be used if the GIL is guaranteed when operator() is called.
 */
struct pyobject_delete {
  void operator()(PyObject* o) const { Py_DECREF(o); }
};

/**
 * Destruction policy for unique_ptr<PyObject, pymol::pyobject_delete_auto_gil>
 * Does not require GIL to be held.
 */
struct pyobject_delete_auto_gil {
  void operator()(PyObject* o) const
  {
    if (o) {
      auto gstate = PyGILState_Ensure();
      Py_DECREF(o);
      PyGILState_Release(gstate);
    }
  }
};

/**
 * RAII helper to ensure the Python GIL
 */
class GIL_Ensure
{
  PyGILState_STATE state;

public:
  GIL_Ensure();
  ~GIL_Ensure();
};
} // namespace pymol

namespace std
{
/**
 * Destruction policy which ensures the GIL before operator() is called.
 */
template <> struct default_delete<PyObject> {
  void operator()(PyObject* o) const
  {
    pymol::GIL_Ensure gil;
    Py_DECREF(o);
  }
};
} // namespace std

/**
 * Unique pointer which must only be used if the GIL is guaranteed when it goes
 * out of scope or is reset.
 */
using unique_PyObject_ptr = std::unique_ptr<PyObject, pymol::pyobject_delete>;

#endif

#define PYOBJECT_CALLMETHOD PyObject_CallMethod
#define PYOBJECT_CALLFUNCTION PyObject_CallFunction

#endif
