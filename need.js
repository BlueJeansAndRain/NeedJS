void function()
{
	"use strict";

	var NeedJS = (function()
	{
		var defineProperty = Object.defineProperty || function(obj, name, options)
		{
			obj[name] = options.value instanceof Object ? options.value : void 0;
		};

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

		// Define multiple properties with similar configuration values.
		function define(target, options, source)
		{
			for (var prop in source)
			{
				if (source[prop] == null)
					continue;

				options.value = source[prop];
				defineProperty(target, prop, {
					value: source[prop],
					enumerable: options.enumerable == null ? true : !!options.enumerable,
					writable: options.writable == null ? true : !!options.writable,
					configurable: options.configurable == null ? true : !!options.configurable
				});
			}

			return target;
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
				_log: options.log instanceof Function ? options.log : function() {}
			});
		}
		define(Resolver.prototype, {}, {
			resolve: function(start, name)
			{
				if (!validPath(start, true))
					throw new Error("invalid resolve start path");
				if (start.charAt(0) !== '/')
					throw new Error("non-absolute resolve start path");

				start = joinPath(start);

				if (!(name instanceof Resolver.Name))
					name = new Resolver.Name(name);

				if (name.topLevel)
					return this._loadTop(start, name.value);
				else
					return this._loadNonTop(joinPath(start, name.value));
			}
		});
		define(Resolver.prototype, { enumerable: false }, {
			_initDirectory: function(directory)
			{
				if (directory == null)
					return 'node_modules';
				else if (!directory)
					return false;
				else if (!validPath(directory) || directory.indexOf('/') !== -1)
					throw new Error("invalid directory name");

				return directory;
			},
			_initManifest: function(manifest)
			{
				if (manifest == null)
					return 'package.json';
				else if (!manifest)
					return false;
				else if (!validPath(manifest) || manifest.indexOf('/') !== -1)
					throw new Error("invalid manifest name");

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
					get = partial(Resolver.get.node, fs);
				}
				catch (e)
				{
					// If requiring "fs" fails, then attempt to use the default get function for
					// the browser which uses XMLHttpRequest or IE's ActiveX equivalent.

					if (typeof window.XMLHttpRequest !== 'undefined')
						get = partial(Resolver.get.browser, window.XMLHttpRequest);
					else if (typeof window.ActiveXObject)
						get = partial(Resolver.get.browser, window.ActiveXObject('MSXML2.XMLHTTP.3.0'));
					else
						throw new Error("missing get function");
				}

				return get;
			},
			_initCore: function(map)
			{
				var core = {
					needjs: NeedJS
				};

				if (!(map instanceof Object))
					return core;

				var name, path;

				for (name in map)
				{
					path = map[name];
					if (!validPath(path))
						throw new Error("invalid core path");

					name = new Resolver.Name(name);
					if (!name.topLevel)
						throw new Error("core name not top-level");
					if (core.hasOwnProperty(name.value))
						throw new Error("core name redefinition");

					core[name.value] = path;
				}

				return core;
			},
			_loadPath: function(path)
			{
				if (this._cache.hasOwnProperty(path))
					return this._cache[path];

				var source = dethrow(this._get, path);

				if (typeof source !== 'string')
				{
					this._cache[path] = false;
					return false;
				}

				return this._cache[path] = define({ source: source }, { configurable: false }, { id: path });
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
				var main = dethrow.call(this, function()
				{
					return JSON.parse(this._loadPath(joinPath(name, this._manifest)).source).main;
				});

				return this._loadFile(joinPath(name, typeof main === 'string' ? main : 'index.js'));
			},
			_loadNonTop: function(name)
			{
				return this._loadFile(name) || this._loadDirectory(name);
			},
			_loadTop: function(start, name)
			{
				if (this._core.hasOwnProperty(name))
					return this._loadNonTop(this._core[name]);

				// TODO: This part is not right.
				var parts = start.split('/'),
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
		define(Resolver, { writable: false, configurable: false }, {
			Name: function(value)
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

				define(this, { enumerable: true }, {
					value: value,
					topLevel: topLevel
				});
			},
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

		return {
			Resolver: Resolver,
			dethrow: dethrow,
			partial: partial,
			define: define,
			joinPath: joinPath,
			validPath: validPath
		};
	}());

	if (typeof module !== 'undefined' && module.exports)
	{
		// Required as module. Export the NeedJS API.

		module.exports = NeedJS;
	}
	else void function()
	{
		// Used in the browser. Initialize browser modules support.

		var options = window.needjs;
		if (!(options instanceof Object))
			options = {};

		var mainModule = void 0,
			start = window.location.pathname.replace(/[^\/]+$/, ''),
			resolver = new NeedJS.Resolver({
				directory: options.directory,
				manifest: options.manifest,
				get: options.get,
				core: options.core,
				log: options.log
			});

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
					mainModule = module;

				delete module.source;

				NeedJS.define(module, { writable: false, configurable: false }, {
					require: NeedJS.define(NeedJS.partial(require, moduleStart), { configurable: false }, {
						main: mainModule
					})
				});

				NeedJS.define(module, { configurable: false }, {
					exports: {}
				});

				/* jshint evil: true */
				new Function('module', 'exports', 'require', 'global', source + "\n//@ sourceURL=" + module.id)(module, module.exports, module.require, window);
			}

			return module.exports;
		}

		var main = options.main;
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

		require(start, main);
	}();
}();
