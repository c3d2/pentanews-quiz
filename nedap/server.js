var Connect = require('connect');
var wss = require('websocket-server');
var ltx = require('ltx');

var WS_KEY = 'nedap-kneemFothbedchoadHietEnobKavLub1';

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
	    backend.send(JSON.stringify({ scores: scores }));
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

	    res.writeHead(200, { 'Content-type': 'text/html' });
	    res.write(html(form.toString()));
	    res.end();
	} else {
	    res.writeHead(404, { 'Content-type': 'text/html' });
	    res.write(html('<p>No question left on server.</p>'));
	    res.end();
	}
    });

    app.post('/', function(req, res) {
	var a = req.body.a;
	if (a && /^\d+$/.test(a)) {
	    var i = parseInt(a, 10);
	    if (scores && i < scores.length && Token.validate(req.body.token)) {
		scores[i]++;
		updateBackend();

		res.writeHead(303, { 'Content-type': 'text/html',
				     'Location': '/thanks' });
		res.end();
	    } else {
		res.writeHead(400, { 'Content-type': 'text/html',
				     'Location': '/' });
		res.end();
	    }
	} else {
	    res.writeHead(400, { 'Content-type': 'text/html' });
	    res.end();
	}
    });

    app.get('/thanks', function(req, res) {
	res.writeHead(200, { 'Content-type': 'text/html' });
	res.write(html("<p>Thanks, your vote may have been counted.</p>"));
	res.end();
    });
}


var server = Connect.createServer(
    Connect.logger(),
    Connect.bodyDecoder(),
    Connect.router(nedap),
    Connect.staticProvider(__dirname + '/static'),
    Connect.errorHandler({ dumpExceptions: true, showStack: true })
);

wss.createServer({ server: server }).on('connection', function(conn) {
    var authed = false;

    conn.on('message', function(data) {
	if (!authed) {
	    if (data.toString() === WS_KEY) {
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
		var msg = JSON.parse(data);
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

server.listen(8080); /* TODO: port 80 */
