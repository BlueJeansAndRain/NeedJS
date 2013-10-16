/* inline
	utils.js
	getters.js
	logger.js
	name.js
	priority-list.js
	module.js
	resolver.js
*/

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
			/* jshint evil: true */
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
defineProperties(Needy, { configurable: false }, {
	extend: partial(extendClass, Needy)
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
