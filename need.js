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

	// Universal Resolver Factory
	// --------------------------
	//
	// Used in both the browser module system and in the NodeJS compiler.
	//
	// This is a factory method that creates a resolve(startPath, name) function when called. The
	// returned resolve method returns a proto-module object with an "id" property and a "source"
	// property, or false if the module name cannot be resolved.
	//
	// * http://nodejs.org/api/modules.html#modules_all_together
	//
	function need(options)
	{
		if (!(options instanceof Object))
			options = {};

		var get = options.get;
		if (!(get instanceof Function))
		{
			try
			{
				// First try to require the NodeJS "fs" module. If it's present, then use the
				// default get function for NodeJS.

				var fs = require('fs');
				get = nodeGet.bind(null, fs);
			}
			catch (e)
			{
				// If requiring "fs" fails, then attempt to use the default get function for
				// the browser which uses XMLHttpRequest.

				if (typeof window.XMLHttpRequest !== 'undefined')
					get = browserGet.bind(null, window.XMLHttpRequest, !!options.noCache);
				else if (typeof window.ActiveXObject)
					get = browserGet.bind(null, window.ActiveXObject('MSXML2.XMLHTTP.3.0'), !!options.noCache);
				else
					throw new Error("missing get function");
			}
		}

		var directory = options.directory == null ? 'node_modules' : ((options.directory && typeof options.directory === 'string') ? options.directory : false);
		var manifest = options.manifest == null ? 'package.json' : ((options.manifest && typeof options.manifest === 'string') ? options.manifest : false);
		var log = options.log instanceof Function ? options.log : function() {};

		var cache = {};
		var core = {};

		function loadPath(path)
		{
			if (cache.hasOwnProperty(path))
				return cache[path];

			var source;

			try
			{
				source = get(path);
			}
			catch (e) {}

			if (typeof source !== 'string')
			{
				cache[path] = false;
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
				try
				{
					pkg = JSON.parse(pkg.source);
				}
				catch(e)
				{
					pkg = false;
				}

				if (pkg !== false && pkg.constructor === Object && typeof pkg.main === 'string')
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

		function Name(value, isCore)
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

			Object.defineProperty(this, 'value', { value: value, configurable: false, enumerable: true, writable: false });
			Object.defineProperty(this, 'type', { value: type, configurable: false, enumerable: true, writable: false });
			Object.defineProperty(this, 'isCore', { value: !!isCore, configurable: false, enumerable: true, writable: false });
		}

		function resolve(start, name)
		{
			if (!(name instanceof Name))
				name = new Name(name);

			if (name.type === 'top')
			{
				if (!name.isCore && core.hasOwnProperty(name))
					return resolve(start, core[name.value]);
				else
					return loadTop(start, name.value);
			}
			else // relative or absolute
			{
				var path = name.type === 'relative' ? joinPath('/', start, name.value) : name.value;
				return loadFile(path) || loadDirectory(path);
			}
		}

		resolve.defineCore = function(coreName, name)
		{
			coreName = new Name(coreName, true);
			if (coreName.type !== 'top')
				throw new Error("non-top core name");
			if (core.hasOwnProperty(coreName.value))
				throw new Error("core redefinition");

			core[coreName.value] = (name != null ? new Name(name, true) : coreName);
		};

		return resolve;
	}

	// Default NodeJS File System module backed get function.
	function nodeGet(fs, path)
	{
		return fs.readFileSync(path, { encoding: 'utf8' });
	}

	// Default XMLHttpRequest backed get function.
	function browserGet(xhr, noCache, path)
	{
		var req = new xhr();
		req.open('get', path, false);
		if (noCache)
			req.setRequestHeader('pragma', 'no-cache');
		req.send();

		if (req.responseText == null)
			return false;

		return req.responseText;
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

		// TODO: Use main property of options if available.
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

		function require(start, name)
		{
			var module = resolve(start, name);
			if (!module)
				throw new Error('failed resolving "' + name + '"');

			if (module.hasOwnProperty('source'))
			{
				// The module has not been initialized yet.

				if (!mainModule)
					mainModule = module;

				var moduleStart = module.id.replace(/[^\/]+$/, '');
				var moduleRequire = function(name)
				{
					return require(moduleStart, name);
				};

				Object.defineProperty(moduleRequire, 'main', { value: mainModule, configurable: false, enumerable: true, writable: false });
				Object.defineProperty(module, 'require', { value: moduleRequire, configurable: false, enumerable: true, writable: false });
				Object.defineProperty(module, 'exports', { value: {}, configurable: false, enumerable: true, writable: true });

				var source = module.source;
				delete module.source;

				// TODO: Define __filename and __dirname.
				/* jshint evil: true */
				new Function('module', 'exports', 'require', 'global', source + "\n//@ sourceURL=" + module.id)(module, module.exports, module.require, window);
			}
		}

		// Define core modules.
		// TODO: Handle options.core in resolver instead of here.
		if (options.core instanceof Array)
		{
			var i = 0,
				max = options.core.length,
				coreDef;

			for (; i < max; ++i)
			{
				coreDef = options.core[i];

				if (typeof coreDef === 'string')
				{
					resolve.defineCore(coreDef);
				}
				else if (coreDef instanceof Object)
				{
					if (typeof coreDef.name !== 'string')
						throw new Error("missing core name");

					if (coreDef.require == null)
						resolve.defineCore(coreDef.name);
					else
						resolve.defineCore(coreDef.name, coreDef.require);
				}
				else
				{
					throw new Error("invalid core module");
				}
			}
		}

		// Require the main module.
		require(window.location.pathname.replace(/[^\/]+$/, ''), main);
	}();
}();
