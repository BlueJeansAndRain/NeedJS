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
