void function()
{
	"use strict";

	// This function should be identical to the one found in needjs-build.
	function resolver(getter, options)
	{
		// http://nodejs.org/api/modules.html#modules_all_together

		if (!(options instanceof Object))
			options = {};

		var directory = options.directory == null ? 'node_modules' : ((options.directory && typeof options.directory === 'string') ? options.directory : false);
		var manifest = options.manifest == null ? 'package.json' : ((options.manifest && typeof options.manifest === 'string') ? options.manifest : false);
		var cache = {};

		function loadPath(id)
		{
			if (cache.hasOwnProperty(id))
				return cache[id];

			var source = getter(id);
			if (typeof source === 'string')
				return cache[id] = { id: id, source: source };

			return false;
		}

		function loadFile(file)
		{
			return loadPath(file) || loadPath(file + '.js');
		}

		function loadDirectory(dir)
		{
			var pkg = loadPath(joinPath(dir, manifest));
			if (pkg)
			{
				pkg = JSON.parse(pkg.source);
				if (pkg.constructor === Object && typeof pkg.main === 'string')
					return loadFile(joinPath(dir, pkg.main));
			}

			return loadFile(joinPath(dir, 'index.js'));
		}

		function loadTop(start, id)
		{
			var parts = joinPath('/', start.replace(/\/+$/, '')).split('/'),
				min = (parts.indexOf(directory) + 1) || 1,
				i = parts.length,
				path, module;

			while (parts.length > min)
			{
				path = parts.join('/');
				if (parts[parts.length - 1] === directory)
					path = joinPath(parts.join('/'), id);
				else
					path = joinPath(parts.join('/'), directory, id);

				if (module = (loadFile(path) || loadDirectory(path)))
					return module;

				parts.pop();
			}

			return false;
		}

		function joinPath()
		{
			var parts = Array.prototype.join.call(arguments, '/').split('/'),
				path = [],
				i = parts.length;

			while (--i >= 0)
			{
				switch (parts[i])
				{
					case '.':
						break;
					case '..':
						i--;
						break;
					default:
						path.push(parts[i]);
						break;
				}
			}

			return path.reverse().join('/').replace(/\/{2,}/g, '/');
		}

		return function(start, name)
		{
			if (!name)
				throw new Error("empty");
			if (/[^a-z0-9_~\/\.\-]/i.test(name))
				throw new Error("invalid characters");
			if (name.charAt(0) === '/')
				throw new Error("leading forward slash");
			if (name.charAt(name.length - 1) === '/')
				throw new Error("trailing forward slash");

			if (/^\.{1,2}/.test(name))
			{
				var path = joinPath('/', start, name);
				return loadFile(path) || loadDirectory(path);
			}
			else
			{
				return loadTop(start, name);
			}
		};
	}

	// XMLHttpRequest wrapper
	function getter(uri)
	{

	}

	var resolve = resolver(getter, window.needjs);

	// TODO: Load main module.
}();
