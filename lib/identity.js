function Identity(value, dir)
{
	if (!(this instanceof Identity))
		return new Identity(value);

	if (!isValidPath(value, true))
		throw new Error("invalid module name");

	if (!dir)
		dir = cwd;
	else if (!isValidPath(dir) || !isAbsPath(dir))
		throw new Error("invalid start dirname");

	var key, topLevel = !(/^\.{0,2}[\/\\]/).test(value);

	if (topLevel)
	{
		if (/[\\\/]/.test(value))
			throw new Error("top-level module names cannot contain slashes");
		else if (/^\./.test(value))
			throw new Error("top-level module names cannot begin with dots");

		key = dir + ':' + value;
	}
	else
	{
		value = joinPath(dir, value);
		dir = false;
		key = value;
	}

	defineProperties(this, { configurable: false, writable: false }, {
		value: value,
		topLevel: dir,
		key: key
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
