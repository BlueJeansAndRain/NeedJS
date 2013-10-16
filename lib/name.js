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
