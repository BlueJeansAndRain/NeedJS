#!/usr/bin/env node

"use strict";

if (typeof __needy === 'undefined' && require.main === module)
{
	var Needy = require('./needy.js');
	var needy = new Needy();

	if (!process.argv[2])
	{
		// No command line arguments, so start a REPL.

		var repl = require('repl').start('needy> ').context;

		// Add a dummy core module called "repl".
		needy.resolver.setCore('repl', function() {});

		// Use the dummy as the REPL session main module.
		var main = needy.init('repl');

		// Setup the REPL context to mimic running in the dummy module's context.
		repl.module = main;
		repl.exports = main.exports;
		repl.require = main.require;
		repl.__filename = __filename;
		repl.__dirname = __dirname;
		repl.__needy = needy;

		// Add the Needy class to the REPL context just for fun.
		repl.Needy = Needy;
	}
	else
	{
		// An command line argument is present. Initialize the Needy module context using the
		// argument as the path to the main module.

		needy.init(Needy.utils.joinPath(__dirname, process.argv[2]));
	}
}
