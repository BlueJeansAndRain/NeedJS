"use strict";

var pkg = require('../package.json');
if (typeof pkg.version !== 'string')
{
	console.log('No version found in "package.json"');
	process.exit(0);
}

var fs = require('fs');
var path = require('path');

var filename = path.resolve(path.join(__dirname, '../needy.js'));
var source = fs.readFileSync(filename, { encoding: 'utf8' });

var match = source.match(/^(\s*)var __version_updated_on_prepublish = "([0-9\.]*)";/m);
if (match == null)
{
	console.error('Unable to find __version_updated_on_prepublish variable');
	process.exit(1);
}

var start = match.index;
var end = start + match[0].length;
var indent = match[1];
var version = match[2];

if (version === pkg.version)
{
	console.log('"needy.js" and "package.json" versions already match');
}
else
{
	console.log('Changing "needy.js" version from "' + version + '" to "' + pkg.version + '"');

	source = source.substring(0, start) + indent + 'var __version_updated_on_prepublish = "' + pkg.version + '";' + source.substring(end);
	fs.writeFileSync(filename, source);
}
