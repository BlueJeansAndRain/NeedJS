#!/usr/bin/env node

"use strict";

var Static = require("node-static").Server;
var http = require('http');
var path = require('path');

var port = parseInt(process.env.npm_package_config_test_port, 10) || 8080;
var docroot = new Static(path.resolve(path.join(__dirname, '../test')), {
	cache: false,
	headers: {
		"Cache-Control": "no-store"
	}
});

http.createServer(function(req, res)
{
	req.on('end', function()
	{
		if (req.url === '/needy.js')
			docroot.serveFile('../needy.js', 200, {}, req, res);
		else
			docroot.serve(req, res);
	}).resume();
}).listen(port);

console.log("Listening on port " + port);
console.log("Press Ctrl+C to quit");

function doExit()
{
	if (!process.stdout.write("\rDone.\n"))
		process.stdout.on('drain', process.exit);
	else
		process.exit();
}

process
	.on('SIGTERM', doExit)
	.on('SIGINT', doExit);
