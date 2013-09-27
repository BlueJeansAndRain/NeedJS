Needy
=====

CommonJS modules for the browser, Node.js, or any other JavaScript environment.

Needy is designed to be a subset of the Node.js module implementation so that targetting Needy will always result in Node.js and Node.js compilers being supported, but _not_ necessarily vise versa. Therefore, if you want to write code for both browser and Node.js use, target Needy features to ensure a common feature set.

You "should" be able to use Needy in just about any JavaScript environment, either to add module support, or even to replace an existing module system. The `Needy` class will automatically be exported as a CommonJS or AMD module if possible. If `module.exports` and `define` are both undefined, then the `Needy` class will be added to the global namespace as a last resort.

Features
--------

* Can be included as a CommonJS module, AMD module, or a simple global variable.
* Complies with CommonJS modules specification (1.1.1)
    * Secure (sandbox) mode only. `module.paths` and `module.uri` will not be defined.
* Compatible with the Node.js module system.
    * Node.js `__filename`, `__dirname`, and `global` variables are defined.
    * Node.js core modules are not provided by this project.
        * (planned) They will be available via the [needy-node-core](https://github.com/BlueJeansAndRain/needy-node-core) project, which will be based on the [browser-builtins](https://npmjs.org/package/browser-builtins) project which is the same project that browserify uses for browser compatible Node.js core modules.
        * Custom core modules can also be added via the Needy `core` option.
    * Node.js-like module resolution algorithm is implemented including "node_modules" sub-directory lookup, and directory modules with or without "package.json" files.
        * 404 warnings may be displayed in a browser's console due to module resolution. This is not a bug, it's just the only way for the browser to determine if a file exists. For production, compiling is recommended.

Installation
------------

Install via NPM.

    npm install needy

Checkout the repository from GitHub.

    git clone git@github.com:BlueJeansAndRain/needy.git

Download the latest release in the GitHub repository.

* [zip](https://github.com/BlueJeansAndRain/needy/archive/latest.zip)
* [tar.gz](https://github.com/BlueJeansAndRain/needy/archive/latest.tar.gz)

Usage
-----

### In The Browser

    <script src="needy.min.js" data-needy="main"></script>

If you want to set more options than just the main module, you can do it in one of the following ways.

Define a `needy` global object.

    <script>
        window.needy = {
            ...
        };
    </script>
    <script src="needy.js" data-needy="main"></script>

The main module name can also be given in the `needy` global instead of as a `data-needy` script attribute.

    <script>
        window.needy = {
            main: "main",
            ...
        }
    </script>
    <script src="needy.js"></script>

Instantiate the Needy class and call its init method.

    <script src="needy.js"></script>
    <script>
        var needy = new Needy({
            ...
        });

        needy.init("main");
    </script>

If no main module name is set via the `needy` global or `data-needy` attribute, then no instances of the Needy class will be automatically created.

### As A CommonJS Module

    var Needy = require('needy');
    var needy = new Needy({
        ...
    });

    needy.init("main");

### As An AMD Module

    define(["path/to/needy"], function(Needy)
    {
        var needy = new Needy({
            ...
        });

        needy.init("main");
    });

Options
-------

Module resolution, logging, and core environment can be customized via an options object.

    {
        // The main module name to require. The default resolve method will
        // require a top-level or relative to the startPath option.
        main: "main",

        // Do something with a log message. Defaults to ignoring log messages.
        log: console.log,

        // Parse a JSON string. Defaults to JSON.parse if defined.
        jsonParse: function(str) {
            // Return decoded JSON or throw an exception.
        },

        // Called when Needy can't resolve a module name. Defaults to a parent
        // require method if defined (by Node.js for example).
        fallback: function(name) {
            // Return module exports or throw an exception.
        },

        // Called when Needy encounters a binary (.node) module file which it
        // can't handle. This is similar to the fallback option, but only for
        // binary modules. Defaults to a parent require method if defined.
        binaryInit: function(id) {
            // Return module exports or throw an exception.
        },

        // Allow a custom name resolution implementation. Defaults to a
        // Needy.Resolver instance created with this options object.
        resolver: new Needy.Resolver(options),

        //
        // Options below this point are for the default Needy.Resolver
        // instance that is created when the resolver option is not set. They
        // have no effect if a custom resolver is used._
        //

        // The path prefix to use when requiring relative or top-level main
        // module and core module names. Defaults in order to whichever of the
        // following exists:__dirname, __filename directory part, module.uri
        // directory part, window.location directory part, or "/". If this is
        // not an absolute (beginning with /) path, then it is appended to the
        // default startPath.
        root: "/",

        // The dependencies directory name to look for when resolving
        // top-level module names. Defaults to "node_modules" for Node.js
        // compatibility.
        directory: "node_modules",

        // The manifest file name to look for in directory modules. Defaults
        // to "package.json" for Node.js compatibility.
        manifest: "package.json",

        // Syncronously fetch the plain/text at a URI. Defaults to an internal
        // default method based on Node's file system module or XMLHttpRequest
        // class, depending on what's available in the environment.
        get: function(uri) {
            // Return a string on on success. On failure, return a non-string
            // value or throw an exception.
        },

        // Core module names mapped to their "real" require name. Top-level
        // and relative core require names will be required relative to the
        // startPath option.
        core: {
            "process": "./core/process.js
        }
    }

Regarding Browserify
--------------------

Browserify is a CommonJS module _compiler_ which is targeted at Node.js, while Needy is a CommonJS module _runtime system_ intended for use as a development tool. Both of them will allow the same modular source code to run in browsers and other environments that do not natively support modules.

What's It For?
--------------

Initially, Needy was created to be a development compliment to Browserify and/or Google's Closure Compiler. Allowing modular code to be run as-is in a browser means not having to recompile for every code change and leaves code in a more readable state for your browser's development console.

Needy was not really intended for production use and makes no real attempt to "fix" the difficulties in implementing client side modules. It's syncronous, is expected to generate 404 warnings, and doesn't care about load times. It simply tries to mimic Node.js module behavior as closely as is reasonably possible on the client side.

It's not a _totally_ unreasonable idea to use Needy in a production web application, given today's average network speeds, good caching policies, modern browser pipelining, and a little server support. However, for anything with a decent amount of traffic or a large code base, compiling is probably still the way to go.

A secondary design goal was to make a module system that is as environment agnostic as possible. Needy uses only features from ECMAScript 3rd Edition or earlier, uses feature detection to provide environment specific implementations, and allows dependency injection in-case of unsupported environments.
