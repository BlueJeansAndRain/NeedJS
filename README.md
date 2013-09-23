NeedJS
======

CommonJS module implementation for the browser and compiler for NodeJS.

This implementation is designed to be a subset of the NodeJS module implementation so that targetting NeedJS will always result in NodeJS and NodeJS compilers being supported, but _not_ vise versa. Therefore, if you want to write code for browser and NodeJS use, target NeedJS features to ensure a common feature set.

_Note: No attempt is made to replicate the NodeJS core modules for browsers. See browserify if you need NodeJS core modules in the browser._

Features
--------

* Compiles with CommonJS modules specification (1.1.1)
    * Secure (sandbox) mode only. `module.paths` and `module.uri` will not be defined.
* Compatible with NodeJS require()
    * NeedJS implements a subset of the features supported by NodeJS. The feature subset is a _stricter_ implementation of CommonJS modules than NodeJS modules.
    * NodeJS binary (.node) modules are not supported.
    * NodeJS core modules are not available by default, but replacements can be defined in the browser using the `needjs.core` global, and in the compiler using the "--core" command line argument.
    * NodeJS's module resolution algorithm is implemented, but will result in 404 errors being displayed in the browser console due to module resolution. This is not a bug, it's just the only way for the browser to determine if a file exists. For production, compiling is recommended.

Browser
-------

Command Line
------------
