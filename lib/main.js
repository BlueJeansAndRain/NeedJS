void function()
{
	var version = "0.5.1";

	"use strict";
	/* globals module, define */

	// An environment agnostic reference to the global namespace.
	/* jshint evil: true */
	var global = Function('return this;')();

	/* inline needy.js */

	if (typeof module !== 'undefined' && module && module.exports)
	{
		// Required as a CommonJS module.

		module.exports = Needy;
	}
	else if (typeof define === 'function')
	{
		// Required as a RequireJS module.

		define(function()
		{
			return Needy;
		});
	}
	else
	{
		// Fallback to creating a Needy global variable.

		if (global.Needy == null)
			global.Needy = Needy;

		var options = global.needy || {};
		var main = false;

		if (global.document)
		{
			// Running in a browser or something browser-like with a global document variable.

			// Attempt to get the script tag that included Needy. It should be the last script on
			// the page with a "data-needy" attribute.
			var script, scripts = global.document.getElementsByTagName('script'),
				i = scripts.length;

			while (main === false && i--)
			{
				script = scripts[i];
				main = script.hasAttribute('data-needy') && script.getAttribute('data-needy');
			}
		}

		// If there was no needy script tag, then check the options object for a string main
		// property.
		if (main === false && typeof options.main === 'string')
			main = options.main;

		// If a main module name is present, then automatically require it.
		if (main !== false)
			new Needy(options).init(main);
	}
}();
