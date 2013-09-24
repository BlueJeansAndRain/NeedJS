void function()
{
	"use strict";

	// Backfill Object.defineProperty for browsers that do not support ECMAScript 5th edition.
	if (Object.defineProperty == null)
	{
		Object.defineProperty = function(obj, name, options)
		{
			obj[name] = options.value instanceof Object ? options.value : void 0;
		};
	}

	// Backfill Function.prototype.bind for browsers that do not support ECMAScript 5th edition.
	if (Function.prototype.bind == null)
	{
		Function.prototype.bind = function(context)
		{
			if (typeof this !== 'function')
				throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");

			var fn = this,
				args = Array.prototype.slice.call(arguments, 1);

			return function()
			{
				fn.apply(context, args.concat(Array.prototype.slice.call(arguments, 0)));
			};
		};
	}

	// Define multiple properties with similar configuration values.
	function define(target, options, source)
	{
		if (typeof source === 'undefined')
		{
			source = options;
			options = null;
		}

		if (options instanceof Object)
		{
			options = {
				enumerable: options.enumerable == null ? true : !!options.enumerable,
				writable: options.writable == null ? true : !!options.writable,
				configurable: options.configurable == null ? true : !!options.configurable
			};
		}
		else
		{
			options = {
				enumerable: true,
				writable: true,
				configurable: true
			};
		}

		for (var prop in source)
		{
			if (source[prop] == null)
				continue;

			options.value = source[prop];
			Object.defineProperty(target, prop, options);
		}

		return target;
	}

	// Combine path parts into a single path.
	function joinPath()
	{
		var parts = Array.prototype.slice.call(arguments, 0),
			i = parts.length,
			part;

		while (i--)
		{
			part = ''+parts[i];
			if (part.charAt(0) === '/')
				break;
		}

		parts = parts.slice(i).join('/').split('/');

		var path = [];
		for (i = parts.length; i >= 0; --i)
		{
			switch (parts[i])
			{
				case '.':
					break;
				case '..':
					i--;
					break;
				default:
					path.push(parts[i]);
					break;
			}
		}

		return path.reverse().join('/').replace(/\/{2,}/g, '/');
	}

	// See: http://nodejs.org/api/modules.html#modules_all_together
	function Resolver(options)
	{
		if (!(options instanceof Object))
			options = {};

		define(this, { writable: true, configurable: true }, {
			_cache: {},
			_directory: this._initDirectory(options.directory),
			_manifest: this._initManifest(options.manifest),
			_get: this._initGet(options.get),
			_core: this._initCore(options.core),
			_corePath: null,
			_log: options.log instanceof Function ? options.log : function() {}
		});

		if (options.corePath != null)
			this.setCorePath(options.corePath);
	}
	define(Resolver.prototype, {
		resolve: function(start, name)
		{
			if (typeof start !== 'string')
				throw new Error("non-string start path");
			if (start.charAt(0) !== '/')
				throw new Error("non-absolute resolve start path");

			if (!(name instanceof this.Name))
				name = new this.Name(name);

			if (name.type === 'top')
			{
				if (!name.ignoreCore && this._core.hasOwnProperty(name))
				{
					if (!this._corePath)
						throw new Error("core path undefined");

					return this.resolve(this._corePath, this._core[name.value]);
				}

				return this._loadTop(start, name.value);
			}

			// relative or absolute

			var path = (name.type === 'relative' ? joinPath('/', start, name.value) : name.value);

			return this._loadFile(path) || this._loadDirectory(path);
		},
		setCorePath: function(path)
		{
			if (this._corePath)
				throw new Error("core path redefinition");
			if (typeof path !== 'string')
				throw new Error("non-string core path");
			if (path.charAt(0) !== '/')
				throw new Error("non-absolute core path");

			this._corePath = path;

			return this;
		}
	});
	define(Resolver.prototype, { enumerable: false }, {
		_initDirectory: function(directory)
		{
			if (directory == null)
				return 'node_modules';
			else if (directory === false)
				return false;
			else
				this._validatePathPart(directory);

			return directory;
		},
		_initManifest: function(manifest)
		{
			if (manifest == null)
				return 'package.json';
			else if (manifest === false)
				return false;
			else
				this._validatePathPart(manifest);

			return manifest;
		},
		_initGet: function(get)
		{
			if (get instanceof Function)
				return get;

			try
			{
				// First try to require the NodeJS "fs" module. If it's present, then use the
				// default get function for NodeJS.

				var fs = require('fs');
				get = this.get.node.bind(this, fs);
			}
			catch (e)
			{
				// If requiring "fs" fails, then attempt to use the default get function for
				// the browser which uses XMLHttpRequest.

				if (typeof window.XMLHttpRequest !== 'undefined')
					get = this.get.browser.bind(this, window.XMLHttpRequest);
				else if (typeof window.ActiveXObject)
					get = this.get.browser.bind(this, window.ActiveXObject('MSXML2.XMLHTTP.3.0'));
				else
					throw new Error("missing get function");
			}

			return get;
		},
		_initCore: function(core)
		{
			if (!(core instanceof Object))
				return {};

			var clean = {},
				coreName,
				name;

			for (coreName in core)
			{
				name = core[coreName];

				coreName = new this.Name(coreName, true);
				if (coreName.type !== 'top')
					throw new Error("non-top-level core module name");
				if (this._core.hasOwnProperty(coreName))
					throw new Error("core module redefinition");

				if (typeof name === 'string')
					this._core[coreName.value] = new this.Name(name, true);
				else if (name)
					this._core[coreName.value] = coreName;
			}

			return clean;
		},
		_loadPath: function(path)
		{
			if (this._cache.hasOwnProperty(path))
				return this._cache[path];

			var source;

			try
			{
				source = this._get(path);
			}
			catch (e) {}

			if (typeof source !== 'string')
			{
				this._cache[path] = false;
				return false;
			}

			var module = this._cache[path] = { source: source };
			define(module, { configurable: false }, { id: path });

			return module;
		},
		_loadFile: function(name)
		{
			if (name.charAt(name.length - 1) === '/')
				// Names that end in / are explicitly directories.
				return false;

			return this._loadPath(name) || this._loadPath(name + '.js');
		},
		_loadDirectory: function(name)
		{
			var pkg = this._loadPath(joinPath(name, this._manifest));

			if (pkg)
			{
				try
				{
					pkg = JSON.parse(pkg.source);
				}
				catch(e)
				{
					pkg = false;
				}

				if (pkg !== false && pkg.constructor === Object && typeof pkg.main === 'string')
					return this._loadFile(joinPath(name, pkg.main));
			}

			return this._loadFile(joinPath(name, 'index.js'));
		},
		_loadTop: function(start, name)
		{
			var parts = joinPath('/', start.replace(/\/+$/, '')).split('/'),
				min = (parts.indexOf(this._directory) + 1) || 1,
				i = parts.length,
				path, module;

			while (parts.length > min)
			{
				path = parts.join('/');
				if (parts[parts.length - 1] === this._directory)
					path = joinPath(parts.join('/'), name);
				else
					path = joinPath(parts.join('/'), this._directory, name);

				if (module = (this._loadFile(path) || this._loadDirectory(path)))
					return module;

				parts.pop();
			}

			return false;
		},
		_validatePathPart: function(part)
		{
			if (typeof part !== 'string')
				throw new Error("empty");
			if (/[^a-z0-9_~\.\-]/i.test(part))
				throw new Error("invalid characters");
			if (/^\.{1,2}$/.test(part))
				throw new Error("dot/double-dot not allowed");
		}
	});
	define(Resolver.prototype, { writable: false, configurable: false }, {
		Name: (function()
		{
			function Name(value, ignoreCore)
			{
				if (typeof value !== 'string')
					throw new Error("non-string");
				if (!value)
					throw new Error("empty");
				if (/[^a-z0-9_~\/\.\-]/i.test(value))
					throw new Error("invalid characters");

				var type;
				if (name.charAt(0) === '/')
					type = 'absolute';
				else if (/^\.{1,2}\//.test(value))
					type = 'relative';
				else
				{
					if (/(^|\/)\./.test(value))
						throw new Error("invalid leading dot");
					if (value.charAt(value.length - 1) === '/')
						throw new Error("invalid trailing forward slash");

					type = 'top';
				}

				define(this, { enumerable: true }, {
					value: value,
					type: type,
					ignoreCore: !!ignoreCore
				});
			}
			define(Name.prototype, {
				toString: function()
				{
					return this.value;
				}
			});

			return Name;
		}()),
		get: define({}, { writable: false, configurable: false }, {
			node: function(fs, path)
			{
				return fs.readFileSync(path, { encoding: 'utf8' });
			},
			browser: function(xhr, path)
			{
				var req = new xhr();
				req.open('get', path, false);
				//req.setRequestHeader('pragma', 'no-cache');
				req.send();

				if (req.responseText == null)
					return false;

				return req.responseText;
			}
		})
	});

	if (typeof module !== 'undefined' && module.exports)
	{
		// Required as module. Export the Resolver class.

		module.exports = Resolver;
	}
	else void function()
	{
		// Used in the browser. Initialize browser modules support.

		var options = window.needjs;
		if (!(options instanceof Object))
			options = {};

		var main = options.main;
		var mainModule = void 0;
		var start = window.location.pathname.replace(/[^\/]+$/, '');
		var resolver = new Resolver({
			directory: options.directory,
			manifest: options.manifest,
			get: options.get,
			core: options.core,
			corePath: options.corePath != null ? joinPath(start, options.corePath) : null,
			log: options.log
		});

		if (typeof main !== 'string')
		{
			main = (function()
			{
				var script = Array.prototype.slice.call(document.getElementsByTagName('script')).pop();
				if (!script)
					throw new Error("script tag not found");

				var value = script.getAttribute('data-main');
				if (!value)
					throw new Error("missing data-main attribute");

				return value;
			}());
		}

		function require(start, name)
		{
			var module = resolver.resolve(start, name);
			if (!module)
				throw new Error('failed resolving "' + name + '"');

			if (module.hasOwnProperty('source'))
			{
				// The module has not been initialized yet.

				var source = module.source;
				var moduleStart = module.id.replace(/[^\/]+$/, '');

				if (!mainModule)
				{
					mainModule = module;
					if (options.corePath == null)
						resolver.setCorePath(moduleStart);
				}

				delete module.source;

				define(module, { writable: false, configurable: false }, {
					require: define(function(name)
					{
						return require(moduleStart, name);
					},
					{ configurable: false }, {
						main: mainModule
					})
				});

				define(module, { configurable: false }, {
					exports: {}
				});

				/* jshint evil: true */
				new Function('module', 'exports', 'require', '__filename', '__dirname', 'global', source + "\n//@ sourceURL=" + module.id)(module, module.exports, module.require, module.id, moduleStart, window);
			}
		}

		// Require the main module.
		require(start, main);
	}();
}();
