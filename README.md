needjs
======

Really simple synchronous module implementation.

Features
--------

* Partial implementation of the CommonJS modules specification (1.1.1)
    * Relative module paths only.
    * Secure (sandbox) mode only (module.paths and module.uri do not exist).

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
