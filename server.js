var Connect = require('connect');
var wss = require('websocket').server;
var wsc = require('websocket').client;
var irc = require('irc-js');
var child_process = require('child_process');

var frontend, sendToCensor = function() { console.log("no censor"); };


/*
 * Nedap backend connection
 */

/* TODO: url */
var nedap;
function connectNedap() {
    var nedapClient = new wsc();
    nedapClient.on('connect', function(conn) {
	console.log('NEDAP opened');
	nedap = conn;
	nedap.sendUTF('nedap-RuJejdymmesAktiOdyitEdivRiectij');
	nedap.on('close', function() {
	    console.log('NEDAP closed');
	    connectNedap();
	});
	nedap.on('error', function(e) {
	    console.log('NEDAP error: ' + e.message);
	    connectNedap();
	});
	nedap.on('message', function(wsmsg) {
	    try {
		var msg = JSON.parse(wsmsg.utf8Data);
		console.log({ fromNedap: msg });
		if (msg.gif) {
		    sendToCensor(msg);
		} else
		    sendToFrontend({ nedap: msg });
	    } catch (e) {
		console.error(e.stack);
	    }
	});
    });
    nedapClient.on('connectFailed', function(e) {
	console.error(e.stack || e);
	setTimeout(connectNedap, 1000);
    });
    nedapClient.connect('ws://spaceboyz.net:2342/', 'quiz-nedap');
}
connectNedap();


/*
 * IRC client
 */

var IRC_SERVER = 'irc.hackint.eu';
var IRC_CHAN = '#pentanews';
function connectChat() {
    var chat = new irc({ server: IRC_SERVER,
			 encoding: 'utf-8',
			 nick: '[Ceiling]Katze'
		       });
    chat.connect();
    chat.addListener('376', function() {
	if (!chat)
	    return;
	chat.join(IRC_CHAN);
    });
    chat.addListener('366', function(msg) {
	if (!chat)
	    return;
	if (msg.params[1] === IRC_CHAN) {
	    console.log('Successfully joined ' + IRC_CHAN);
	    pushIrcInfo();
	}
    });
    chat.addListener('privmsg', function(msg) {
	if (!chat)
	    return;
	console.log({PRIVMSG:msg});
	var nick = msg.person.nick;
	var channel = msg.params[0];
	var text = msg.params[1];

	var sText = "", i;
	for(i = 0; i < text.length; i++) {
	    if (text.charCodeAt(i) >= 32)
		sText += text[i];
	}

	if (nick && channel === IRC_CHAN && sText && frontend) {
	    sendToFrontend({ irc: { nick: nick,
				    text: sText
				  } });
	}
    });
    chat.addListener('disconnected', function() {
	if (!chat)
	    return;
	chat = undefined;
        console.error('Chat disconnected!');
        window.setTimeout(connectChat, 1000);
    });
    chat.on('error', connectChat);
}
connectChat();

function pushIrcInfo() {
    sendToFrontend({ irc: { server: IRC_SERVER,
			    channel: IRC_CHAN } });
}


/*
 * Buttons
 */
var buzz = new (require('./buzz_iface/node_lib/buzz').Buzz)('/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_A400gqnA-if00-port0');
buzz.on('button', function(key) {
    console.log({button:key});
    sendToFrontend({ buzzer: key });
});

function setAllLEDs(brightness) {
    for(var player = 0; player < 3; player++)
	buzz.set_led(player, brightness);
}

var MORSE_ALPHABET = {
    "A":	". -",
    "B":	"- . . .",
    "C":	"- . - .",
    "D":	"- . .",
    "E":	".",
    "F":	". . - .",
    "G":	"- - .",
    "H":	". . . .",
    "I":	". .",
    "J":	". - - -",
    "K":	"- . -",
    "L":	". - . .",
    "M":	"- -",
    "N":	"- .",
    "O":	"- - -",
    "P":	". - - .",
    "Q":	"- - . -",
    "R":	". - .",
    "S":	". . .",
    "T":	"-",
    "U":	". . -",
    "V":	". . . -",
    "W":	". - -",
    "X":	"- . . -",
    "Y":	"- . - -",
    "Z":	"- - . .",
    "0":	"- - - - -",
    "1":	". - - - -",
    "2":	". . - - -",
    "3":	". . . - -",
    "4":	". . . . -",
    "5":	". . . . .",
    "6":	"- . . . .",
    "7":	"- - . . .",
    "8":	"- - - . .",
    "9":	"- - - - .",
    "À":	". - - . -",
    "Å":	". - - . -",
    "Ä":	". - . -",
    "È":	". - . . -",
    "É":	". . - . .",
    "Ö":	"- - - .",
    "Ü":	". . - -",
    "ß":	". . . - - . .",
    "CH":	"- - - -",
    "Ñ":	"- - . - -",
    ".":	". - . - . -",
    ",":	"- - . . - -",
    ":":	"- - - . . .",
    ";":	"- . - . - .",
    "?":	". . - - . .",
    "-":	"- . . . . -",
    "_":	". . - - . -",
    "(":	"- . - - .",
    ")":	"- . - - . -",
    "'":	". - - - - .",
    "=":	"- . . . -",
    "+":	". - . - .",
    "/":	"- . . - .",
    "@":	". - - . - ."
};

var DIT_LENGTH = 100;
var DAH_LENGTH = 3 * DIT_LENGTH;
var PAUSE_LENGTH = DIT_LENGTH;

var CHARACTER_PAUSE_LENGTH = 3;
var WORD_PAUSE_LENGTH = 7;

function morse(text) {
    /* Assemble sequence */
    var sequence = '';
    for(var i = 0; i < text.length; i++) {
	var symbols;
	if (text[i] === " ")
	    for(var j = 0; j < WORD_PAUSE_LENGTH; j++)
		sequence += " ";
	else if ((symbols = MORSE_ALPHABET[text[i].toLocaleUpperCase()])) {
	    sequence += symbols;
	    for(j = 0; j < CHARACTER_PAUSE_LENGTH; j++)
		sequence += " ";
	}
    }
    sequence += " ";  /* clear led at end */

    console.log("morse", text, sequence);

    /* Play */
    var playSequence = function() {
	console.log("playSequence", sequence[0])
	var delay;
	switch(sequence[0]) {
	case ".":
	    setAllLEDs(1);
	    delay = DIT_LENGTH;
	    break;
	case "-":
	    setAllLEDs(1);
	    delay = DAH_LENGTH;
	    break;
	case " ":
	    setAllLEDs(0);
	    delay = PAUSE_LENGTH;
	    break;
	}
	sequence = sequence.substr(1);
	if (sequence && delay)
	    setTimeout(playSequence, delay);
    };
    playSequence();
}

/*
 * Web server
 */
var server = Connect.createServer(
    Connect.logger(),
    Connect.bodyParser(),
    Connect.static(__dirname, { maxAge: 1000 }),
    Connect.errorHandler({ dumpExceptions: true, showStack: true })
);

/*
 * WebSocket server
 */

var gamestate = {};

new wss({ httpServer: server }).on('request', function(req) {
    var conn = req.accept(null, req.origin);

    // console.log("ws conn", req, conn);
    var proto = req.httpRequest.headers['sec-websocket-protocol'];
    if (proto && proto.indexOf('censor') >= 0) {
	/* Censor frontend */
	sendToCensor = function(obj) {
	    conn.sendUTF(JSON.stringify(obj));
	};
	conn.on('message', function(wsmsg) {
	    console.log(wsmsg);
	    try {
		var msg = JSON.parse(wsmsg.utf8Data);
		if (msg.gif)
		    sendToFrontend(msg);
		if (msg.toBackend)
		    sendToFrontend({ fromBackend: msg.toBackend });
	    } catch (e) {
		console.error(e.stack);
	    }
	});

	var reset = function() {
	    sendToCensor = function() { };
	};
	conn.on('close', reset);
	conn.on('error', reset);
    } else {
	/* Game frontend */
	frontend = conn;
	conn.on('message', function(wsmsg) {
	    console.log(wsmsg);
	    try {
		var msg = JSON.parse(wsmsg.utf8Data);
		if (msg.nedap) {
		    console.log({ toNedap: msg.nedap });
		    if (nedap)
			nedap.sendUTF(JSON.stringify(msg.nedap));
		} else if (msg.irc === "activate") {
		    pushIrcInfo();
		} else if (msg.buzzerLED) {
		    buzz.set_led(msg.buzzerLED[0], msg.buzzerLED[1]);
		} else if (msg.morse) {
		    morse(msg.morse);
		} else if (msg.gamestate) {
		    gamestate = msg.gamestate;
		} else if (msg.requestGamestate) {
		    conn.sendUTF(JSON.stringify({ gamestate: gamestate }));
		} else if (msg.tweet) {
		    tweet(msg.tweet);
		} else if (msg.nsa === "activate") {
		    fundNSA();
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
    }
});

function sendToFrontend(obj) {
    if (!frontend)
	return;

    frontend.sendUTF(JSON.stringify(obj));
}

server.listen(8081, "::1");

morse("c3d2");

var twit = new (require('twitter'))({
    consumer_key: 'sNWvbrAz11vVMwppORKA',
    consumer_secret: 'MzAhGlzz3qWUIxse8vcHc3zqkPOBuWKJgjazGkeOc',
    access_token_key: '108923470-KVfqQJc8oIhAYZj2RhL7ggrR5Y9eMGjTQD79Db12',
    access_token_secret: 'uQ9ljbh5L3NGEuHhKSrrnQv3KmL59d0nS2pJBjiqgL8'
});
function tweet(text) {
    // FIXME: remove next line for production!
    return;

    twit.updateStatus(text, function(res) {
	if (res.statusCode && res.statusCode >= 400) {
	    /* Failure */
	    var m = text.match(/^(.+) /);
	    if (m)
		tweet(m[1]);
	}
    });
}

var nsaProc;
function fundNSA() {
    if (nsaProc)
	nsaProc.kill('SIGINT');

    var cmds = [
	"tcpdump -ni nsa -As 0 tcp dst port 80",
	"tcpdump -ni nsa -s 0 udp port 53",
	"tcpdump -ni nsa -As 0 tcp port 6667"
    ];
    var cmd = cmds[Math.floor(cmds.length * Math.random())];
    sendToFrontend({ nsa: { command: cmd } });

    nsaProc = child_process.spawn("sudo", ["sh", "-c", "exec " + cmd]);
    nsaProc.on('error', function(err) {
	sendToFrontend({ nsa: { command: err.message || "Error" } });
	nsaProc = null;
    });
    nsaProc.on('close', function(code) {
	sendToFrontend({ nsa: { command: "Exited with " + code } });
	nsaProc = null;
    });
    nsaProc.stderr.setEncoding('ascii');
    nsaProc.stderr.on('data', function(b) {
	console.error("nsa", b);
    });
    var buf = "";
    nsaProc.stdout.setEncoding('ascii');
    nsaProc.stdout.on('data', function(b) {
	console.log("nsa stdout", b);
	buf += b;
	var i;
	while((i = buf.indexOf("\n")) >= 0) {
	    var line = buf.slice(0, i);
	    buf = buf.slice(i + 1);
	    sendToFrontend({ nsa: { line: line } });
	}
    });
}
