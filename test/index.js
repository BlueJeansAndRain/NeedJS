"use strict";

window.log();
window.log('Main module loaded');
window.log('Hello World!');

window.log();
window.log('Requiring non-existent relative module names...');
window.log();
try
{
	require('./foo/bar');
}
catch (e)
{
	window.log(e.message, 'red');
}
