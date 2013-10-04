void function()
{
	var version = "0.3.6";

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
		function defineProperties(target, options/*, source, ...*/)
		{
			if (options == null)
				options = {};

			var i = 2,
				max = arguments.length,
				source, prop;

			for (; i < max; ++i)
			{
				source = arguments[i];
				if (!(source instanceof Object))
					continue;

				for (prop in source)
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
			}

			return target;
		}

		// Copy non-null properties from all sources, to the target
		function setProperties(target/*, source, ...*/)
		{
			var i = 1,
				max = arguments.length,
				source, prop;

			for (; i < max; ++i)
			{
				source = arguments[i];
				if (!(source instanceof Object))
					continue;

				for (prop in source)
				{
					if (source[prop] == null)
						continue;

					target[prop] = source[prop];
				}
			}

			return target;
		}

		// Simple JavaScript inheritance. Nothing fancy.
		function extendClass(parent, constructor)
		{
			var anonymous = function() {};
			anonymous.prototype = parent.prototype;
			constructor.prototype = new anonymous();
			constructor.constructor = constructor;

			defineProperties.apply(null, [constructor.prototype, { configurable: false }].concat(Array.prototype.slice.call(arguments, 2)));

			defineProperties(constructor, { configurable: false }, {
				extend: partial(extendClass, constructor)
			});

			return constructor;
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
				rootPrefix;

			while (i--) if (isAbsPath(parts[i]))
			{
				// If the path is absolute, then save the root prefix so that it doesn't get
				// removed by a .. part.
				parts = parts.slice(i);
				rootPrefix = parts[0].match(/^([a-z]:|)[\/\\]/i)[1] + '/';
				parts[0] = parts[0].slice(rootPrefix.length);
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
						if (rootPrefix || parts[i+1] !== '..')
							parts.splice(i, 2);
						break;
				}
			}

			parts = parts.reverse();

			// If there's a prefix, add it back in.
			if (rootPrefix)
				return rootPrefix + parts.join('/');
			else
				return parts.join('/');
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

		// Return a quoted CSV string.
		function csv(array)
		{
			if (!(array instanceof Array) || array.length === 0)
				return '';

			array = array.slice(0);

			var i = array.length;
			while (i--)
				array[i] = '"' + (''+array[i]).replace(/(\\|")/g, '\\$1') + '"';

			return array.join(', ');
		}

		function indexIn(array, test)
		{
			var i = 0, max = array.length;
			for (; i < max; ++i) if (array[i] === test)
				return i;

			return -1;
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

		function getCwd()
		{
			var cwd = '/';
			if (typeof __dirname === 'string')
				cwd = __dirname;
			else if (typeof __filename === 'string')
				cwd = dirname(__filename);
			else if (typeof module !== 'undefined' && module && typeof module.uri === 'string')
				cwd = dirname(module.uri);
			else if (global.location && typeof global.location.pathname === 'string')
				cwd = global.location.pathname.replace(/[\/\\]*[^\/\\]*$/, '') || '/';

			cwd = joinPath(cwd);

			if (!isAbsPath(cwd))
				return '/';

			// Remove the trailing slashes, making sure to leave one leading slash if the path
			// is nothing but slashes.
			return cwd.replace(/(?!^)[\/\\]+$/, '');
		}

		var cwd = getCwd();

		var Logger = defineProperties({}, { configurable: false }, {
			setLog: function(log)
			{
				if (log instanceof Function)
					this.log = log;
				else
					this.log = false;

				return this.target;
			},
			setConsole: function(console)
			{
				this.console = !!console;

				return this.target;
			},
			setConsoleGroup: function(group)
			{
				this.group = group === 'collapse' ? group : !!group;

				return this.target;
			},
			log: function(message)
			{
				if (this.console && typeof console !== 'undefined' && typeof console.log !== 'undefined')
					console.log(message);

				if (this.log)
					this.log(message);

				return this.target;
			},
			group: function(message, submessage, callback)
			{
				if (!this.group || typeof console === 'undefined' || typeof console.group === 'undefined')
					return callback.apply(this.target, Array.prototype.slice.call(arguments, 3));

				var key = message ? (submessage ? message + ":" + submessage : message) : '';

				if (this.group === 'collapse')
					console.groupCollapsed(key);
				else
					console.group(key);

				try
				{
					return callback.apply(this.target, Array.prototype.slice.call(arguments, 3));
				}
				finally
				{
					console.groupEnd(key);
				}
			},
			mixin: function(target, options)
			{
				var state = {
					target: target,
					log: void 0,
					console: false,
					group: false,
				};

				defineProperties(target, { configurable: false }, {
					setLog: portable(state, this.setLog),
					setConsole: portable(state, this.setConsole),
					setConsoleGroup: portable(state, this.setConsoleGroup),
					_log: portable(state, this.log),
					_group: portable(state, this.group)
				});

				if (options instanceof Object)
				{
					if (options.log != null)
						target.setLog(options.log);
					if (options.console != null)
						target.setConsole(options.console);
					if (options.consoleGroup != null)
						target.setConsoleGroup(options.consoleGroup);
				}

				return target;
			}
		});

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

			defineProperties(this, { configurable: false, writable: false }, {
				value: value,
				topLevel: topLevel
			});
		}
		defineProperties(Name.prototype, { configurable: false }, {
			toString: function()
			{
				return this.value;
			}
		});
		defineProperties(Name, { configurable: false }, {
			extend: partial(extendClass, Name)
		});

		function PriorityList()
		{
			this._list = [];
		}
		defineProperties(PriorityList.prototype, { configurable: false }, {
			set: function(value, priority)
			{
				if (value == null)
					return this;

				var i;

				i = this._list.length;
				while (i--)
				{
					if (this._list[i].value === value)
					{
						this._list.splice(i, 1);
						break;
					}
				}

				if (priority !== false)
				{
					priority = parseInt(priority, 10) || 0;

					i = this._list.length;
					while (i--) if (this._list[i].priority <= priority)
						break;

					this._list.splice(i + 1, 0, { value: value, priority: priority });
				}

				return this;
			},
			each: function(context, callback)
			{
				if (callback == null)
				{
					callback = context;
					context = this;
				}

				var i = 0,
					max = this._list.length,
					list = this._list.slice(0),
					retval;

				for (; i < max; ++i)
				{
					retval = callback.call(context, list[i].value);
					if (retval != null)
						return retval;
				}

				return null;
			},
			toArray: function()
			{
				var array = this._list.slice(),
					i = array.length;

				while (i--)
					array[i] = array[i].value;

				return array;
			},
			toString: function()
			{
				return csv(this.toArray());
			},
			_list: void 0
		});

		function Module(id, source)
		{
			if (!(this instanceof Module))
				return new Module(id, source);

			if (id instanceof Name)
				id = id.value;

			defineProperties(this, { configurable: false, writable: false }, { id: id });
			defineProperties(this, { configurable: false }, { exports: {} });

			if (typeof source === 'string')
				this.source = source.replace(/^#!.*/, '');
			else if (source instanceof Function)
				this.source = source;
			else
				this.source = false;
		}
		defineProperties(Module, { configurable: false }, {
			extend: partial(extendClass, Module)
		});

		// See: http://nodejs.org/api/modules.html#modules_all_together
		function Resolver(options)
		{
			if (!(this instanceof Resolver))
				return new Resolver(options);

			Logger.mixin(this, options);

			options = this.options = setProperties({}, this.options, options);

			this._cache = {};
			this._manifestCache = {};

			this._core = {};
			this._extensions = new PriorityList();
			this._manifests = new PriorityList();
			this._prefixes = new PriorityList();

			this._group("Resolver Initialize", null, function()
			{
				this._initGet();
				this._initRoot();
				this._initCore();
				this._initExtension();
				this._initPrefix();
				this._initManifest();

				this._initAllowExtensionless(options.allowExtensionless);
			});
		}
		defineProperties(Resolver.prototype, { configurable: false }, {
			options: void 0,
			resolve: function(mod, dirname)
			{
				if (mod instanceof Module)
				{
					if (this._cache[mod.id])
						throw new Error("cache collision");

					this._cache[mod.id] = mod;

					return mod;
				}

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

				if (!(mod instanceof Name))
					mod = new Name(mod);

				return this._resolve(dirname, mod);
			},
			setGet: function(fn)
			{
				if (fn == null)
					return this;
				if (fn instanceof Function)
					throw new Error("invalid get function");

				this._get = fn;

				this._log('Custom get function set');
			},
			setRoot: function(root)
			{
				if (root == null)
					return this;
				else if (typeof root !== 'string')
					throw new Error("invalid root");

				// Remove the trailing slashes, making sure to leave one leading slash if the path
				// is nothing but slashes.
				this._root = joinPath(cwd, root).replace(/(?!^)[\/\\]+$/, '');

				this._log('Root set: "' + this._root + '"');
			},
			setCore: function(name, core)
			{
				this._normSet(name, core, function(name, core)
				{
					if (core === false)
					{
						delete this._core[name];
						this._log('Core module removed: "' + name + '"');
					}
					else
					{
						this._setCore(name, core);
						this._log('Core module added: "' + name + '" -> ' + (typeof core === 'string' ? '"' + core  + '"' : 'Function()'));
					}
				});

				return this;
			},
			setExtension: function(extension, priority)
			{
				this._normSet(extension, priority, function(extension, priority)
				{
					if (priority === false)
					{
						this._extensions.set(extension, false);
						this._log('Extension removed: "' + extension + '"');
					}
					else
					{
						this._setExtension(extension, priority);
						this._log('Extension added: "' + extension + '"');
					}
				});

				return this;
			},
			setManifest: function(manifest, priority)
			{
				this._normSet(manifest, priority, function(manifest, priority)
				{
					if (priority === false)
					{
						this._manifests.set(manifest, false);
						this._log('Generic manifest removed: "' + manifest + '"');
					}
					else
					{
						this._setManifest(manifest, priority);
						this._log('Generic manifest added: "' + manifest + '"');
					}
				});

				return this;
			},
			setPrefix: function(prefix, priority)
			{
				this._normSet(prefix, priority, function(prefix, priority)
				{
					var delim = prefix.indexOf(':'),
						manifests;

					if (delim >= 0)
					{
						manifests = prefix.slice(delim + 1).split(/\s*,\s*/);
						prefix = prefix.slice(0, delim);
					}

					if (priority === false)
					{
						this._prefixes.set(prefix, false);
						this._log('Prefix removed: "' + prefix + '"');
					}
					else
					{
						this._setPrefix(prefix, manifests, priority);
						if (manifests)
							this._log('Prefix added: "' + prefix + '" (manifests: ' + csv(manifests) + ')');
						else
							this._log('Prefix added: "' + prefix + '"');
					}
				});

				return this;
			},
			uncache: function(name)
			{
				if (name instanceof Name)
					name = name.value;

				delete this._cache[name];

				return this;
			},
			_cache: void 0,
			_manifestCache: void 0,
			_get: void 0,
			_root: '/',
			_core: void 0,
			_extensions: void 0,
			_prefixes: void 0,
			_manifests: void 0,
			_allowExtensionless: false,
			_resolve: function(dirname, name)
			{
				if (name.topLevel)
					this._log('Resolving top-level "' + name.value + '" in "' + dirname + '"');
				else if (!isAbsPath(name.value))
					this._log('Resolving relative "' + name.value + '" in "' + dirname + '"');
				else
					this._log('Resolving absolute "' + name.value + '"');

				this._log('  Trying "' + name + '" in cache');

				var mod;

				if (this._cache[name.value])
				{
					this._log('  + Found (cache)');
					mod = this._cache[name.value];
				}
				else
				{
					this._log('  - Not found');

					if (name.topLevel)
					{
						mod = this._loadTop(dirname, name.value);
					}
					else
					{
						name = joinPath(dirname, name.value);
						mod = this._loadNonTop(name);
					}
				}

				// A module is ALWAYS returned because it might be resolved outside of this resolver
				// and if we didn't create the module then we wouldn't be able to cache it. The
				// unresolved module's source property will be false.
				if (!mod)
				{
					if (name instanceof Name)
						name = name.value;

					if (this._cache[name])
						mod = this._cache[name];
					else
						mod = this._cache[name] = new Module(name);
				}

				return mod;
			},
			_initGet: function()
			{
				if (this._get instanceof Function)
					return;

				try
				{
					// First try to require the Node.js "fs" module. If it's present, then use the
					// default get function for Node.js.

					var fs = require('fs');
					if (fs.readFileSync instanceof Function && fs.existsSync instanceof Function)
					{
						this._get = partial(defaultGetNode, fs);
						return;
					}
				}
				catch (e) {}

				// If requiring "fs" fails or readFileSync/existsSync is unimplemented (browserify),
				// then attempt to use the default get function for the browser which uses
				// XMLHttpRequest or IE's ActiveX equivalent.
				if (global.XMLHttpRequest)
					this._get = partial(defaultGetBrowser, global.XMLHttpRequest);
				else if (global.ActiveXObject)
					this._get = partial(defaultGetBrowser, global.ActiveXObject('MSXML2.XMLHTTP.3.0'));

				if (!this._get)
					throw new Error("missing get function");
			},
			_initRoot: function()
			{
				this.setRoot(cwd);
			},
			_initCore: function()
			{
				this.setCore('needy', function() { return Needy; });
			},
			_initExtension: function()
			{
				this.setExtension(['', 'js', 'json', 'node']);
			},
			_initPrefix: function()
			{
				this.setPrefix('node_modules:package.json');
			},
			_initManifest: function()
			{
				this.setManifest('package.json');
			},
			_initAllowExtensionless: function(allowExtensionless)
			{
				if (allowExtensionless != null)
					this._allowExtensionless = !!allowExtensionless;
			},
			_normSet: function(a, b, fn)
			{
				if (a instanceof Array)
				{
					for (var i = 0, max = a.length; i < max; ++i)
						fn.call(this, a[i], 0);
				}
				else if (a instanceof Object)
				{
					for (var prop in a) if (a[prop] != null)
						fn.call(this, prop, a[prop]);
				}
				else if (a != null)
				{
					fn.call(this, a, b);
				}
			},
			_setCore: function(name, core)
			{
				if (!(core instanceof Function) && !isValidPath(core))
					throw new Error("invalid core value");
				if (typeof core === 'string')
					core = new Name(joinPath(this._root, core));

				if (!(name instanceof Name))
					name = new Name(name);

				if (!name.topLevel)
					throw new Error("core name not top-level");

				this._core[name.value] = core;
			},
			_setExtension: function(ext, priority)
			{
				if (typeof ext !== 'string' || /[^a-z0-9]/i.test(ext))
					throw new Error('invalid extension');

				this._extensions.set(ext, priority);
			},
			_setManifest: function(manifest, priority)
			{
				if (!isValidPath(manifest) || manifest.indexOf('/') !== -1)
					throw new Error('invalid manifest name');

				this._manifests.set(manifest, priority);
			},
			_setPrefix: function(prefix, manifests, priority)
			{
				if (!isValidPath(prefix) || prefix.indexOf('/') !== -1)
					throw new Error('invalid prefix name');

				if (manifests instanceof Array)
				{
					var i = manifests.length;
					while (i--) if (!isValidPath(manifests[i]) || manifests[i].indexOf('/') !== -1)
						throw new Error('invalid manifest name');
				}

				this._prefixes.set({ prefix: prefix, manifests: manifests }, priority);
			},
			_getManifestMain: function(path)
			{
				this._log('  Checking for manifest main in "' + path + '"');

				if (this._manifestCache.hasOwnProperty(path))
				{
					if (!this._manifestCache[path])
					{
						this._log('  - Not found (cache)');
						return false;
					}
					else
					{
						this._log('  + Found "' + this._manifestCache[path] + '" (cache)');
						return this._manifestCache[path];
					}
				}

				var source = dethrow(this._get, path);
				if (typeof source !== 'string')
				{
					this._manifestCache[path] = false;
					this._log('  - Not found');
					return false;
				}

				var obj = dethrow(JSON.parse, source);
				if (!(obj instanceof Object) || !obj.main || typeof obj.main !== 'string')
				{
					this._manifestCache[path] = false;
					this._log('  - Invalid');
					return false;
				}

				this._manifestCache[path] = obj.main;
				this._log('  + Found "' + obj.main + '"');

				return obj.main;
			},
			_load: function(path)
			{
				if (!this._allowExtensionless && !(/(^|[\/\\])[^\/\\]*\.[^\/\\]*$/).test(path))
					return false;

				this._log('  Trying "' + path + '"');

				if (this._cache.hasOwnProperty(path))
				{
					if (this._cache[path])
						this._log('  + Found (cache)');
					else
						this._log('  - Not found (cache)');

					return this._cache[path];
				}

				var source = dethrow(this._get, path);
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

				return this._extensions.each(this, function(ext)
				{
					return this._load(ext ? name + '.' + ext : name) || null;
				}) || false;
			},
			_loadManifest: function(path, prefix_manifests)
			{
				if (typeof JSON === 'undefined')
					return false;

				if (prefix_manifests instanceof Array)
				{
					var i = 0,
						max = prefix_manifests.length,
						main;

					for (; i < max; ++i)
					{
						if (main = this._getManifestMain(joinPath(path, prefix_manifests[i])))
							return main;
					}

					return false;
				}
				else
				{
					return this._manifests.each(this, function(manifest)
					{
						return this._getManifestMain(joinPath(path, manifest)) || null;
					}) || false;
				}
			},
			_loadDirectory: function(name, prefix_manifests)
			{
				var main = this._loadManifest(name, prefix_manifests),
					mod;

				if (main)
					mod = this._loadFile(joinPath(name, main)) || this._loadFile(joinPath(name, main, 'index'));

				return mod || this._loadFile(joinPath(name, 'index'));
			},
			_loadNonTop: function(name, prefix_manifests)
			{
				return this._loadFile(name) || this._loadDirectory(name, prefix_manifests);
			},
			_loadTop: function(dirname, name)
			{
				if (this._core.hasOwnProperty(name))
				{
					this._log('  Core contains "' + name + '"');

					if (this._core[name] instanceof Function)
					{
						this._log(  '  + Found (function)');
						return new Module(name, this._core[name]);
					}

					return this._resolve(null, this._core[name]);
				}

				var rootPrefix = dirname.match(/^(?:(?:[a-z]:)?[\/\\])?/i)[0];
				dirname = dirname.slice(rootPrefix.length);

				var parts;
				if (dirname)
					parts = dirname.split(/[\/\\]/);
				else
					parts = [];

				var prefixes = [];
				this._prefixes.each(this, function(def)
				{
					prefixes.push(def.prefix);
				});

				var i = parts.length - 1,
					root, mod;

				for (; i >= -1 && !mod; --i)
				{
					root = rootPrefix + parts.slice(0, i + 1).join('/');

					mod = this._prefixes.each(this, function(def)
					{
						// Don't search in nested dependency prefix directories.
						// Example: .../node_modules/node_modules
						if (i >= 0 && indexIn(prefixes, parts[i]) !== -1)
							return;

						this._log(' Prefix "' + joinPath(root, def.prefix) + '"');

						return this._loadNonTop(joinPath(root, def.prefix, name), def.manifests) || null;
					}) || false;
				}

				return mod;
			}
		});
		defineProperties(Resolver, { configurable: false }, {
			extend: partial(extendClass, Resolver)
		});

		function Needy(options)
		{
			if (!(this instanceof Needy))
				return new Needy(options);

			Logger.mixin(this, options);

			options = this.options = setProperties({}, this.options, options);

			this._initializers = {};
			this._prerequire = [];

			this._group('Needy Initialize', null, function()
			{
				this._log('Needy v' + this.version);

				if (this.parent)
					this._log('Parent Needy instance detected');
				else
					this._log('No parent');

				this._initFallback(this.options.fallback);
				this._initAllowUnresolved(this.options.allowUnresolved);
				this._initInitializers(this.options.initializers);
				this._initPrerequire(this.options.prerequire);
				this._initResolver(this.options);
			});
		}
		defineProperties(Needy.prototype, { configurable: false }, {
			options: void 0,
			resolver: void 0,
			fallback: false,
			defaultInitializers: {
				js: function(mod, source, dirname, needy, global)
				{
					Function('module', 'exports', 'require', '__filename', '__dirname', '__needy', 'global', source + "\n//@ sourceURL=" + mod.id)(mod, mod.exports, mod.require, mod.id, dirname, needy, global);
				},
				json: function(mod, source)
				{
					if (typeof JSON.parse === 'undefined')
						throw new Error('JSON modules are not supported');

					mod.exports = JSON.parse(source);
				},
				node: function(mod, source)
				{
					if (typeof require === 'undefined')
						throw new Error('binary modules (.node) are not supported');

					mod.exports = require(mod.id);
				}
			},
			init: function(name)
			{
				if (this._mainModule)
					throw new Error("already initialized");

				this._require(null, name);

				return this._mainModule;
			},
			require: function(name, dirname)
			{
				return this._require(dirname, name);
			},
			resolve: function(name, dirname)
			{
				return this._group(dirname || '[root]', name, _resolve, dirname, name);
			},
			setInitializer: function(ext, fn)
			{
				if (!(/^[a-z0-9]*$/i).test(ext))
					throw new Error('invalid initializer extension "' + ext + '"');

				if (fn === false)
				{
					delete this._initializers[ext];
					this._log('Initializer removed: "' + ext + '"');
				}
				else
				{
					if (!(fn instanceof Function))
						throw new Error('initializers must be functions');

					this._initializers[ext] = fn;

					this._log('Initializer added: "' + ext + '"');
				}
			},
			setGet: function(get)
			{
				if (!(this.resolver.setGet instanceof Function))
					this._log('Resolver does not support setGet() method');
				else
					this.resolver.setGet(get);

				return this;
			},
			setRoot: function(root)
			{
				if (!(this.resolver.setRoot instanceof Function))
					this._log('Resolver does not support setRoot() method');
				else
					this.resolver.setRoot(root);

				return this;
			},
			setCore: function(name, path)
			{
				if (!(this.resolver.setCore instanceof Function))
					this._log('Resolver does not support setCore() method');
				else
					this.resolver.setCore(name, path);

				return this;
			},
			setExtension: function(ext, priority)
			{
				if (!(this.resolver.setExtension instanceof Function))
					this._log('Resolver does not support setExtension() method');
				else
					this.resolver.setExtension(ext, priority);

				return this;
			},
			setManifest: function(manifest, priority)
			{
				if (!(this.resolver.setManifest instanceof Function))
					this._log('Resolver does not support setManifest() method');
				else
					this.resolver.setManifest(manifest, priority);

				return this;
			},
			setPrefix: function(prefix, priority)
			{
				if (!(this.resolver.setPrefix instanceof Function))
					this._log('Resolver does not support setPrefix() method');
				else
					this.resolver.setPrefix(prefix, priority);

				return this;
			},
			uncache: function(name)
			{
				if (!(this.resolver.uncache instanceof Function))
					this._log('Resolver does not support uncache() method');
				else
					this.resolver.uncache(name);

				return this;
			},
			_mainModule: false,
			_initializers: void 0,
			_prerequire: void 0,
			_allowUnresolved: false,
			_require: function(dirname, name)
			{
				return this._group(dirname || '[root]', name, function()
				{
					var mod = this._resolve(dirname, name);
					if (!(mod instanceof Module))
						mod = new Module(name);

					if (mod.source != null)
						this._moduleInit(mod, name);
					else if (mod.error && !this._allowUnresolved)
						throw mod.error;

					return mod.exports;
				});
			},
			_resolve: function(dirname, name)
			{
				return this.resolver.resolve ? this.resolver.resolve(name, dirname) : this.resolver(name, dirname);
			},
			_extendModule: function(mod, dirname)
			{
				defineProperties(mod, { writable: false, configurable: false }, { require: partial(portable(this, '_require'), dirname) });
				defineProperties(mod.require, { configurable: false }, { main: this._mainModule });
			},
			_moduleInit: function(mod, name)
			{
				var source = mod.source;
				delete mod.source;

				if (!this._mainModule && source)
				{
					this._mainModule = mod;

					if (this._prerequire && this._prerequire.length > 0)
					{
						this._group('Prerequiring modules', null, function()
						{
							var i = 0, max = this._prerequire.length;
							for (; i < max; ++i)
								this._require(null, this._prerequire[i]);
						});
					}
				}

				try
				{
					if (typeof source === 'string')
					{
						// Resolved to source code.

						var ext = mod.id.match(/(?:\.[a-z0-9]*)?$/i)[0].slice(1).toLowerCase(),
							moduleDirname = dirname(mod.id);

						this._extendModule(mod, moduleDirname);

						if (this._initializers.hasOwnProperty(ext))
							this._initializers[ext](mod, source, moduleDirname, this, global);
						else if (this.defaultInitializers.hasOwnProperty(ext))
							this.defaultInitializers[ext](mod, source, moduleDirname, this, global);
						else if (this.defaultInitializers.hasOwnProperty('js'))
							this.defaultInitializers.js(mod, source, moduleDirname, this, global);
						else
							throw new Error('no suitable initializer for "' + name + '"');
					}
					else
					{
						// For non-source or fallback resolved modules use null as the new require
						// root which makes the resolver use its own root.
						this._extendModule(mod, null);

						if (source instanceof Function)
						{
							// Resolved to initializer function.

							var returnedExports = source(mod, this, global);
							if (typeof returnedExports !== 'undefined')
								mod.exports = returnedExports;
						}
						else
						{
							// The module is unresolved.

							if (this.fallback)
								mod.exports = this.fallback(mod.id);
							else
								throw new Error('failed resolving "' + name + '"');
						}
					}
				}
				catch (e)
				{
					mod.error = e;

					if (this._mainModule === mod)
						this._mainModule = void 0;

					if (!this._allowUnresolved)
						throw e;
				}
			},
			_initFallback: function(fallback)
			{
				if (fallback instanceof Function)
					this.fallback = fallback;
				else if (!(this.fallback instanceof Function) && typeof require !== 'undefined' && require instanceof Function)
					this.fallback = require;

				if (this.fallback)
					this._log('Fallback require is set');
				else
					this._log('No fallback');
			},
			_initAllowUnresolved: function(allowUnresolved)
			{
				if (allowUnresolved != null)
					this._allowUnresolved = !!allowUnresolved;

				if (this._allowUnresolved)
					this._log('Ignore module unresolved errors');
				else
					this._log('Throw module unresolved errors');
			},
			_initResolver: function(options)
			{
				if (options.resolver instanceof Resolver || options.resolver instanceof Function)
					this.resolver = options.resolver;

				if (!(this.resolver instanceof Function) && !(this.resolver instanceof Resolver))
				{
					this._log('Creating default resolver');
					this.resolver = new Resolver(options);
				}
				else
				{
					this._log('Using external resolver ' + (this.resolver instanceof Function ? 'function' : 'instance'));
				}

				this.setGet(options.get);
				this.setRoot(options.root);
				this.setCore(options.core);
				this.setExtension(options.extension);
				this.setManifest(options.manifest);
				this.setPrefix(options.prefix);
			},
			_initInitializers: function(initializers)
			{
				if (!(initializers instanceof Object))
					return;

				for (var ext in initializers)
					this.setInitializer(ext, initializers[ext]);
			},
			_initPrerequire: function(prerequire)
			{
				if (!(prerequire instanceof Array))
					return;

				var i = 0, max = prerequire.length;
				for (; i < max; ++i)
				{
					if (typeof prerequire[i] === 'string')
					{
						this._prerequire.push(prerequire[i]);
						this._log('Prerequire added: "' + prerequire[i] + '"');
					}
					else if (prerequire[i] instanceof Module)
					{
						this._prerequire.push(prerequire[i]);
						this._log('Prerequire added: "' + prerequire[i].id + '"');
					}
				}
			}
		});
		defineProperties(Needy.prototype, { configurable: false, writable: false }, {
			version: version,
			parent: typeof __needy !== 'undefined' && __needy instanceof Needy ? __needy : null
		});
		defineProperties(Needy, { configurable: false, writable: false }, {
			version: version,
			Logger: Logger,
			Name: Name,
			PriorityList: PriorityList,
			Module: Module,
			Resolver: Resolver,
			utils: defineProperties({}, { configurable: false, writable: false }, {
				defineProperties: defineProperties,
				setProperties: setProperties,
				extendClass: extendClass,
				dethrow: dethrow,
				partial: partial,
				portable: portable,
				dirname: dirname,
				joinPath: joinPath,
				isAbsPath: isAbsPath,
				isValidPath: isValidPath,
				csv: csv,
				defaultGetNode: defaultGetNode,
				defaultGetBrowser: defaultGetBrowser,
				getCwd: getCwd
			}),
		});
		defineProperties(Needy, { configurable: false }, {
			extend: partial(extendClass, Needy)
		});

		return Needy;
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
		// Fallback to creating a Needy global variable.

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
		}

		// If there was no needy script tag, then check the options object for a string main
		// property.
		if (main === false && typeof options.main === 'string')
			main = options.main;

		// If a main module name is present, then automatically require it.
		if (main !== false)
			new Needy(options).init(main);
	}
}();
