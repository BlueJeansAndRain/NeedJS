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
