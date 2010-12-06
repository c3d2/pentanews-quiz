var Connect = require('connect');
var wss = require('websocket-server');
var wsc = require('websocket-client');

var frontend;

/* TODO: url */
var nedap = new wsc.WebSocket('ws://localhost:8080/', 'quiz-nedap');
nedap.onopen = function() {
    console.log('NEDAP opened');
    nedap.send('nedap-kneemFothbedchoadHietEnobKavLub1');
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
	console.log({ fromNedap: msg });
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

wss.createServer({ server: server }).on('connection', function(conn) {
    frontend = conn;

    conn.on('message', function(data) {
	console.log({data:data});
	try {
	    var msg = JSON.parse(data);
	    if (msg.nedap) {
		console.log({ toNedap: msg.nedap });
		nedap.send(JSON.stringify(msg.nedap));
	    }
	    
	} catch (e) {
	    console.error(e.stack);
	}
    });

    var reset = function() {
	frontend = null;
    };
    conn.on('close', reset);
    conn.on('error', reset);
});

server.listen(8081);
