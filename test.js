#!/usr/bin/env node

"use strict";

var Static = require("node-static").Server;
var http = require('http');
var path = require('path');

var port = parseInt(process.env.npm_package_config_port, 10) || 8080;
var docroot = new Static(path.join(__dirname), {
	cache: false,
	headers: {
		"Cache-Control": "no-store"
	}
});

http.createServer(function(req, res)
{
	req.on('end', function()
	{
		docroot.serve(req, res);
	}).resume();
}).listen(port);

console.log("Listening on port " + port);
console.log("Press Ctrl+C to quit");

process
	.on('SIGTERM', function()
	{
		process.exit();
	})
	.on('SIGINT', function()
	{
		process.exit();
	})
	.on('exit', function()
	{
		console.log("\rDone.");
	});
