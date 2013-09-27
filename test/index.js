"use strict";

function block()
{
	if (arguments.length === 0)
		return;

	window.log();

	var i = 0, max = arguments.length;
	for (; i < max; ++i)
		window.log(arguments[i]);
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

block('Requiring "needy" core module.');
test(function()
{
	require('needy');
});

block('Requiring non-existent modules. These are expected to fail, but should illuminate the module resolution algorithm.');

var nonexistant = [
	'./a/b',
	'./c/d/',
	'../e/f',
	'../g/h/',
	'/i/j',
	'/k/l/',
	'm',
	'n/o'
];

var i = 0, max = nonexistant.length;
for (; i < max; ++i)
{
	block('require("' + nonexistant[i] + '");');
	test(function()
	{
		require(nonexistant[i]);
	});
}
