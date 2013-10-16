"use strict";
/* globals __needy */

function test(message, callback)
{
	window.ui.logger();
	window.ui.logger(message, '#afa');

	try
	{
		callback();
	}
	catch (e)
	{
		window.ui.logger(e.message, 'red');
	}
}

window.ui.logger();
window.ui.logger('Main module loaded: ' + module.id);
window.ui.logger('The time is: ' + new Date());
window.ui.logger('Hello World!');

test('Requiring "needy" core module.', function()
{
	var Needy = require('needy');
	if (__needy instanceof Needy)
		window.ui.logger('__needy is an instance of require("needy")');
	else
		throw new Error('__needy is not an instance of require("needy")');
});

test('Requiring "core1" core module.', function()
{
	require('core1');
});

test('Requiring "core2" core module.', function()
{
	require('core2');
});

test('Requiring "foo" top-level module.', function()
{
	require('foo');
});

test('Requiring "bar" top-level directory module.', function()
{
	require('bar');
});

test('Requiring "./bacon" relative module.', function()
{
	require('./bacon');
});

test('Requiring "eggs" top-level directory module with a manifest, which in turn requires sausage and beans. Beans doesn\'t exist.', function()
{
	require('eggs');
});

window.ui.logger();
window.ui.logger('Requiring non-existent modules. These are expected to fail, but should illuminate the module resolution algorithm.');

var nonexistant = [
	'./a/b',
	'./c/d/',
	'../e/f',
	'../g/h/',
	'/i/j',
	'/k/l/',
	'm'
];

var i = 0, max = nonexistant.length;
for (; i < max; ++i)
{
	test('require("' + nonexistant[i] + '");', function()
	{
		require(nonexistant[i]);
	});
}
