"use strict";

function block()
{
	if (arguments.length === 0)
		return;

	window.log();

	var i = 0, max = arguments.length;
	for (; i < max; ++i)
		window.log(arguments[i]);

	window.log();
}

function test(callback)
{
	try
	{
		callback();
	}
	catch (e)
	{
		window.log(e.message, 'red');
	}
}

block(
	'Main module loaded: ' + module.id,
	'Hello World!'
);

block('Requiring "needy" core module...');

test(function()
{
	require('needy');
});

block('Requiring non-existent relative module names...');

test(function()
{
	require('./foo/bar');
});
