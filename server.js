var Connect = require('connect');
var wss = require('websocket').server;
var wsc = require('websocket').client;
var irc = require('irc-js');

var frontend;


/*
 * Nedap backend connection
 */

/* TODO: url */
var nedap;
function connectNedap() {
    nedap = new wsc();
    nedap.on('connect', function() {
	console.log('NEDAP opened');
	nedap.sendUTF('nedap-kneemFothbedchoadHietEnobKavLub1');
    });
    nedap.on('close', function() {
	console.log('NEDAP closed');
	connectNedap();
    });
    nedap.on('error', function(e) {
	console.log('NEDAP error: ' + e.message);
	connectNedap();
    });
    nedap.on('message', function(data) {
	try {
	    var msg = JSON.parse(data);
	    console.log({ fromNedap: msg });
	    sendToFrontend({ nedap: msg });
	} catch (e) {
	    console.error(e.stack);
	}
    });
    nedap.connect('ws://localhost/', 'quiz-nedap');
}
//connectNedap();


/*
 * IRC client
 */

var IRC_SERVER = 'irc.hackint.eu';
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
if (false){
var buzz = new (require('./buzz_iface/node_lib/buzz').Buzz)('/dev/ttyUSB0');
buzz.on('button', function(key) {
    console.log({button:key});
    sendToFrontend({ buzzer: key });
});
}

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

var DIT_LENGTH = 240;
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

new wss({ httpServer: server }).on('request', function(req) {
    var conn = req.accept(null, req.origin);
    frontend = conn;

    conn.on('message', function(wsmsg) {
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

    frontend.sendUTF(JSON.stringify(obj));
}

server.listen(8081);

morse("c3d2");
