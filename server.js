var Connect = require('connect');
var wss = require('websocket-server');
var wsc = require('websocket-client');
var irc = require('irc-js');

var frontend;


/*
 * Nedap backend connection
 */

/* TODO: url */
var nedap;
function connectNedap() {
    nedap = new wsc.WebSocket('ws://localhost:8080/', 'quiz-nedap');
    nedap.onopen = function() {
	console.log('NEDAP opened');
	nedap.send('nedap-kneemFothbedchoadHietEnobKavLub1');
    };
    nedap.onclose = function() {
	console.log('NEDAP closed');
	connectNedap();
    };
    nedap.onerror = function(e) {
	console.log('NEDAP error: ' + e.message);
	connectNedap();
    };
    nedap.onmessage = function(data) {
	try {
	    var msg = JSON.parse(data);
	    console.log({ fromNedap: msg });
	    sendToFrontend({ nedap: msg });
	} catch (e) {
	    console.error(e.stack);
	}
    };
}
connectNedap();


/*
 * IRC client
 */

var IRC_SERVER = 'irc.freenode.net';
var IRC_CHAN = '#pentanews';
var chat = new irc({ server: IRC_SERVER,
		     encoding: 'utf-8',
		     nick: '[Ceiling]Cat'
		   });
function connectChat() {
    chat.connect();
}
connectChat();
chat.addListener('376', function() {
    chat.join(IRC_CHAN);
});
chat.addListener('366', function(msg) {
    if (msg.params[1] === IRC_CHAN) {
	console.log('Successfully joined ' + IRC_CHAN);
	pushIrcInfo();
    }
});
chat.addListener('privmsg', function(msg) {
    console.log({PRIVMSG:msg});
    var nick = msg.person.nick;
    var channel = msg.params[0];
    var text = msg.params[1];
    if (nick && channel === IRC_CHAN && text && frontend) {
	sendToFrontend({ irc: { nick: nick,
				text: text
			      } });
    }
});
chat.addListener('disconnected', function() {
    console.error('Chat disconnected!');
    process.nextTick(connectChat);
});

function pushIrcInfo() {
    sendToFrontend({ irc: { server: IRC_SERVER,
			    channel: IRC_CHAN } });
}


/*
 * Web server
 */

var server = Connect.createServer(
    Connect.logger(),
    Connect.bodyDecoder(),
    Connect.staticProvider(__dirname),
    Connect.errorHandler({ dumpExceptions: true, showStack: true })
);

/*
 * WebSocket server
 */

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
	    else if (msg.irc === "activate") {
		pushIrcInfo();
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

function sendToFrontend(obj) {
    if (!frontend)
	return;

    frontend.send(JSON.stringify(obj));
}

server.listen(8081);
