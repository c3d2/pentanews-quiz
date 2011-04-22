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
    nedap = new wsc.WebSocket('ws://nedap.c3d2.de/', 'quiz-nedap');
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

    var sText = "", i;
    for(i = 0; i < text.length; i++) {
	if (text.charCodeAt(i) >= 32)
	    sText += text.charAt(i);
    }

    if (nick && channel === IRC_CHAN && sText && frontend) {
	sendToFrontend({ irc: { nick: nick,
				text: sText
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
 * Buttons
 */
var buzz = new (require('./buzz_iface/node_lib/buzz').Buzz)('/dev/ttyUSB0');
buzz.on('button', function(key) {
    console.log({button:key});
    sendToFrontend({ buzzer: key });
});

/*
 * Web server
 */
function noCache(req, res, next) {
    var writeHead = res.writeHead;
    res.writeHead = function(status, headers) {
	headers['Cache-Control'] = 'no-cache';
	writeHead.call(this, status, headers);
    };
    next();
}

var server = Connect.createServer(
    Connect.logger(),
    noCache,
    Connect.bodyDecoder(),
    Connect.staticProvider({ root: __dirname, maxAge: 1000 }),
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
	    } else if (msg.irc === "activate") {
		pushIrcInfo();
	    } else if (msg.buzzerLED) {
		buzz.set_led(msg.buzzerLED[0], msg.buzzerLED[1]);
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
