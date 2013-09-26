void function()
{
	"use strict";

	var _exports = (function()
	{
		// A thin shim that sets a property on an object, in case Object.defineProperty is
		// undefined.
		var defineProperty = Object.defineProperty || function(obj, name, options)
		{
			if (options instanceof Object && options.hasOwnProperty('value'))
				obj[name] = options.value;
		};

		// Define multiple properties with similar configuration values.
		function define(target, options, source)
		{
			if (options == null)
				options = {};

			for (var prop in source)
			{
				if (source[prop] == null)
					continue;

				defineProperty(target, prop, {
					value: source[prop],
					enumerable: options.enumerable == null ? true : !!options.enumerable,
					writable: options.writable == null ? true : !!options.writable,
					configurable: options.configurable == null ? true : !!options.configurable
				});
			}

			return target;
		}

		// Call a function ignoring any exceptions that it throws.
		function dethrow(fn)
		{
			try
			{
				return fn.apply(this, Array.prototype.slice.call(arguments, 1));
			}
			catch (e) {}
		}

		// Partially apply a function by filling in any number of its arguments.
		function partial(fn)
		{
			var args = Array.prototype.slice.call(arguments, 1);
			return function()
			{
				return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
			};
		}

		// Permantently override the "this" value of a function.
		function portable(obj, fn)
		{
			if (typeof fn === 'string')
				fn = obj[fn];

			return function()
			{
				return fn.apply(obj, arguments);
			};
		}

		// Combine path parts into a single path.
		function joinPath()
		{
			var parts = Array.prototype.slice.call(arguments, 0),
				i = parts.length;

			while (i--) if ((''+parts[i]).charAt(0) !== '/')
			{
				parts = parts.slice(i);
				break;
			}

			parts = parts.join('/').split(/\/+/).reverse();
			i = parts.length;

			while (i--)
			{
				switch (parts[i])
				{
					case '.':
						parts.splice(i, 1);
						break;
					case '..':
						parts.splice(i, 2);
						break;
				}
			}

			return path.reverse().join('/');
		}

		function defaultGetNode(fs, path)
		{
			if (/\.node$/.test(path))
				return fs.existsSync(path) ? "" : false;
			else
				return fs.readFileSync(path, { encoding: 'utf8' });
		}

		function defaultGetBrowser(xhr, path)
		{
			var req = new xhr();
			req.open(/\.node$/.test(path) ? 'head' : 'get', path, false);
			req.setRequestHeader('Accept', 'text/plain');
			req.send();

			if (req.status !== 200)
				return false;

			return req.responseText;
		}

		// Make sure a path is a string, isn't empty, contains valid characters, and optionally
		// isn't a dot path.
		function validPath(path, allowDots)
		{
			if (!(options instanceof Object))
				options = {};

			if (typeof path !== 'string')
				throw new Error("non-string");
			if (!path)
				throw new Error("empty");
			if (/[^a-z0-9_~\/\.\-]/i.test(path))
				throw new Error("invalid characters");
			if (!allowDots && /^\.{1,2}$/.test(path))
				throw new Error("dot/double-dot not allowed");
		}

		function Name(value)
		{
			if (validPath(value, true))
				throw new Error("invalid module name");

			var topLevel = /^\.{0,2}\//.test(value);
			if (topLevel)
			{
				// Top-level modules names cannot contain dot parts or trailing slashes.
				if (/\/(\.{1,2}(\/|$)|$)/.test(value))
					throw new Error("invalid module name");
			}

			define(this, { configurable: false, writable: false }, {
				value: value,
				topLevel: topLevel
			});
		}
		define(Name.prototype, { configurable: false }, {
			toString: function()
			{
				return this.value;
			}
		});

		function Module(id, extra)
		{
			if (id instanceof Name)
				id = id.value;

			define(this, { configurable: false, writable: false }, { id: id });
			define(this, { configurable: false }, { exports: {} });

			if (extra instanceof Object)
			{
				for (var prop in extra)
				{
					if (extra.hasOwnProperty(prop))
						this[prop] = extra[prop];
				}
			}
		}

		// See: http://nodejs.org/api/modules.html#modules_all_together
		function Resolver(options)
		{
			if (!(options instanceof Object))
				options = {};

			this._cache = {};

			this._initDirectory(options.directory);
			this._initManifest(options.manifest);
			this._initGet(options.get);
			this._initCore(options.core);
			this._initJsonParse(options.jsonParse);
			this._initLog(options.log);
		}
		define(Resolver.prototype, { configurable: false }, {
			resolve: function(dirname, name)
			{
				if (!validPath(dirname, true))
					throw new Error("invalid resolve dirname path");
				if (dirname.charAt(0) !== '/')
					throw new Error("non-absolute resolve dirname path");

				dirname = joinPath(dirname);

				if (!(name instanceof Name))
					name = new Name(name);

				var module;

				if (name.topLevel)
				{
					module = this._loadTop(dirname, name.value);
				}
				else
				{
					name = joinPath(dirname, name.value);
					module = this._loadNonTop(name);
				}

				if (!module)
					module = this._cache[name] = new Module(name, { source: false });

				return module;
			},
			_cache: void 0,
			_directory: 'node_modules',
			_manifest: 'package.json',
			_get: void 0,
			_core: void 0,
			_jsonParse: void 0,
			_log: function() {},
			_initDirectory: function(directory)
			{
				if (directory == null)
					return;

				if (!directory)
					this._directory = false;
				else if (validPath(directory) && directory.indexOf('/') === -1)
					this._directory = directory;
				else
					throw new Error("invalid directory name");
			},
			_initManifest: function(manifest)
			{
				if (manifest == null)
					return;

				if (!manifest)
					this._manifest = false;
				else if (validPath(manifest) && manifest.indexOf('/') === -1)
					this._manifest = manifest;
				else
					throw new Error("invalid manifest name");
			},
			_initGet: function(get)
			{
				if (get instanceof Function)
				{
					this._get = get;
					return;
				}

				try
				{
					// First try to require the Node.js "fs" module. If it's present, then use the
					// default get function for Node.js.

					var fs = require('fs');
					this._get = partial(defaultGetNode, fs);
				}
				catch (e)
				{
					// If requiring "fs" fails, then attempt to use the default get function for
					// the browser which uses XMLHttpRequest or IE's ActiveX equivalent.

					if (typeof window !== 'undefined')
					{
						if (typeof window.XMLHttpRequest !== 'undefined')
							this._get = partial(Resolver.defaultGetBrowser, window.XMLHttpRequest);
						else if (typeof window.ActiveXObject)
							this._get = partial(Resolver.defaultGetBrowser, window.ActiveXObject('MSXML2.XMLHTTP.3.0'));
					}
				}

				if (!this._get)
					throw new Error("missing get function");
			},
			_initCore: function(core)
			{
				if (!(core instanceof Object))
					return;

				var name, path;
				for (name in core)
				{
					path = core[name];
					if (!validPath(path))
						throw new Error("invalid core path");

					name = new Name(name);
					if (!name.topLevel)
						throw new Error("core name not top-level");
					if (this._core.hasOwnProperty(name.value))
						throw new Error("core name redefinition");

					this._core[name.value] = path;
				}
			},
			_initJsonParse: function(jsonParse)
			{
				if (jsonParse instanceof Function)
					this._jsonParse = jsonParse;
				else if (typeof JSON !== 'undefined')
					this._jsonParse = JSON.parse;
			},
			_initLog: function(log)
			{
				if (log instanceof Function)
					this._log = log;
			},
			_loadPath: function(path)
			{
				if (this._cache.hasOwnProperty(path))
					return this._cache[path];

				var source = dethrow(this._get, path);
				if (typeof source !== 'string')
					this._cache[path] = false;
				else
					this._cache[path] = new Module(path, { source: source });

				return this._cache[path];
			},
			_loadFile: function(name)
			{
				if (name.charAt(name.length - 1) === '/')
					// Names that end in / are explicitly directories.
					return false;

				return this._loadPath(name) || this._loadPath(name + '.js') || this._loadPath(name + '.json') || this._loadPath(name + '.node');
			},
			_loadManifest: function(name)
			{
				if (!this._jsonParse)
					return { main: 'index.js' };

				var manifest = this._loadPath(joinPath(name, this._manifest));
				if (!manifest)
					return { main: 'index.js' };

				manifest = dethrow(this._jsonParse, manifest);
				if (!(manifest instanceof Object))
					return { main: 'index.js' };

				return manifest;
			},
			_loadDirectory: function(name)
			{
				var manifest = this._loadManifest(name);
				var module = this._loadFile(joinPath(name, manifest.main));

				if (module)
					module.manifest = manifest;

				return module;
			},
			_loadNonTop: function(name)
			{
				return this._loadFile(name) || this._loadDirectory(name);
			},
			_loadTop: function(dirname, name)
			{
				if (this._core.hasOwnProperty(name))
					return this._loadNonTop(this._core[name]);

				// TODO: This part is not right.

				var parts = dirname.split('/'),
					min = (parts.indexOf(this._directory) + 1) || 1,
					path, module;

				if (!parts[parts.length - 1])
					parts.pop();

				while (parts.length > min)
				{
					if (parts[parts.length - 1] === this._directory)
						path = joinPath(parts.join('/'), name);
					else
						path = joinPath(parts.join('/'), this._directory, name);

					if (module = this._loadNonTop(path))
						return module;

					parts.pop();
				}

				return false;
			}
		});

		function Need(options)
		{
			if (!(options instanceof Object))
				options = {};

			if (options.global != null)
				this._global = options.global;
			else if (typeof global !== 'undefined')
				this._global = global;
			else if (typeof window !== 'undefined')
				this._global = window;
			else
				this._global = {};

			if (options.jsonParse instanceof Function)
				this._jsonParse = options.jsonParse;
			else if (typeof JSON !== 'undefined')
				this._jsonParse = JSON.parse;

			if (options.fallback instanceof Function)
				this._fallback = options.fallback;
			else if (typeof require !== 'undefined' && require instanceof Function)
				this._fallback = require;

			if (options.binaryInit instanceof Function)
				this._binaryInit = options.binaryInit;
			else if (typeof require !== 'undefined' && require instanceof Function)
				this._binaryInit = require;

			if (options.dirname != null)
				this._dirname = options.startPath;
			else if (typeof __dirname !== 'undefined')
				this._dirname = __dirname;
			else if (typeof window !== 'undefined' && window.location && typeof window.location.pathname === 'string')
				this._dirname = window.location.pathname.replace(/[^\/]+$/, '');

			if (options.resolve instanceof Function)
				this._resolve = options.resolve;
			else
			{
				var resolver = new Resolver({
					directory: options.directory,
					manifest: options.manifest,
					get: options.get,
					core: options.core,
					log: options.log
				});

				this._resolve = portable(resolver, 'resolve');
			}
		}
		define(Need.prototype, { configurable: false }, {
			init: function(name)
			{
				if (this._main)
					throw new Error("already initialized");

				this._require(this._dirname, name);

				return this._main.exports;
			},
			_main: void 0,
			_global: void 0,
			_jsonParse: false,
			_fallback: false,
			_binaryInit: false,
			_dirname: '/',
			_resolve: void 0,
			_require: function(dirname, name)
			{
				if (name === 'need')
					return Need;

				var module = this._resolve(dirname, name);

				if (typeof module.source === 'string')
				{
					// The module has not been initialized yet.

					var source = module.source;
					var moduleDirname = module.id.replace(/[^\/]+$/, '');

					delete module.source;
					delete module.manifest;

					if (!this._main)
						define(this, { writable: false }, { _main: module });

					if (/\.json$/.test(module.id))
					{
						if (this._jsonParse)
							module.exports = this._jsonParse(source);
						else
							throw new Error("json modules unsupported");
					}
					else if (/\.node$/.test(module.id))
					{
						if (this._binaryInit)
							module.exports = this._binaryInit(module.id);
						else
							throw new Error("binary modules unsupported");
					}
					else
					{
						define(module, { writable: false, configurable: false }, { require: partial(portable(this, '_require'), moduleDirname) });
						define(module.require, { configurable: false }, { main: this._main });

						/* jshint evil: true */
						Function('module', 'exports', 'require', '__filename', '__dirname', 'global', source + "\n//@ sourceURL=" + module.id)(module, module.exports, module.require, module.id, moduleDirname, this._global);
					}
				}
				else if (module.source === false)
				{
					delete module.source;
					delete module.manifest;

					if (this._fallback)
						module.exports = this._fallback(name);
					else
						throw new Error('failed resolving "' + name + '"');
				}

				return module.exports;
			}
		});

		return define(Need, null, {
			Resolver: Resolver,
			Name: Name,
			utils: define({}, null, {
				define: define,
				dethrow: dethrow,
				partial: partial,
				portable: portable,
				joinPath: joinPath,
				validPath: validPath,
				defaultGetNode: defaultGetNode,
				defaultGetBrowser: defaultGetBrowser
			})
		});
	}());

	if (typeof module !== 'undefined' && module.exports)
	{
		// Required as module.

		module.exports = _exports;
	}
	else if (typeof window !== 'undefined') void function()
	{
		// Used in the browser.

		var options = window.needjs;
		if (!(options instanceof Object))
			options = {};

		var main;
		if (typeof options.main === 'string')
			main = options.main;
		else
			main = (function()
			{
				var script = Array.prototype.slice.call(window.document.getElementsByTagName('script')).pop();
				if (!script)
					throw new Error("script tag not found");

				var valueN = script.getAttribute('data-main');
				if (!value)
					throw new Error("missing data-main attribute");

				return value;
			}());

		new Need(options).init(main);
	}();
	else
	{
		throw new Error("expected module.exports or window");
	}
}();
