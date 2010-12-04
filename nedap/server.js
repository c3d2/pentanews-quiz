var Connect = require('connect');
var spacesocket = require('spacesocket');
var ltx = require('ltx');

var WS_PROTOCOL = 'nedap-kneemFothbedchoadHietEnobKavLub1';

var backend, question, answers, scores;


function html(body) {
    return "<!DOCTYPE html>\n" +
	"<html><head><title>Pentanews Game Show</title></head>\n" +
	/* TODO: CSS */
	"<body><h1>Pentanews Game Show</h1>\n" +
	body +
	"</body></html>";
}

function nedap(app) {
    app.get('/', function(req, res) {
	if (question && answers) {
	    var form = new ltx.Element('form',
				       { action: '/',
					 method: 'POST',
					 enctype: 'application/x-www-form-urlencoded' });
	    form.c('p').text(question);
	    var ul = form.c('ul');
	    for(var i = 0; i < answers.length; i++) {
		ul.c('li').
		    c('input', { type: 'radio',
				 id: 'a'+i,
				 name: 'a',
				 value: ''+i }).
		    c('label', { for: 'a'+i }).
		    t(answers[i]);
	    }
	    form.c('input', { type: 'submit',
			      value: 'Submit' });

	    res.writeHead(200, { 'Content-type': 'text/html' });
	    res.write(html(form.toString()));
	    res.end();
	} else {
	    res.writeHead(404, { 'Content-type': 'text/html' });
	    res.write(html('o_0'));
	    res.end();
	}
    });

    app.post('/', function(req, res) {
	var a = req.body.a;
	if (a && /^\d+$/.test(a)) {
	    var i = parseInt(a, 10);
	    if (scores && i < scores.length) {
		scores[i]++;
		backend.send(JSON.stringify({ scores: scores }));

		res.writeHead(200, { 'Content-type': 'text/html' });
		res.write(html("<p>Thanks</p>"));
		res.end();
	    } else {
		res.writeHead(400, { 'Content-type': 'text/html' });
		res.end();
	    }
	} else {
	    res.writeHead(400, { 'Content-type': 'text/html' });
	    res.end();
	}
    });
}


var server = Connect.createServer(
    Connect.logger(),
    Connect.bodyDecoder(),
    Connect.router(nedap),
    Connect.staticProvider(__dirname + '/static'),
    Connect.errorHandler({ dumpExceptions: true, showStack: true })
);
server.listen(8080); /* TODO: port 80 */

spacesocket.attach(server, function(conn) {
console.log(conn);
    if (conn.protocol === WS_PROTOCOL) {
	backend = conn;

	conn.on('data', function(data) {
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
	});

	var reset = function() {
	    backend = null;
	};
	conn.on('close', reset);
	conn.on('error', reset);
    } else {
	console.error({ 'Wrong Protocol': conn.protocol });
	conn.end();
    }
});
