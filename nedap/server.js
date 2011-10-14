var Connect = require('connect');
var wss = require('websocket').server;
var ltx = require('ltx');

var WS_KEY = 'nedap-kneemFothbedchoadHietEnobKavLub1';
var MIME_HTML = 'text/html; charset=UTF-8';

var backend, question, answers, scores;


function html(body) {
    return "<!DOCTYPE html>\n" +
	"<html><head><title>Pentanews Game Show</title></head>\n" +
	"<link href='style.css' rel='stylesheet' type='text/css'>" +
	"<body><h1>Pentanews Game Show</h1>\n" +
	body +
	"</body></html>";
}

var voteTokens = {};
var TOKEN_TIMEOUT = 30 * 1000;
var Token = {
    generate: function() {
	var token = Math.round(Math.random() * 10000000).toString();

	voteTokens[token] = setTimeout(function() {
	    delete voteTokens[token];
	}, TOKEN_TIMEOUT);

	return token;
    },
    validate: function(token) {
	if (voteTokens.hasOwnProperty(token)) {
	    clearTimeout(voteTokens[token]);
	    delete voteTokens[token];
	    return true;
	} else {
	    return false;
	}
    }
};

var updateBackendTimeout;
function updateBackend() {
    if (!updateBackendTimeout) {
	updateBackendTimeout = setTimeout(function() {
	    if (backend)
		backend.sendUTF(JSON.stringify({ scores: scores }));
	    updateBackendTimeout = undefined;
	}, 50);
    }
}

function nedap(app) {
    app.get('/', function(req, res) {
	if (question && answers) {
console.log({question:question,answers:answers})
	    var form = new ltx.Element('form',
				       { action: '/',
					 method: 'POST',
					 enctype: 'application/x-www-form-urlencoded' });
	    form.c('p').t(question);
	    var ul = form.c('ul');
	    for(var i = 0; i < answers.length; i++) {
		ul.c('li').
		    c('input', { type: 'radio',
				 id: 'a'+i,
				 name: 'a',
				 value: ''+i }).
		    c('label', { for: 'a'+i }).
		    t(answers[i].text);
	    }
	    form.c('input', { type: 'hidden',
			      name: 'token',
			      value: Token.generate() });
	    form.c('input', { type: 'submit',
			      value: 'Submit' });

	    res.writeHead(200, { 'Content-type': MIME_HTML });
	    res.write(html(form.toString()));
	    res.end();
	} else {
	    res.writeHead(404, { 'Content-type': MIME_HTML });
	    res.write(html('<p>No question left on server.</p>'));
	    res.end();
	}
    });

    app.post('/', function(req, res) {
	var a;
	if (req.body && (a = req.body.a) && /^\d+$/.test(a)) {
	    var i = parseInt(a, 10);
	    if (scores && i < scores.length && Token.validate(req.body.token)) {
		scores[i]++;
		updateBackend();

		res.writeHead(303, { 'Content-type': MIME_HTML,
				     'Location': '/thanks' });
		res.end();
	    } else {
		res.writeHead(400, { 'Content-type': MIME_HTML,
				     'Location': '/' });
		res.write(html("<p>Face validation error.</p>"));
		res.end();
	    }
	} else {
	    res.writeHead(400, { 'Content-type': MIME_HTML,
				 'Location': '/' });
	    res.write(html("<p>Huh?</p>"));
	    res.end();
	}
    });

    app.get('/thanks', function(req, res) {
	res.writeHead(200, { 'Content-type': MIME_HTML });
	res.write(html("<p>Thanks, your vote may have been counted.</p>"));
	res.end();
    });
}


var server = Connect.createServer(
    Connect.logger(),
    Connect.bodyParser(),
    Connect.router(nedap),
    Connect.static(__dirname + '/static'),
    Connect.errorHandler({ dumpExceptions: true, showStack: true })
);

new wss({ httpServer: server }).on('request', function(req) {
    var conn = req.accept(req.requestedProtocols[0], req.origin);
    var authed = false;

    conn.on('message', function(wsmsg) {
	if (!authed) {
	    if (wsmsg.utf8Data.toString() === WS_KEY) {
		console.warn('Authorized WebSocket');
		backend = conn;
		authed = true;

		var reset = function() {
		    backend = null;
		};
		conn.on('close', reset);
		conn.on('error', reset);
	    } else {
		console.warn('Unauthorized backend WebSocket');
		conn.close();
	    }
	} else {
	    try {
		var msg = JSON.parse(wsmsg.utf8Data);
		console.log({msg: msg});
		if (msg.joker) {
		    question = msg.joker.question;
		    answers = msg.joker.answers;
		    scores = [];
		    for(var i = 0; i < answers.length; i++)
			scores[i] = 0;
		}
		if (msg.clear) {
		    question = null;
		    answers = null;
		    scores = null;
		}
	    } catch (e) {
		console.error(e.stack);
	    }
	}
    });
});

server.listen(2342, '::');
