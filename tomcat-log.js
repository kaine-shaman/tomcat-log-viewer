var fs = require('fs');
var child_process = require('child_process');

var port = process.argv[2] || 8888;
var logFileName = process.argv[3] || '/var/log/tomcat7/catalina.out';
var startLogSize = 102400;

var indexPage = fs.readFileSync('tomcat-log.html').toString();

var app = require('http')
	.createServer(function (req, res) {
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end(indexPage);
	})
	.listen(port)
;

var io = require('socket.io').listen(app).set('log level', 1);

runTail();

io.sockets.on('connection', function (socket) {
	console.log('new client');

	read(logFileName, startLogSize, function (data) {
		socket.send(data);
	});

	socket.on('disconnect', console.log.bind(console));
});


function runTail() {
	child_process
		.exec('tail -f -c 0 ' + logFileName)
		.on('exit', function (code, signal) {
			if (code !== null) {
				console.log('tail failed, restaring.');

				runTail();
			}
		})
		.stdout.on('data', function (data) {
			console.log('tail reported new data (length: ' + data.length + ')');

			io.sockets.emit('message', data);
		});
}

function read(path, size, callback) {
	fs.open(path, 'r', function (err, fd) {
		fs.fstat(fd, function (err, stat) {
			var length = Math.min(stat.size, size),
				position = Math.max(stat.size - size, 0);

			if (!length) return;
			
			fs.read(fd, new Buffer(length), 0, length, position, function (err, bytesRead, buffer) {
				callback(buffer.toString());
				fs.close(fd);
			});
		});
	});
}
