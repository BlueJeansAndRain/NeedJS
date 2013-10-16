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
	this._prefixes = new PriorityList(function(a, b)
	{
		return a.value === b.value;
	});

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
	resolve: function(identity, dirname)
	{
		if (!(identity instanceof Identity))
			identity = new Identity(identity, dirname || this._root);

		return this._resolve(identity);
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

			this._setPrefix(prefix, manifests, priority);

			if (priority === false)
			{
				this._log('Prefix removed: "' + prefix + '"');
			}
			else
			{
				if (manifests)
					this._log('Prefix added: "' + prefix + '" (manifests: ' + csv(manifests) + ')');
				else
					this._log('Prefix added: "' + prefix + '"');
			}
		});

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
	_resolve: function(identity)
	{
		if (identity.topLevel)
			this._log('Resolving top-level "' + identity.value + '" in "' + identity.topLevel + '"');
		else
			this._log('Resolving "' + identity.value + '"');

		this._log('  Trying "' + identity.key + '" in cache');

		if (this._cache.hasOwnProperty(identity.key))
		{
			if (this._cache[identity.key])
				this._log('  + Found (cache)');
			else
				this._log('  - Not found (cache)');

			return this._cache[identity.key];
		}
		else
		{
			this._log('  - Cache miss');
			return this._cache[identity.key] = this._loadModule(identity);
		}
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
	_setCore: function(identity, core)
	{
		if (!(identity instanceof Identity))
			identity = new Identity(identity, '/');
		if (!identity.topLevel)
			throw new Error("core name not top-level");

		if (!(core instanceof Function) && !(core instanceof Identity))
			core = new Identity(core, this._root);

		this._core[identity.value] = core;
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
	_loadFile: function(path)
	{
		// Names that end in / are explicitly directories.
		if (path.charAt(path.length - 1) === '/')
			return false;

		return this._extensions.each(this, function(ext)
		{
			return this._load(ext ? path + '.' + ext : path) || null;
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
	_loadDirectory: function(path, prefix_manifests)
	{
		var main = this._loadManifest(path, prefix_manifests),
			mod;

		if (main)
			mod = this._loadFile(joinPath(path, main)) || this._loadFile(joinPath(path, main, 'index'));

		return mod || this._loadFile(joinPath(path, 'index'));
	},
	_loadNonTop: function(path, prefix_manifests)
	{
		return this._loadFile(path) || this._loadDirectory(path, prefix_manifests);
	},
	_loadTop: function(name, dirname)
	{
		if (this._core.hasOwnProperty(name))
		{
			this._log('  Core contains "' + name + '"');

			if (this._core[name] instanceof Function)
			{
				this._log(  '  + Found (function)');
				return new Module(name, this._core[name]);
			}

			return this._resolve(this._core[name]);
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
			mod = false,
			root;

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
	},
	_loadModule: function(identity)
	{
		if (identity.topLevel)
			return this._loadTop(identity.value, identity.topLevel);
		else
			return this._loadNonTop(identity.value);
	}
});
defineProperties(Resolver, { configurable: false }, {
	extend: partial(extendClass, Resolver)
});
