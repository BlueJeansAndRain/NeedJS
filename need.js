void function()
{
	"use strict";

	// Default Script Get Function
	// ---------------------------
	//
	// Use NodeJS "fs" module if available, or XMLHttpRequest if that's available. If neither is
	// available, then set the default to false which means that a get function _must_ be given via
	// the options.get property when calling need().
	//
	var defaultGet = (function()
	{
		try
		{
			var fs = require('fs');

			return function(path)
			{
				if (!fs.existsSync(path))
					return false;

				try
				{
					var stat = fs.statSync(path);
					if (!stat.isFile())
						return false;

					return fs.readFileSync(path, { encoding: 'utf8' });
				}
				catch (e) {}

				return false;
			};
		}
		catch (e) {}

		if (typeof XMLHttpRequest !== 'undefined')
		{
			return function(path)
			{
				var req = new XMLHttpRequest();
				req.open('get', path, false);
				if (options.noCache)
					req.setRequestHeader('pragma', 'no-cache');
				req.send();

				if (req.responseText == null)
					return false;

				return req.responseText;
			};
		}

		return false;
	}());

	// Universal Resolver Factory
	// --------------------------
	//
	// Used in both the browser module system and in the NodeJS compiler.
	//
	// This is a factory method that creates a resolve(startPath, name) function when called.
	//
	// * http://nodejs.org/api/modules.html#modules_all_together
	//
	function need(options)
	{
		if (!(options instanceof Object))
			options = {};

		var get = options.get == null ? defaultGet : options.get;
		if (!(get instanceof Function))
			throw new Error("missing get function");

		var directory = options.directory == null ? 'node_modules' : ((options.directory && typeof options.directory === 'string') ? options.directory : false);
		var manifest = options.manifest == null ? 'package.json' : ((options.manifest && typeof options.manifest === 'string') ? options.manifest : false);
		var cache = {};
		var core = {};

		function loadCore(name)
		{
			return core.hasOwnProperty(name) ? core[name] : false;
		}

		function loadPath(path)
		{
			if (cache.hasOwnProperty(path))
				return cache[path];

			var source;

			try
			{
				source = get(path);
				if (typeof source !== 'string')
					return false;
			}
			catch (e)
			{
				return false;
			}

			var module = cache[path] = { source: source };
			Object.defineProperty(module, 'id', { value: path, configurable: false, enumerable: true, writable: false });

			return module;
		}

		function loadFile(name)
		{
			if (name.charAt(name.length - 1) === '/')
				// Names that end in / are explicitly directories.
				return false;

			return loadPath(name) || loadPath(name + '.js');
		}

		function loadDirectory(name)
		{
			var pkg = loadPath(joinPath(name, manifest));
			if (pkg)
			{
				pkg = JSON.parse(pkg.source);
				if (pkg.constructor === Object && typeof pkg.main === 'string')
					return loadFile(joinPath(name, pkg.main));
			}

			return loadFile(joinPath(name, 'index.js'));
		}

		function loadTop(start, name)
		{
			var parts = joinPath('/', start.replace(/\/+$/, '')).split('/'),
				min = (parts.indexOf(directory) + 1) || 1,
				i = parts.length,
				path, module;

			while (parts.length > min)
			{
				path = parts.join('/');
				if (parts[parts.length - 1] === directory)
					path = joinPath(parts.join('/'), name);
				else
					path = joinPath(parts.join('/'), directory, name);

				if (module = (loadFile(path) || loadDirectory(path)))
					return module;

				parts.pop();
			}

			return false;
		}

		function joinPath()
		{
			var parts = Array.prototype.join.call(arguments, '/').split('/'),
				path = [],
				i = parts.length;

			while (--i >= 0)
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

		function validateName(name)
		{
			if (typeof name !== 'string')
				throw new Error("non-string");
			if (!name)
				throw new Error("empty");
			if (/[^a-z0-9_~\/\.\-]/i.test(name))
				throw new Error("invalid characters");
			if (name.charAt(0) === '/')
				throw new Error("leading forward slash");
		}

		function validateTopName(name)
		{
			if (/(^|\/)\./.test(name))
				throw new Error("invalid leading dot");
			if (name.charAt(name.length - 1) === '/')
				throw new Error("trailing forward slash");
		}

		function resolve(start, name)
		{
			validateName(name);

			if (!(/^\.{1,2}\//).test(name))
			{
				// Top-level
				validateTopName(name);
				return loadCore(name) || loadTop(start, name);
			}
			else
			{
				// Relative
				var path = joinPath('/', start, name);
				return loadFile(path) || loadDirectory(path);
			}
		}

		resolve.setCore = function(name, module)
		{
			validateName(name);
			validateTopName(name);

			if (core.hasOwnProperty(name))
				throw new Error("core redefinition");

			core[name] = module;
		};

		return resolve;
	}

	if (typeof module !== 'undefined' && module.exports)
	{
		// Required as module. Export the universal resolver factory.

		module.exports = need;
	}
	else void function()
	{
		// Used in the browser. Initialize browser modules support.

		var options = window.needjs;
		if (!(options instanceof Object))
			options = {};

		var resolve = need(options);

		var mainModule = void 0;

		var main = (function()
		{
			var script = Array.prototype.slice.call(document.getElementsByTagName('script')).pop();
			if (!script || !(/(?:^|\/)need.js$/.test(script.src)))
				throw new Error("script tag not found");

			var main = script.getAttribute('data-main');
			if (!main)
				throw new Error("missing data-main attribute");

			return main;
		}());

		function require(options, start, name)
		{
			var module = resolve(start, name);
			if (!module)
				throw new Error('failed resolving "' + name + '"');

			if (options.core)
				resolve.setCore(options.core, module);

			if (module.hasOwnProperty('source'))
			{
				// The module has not been initialized yet.

				if (options.main)
					mainModule = module;

				var moduleStart = module.id.replace(/[^\/]+$/, '');
				var moduleRequire = function(name)
				{
					return require({}, moduleStart, name);
				};

				Object.defineProperty(moduleRequire, 'main', { value: mainModule, configurable: false, enumerable: true, writable: false });
				Object.defineProperty(module, 'require', { value: moduleRequire, configurable: false, enumerable: true, writable: false });
				Object.defineProperty(module, 'exports', { value: {}, configurable: false, enumerable: true, writable: true });

				var source = module.source;
				delete module.source;

				/* jshint evil: true */
				new Function('module', 'exports', 'require', 'global', source + "\n//@ sourceURL=" + module.id)(module, module.exports, module.require, window);
			}
		}

		var start = window.location.pathname.replace(/[^\/]+$/, '');

		// Backfill Object.defineProperty for browsers that do not support ECMAScript 5th edition.
		if (Object.defineProperty == null)
		{
			Object.defineProperty = function(obj, name, options)
			{
				obj[name] = options.value instanceof Object ? options.value : void 0;
			};
		}

		// Require core modules.
		if (options.core instanceof Object)
		{
			for (var name in options.core)
			{
				if (typeof options.core[name] === 'string')
					require({ core: name }, start, options.core[name]);
				else if (options.core[name] === true)
					require({ core: name }, start, name);
			}
		}

		// Require the main module.
		require({ main: true }, start, main);
	}();
}();
