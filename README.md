Need.js
=======

CommonJS module system for the browser, Node.js, or other JavaScript environment.

This implementation is designed to be a subset of the Node.js module implementation so that targetting Need.js will always result in Node and Node compilers being supported, but _not_ vise versa. Therefore, if you want to write code for browser AND Node.js use, target Need.js features to ensure a common feature set.

_Note: Node.js core modules are provided in [needjs-node-core](https://github.com/BlueJeansAndRain/needjs-nodecore)_

Features
--------

* Complies with CommonJS modules specification (1.1.1)
    * Secure (sandbox) mode only. `module.paths` and `module.uri` will not be defined.
* Compatible with Node.js require()
    * Node.js `__filename`, `__dirname`, and `global` variables are defined.
    * Node.js core modules are not provided by this project.
        * (planned) They are available via the [needjs-node-core](https://github.com/BlueJeansAndRain/needjs-nodecore) project.
        * Custom core modules can also be added via the Need.js `core` option.
    * Node.js-like module resolution algorithm is implemented including "node_modules" sub-directory lookup, and directory modules with or without "package.json" files.
        * 404 errors may be displayed in a browser's console due to module resolution. This is not a bug, it's just the only way for the browser to determine if a file exists. For production, compiling is recommended.

Installation
------------

Install via NPM.

    npm install needjs

Checkout the repository from GitHub.

    git clone git@github.com:BlueJeansAndRain/needjs.git

Download the latest release in the GitHub repository.

* [zip](https://github.com/BlueJeansAndRain/needjs/archive/latest.zip)
* [tar.gz](https://github.com/BlueJeansAndRain/needjs/archive/latest.tar.gz)

Usage
-----

### In The Browser

    <script src="need.min.js" data-main="main"></script>

If you want to set more options than just the main module, you can do it in one of the following ways.

Define a global options object:

    <script>
        window.needjs = {
            ...
        };
    </script>
    <script src="need.js" data-main="main"></script>

Instantiate the Need class and call its init method.

    <script src="need.js"></script>
    <script>
        var need = new Need(options);
        need.init("main");
    </script>

### As A Module

    var Need = require('need');
    var need = new Need(options);
    need.init("main");

Options
-------

Module resolution, logging, and core environment can be customized via an options object.

    {
        // The dependencies directory name to look for when resolving top-level module names.
        // Defaults to "node_modules" for Node.js compatibility.
        directory: "node_modules",

        // The manifest file name to look for in directory modules. Defaults to "package.json" for
        // Node.js compatibility.
        manifest: "package.json",

        // Syncronously fetch the plain/text at a URI. Defaults to an internal default method
        // based on Node's file system module or XMLHttpRequest class, depending on what's
        // available in the environment.
        get: function(uri) {
            // Return a string on on success. On failure, return a non-string value or throw an
            // exception.
        },

        // Do something with a log message. Defaults to ignoring log messages.
        log: console.log,

        // Parse a JSON string. Defaults to JSON.parse if defined.
        jsonParse: function(str) {
            // Return decoded JSON or throw an exception.
        },

        // Called when Need.js can't resolve a module name. Defaults to a parent require method
        // if defined (by Node.js for example).
        fallback: function(name) {
            // Return module exports or throw an exception.
        },

        // Called when Need.js encounters a binary (.node) module file which it can't handle. This
        // is similar to the fallback option, but only for binary modules. Defaults to a parent
        // require method if defined.
        binaryInit: function(id) {
            // Return module exports or throw an exception.
        },

        // The path prefix to use when requiring relative or top-level main module and core module
        // names. Defaults to __dirname if defined, the directory part of window.location if
        // window.location is defined, or "/". If this is not an absolute (beginning with /) path,
        // then it is appended to the default startPath.
        startPath: "/",

        // Core module names mapped to their "real" require name. Top-level and relative core
        // require names will be required relative to the startPath option.
        core: {
            "process": "./core/process.js
        },

        // The main module name to require. A top-level or relative name will be required relative
        // to the startPath option.
        main: "main"
    }

Regarding Browserify
--------------------

Browserify is a CommonJS module _compiler_, loosely targeted at Node.js. Need.js is a CommonJS module _system_ for use with uncompiled CommonJS modules. You _could_ use it in production, but the goal is mostly to provide a way to run your code in a browser (or some other environment) during development without having to recompile each code change.
