NeedJS
======

Really simple synchronous CommonJS module implementation for the browser.

This implementation is designed to be a subset of the NodeJS module implementation so that targetting NeedJS will always result in NodeJS being supported, but _not_ vise versa.

_Note: No attempt is made to replicate the NodeJS core modules for browsers. See browserify if you need NodeJS core modules in the browser._

Features
--------

* Partial implementation of the CommonJS modules specification (1.1.1)
    * Relative module paths only.
    * Secure (sandbox) mode only (module.paths and module.uri do not exist).
* Compatible with NodeJS require()
    * NeedJS implements a subset of the features supported by NodeJS. The feature subset is a _stricter_ implementation of CommonJS modules than NodeJS modules. This means that NodeJS supports everything NeedJS does, but NeedJS does not support all of NodeJS's module features.
    * Scripts written to work NeedJS require() in the browser, will work in NodeJS require() assuming the same relative file structure.
    * Scripts written to work with NodeJS require() will only work with NeedJS require() in the browser if all modules paths are relative.
        * When top-level modules are supported, then only NodeJS core modules will be unsupported in NeedJS.

Roadmap
-------

* Top-level module support
    * NPM compatible by default.
        * Default module directory to "node_modules".
        * Allow directory as module (package.json, index.js).
    * Allow customization of module directory (something other than node_modules).
    * Allow customization of module manifest (something other than package.json).

Related
-------

* needjs-build
    * Compile a script and all dependencies into a stand-alone JavaScript file.
