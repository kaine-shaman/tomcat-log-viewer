var http = require('http');
var fs = require('fs');
var childProcess = require('child_process');

var port = process.argv[2] || 8888;
var page = fs.readFileSync('tomcat-log.html').toString();
var logFileName = '/var/log/tomcat7/catalina.out';
var bufferingQueue = [];
var tailingProcess;

var server = http.createServer(function (req, res) {
	switch (req.url) {
		case '/':
			if (tailingProcess) {
				tailingProcess.kill();
				bufferingQueue = [];
			}
			tailingProcess = childProcess.exec('tail -f -c 102400 ' + logFileName);
			tailingProcess.stdout.on('data', function (data) {
				bufferingQueue.push(data);
			});

			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(page);
			break;
		case '/feed':
			var data = bufferingQueue.shift() || "";
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end(data);
			break;
	}
});

server.listen(port, "0.0.0.0");
console.log('Server running on port ' + port);
