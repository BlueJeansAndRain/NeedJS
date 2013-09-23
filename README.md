NeedJS
======

Really simple synchronous module implementation for the browser.

Features
--------

* Partial implementation of the CommonJS modules specification (1.1.1)
    * Relative module paths only.
    * Secure (sandbox) mode only (module.paths and module.uri do not exist).
* Compatible with NodeJS require()
    * Scripts written to load modules using NeedJS require() in the browser, will work in NodeJS require() assuming the same relative file structure.
    * Scripts written to work with NodeJS require() will only work with NeedJS in the browser if all require() calls use relative module paths.
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
