needjs
======

Really simple synchronous module implementation.

Features
--------

* Partial implementation of the CommonJS modules specification (1.1)
    * Implements relative module paths only.
    * Secure (sandbox) mode only (module.paths and module.uri do not exist).

Roadmap
-------

* Implement NPM (node_modules) support.
    * Allow customization of module directory name (something other than node_modules).
    * Allow directory as module (package.json, index.js)

Related
-------

* needjs-build
