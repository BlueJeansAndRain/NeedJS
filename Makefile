all: needy.js

needy.js: lib/main.js
	meta-inline lib/main.js > needy.js

clean:
	rm needy.js
