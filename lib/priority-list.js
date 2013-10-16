function PriorityList(comparer)
{
	this._list = [];

	if (comparer instanceof Function)
		this._comparer = comparer;
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
			if (this._comparer(this._list[i].value, value))
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
	_list: void 0,
	_comparer: function(a, b)
	{
		return a === b;
	}
});
