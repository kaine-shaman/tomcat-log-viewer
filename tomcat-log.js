var http = require('http');
var fs = require('fs');
var childProcess = require('child_process');
var url = require('url');

var port = process.argv[2] || 8888;
var page = fs.readFileSync('tomcat-log.html').toString();
var logFileName = '/var/log/tomcat7/catalina.out';
var connections = [];

var LAST_BYTES = 102400;
var TERMINATE_DELAY = 5000;
var CHECK_DELAY = 500;

function createUUID() {
	var s = [];
	var hexDigits = "0123456789abcdef";
	for (var i = 0; i < 36; i++) {
		s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
	}
	s[14] = "4";
	s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
	s[8] = s[13] = s[18] = s[23] = "-";

	var uuid = s.join("");
	return uuid;
};

function Connection(uuid) {
	var that = this;
	var terminator;

	that.buffer = "";

	that.process = childProcess.exec('tail -f -c ' + LAST_BYTES + ' ' + logFileName);
	that.process.stdout.on('data', function (data) {
		that.buffer += data;
	});

	that.terminate = function () {
		that.process.kill();
		delete connections[uuid];
	};

	that.scheduleTermination = function () {
		terminator = setTimeout(that.terminate, TERMINATE_DELAY);
	};

	that.cancelTermination = function () {
		clearTimeout(terminator);
	};
};

http.ServerResponse.prototype.writeText = function(text, status) {
	this.writeHead(status || 200, { 'Content-Type': 'text/plain' });
	this.end(text);
};

http.ServerResponse.prototype.writeHtml = function(html, status) {
	this.writeHead(status || 200, { 'Content-Type': 'text/html' });
	this.end(html);
};

var server = http.createServer(function (request, response) {
	var requestUrl = url.parse(request.url, true);
	switch (requestUrl.pathname) {
		case '/':
			response.writeHtml(page);
			break;
		case '/getid':
			var uuid = createUUID();
			connections[uuid] = new Connection(uuid);
			connections[uuid].scheduleTermination();

			response.writeText(uuid);
			break;
		case '/feed':
			var uuid = requestUrl.query.id;
			var connection = connections[uuid];
			if (!connection) {
				response.writeText("uuid is not valid", 400);
				break;
			}

			connection.cancelTermination();

			function checkBuffer() {
				if (connection.buffer == "") {
					setTimeout(checkBuffer, CHECK_DELAY);
					return;
				}

				response.writeText(connection.buffer);

				connection.buffer = "";
				connection.scheduleTermination();
			};

			checkBuffer();
			break;
		default:
			response.writeText("bad request", 400);
			break;
	}
});

server.listen(port, "0.0.0.0");
console.log('Server running on port ' + port);
