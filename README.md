NeedJS
======

CommonJS modules implementation for the browser and module resolver for NodeJS.

This implementation is designed to be a subset of the NodeJS module implementation so that targetting NeedJS will always result in NodeJS and NodeJS compilers being supported, but _not_ vise versa. Therefore, if you want to write code for browser and NodeJS use, target NeedJS features to ensure a common feature set.

_Note: No attempt is made to replicate the NodeJS core modules for browsers. See browserify if you need NodeJS core modules in the browser._

Features
--------

* Complies with CommonJS modules specification (1.1.1)
    * Secure (sandbox) mode only. `module.paths` and `module.uri` will not be defined.
* Compatible with NodeJS require()
    * NeedJS implements a subset of the features supported by NodeJS. The feature subset is a _stricter_ implementation of CommonJS modules than NodeJS's implementation.
    * NodeJS binary (.node) modules are not supported.
    * NodeJS core modules are not available by default, but replacements can be defined in the browser by defining the `window.needjs.core` array.
    * NodeJS's module resolution algorithm is implemented, but will result in 404 errors being displayed in the browser console due to module resolution. This is not a bug, it's just the only way for the browser to determine if a file exists. For production, compiling is recommended.

Including Via Script Tag
------------------------

When included via a script tag, NeedJS provides modules for the browser.

    <script src="need.min.js" data-main="main"></script>

### Installation

You can checkout the repository from GitHub.

    git clone git@github.com:BlueJeansAndRain/needjs.git

Or you can just download the latest release in the repository.

* [zip](https://github.com/BlueJeansAndRain/needjs/archive/latest.zip)
* [tar.gz](https://github.com/BlueJeansAndRain/needjs/archive/latest.tar.gz)

### Main Module

A main module is manditory because NeedJS does not provide any global methods. The main module name can be set using the `data-main` attribute on the "need.js" script tag as shown above, or using the `window.needjs.main` property as explained below in the Options section.

The main module will be automatically required after NeedJS initialization.

### Options

NeedJS has several options which can be used to customise resolution behavior, logging, and core environment. The options can be set in the browser by defining a global `needjs` object before
including "need.js".

    <script>
    window.needjs = {
        directory: "node_modules",
        manifest: "package.json",
        get: function(uri) {
            // Return content from uri.
        },
        log: console.log,
        core: [
            "coreModA",
            { name: "coreModB", require: "./core/coreModB" }
        ],
        main: "main"
    };
    </script>
    <script src="need.min.js"></script>

#### directory

A sub-directory name in which top-level modules will be resolved. Defaults to "node_modules" for compatibility with NodeJS.

This option must be undefined, null, or a string.

#### manifest

A JSON manifest file to check when determining the main module of a directory-as-module. Defaults to "package.json" for compatibility with NodeJS.

This option must be undefined, null, or a string.

The file format is expected to contain a JSON object with an optional `main` String property. If the manifest file cannot be found, does not contain a valid JSON object, or does not have a String main property, then main script filename defaults to "index.js".

#### get

A custom function for retrieving module source given a module path. If no method is given, then a default getter will be used based on NodeJS File System module or XMLHttpRequest availability.

This function must be syncronous and should return a string on success. On failure, it can return any non-string value or throw an exception.

If you _don't_ plan on compiling your web application for production, you may want to consider implementing a module source service that can return non-404 responses when the target path is not found, and then using this option to target that service. Otherwise, the browser may show unsightly 404 errors while trying to resolve a module name.

#### log

An optional callback function to recieve log messages. Defaults to noop. The callback will be passed a single string value, so it is compatible with `console.log` and `console.error`.

#### core

An array of core modules to be required _before_ the main module is required. Items in the array can be strings or objects.

A string value represents a top-level module name. It will be used both to require the module and as the name by which the core module can be required.

Object values must have a `name` property by which the core module can be required. An optional `require` property can be given which will be used to initially require the core module. If the `require` property is not present, then the `name` property will be used which makes it equivalent to using a string value.

In any core module or module required by a core module, the `require.main` property will be undefined because the main module has not been required yet.

#### main

The main module name to automatically require. This is equivalent to and overrides the `data-main` attribute on the "need.js" script tag.

Requiring As A Module
---------------------

When required as a module the `Resolver` class is exported.

    var Resolver = require('needjs');
    var resolver = new Resolver(options);
    var proto_module = resolver.resolve(startPath, name);

This class is used internally when NeedJS is providing browser modules, and by the [needjs-build](https://npmjs.org/package/needjs-build) package when compiling CommonJS source code. This allows the two separate projects to share a module resolution implementation.

The `directory`, `manifest`, `get`, and `log` options are supported by the Resolver constructor.

    var resolver = new Resolver({
        directory: "node_modules",
        manifest: "package.json",
        get: function(uri) {
            // Return content from uri.
        },
        log: console.log
    });

The `resolve(startPath, name)` method returns an object on success, or false if the name cannot be resolved.

The object returned on success will have `id` and `source` properties. The id will be the absolute path to the resolved modules main script. The source will be the contents of the module's main script.

If the same id is resolved more than once, the proto-module returned will be a reference to the same object each time.

Regarding Browserify
--------------------

This project fills roughly the same role as Browserify, with the following notable differences.

* More limited in scope and designed to be the first step in solving the browser modules problem, rather than the whole enchilada.
    * NodeJS core modules re-implementation is not included, but the ability to provide core modules is included.
    * The compiler is a seperate project which depends on this project. You could in fact use the browserify compiler or Google's closure compiler instead because NeedJS is designed such that it's features and API are a subset of NodeJS's.
* Supports uncompiled source in the browser by actually fetching required source from the server as needed.
    * Easier development because no recompilation is required to see your code changes in the browser.

Basically, if you don't need NodeJS core modules or if you want/plan to implement your own versions, then NeedJS is a smaller alternative.
