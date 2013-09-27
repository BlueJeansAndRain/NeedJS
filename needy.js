void function()
{
	"use strict";
	/* jshint evil: true */
	/* globals module, define */

	// An environment agnostic reference to the global namespace.
	var global = Function('return this;')();

	var Needy = (function()
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
				/* jshint validthis: true */
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

		// Get the directory part of a path.
		// * Replicates Node.js path.dirname behavior.
		function dirname(path)
		{
			return path.replace(/(^(?:[a-z]:)?[\/\\])?[\/\\]*[^\/\\]*[\/\\]*$/i, '$1') || '.';
		}

		// Combine path parts into a single path, handing all . or .. or empty parts and normalizing
		// separators to foward slashes.
		// * Replicates Node.js path.join behavior, with the exception that this method normalizes
		//   all separators to forward slashes unlike the Node.js version.
		function joinPath()
		{
			var parts = Array.prototype.slice.call(arguments, 0);
			if (parts[0] instanceof Array)
				parts = parts[0];

			// Strip off all parts before the first part with a root prefix.
			var i = parts.length,
				prefix;
			while (i--) if (isAbsPath(parts[i]))
			{
				// If the path is absolute, then save the root prefix so that it doesn't get
				// removed by a .. part.
				parts = parts.slice(i);
				prefix = parts[0].match(/^([a-z]:|)[\/\\]/i)[1] + '/';
				parts[0] = parts[0].substr(prefix.length);
				break;
			}

			parts = parts.join('/').split(/[\/\\]+/).reverse();

			i = parts.length;

			while (i--)
			{
				switch (parts[i])
				{
					case '':
						if (i !== 0)
							parts.splice(i, 1);
						break;
					case '.':
						if (i !== 0)
							parts.splice(i, 1);
						else
							parts[i] = '';
						break;
					case '..':
						// Only strip off leading .. parts if the path is absolute.
						if (prefix || parts[i+1] !== '..')
							parts.splice(i, 2);
						break;
				}
			}

			parts = parts.reverse();

			// If there's a prefix, add it back in.
			if (prefix)
				return prefix + parts.join('/');
			else
				return parts.join('/');
		}

		// Remove the trailing slashes, making sure to leave one leading slash if the path is
		// nothing but slashes.
		function stripTrailingSlashes(path)
		{
			return path.replace(/(?!^)[\/\\]+/, '');
		}

		// Detect a windows or linux root prefix.
		function isAbsPath(path)
		{
			return (/^([a-z]:)?[\/\\]/i).test(''+path);
		}

		// Make sure a path is a string, isn't empty, contains valid characters, and optionally
		// isn't a dot path.
		function isValidPath(path, allowDots)
		{
			if (typeof path !== 'string')
				return false;
			if (!path)
				return false;
			if (!/^([a-z]:[\/\\])?[a-z0-9_~\/\.\-]+$/i.test(path))
				return false;
			if (!allowDots && /^\.{1,2}$/.test(path))
				return false;

			return true;
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

		function Name(value)
		{
			if (!(this instanceof Name))
				return new Name(value);

			if (!isValidPath(value, true))
				throw new Error("invalid module name");

			var topLevel = !(/^\.{0,2}[\/\\]/).test(value);
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

		function Module(id, source, extra)
		{
			if (!(this instanceof Module))
				return new Module(id, source, extra);

			if (id instanceof Name)
				id = id.value;

			define(this, { configurable: false, writable: false }, { id: id });
			define(this, { configurable: false }, { exports: {} });

			if (typeof source === 'string')
			{
				this.source = source;
			}
			else
			{
				this.source = false;

				if (source instanceof Object)
					extra = source;
			}

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
			if (!(this instanceof Resolver))
				return new Resolver(options);

			if (!(options instanceof Object))
				options = {};

			this._cache = {};
			this._core = {};

			this._initRoot(options.root);
			this._initDirectory(options.directory);
			this._initManifest(options.manifest);
			this._initGet(options.get);
			this._initCore(options.core);
			this._initJsonParse(options.jsonParse);
			this._initLog(options.log);
		}
		define(Resolver.prototype, { configurable: false }, {
			resolve: function(name, dirname)
			{
				if (dirname != null)
				{
					if (!isValidPath(dirname, true))
						throw new Error("invalid resolve dirname");

					dirname = joinPath(this._root, dirname);
				}
				else
				{
					dirname = this._root;
				}

				return this._resolve(dirname, name);
			},
			uncache: function(name)
			{
				delete this._cache[name];
			},
			_cache: void 0,
			_root: '/',
			_directory: 'node_modules',
			_manifest: 'package.json',
			_get: void 0,
			_core: void 0,
			_jsonParse: void 0,
			_log: function() {},
			_resolve: function(dirname, name)
			{
				this._log('Resolving "' + name + '" in "' + dirname + '"');

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

				// A module is ALWAYS returned because it might be resolved outside of this resolver
				// and if we didn't create the module then we wouldn't be able to cache it. The
				// unresolved module's source property will be false.
				if (!module)
				{
					if (this._cache[name])
						module = this._cache[name];
					else
						module = this._cache[name] = new Module(name);
				}

				return module;
			},
			_initRoot: function(root)
			{
				if (typeof __dirname === 'string')
					this._root = __dirname;
				else if (typeof __filename === 'string')
					this._root = dirname(__filename);
				else if (typeof module !== 'undefined' && module && typeof module.uri === 'string')
					this._root = dirname(module.uri);
				else if (global.location && typeof global.location.pathname === 'string')
					this._root = global.location.pathname.replace(/[\/\\]*[^\/\\]*$/, '');

				// Ensure a leading slash and join options.root if it's a string.
				if (typeof root === 'string')
					this._root = joinPath('/', this._root, root);
				else
					this._root = joinPath('/', this._root);

				this._root = stripTrailingSlashes(this._root);

				this._log('Root is "' + this._root + '"');
			},
			_initDirectory: function(directory)
			{
				if (directory != null)
				{
					if (!directory)
						this._directory = false;
					else if (isValidPath(directory) && directory.indexOf('/') === -1)
						this._directory = directory;
					else
						throw new Error("invalid directory name");
				}

				this._log('Top-level sub-directory name is "' + this._directory + '"');
			},
			_initManifest: function(manifest)
			{
				if (manifest != null)
				{
					if (!manifest)
						this._manifest = false;
					else if (isValidPath(manifest) && manifest.indexOf('/') === -1)
						this._manifest = manifest;
					else
						throw new Error("invalid manifest name");
				}

				this._log('Manifest filename is "' + this._manifest + '"');
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

					if (global.XMLHttpRequest)
						this._get = partial(defaultGetBrowser, global.XMLHttpRequest);
					else if (global.ActiveXObject)
						this._get = partial(defaultGetBrowser, global.ActiveXObject('MSXML2.XMLHTTP.3.0'));
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
					if (!isValidPath(path))
						throw new Error("invalid core path");

					name = new Name(name);
					if (!name.topLevel)
						throw new Error("core name not top-level");
					if (this._core.hasOwnProperty(name.value))
						throw new Error("core name redefinition");

					this._core[name.value] = joinPath(this._root, path);

					this._log('Core module added: "' + name.value + '" -> "' + this._core[name.value] + '"');
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
			_load: function(path)
			{
				this._log('  Trying "' + path + '"');

				if (this._cache.hasOwnProperty(path))
				{
					if (this._cache[path])
						this._log('  + Found (cache)');
					else
						this._log('  - Not found (cache)');

					return this._cache[path];
				}

				//var source = dethrow(this._get, path);
				var source = this._get(path);
				if (typeof source !== 'string')
				{
					this._cache[path] = false;
					this._log('  - Not found');
				}
				else
				{
					this._cache[path] = new Module(path, source);
					this._log('  + Found');
				}

				return this._cache[path];
			},
			_loadFile: function(name)
			{
				if (name.charAt(name.length - 1) === '/')
					// Names that end in / are explicitly directories.
					return false;

				return this._load(name) || this._load(name + '.js') || this._load(name + '.json') || this._load(name + '.node');
			},
			_loadManifest: function(name)
			{
				if (!this._jsonParse)
					return false;

				this._log('Getting manifest for "' + name + '"');

				var manifest = this._load(joinPath(name, this._manifest));
				if (!manifest)
					return false;

				manifest = dethrow(this._jsonParse, manifest);
				if (!(manifest instanceof Object))
				{
					this._log('Invalid manifest for "' + name + '"');
					return false;
				}

				return manifest;
			},
			_loadDirectory: function(name)
			{
				var manifest = this._loadManifest(name),
					module;

				if (manifest && manifest.main && typeof manifest.main === 'string')
				{
					this._log('Manifest main for "' + name + '" is "' + manifest.main + '"');
					module = this._loadFile(joinPath(name, manifest.main)) || joinPath(name, manifest.main, 'index');
				}

				if (!module)
					module = this._loadFile(joinPath(name, 'index'));

				if (module && manifest)
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
				{
					this._log('Core map contains "' + name + '"');
					return this._loadNonTop(this._core[name]);
				}

				var parts = (dirname === '/') ? [''] : dirname.split(/[\/\\]/);

				// If dirname contains the top-level subdirectory, then consider the top-most one
				// the "root" of the search.
				var min = parts.indexOf(this._directory);
				min = (min === -1) ? 0 : min - 1;
				if (min === -1)
					min = 0;

				var module;
				while (parts.length > min)
				{
					// Don't search in nested dependency directories.
					// Example: .../node_modules/node_modules
					if (parts[parts.length - 1] !== this._directory)
					{
						if (module = this._loadNonTop(joinPath(parts.concat([this._directory, name]))))
							return module;
					}

					parts.pop();
				}

				return false;
			}
		});

		function Needy(options)
		{
			if (!(this instanceof Needy))
				return new Needy(options);

			if (!(options instanceof Object))
				options = {};

			this._initResolver(options);
			this._initJsonParse(options.jsonParse);
			this._initFallback(options.fallback);
			this._initBinaryInit(options.fallback);
		}
		define(Needy.prototype, { configurable: false }, {
			init: function(name)
			{
				if (this._main)
					throw new Error("already initialized");

				this._require(null, name);

				return this._main.exports;
			},
			_main: void 0,
			_resolver: void 0,
			_jsonParse: false,
			_fallback: false,
			_binaryInit: false,
			_require: function(dirname, name)
			{
				if (name === 'needy')
					return Needy;

				var module = this._resolver.resolve(name, dirname);

				if (module.source != null)
					this._moduleInit(module, name);

				return module.exports;
			},
			_moduleInit: function(module, name)
			{
				var source = module.source;
				var moduleDirname = dirname(module.id);

				delete module.source;
				delete module.manifest;

				if (!this._main)
					this._main = module;

				try
				{
					if (typeof source === 'string')
					{
						// The module was resolved.

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
							Function('module', 'exports', 'require', '__filename', '__dirname', '__needy', 'global', source + "\n//@ sourceURL=" + module.id)(module, module.exports, module.require, module.id, moduleDirname, this, global);
						}
					}
					else
					{
						// The module is unresolved.

						if (this._fallback)
							module.exports = this._fallback(module.id);
						else
							throw new Error('failed resolving "' + name + '"');
					}
				}
				catch (e)
				{
					this._resolver.uncache(module.id);

					if (this._main === module)
						this._main = void 0;

					throw e;
				}
			},
			_initResolver: function(options)
			{
				if (options.resolver instanceof Resolver)
				{
					this._resolver = options.resolver;
				}
				else
				{
					this._resolver = new Resolver({
						directory: options.directory,
						manifest: options.manifest,
						get: options.get,
						core: options.core,
						log: options.log
					});
				}
			},
			_initJsonParse: function(jsonParse)
			{
				if (jsonParse instanceof Function)
					this._jsonParse = jsonParse;
				else if (typeof JSON !== 'undefined')
					this._jsonParse = JSON.parse;
			},
			_initFallback: function(fallback)
			{
				if (fallback instanceof Function)
					this._fallback = fallback;
				else if (typeof require !== 'undefined' && require instanceof Function)
					this._fallback = require;
			},
			_initBinaryInit: function(binaryInit)
			{
				if (binaryInit instanceof Function)
					this._binaryInit = binaryInit;
				else if (typeof require !== 'undefined' && require instanceof Function)
					this._binaryInit = require;
			}
		});

		return define(Needy, null, {
			Resolver: Resolver,
			Name: Name,
			utils: define({}, null, {
				define: define,
				dethrow: dethrow,
				partial: partial,
				portable: portable,
				dirname: dirname,
				joinPath: joinPath,
				stripTrailingSlashes: stripTrailingSlashes,
				isAbsPath: isAbsPath,
				isValidPath: isValidPath,
				defaultGetNode: defaultGetNode,
				defaultGetBrowser: defaultGetBrowser
			})
		});
	}());

	if (typeof module !== 'undefined' && module && module.exports)
	{
		// Required as a CommonJS module.

		module.exports = Needy;
	}
	else if (typeof define === 'function')
	{
		// Required as a RequireJS module.

		define(function()
		{
			return Needy;
		});
	}
	else
	{
		// Fall back to adding Needy to the global namespace.

		if (global.Needy == null)
			global.Needy = Needy;

		var options = global.needy || {};
		var main = false;

		if (global.document)
		{
			// Running in a browser or something browser-like with a global document variable.

			// Attempt to get the script tag that included Needy. It should be the last script on
			// the page with a "data-needy" attribute.
			var script, scripts = global.document.getElementsByTagName('script'),
				i = scripts.length;

			while (main === false && i--)
			{
				script = scripts[i];
				main = script.hasAttribute('data-needy') && script.getAttribute('data-needy');
			}
			//while (main === false && (script = scripts.pop()))
			//	main = script.hasAttribute('data-needy') && script.getAttribute('data-needy');
		}

		// If there was no needy script tag, then check the options object for a string main
		// property.
		if (main === false && options.main === 'string')
			main = options.main;

		// If a main module name is present, then automatically require it.
		if (main !== false)
			new Needy(options).init(main);
	}
}();
