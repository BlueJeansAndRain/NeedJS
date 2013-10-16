function Module(id, source)
{
	if (!(this instanceof Module))
		return new Module(id, source);

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
