function Identity(value, dir)
{
	if (!(this instanceof Identity))
		return new Identity(value);

	if (!isValidPath(value, true))
		throw new Error("invalid module name");

	var topLevel = !(/^\.{0,2}[\/\\]/).test(value);

	if (topLevel)
	{
		if (/[\\\/]/.test(value))
			throw new Error("top-level module names cannot contain slashes");
		else if (/^\./.test(value))
			throw new Error("top-level module names cannot begin with dots");

		if (!dir)
			dir = cwd;
		else if (!isValidPath(dir) || !isAbsPath(dir))
			throw new Error("invalid top-level start dirname");
	}
	else
	{
		value = joinPath(dir, value);
		dir = false;
	}

	defineProperties(this, { configurable: false, writable: false }, {
		key: dir ? dir + ':' + value : value,
		topLevel: dir,
		value: value
	});
}
defineProperties(Identity.prototype, { configurable: false }, {
	toString: function()
	{
		return this.key;
	}
});
defineProperties(Identity, { configurable: false }, {
	extend: partial(extendClass, Identity)
});
