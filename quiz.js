if (!window.console) {
    var stub = function() { };
    window.console = { log: stub, error: stub, warn: stub };
}

var keyHandler;
$(document).bind('keydown', function(event) {
    console.log('cc: '+event.charCode+'/'+String.fromCharCode(event.keyCode).toLowerCase()+' kc: '+event.keyCode);
    if (keyHandler)
        keyHandler(String.fromCharCode(event.keyCode).toLowerCase(), event.keyCode);
});

$(window).bind('load', function() {
    $('#game').hide();
    $('#scoreboard').hide();

    loadQuizData(function() {
        // Quiz data has initialized
        $('#setup').show();
        $('#start').bind('click', function() {
            try {
                startQuiz();
            } catch (e) {
                console.error(e.stack);
            }
            return false;  // don't submit <form>
        });
    });
});

var questions;
var currentQuestion = 0;

function loadQuizData(done) {
    $.ajax({ url: 'data/questions.json?' + Math.round(Math.random() * 1000),
             contentType: 'json',
             success: function(data, status) {
                 if (typeof data === 'string')
                     data = JSON.parse(data);

                 console.log(status);
                 questions = data;
                 done();
             },
             error: function(req, status, e) {
                 console.error(status);
                 console.log(e.stack);
             }
           });
}

var ws, sendToBackend, onBackendMessage;
function setupWs() {
    var url = 'ws://' + document.location.host + '/';
    ws = new WebSocket(url, '*');

    ws.onerror = function(e) {
	console.error(e.message);
	setupWs();
    };
    ws.onclose = function() {
	console.error('WebSocket closed');
	window.setTimeout(setupWs, 100);
    };
    ws.onmessage = function(event) {
	try {
	    var data = event.data;
	    console.log({fromBackend: data});
	    var msg = JSON.parse(data);
	    if (onBackendMessage)
		onBackendMessage(msg);
	} catch(e) {
	    console.error(e.message);
	}
    };
    sendToBackend = function(msg) {
	console.log('toBackend: ' + JSON.stringify(msg));
	ws.send(JSON.stringify(msg));
    };
    ws.onopen = function() {
	/* TODO: rm debug */
	sendToBackend({ nedap: "ping" });
    };
}
setupWs();


function Timer() {
    $('#timer').hide();
    this.cb = null;
}
Timer.prototype.set = function(t, cb) {
    var that = this;

    this.clear();
    this.cb = cb;

    var tick = function() {
	if (t > 0) {
	    t--;
	    $('#timer').text('' + t);
	    if (t > 21 && t < 23) {
		$('#audio_timeout')[0].load();
		$('#audio_timeout')[0].play();
	    }
	} else {
	    that.elapse();
	}
    };
    this.interval = window.setInterval(tick, 1000);

    /* appear: */
    tick();
    $('#timer').fadeIn(1000);

};
Timer.prototype.elapse = function() {
    var cb = this.cb;
    this.halt();
    $('#timer').addClass('elapsed');
    if (cb)
	cb();
};
Timer.prototype.halt = function() {
    if (this.interval)
	window.clearInterval(this.interval);
};
Timer.prototype.clear = function() {
    this.halt();
    delete this.interval;
    this.cb = null;
    $('#timer').removeClass('elapsed');
    $('#timer').hide();
};
var TIMER_QUESTION = 60;
var TIMER_ANSWER = 90;
var timer = new Timer();

var playerNames = [], playerScores = [], playerJokers = [];

function startQuiz() {
    var i;
    console.log('startQuiz');

    questions.forEach(function(q) {
        $('#tiers').append('<li></li>');
        $('#tiers li').last().text(q.tier);
    });

    for(i = 0; i < 5; i++) {
        var name = $('#playername' + i).val();
        if (name) {
            playerNames[i] = name;
            playerScores[i] = 0;
            $('#scoreboard dl').append('<dt></dt><dd><span class="score">0</span><img src="fiftyfifty.png" class="fiftyfifty"><img src="nedap.png" class="nedap"><img src="irc.png" class="irc"><img src="fwd.png" class="fwd"></dd>');
            $('#scoreboard dl dt').last().text(name);
            $('#players').append('<li class="player'+i+'"><span class="name"></span><span class="score">0</span></li>');
            $('#players li.player'+i+' span.name').text(name);
        }
    }

    $('#setup').fadeOut(700, function() {
        switchToScoreboard();
    });
}

function switchToScoreboard() {
    timer.clear();

    keyHandler = function(key) {
        if (key === ' ' &&
	    currentQuestion < questions.length) {

            $('#scoreboard').fadeOut(500, function() {
                switchToGame();
            });
        }
    };

    for(var i = 0; i < currentQuestion; i++) {
	$('#tiers li').eq(i).addClass('done');
    }

    $('#scoreboard').fadeIn(300);
}

function updateScores() {
    for(var i = 0; i < playerNames.length; i++) {
        if (playerNames[i]) {
	    // FIXME: eq(i) is bad when first player is empty
	    $('#scoreboard dl dd').eq(i).find('.score').text(playerScores[i]);
            $('#players .player'+i+' .score').text(playerScores[i]);
	}
    }
}

function takeJoker(activePlayer, joker) {
    if (activePlayer === null)
	// No active player
	return;

    if (!playerJokers.hasOwnProperty(activePlayer))
	playerJokers[activePlayer] = {};

    if (playerJokers[activePlayer][joker])
	// Joker already taken
	return;

    /* Hide previous special jokers */
    $('#nedap').hide();
    $('#irc').hide();

    playerJokers[activePlayer][joker] = true;
    $('#tier').append('<img src="' + joker + '.png">');
    $('#scoreboard dd').eq(activePlayer).find('.' + joker).remove();

    if (joker === 'fiftyfifty') {
	var h1, h2, answers = questions[currentQuestion].answers;
	do {
	    h1 = Math.floor(Math.random() * 4);
	    h2 = Math.floor(Math.random() * 4);
	} while(answers[h1].right || answers[h2].right || h1 === h2);
	$('#answer' + h1).fadeTo(500, 0.1);
	$('#answer' + h2).fadeTo(500, 0.1);
    }
    if (joker === 'nedap') {
	var q = questions[currentQuestion];
	sendToBackend({ nedap: { joker: { question: q.text,
					  answers: q.answers
	} } });

	$('#nedap').show();
	var scores = [0, 0, 0, 0];
	var redraw = function() {
	    var canvas = $('#polls')[0];
	    var w = canvas.width, h = canvas.height;
	    var ctx = canvas.getContext('2d');
	    ctx.fillStyle = '#20203f';
	    ctx.fillRect(0, 0, w, h);

	    var total = 0;
	    for(var i = 0; i < scores.length; i++) {
		total += scores[i];
	    }
	    if (total < 1)
		total = 1;

	    for(var i = 0; i < scores.length; i++) {
		/* Bounds */
		var x1, y1, x2, y2;
		if (i == 0 || i == 2) {
		    x1 = w * 0.05;
		    x2 = w * 0.45;
		}
		if (i == 1 || i == 3) {
		    x1 = w * 0.55;
		    x2 = w * 0.95;
		}
		if (i == 0 || i == 1) {
		    y1 = h * 0.05;
		    y2 = h * 0.45;
		}
		if (i == 2 || i == 3) {
		    y1 = h * 0.55;
		    y2 = h * 0.95;
		}

		/* Outline */
		ctx.fillStyle = '#40405f';
		ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

		/* Fill */
		ctx.fillStyle = '#ccc';
		var barHeight = (y2 - y1) * scores[i] / total;
		ctx.fillRect(x1, y2 - barHeight, x2 - x1, barHeight);
	    }
	};
	onBackendMessage = function(msg) {
	    if (msg.nedap && msg.nedap.scores)
		scores = msg.nedap.scores;
	    console.log('scores: '+JSON.stringify(scores));
	    redraw();
	};
    }
    if (joker === 'irc') {
	sendToBackend({ irc: "activate" });
	onBackendMessage = function(msg) {
	    if (msg.irc && msg.irc.nick && msg.irc.text) {
		var ircPane = $('#irc ul');
		var line = $('<li></li>');
		line.text('<' + msg.irc.nick + '> ' + msg.irc.text);
		line.hide();
		ircPane.append(line);
		line.slideDown(200);

		if (ircPane.children().length > 8) {
		    var line1 = ircPane.children().first();
		    line1.slideUp(200, function() {
			line1.remove();
		    });
		}
	    }
	    if (msg.irc && msg.irc.server && msg.irc.channel) {
		$('#irc .caption').text(msg.irc.server + ' ' + msg.irc.channel);
	    }
	};
	$('#irc ul').empty();
	$('#irc').slideDown(500);
    }
}

function setQuestionContents(q) {
    $('#question').empty();
    if (q.text) {
        $('#question').append('<p></p>');
        $('#question p').text(q.text);
    }
    if (q.image) {
        $('#question').append('<img>');
        $('#question img').attr('src', q.image);
    }
    if (q.video) {
        $('#question').append('<video controls autoplay>');
        $('#question video').attr('src', q.video);
    }
}

var PLAYER_KEYS = 'abc';
var ANSWER_KEYS = '1234';

// Game screen is the one with the question in question
function switchToGame() {
    var i, q = questions[currentQuestion];
    var activePlayer = null, choice = null;  // can be null

    var updateTier = function() {
        var s = q.tier;
        if (activePlayer !== null)
            s += ' — ' + playerNames[activePlayer];
        $('#tier').text(s);
    };
    updateTier();

    setQuestionContents(q);

    for(i = 0; i < 4; i++) {
        var answer = q.answers[i];
        var liEl = $('#answers li').eq(i);
        liEl.text(answer.text);
        liEl.removeClass('selected right wrong');
	liEl.fadeTo(0, 1);
    }

    var switchToAnswer = function(isTimeout) {
	// Halt timeout sound first
	$('#audio_timeout')[0].pause();

	if (activePlayer !== null) {
	    // player confirmed answer or gave up
            var answerEl;
            if (choice !== null) {
                answerEl = $('#answer' + choice);
                answerEl.removeClass('selected');
            }
            var isRight = choice !== null && q.answers[choice].right === true;
            if (isRight) {
                playerScores[activePlayer] += q.tier;

		$('#audio_right')[0].load();
		$('#audio_right')[0].play();
            } else {
		playerScores[activePlayer] -= q.tier;

		if (choice !== null)
		    // Hilight the wrong choice
		    answerEl.addClass('wrong');
		if (!isTimeout) {
		    $('#audio_wrong')[0].load();
		    $('#audio_wrong')[0].play();
		}
            }

	} else {
	    /* no player wanted to answer, punish a winner */
	    var i, maxScore = playerScores[0];
	    for(var i = 0; i < playerNames.length; i++) {
		if (playerScores[i] > maxScore)
		    maxScore = playerScores[i];
	    }
	    var winners = [];
	    for(var i = 0; i < playerNames.length; i++) {
		if (playerScores[i] === maxScore)
		    winners.push(i);
	    }
	    var punished = winners[Math.floor(Math.random() * winners.length)];
	    playerScores[punished] -= q.tier;

	    if (!isTimeout) {
		$('#audio_wrong')[0].load();
		$('#audio_wrong')[0].play();
	    }
	}
	updateScores();
	timer.halt();
	if (q.explanation)
	    setQuestionContents(q.explanation);

	// Hilight all right choices
	var i = 0;
	q.answers.forEach(function(answer) {
            if (answer.right === true)
		$('#answer' + i).addClass('right');
            i++;
        });

	keyHandler = function(key) {
	    if (key === " ") {
		// next question:
		currentQuestion++;
		$('#game').fadeOut(500, function() {
                    switchToScoreboard();
		});
	    }
	};
    };
    var timeout = function() {
	switchToAnswer(true);
    };
    timer.set(TIMER_QUESTION, timeout);

    var activatePlayer = function(player) {
	if (activePlayer !== null)
	    return;

        if (playerNames[player]) {
	    activePlayer = player;
	    updateTier();
	    timer.set(TIMER_ANSWER, timeout);
	}
	for(var i = 0; i < playerNames.length; i++) {
	    sendToBackend({ buzzerLED: [i, i === player ? 1 : 0] });
	}
	sendToBackend({ buzzerLED: [player, 1] });
    };
    for(var i = 0; i < playerNames.length; i++) {
	sendToBackend({ buzzerLED: [i, 1] });
    }

    keyHandler = function(key, keyCode) {
        if (keyCode === 27) {
            // Shortcut: cancel this state
            $('#game').hide();
            switchToScoreboard();
        } else if (activePlayer === null &&
		   PLAYER_KEYS.indexOf(key) >= 0) {
            // No active player before, but somebody hit a button!
            var player = PLAYER_KEYS.indexOf(key);
	    activatePlayer(player);
        } else if (activePlayer !== null &&
                   ANSWER_KEYS.indexOf(key) >= 0) {
            // player pronounced the answer
            if (choice !== null)
                $('#answer' + choice).removeClass('selected');

            choice = ANSWER_KEYS.indexOf(key);
            $('#answer' + choice).addClass('selected');
        } else if (keyCode === 13) {
	    switchToAnswer();
	} else if (activePlayer !== null &&
		   key === 'f') {
	    takeJoker(activePlayer, 'fiftyfifty');
	} else if (activePlayer !== null &&
		   key === 'z') {
	    takeJoker(activePlayer, 'audience');
	} else if (activePlayer !== null &&
		   key === 'p') {
	    takeJoker(activePlayer, 'phone');
	} else if (activePlayer !== null &&
		   key === 'n') {
	    takeJoker(activePlayer, 'nedap');
	} else if (activePlayer !== null &&
		   key === 'i') {
	    takeJoker(activePlayer, 'irc');
	} else if (activePlayer !== null &&
		   key === 's') {
	    takeJoker(activePlayer, 'fwd');
	    activePlayer = null;
	}
    };

    onBackendMessage = function(msg) {
	if (msg.hasOwnProperty('buzzer'))
	    activatePlayer(msg.buzzer);
    };

    $('#nedap').hide();
    $('#irc').hide();
    // Instantly show the question:
    $('#game').show();
}
