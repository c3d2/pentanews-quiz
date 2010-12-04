var Connect = require('connect');
var spacesocket = require('spacesocket');
var WS = require('websocket-client');

var frontend;

/* TODO: url */
var nedap = new WS.WebSocket('http://localhost:8080/', 'nedap-kneemFothbedchoadHietEnobKavLub1');
nedap.onopen = function() {
    console.log('NEDAP opened');
};
nedap.onclose = function() {
    console.log('NEDAP closed');
};
nedap.onerror = function(e) {
    console.log('NEDAP error: ' + e.message);
};
nedap.onmessage = function(data) {
    try {
	var msg = JSON.parse(data);
	frontend.send(JSON.stringify({ nedap: msg }));
    } catch (e) {
	console.error(e.stack);
    }
};

var server = Connect.createServer(
    Connect.logger(),
    Connect.bodyDecoder(),
    Connect.staticProvider(__dirname),
    Connect.errorHandler({ dumpExceptions: true, showStack: true })
);
server.listen(8081);

spacesocket.attach(server, function(conn) {
    if (conn.protocol === 'quiz') {
	frontend = conn;

	conn.on('data', function(data) {
	    var msg = JSON.parse(data);
	    if (msg.nedap)
		nedap.send(JSON.stringify(msg.nedap));
	});

	var reset = function() {
	    frontend = null;
	};
	conn.on('close', reset);
	conn.on('error', reset);
    } else {
	conn.end();
    }
});
