function defaultGetNode(fs, path)
{
	if (/\.node$/.test(path))
		return fs.existsSync(path) ? "" : false;
	else
		return fs.readFileSync(path, { encoding: 'utf8' });
}

function defaultGetBrowser(xhr, path)
{
	var req = new xhr();
	req.open(/\.node$/.test(path) ? 'head' : 'get', path, false);
	req.setRequestHeader('Accept', 'text/plain');
	req.send();

	if (req.status !== 200)
		return false;

	return req.responseText;
}
