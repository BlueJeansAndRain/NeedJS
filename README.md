Needy
=====

CommonJS modules for the browser, Node.js, or any other JavaScript environment.

You "should" be able to use Needy in just about any JavaScript environment, either to add module support, or even to replace an existing module system. The `Needy` class will automatically be exported as a CommonJS or AMD module if possible. If `module.exports` and `define` are both undefined, then the `Needy` class will be added to the global namespace as a last resort.

Overview
--------

Here's a highlevel example of a basic Needy webapp setup.

Document root directory structure.

    /index.html
    /js/main.js
    /js/node_modules/needy/
    /js/node_modules/needy/...
    /js/node_modules/needy-nodecore/
    /js/node_modules/needy-nodecore/...

/index.html
```html
<!DOCTYPE html>
<html>
    <head>
        <title>Needy Example</title>
    </head>
    <body>
    </body>
</html>
<script>
// Set some Needy options...
window.needy = {
    // Resolve main, core, and prerequires relative to the "js" sub-directory.
    root: 'js',
    // Automatically require "needy-nodecore" which adds Node.js core modules support.
    prerequire: ["needy-nodecore"],
    // Output Needy log messages to the console.
    log: function(message) { console.log(message); }
};
</script>
<script src="node_modules/needy/needy.js" data-needy="./main.js">
```

_Notice that even though "main.js" is in the "js" sub-directory of the document root, the "data-needy" attribute of the "needy.js" script tag is does not include the "js" part because the "root" option makes the main module relative to "js"._

/js/main.js
```javascript
// Node.js process emulation provided by needy-nodecore.
var process = require("process");

var span = document.createElement('span');
span.appendChild(document.createTextNode(process.title + ' says "Hello world!"'));
document.body.appendChild(span);
```

When this page is loaded, you should see something like...
```
browser says "Hello world!"
```

If you have your developer console open, you'll also see log messages about what Needy is doing behind the scenes, and probably some 404 warnings due to Needy trying different paths.

Features
--------

* Can be included as a CommonJS or an AMD module, otherwise it will expose the `Needy` class as a global.
* Works or can be configured to work in just about any JavaScript environment.
    * Can be used with zero configuration in Node.js and most browsers.
    * Uses only features from ECMAScript 3rd Edition or earlier.
        * To resolve .json files or directory modules which use a manifest file, JSON.parse must exist.
* Can be used in the browser or as a command line utility to execute scripts or start a REPL.
* Complies with the CommonJS modules specification (1.1.1).
    * Secure (sandbox) mode only. `module.paths` and `module.uri` will not be defined.
* Node.js emulation.
    * Node.js `__filename`, `__dirname`, and `global` variables are defined.
    * Node.js-like module resolution algorithm is implemented including "node_modules" sub-directory lookup, and directory modules with or without "package.json" files.
        * 404 warnings may be displayed in a browser's console due to module resolution. This is not a bug, it's just the only way for the browser to determine if a file exists. For production, compiling is recommended.
    * _Node.js core modules are __not__ provided by this project._
        * _(planned)_ They will be available via the [needy-nodecore](https://github.com/BlueJeansAndRain/needy-nodecore) project, which will be based on the [browser-builtins](https://npmjs.org/package/browser-builtins) project which is the same project that browserify uses for browser compatible Node.js core modules.
* More extensible than the Node.js module system.
    * Add custom core modules.
    * Add initializers for more file types, beyond the regular JavaScript, JSON, and Node.js binary modules.
        * Node.js binaries are only supported in Node.js
    * Change the top-level prefix (node_modules) and manifest (package.json) names.
    * Define a custom method for getting source code from a path.
    * Completely redefine module resolution behavior.
* Under 5kB minified and gzipped.

Installation
------------

Install via NPM.

    npm install needy

FYI: Running the NPM test script will start a web server on localhost:8080. If you visit that address in your browser, you'll see an example of Needy running in the browser.

    npm test

It can also be installed globally as a command line application.

    npm install -g needy

Checkout the repository from GitHub.

    git clone git@github.com:BlueJeansAndRain/needy.git

Download the current release in the GitHub repository.

* [zip](https://github.com/BlueJeansAndRain/needy/archive/current.zip)
* [tar.gz](https://github.com/BlueJeansAndRain/needy/archive/current.tar.gz)

Usage
-----

### In The Browser

```html
<script src="needy.min.js" data-needy="main"></script>
```

If you want to set more options than just the main module, you can do it in one of the following ways.

Define a `needy` global object.

```html
<script>
    window.needy = {
        ...
    };
</script>
<script src="needy.js" data-needy="main"></script>
```

The main module name can also be given in the `needy` global instead of as a `data-needy` script attribute.

```html
<script>
    window.needy = {
        main: "main",
        ...
    }
</script>
<script src="needy.js"></script>
```

Instantiate the Needy class and call its init method.

```html
<script src="needy.js"></script>
<script>
    var needy = new Needy({
        ...
    });

    needy.init("main");
</script>
```

If no main module name is set via the `needy` global or `data-needy` attribute, then no instances of the Needy class will be automatically created.

### As A CommonJS Module

```javascript
var Needy = require('needy');
var needy = new Needy({
    ...
});

needy.init("main");
```

### As An AMD Module

```javascript
define(["path/to/needy"], function(Needy)
{
    var needy = new Needy({
        ...
    });

    needy.init("main");
});
```

### On The Command Line

First, make sure you've installed Needy globally as outlined in the Installation section.

Calling Needy with no arguments starts a Node.js REPL with a Needy module system.

    needy

Execute a script using the Needy module system instead of the Node.js module system by passing the script path as the first arguments. Extra arguments will be passed to the script via `process.argv`.

    needy path/to/script.js arg1 arg2 ...

You can even use a shebang to make executable JavaScript files automatically use Needy, at least on `nix operating systems.

    #!/usr/bin/env needy

Options
-------

Module resolution, logging, and core environment can be customized via an options object.

```javascript
{
    // The main module name to require. The default resolve method will
    // require a top-level or relative to the startPath option.
    main: "main",

    // Do something with a log message. Defaults to ignoring log messages.
    log: console.log,

    // Called when Needy can't resolve a module name. Defaults to an
    // existing require method if one is defined in the scope that
    // required/included Needy.
    fallback: function(name) {
        // Return module exports or throw an exception.
    },

    // Set a custom name resolution implementation. Defaults to a
    // Needy.Resolver instance created with the options passed to the Needy
    // constructor. This can be an object with a "resolve" method or a
    // function. The method/function will be passed a module name and the
    // directory of the module that is requiring it. It should return a
    // Needy.Module instance or derivative. If it cannot resolve the
    // module name then it can return false, return a module with source
    // property set to false, or throw an exception.
    resolver: new Needy.Resolver(options),

    // Define initializers for specific file extensions. There are default
    // initializers for .js, .json, and .node files. If a file has an
    // unrecognized extension then the default initializer for .js files
    // will be used.
    initializers: {
        coffee: function(module, source, dirname, needy, global)
        {
            // An initalizer for .coffee files. Parse the source and set
            // the exports.
        }
    },

    // Module names to require before the main module. These are not the same
    // as core modules. Core modules adjust resolver behavior for specific top
    // level module names, but do not actually cause modules to be loaded
    // until something requires that top-level name. Prerequires are required
    // immediately before the main module. This should be an array of module
    // names and/or Needy.Module instances.
    prerequire: [
        "needy-nodecore",
        new Module("silly-walks", function(module, needy, global)
        {
            // Set or return exported API.
        })
    ],

    // Throw exceptions when require cannot resolve a module. The CommonJS
    // spec states that exceptions should be thrown if a module cannot be
    // resolved. However, it seems like there might be cases when silently
    // failing is reasonable. Now exception will be thrown when a module
    // cannot be found, if this option is true.
    allowUnresolved: false,

    //
    // Options below this point are for the default Needy.Resolver
    // instance that is created when the resolver option is not set. They
    // have no effect if a custom resolver is used._
    //

    // The path prefix to use when requiring relative or top-level main
    // module, prequire, and core module names. Defaults in order to whichever
    // of the following exists:__dirname, __filename directory part, module.uri
    // directory part, window.location directory part, or "/". If this is
    // not an absolute (beginning with /) path, then it is appended to the
    // default startPath.
    root: "/",

    // The dependencies directory name to look for when resolving
    // top-level module names. Defaults to "node_modules" for Node.js
    // compatibility.
    prefix: "node_modules",

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

    // Core module names mapped to their "real" require name or an
    // initializer function. Top-level and relative module paths will be
    // required relative to the root option.
    core: {
        "process": "./core/process.js",
        "path": function(module, needy, global)
        {
            // Set or return exported API.
        }
    }
}
```

Advanced API
------------

In addition to setting options, you can extend Needy, Needy.Resolver, or Needy.Module. They all have a static method `extend` for easier derived class definition.

Class structure outline:

* `Needy`
    * _static_
        * `Resolver`
            * _properties_
                * options = Object
                * _cache = Object
                * _manifestCache = Object
                * _log = Function
                * _root = String
                * _prefix = String
                * _manifest = String
                * _get = Function
                * _core = Object
            * _methods_
                * constructor(options)
                * constructor(Resolver)
                * resolve(name, dirname)
                * resolve(module)
                * addCore(name, core)
                * uncache(name)
                * _resolve(dirname, name)
                * _initLog(options.log)
                * _initRoot(options.root)
                * _initPrefix(options.prefix)
                * _initManifest(options.manifest)
                * _initGet(options.get)
                * _initCore(options.core)
                * _getManifestMain(directory)
                * _addCore(name, core)
                * _load(path)
                * _loadFile(name)
                * _loadDirectory(name)
                * _loadNonTop(name)
                * _loadTop(dirname, name)
            * _static\_methods_
                * extend(childConstructor, prototype...)
        * `Module`
            * _properties_
                * id = String
                * source = String | Function | false,
                * exports
            * _methods_
                * constructor(id, source)
            * _static\_methods_
                * extend(childConstructor, prototype...)
        * version = String
        * utils = Object
            * defineProperties(target, options, source)
            * setProperties(target, source...)
            * extendClass(parent, childConstructor, prototype...)
            * dethrow(fn, arg...)
            * partial(fn, arg...)
            * portable(obj, fn)
            * dirname(path)
            * joinPath(path...)
            * isAbsPath(path)
            * isValidPath(path)
            * defaultGetNode(path)
            * defaultGetBrowser(path)
    * _properties_
        * options = Object
        * parent = Needy | null
        * resolver = Function | Needy.Resolver
        * fallback = Function | false
        * defaultInitializers = Object
            * js = Function
            * json = Function
            * node = Function
        * _mainModule = Needy.Module
        * _initializers = Object
        * _prerequire = Array
        * _allowUnresolved = Boolean
    * _methods_
        * constructor(options)
        * constructor(Needy)
        * init(name)
        * require(name, dirname)
        * resolve(name, dirname)
        * addInitializer(extension, init_function)
        * _require(dirname, name)
        * _resolve(dirname, name)
        * _extendModule(module)
        * _moduleInit(module, name)
        * _initResolver(options)
        * _initFallback(options.fallback)
        * _initInitializers(options.initializers)
        * _initPrerequire(options.prerequire)
        * _initAllowUnresolved(options.allowUnresolved)
    * _static\_methods_
        * extend(childConstructor, prototype...)

You can write modules that work with the Needy instance that required them via the `__needy` global variable. Needy also automatically defines itself as a core module, so modules can get the Needy class by calling `require("needy")`.

RequireJS vs. Browserify vs. Needy
----------------------------------

Currently the two hot projects for modular code in the browser are RequireJS and Browserify. Needy fills what I feel is an unclaimed middle ground.\

Here's a breakdown of how they all relate:

* They _all_ support...
    * Multi-version modules
    * JSON modules
    * Almost any JavaScript environment
* [RequireJS](http://requirejs.org/)
    * Asynchronous
    * Pros
        * Can run uncompiled code.
        * Comes with a compiler.
        * Custom module loaders.
    * Cons
        * For modules to be cross compatible with Node.js, they must be specially written or re-compiled.
        * Circular dependencies result in an undefined module API.
        * No Node.js core module emulation.
        * No support for NPM module management. Modules in NPM can of course be written to work with RequireJS, but RequireJS does not support the directory scheme NPM uses.
        * No core module definition at all.
        * No custom module resolution or fetching.
* [Browserify](http://browserify.org/)
    * Synchronous
    * Pros
        * Modules are cross compatible with Node.js.
        * Circular dependencies can be partially defined.
        * Includes partial Node.js core module emulation.
        * It is a compiler.
        * Supports NPM module management.
    * Cons
        * No uncompiled code support.
        * No custom module loader support.
        * No _extra_ core module definition.
        * No custom module resolution and fetching.
* Needy
    * Synchronous
    * Pros
        * Can run uncompiled code.
        * Circular dependencies can be partially defined.
        * Modules are cross compatible with Node.js.
        * Supports NPM module management.
        * Custom module loaders.
        * Custom core module definition.
        * Custom module resolution and fetching.
    * Cons
        * No _included_ compiler.
            * Can leverage Browserify compiler, just like Node.js.
        * No _built-in_ node core module emulation.
            * It does support adding Node.js core modules via the (planned) needy-nodecore module.

### Sync vs. Async

Asynchronous is a JavaScript buzzword. It makes great sense for I/O intensive applications, and module loading does require I/O.

RequireJS modules do not actually take much advantage of asynchronous I/O though. The pattern that RequireJS uses actually implies that all modules will be fetched before any of your code runs! It can still make multiple simultaneous requests, which might save a little time, but in the realm of things, not much. On top of that, projects were the overhead might matter are typically compiled for production. The callback AMD pattern is also a little hard to step through when debugging.

Browserify, being a compiler, is synchronous and has even less overhead than RequireJS. However, it's still difficult to step through, because it's all compiled.

Needy is synchronous without being compiled, which makes stepping across modules in your browser's dev console much easier. The tradeoff is that it's absolutely awful as far as loading latency goes, which makes it fairly unsuitable for production. Luckily, it can be compiled (Using Browserify even! Or, Google Closure compiler if you prefer.)

What's It For?
--------------

Initially, Needy was created to be a development compliment to Browserify and/or Google's Closure Compiler. An easier way to work with CommonJS modular code in development. It has since evolved into a more complete solution, with command line support, extensibility features, and environment feature detection.

It's not an obvious choice for production use since it makes no real attempt to "fix" the difficulties in implementing browser modules. It's expected to generate 404 warnings while resolving and doesn't care about load times. But it's designed to be extended, so, given reasonable network speeds, good caching policies, modern browser pipelining, and a little server support, it is certainly possible. However, for anything with a decent amount of traffic or a large code base, compiling is probably still the way to go. It's the great JavaScript equalizer.
