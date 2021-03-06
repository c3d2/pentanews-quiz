var Connect = require('connect');
var http = require('http');
var wss = require('websocket').server;
var ltx = require('ltx');
var fs = require('fs');
var mime = require('mime');

var WS_KEY = 'nedap-RuJejdymmesAktiOdyitEdivRiectij';
var MIME_HTML = 'text/html; charset=UTF-8';
var ROOT_HEADERS = { 'Content-type': MIME_HTML,
		     'Pragma': 'no-cache',
		     'Expires': '-1',
		     'Cache-Control': 'no-cache, must-revalidate, max-age=1'
		   };
var UPLOAD_DIR = "static/gifs";
var GIFS_PREFIX = "http://spaceboyz.net:2342/gifs/";
try { fs.mkdirSync(UPLOAD_DIR); } catch (e) {}

var backend, question, answers, scores, mode;


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

function errorResponse(res) {
    res.writeHead(503, { 'Content-type': MIME_HTML });
    res.write("<img src=\"/503.png\">");
    res.end();
}

function nedap(app) {
    app.get('/', function(req, res) {
	if (mode === 'nedap' &&
	    question && answers) {

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

	    res.writeHead(200, ROOT_HEADERS);
	    res.write(html(form.toString()));
	    res.end();
	} else if (mode === 'gif') {
	    var form = new ltx.Element('form', { action: "/i",
						 method: "POST",
						 enctype: "multipart/form-data"
					       });
	    form.c('p').t(question);
	    form.c('input', { type: 'file', name: 'gif' });
	    form.c('input', { type: 'submit', value: "Submit" });
	    form.c('input', { type: 'hidden',
			      name: 'token',
			      value: Token.generate() });
	    form.c('p').t("Max file size: 2 MB");
	    res.writeHead(200, ROOT_HEADERS);
	    res.write(html(form.toString()));
	    res.end();
	} else {
	    res.writeHead(404, ROOT_HEADERS);
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
		errorResponse(res);
	    }
	} else {
	    errorResponse(res);
	}
    });

    app.get('/thanks', function(req, res) {
	res.writeHead(200, { 'Content-type': MIME_HTML });
	res.write(html("<p>Thanks, your vote may have been counted. <a href='/'>Back</a></p>"));
	res.end();
    });

    app.post('/i', function(req, res) {
console.log('upload req', req);
	if (req.files.gif) {
	    if (!Token.validate(req.body.token)) {
		errorResponse(res);
		return;
	    }
	    /* pass to frontend */
	    var gif = req.files.gif;
	    var path = gif.path + "." + mime.getExtension(gif.type);
	    console.log("fs.rename", gif.path, path)
	    fs.rename(gif.path, path, function(err) {
		if (err)
		    return;
		path = path.split('/').pop();
		console.log("file", gif.name, path, gif.type);
		if (backend)
		    backend.sendUTF(JSON.stringify({ gif: { path: GIFS_PREFIX + path,
							    name: gif.name,
							    size: gif.size
							  } }));
	    });

	    res.writeHead(303, { 'Content-type': MIME_HTML,
				 'Location': '/thanks' });
	    res.end();
	} else {
	    console.error(err.stack || err);
	    errorResponse(res);
	}
    });
}


var app = Connect();
app.use(require('morgan')('combined', {}));
app.use(require('body-parser').urlencoded({ uploadDir: UPLOAD_DIR, extended: false }));
app.use(require('connect-multiparty')({ uploadDir: UPLOAD_DIR }));
app.use(require('./router')(nedap));
app.use(require('serve-static')(__dirname + '/static'));
app.use(require('errorhandler')({ dumpExceptions: true, showStack: true }));

var server = http.createServer(app);

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
		    if (msg.joker.type === 'nedap') {
			mode = 'nedap';
			answers = msg.joker.answers;
			scores = [];
			for(var i = 0; i < answers.length; i++)
			    scores[i] = 0;
		    } else if (msg.joker.type === 'gif') {
			mode = 'gif';
		    }
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
