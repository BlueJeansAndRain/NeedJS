window.ui = {
	logger: function(message, color)
	{
		var div = document.createElement('div');
		if (color)
			div.style.color = color;
		if (message != null)
			div.appendChild(document.createTextNode(message));
		document.getElementById("log").appendChild(div);
	}
};
