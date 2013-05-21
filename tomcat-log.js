var http = require('http');
var fs = require('fs');
var childProcess = require('child_process');
var url = require('url');

var port = process.argv[2] || 8888;
var page = fs.readFileSync('tomcat-log.html').toString();
var logFileName = '/var/log/tomcat7/catalina.out';
var bufferingQueues = [];
var tailingProcesses = [];
var terminators = [];

var TERMINATE_TIMEOUT = 5000;

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
	that.uuid = uuid;

	bufferingQueues[uuid] = [];

	var tailingProcess = childProcess.exec('tail -f -c 102400 ' + logFileName);
	tailingProcess.stdout.on('data', function (data) {
		bufferingQueues[that.uuid].push(data);
	});
	tailingProcesses[uuid] = tailingProcess;

	scheduleTermination(uuid);
};

function terminate(uuid) {
	tailingProcesses[uuid].kill();

	delete tailingProcesses[uuid];
	delete bufferingQueues[uuid];
	delete terminators[uuid];
};

function scheduleTermination(uuid) {
	terminators[uuid] = setTimeout(function () { terminate(uuid) }, TERMINATE_TIMEOUT);
};

function delayTermination(uuid) {
	clearTimeout(terminators[uuid]);
	scheduleTermination(uuid);
};

var server = http.createServer(function (req, res) {
	var request = url.parse(req.url, true);
	switch (request.pathname) {
		case '/':
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(page);
			break;
		case '/getid':
			var uuid = createUUID();
			new Connection(uuid);

			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end(uuid);
			break;
		case '/feed':
			var uuid = request.query.id;
			var data = bufferingQueues[uuid].shift() || "";

			delayTermination(uuid);

			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end(data);
			break;
	}
});

server.listen(port, "0.0.0.0");
console.log('Server running on port ' + port);
