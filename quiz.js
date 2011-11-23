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
    var started = false;
    $('#game').hide();
    $('#scoreboard').hide();

    loadQuizData(function() {
        // Quiz data has initialized
        $('#setup').show();
        $('#start').bind('click', function() {
            try {
		started = true;
		for(var i = 0; i < 5; i++) {
		    var name = $('#playername' + i).val();
		    if (name) {
			playerNames[i] = name;
			playerScores[i] = 0;
		    }
		}
                startQuiz();
            } catch (e) {
                console.error(e.stack);
            }
            return false;  // don't submit <form>
        });
    });

    for(var i = 0; i < 5; i++) {
	(function(i_) {
	     $('#playername' + i_).focus(function() {
		 if (started) return;
		 sendToBackend({ buzzerLED: [i_, 1] });
	     });
	     $('#playername' + i_).focusout(function() {
		 if (started) return;
		 sendToBackend({ buzzerLED: [i_, 0] });
	     });
	 })(i);
    }
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
	window.setTimeout(setupWs, 100);
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
	    if (t > 25 && t < 27) {
		$('#audio_timeout')[0].load();
		$('#audio_timeout')[0].play();
	    }
	    if (t > 0 && t < 2) {
		$('#audio_timeup')[0].load();
		$('#audio_timeup')[0].play();
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
console.log('playerNames', playerNames);

function startQuiz() {
    var i;
    console.log('startQuiz');

    questions.forEach(function(q) {
        $('#tiers').append('<li></li>');
        $('#tiers li').last().text(q.tier);
    });

    updateScores();

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

    for(var i = 0; i < playerNames.length; i++) {
	sendToBackend({ buzzerLED: [i, 0] });
    }
    $('#scoreboard').fadeIn(300);
    if (currentQuestion >= questions.length)
	$('#audio_final')[0].play();
}

function updateScores() {
    for(var i = 0; i < 5; i++) {
        if (playerNames[i]) {
	    $('#scoreboard dl dd.p' + i).find('.score').text(playerScores[i]);
            $('#players .player'+i+' .score').text(playerScores[i]);
            $('#scoreboard dt.p' + i).text(playerNames[i]);
            $('#players li.player'+i+' span.name').text(playerNames[i]);
	    for(var joker in (playerJokers[i] || {}))
		$('#scoreboard dd.p' + i).find('.' + joker).hide();
	} else {
	    $('#scoreboard dl dt.p' + i).hide();
	    $('#scoreboard dl dd.p' + i).hide();
	    $('#players .player' + i).hide();
	}
    }
}

function takeJoker(activePlayer, joker) {
    if (activePlayer === null)
	// No active player
	return;

    if (!playerJokers[activePlayer])
	playerJokers[activePlayer] = {};

    if (playerJokers[activePlayer][joker])
	// Joker already taken
	return;

    /* Hide previous special jokers */
    $('#nedap').hide();
    $('#irc').hide();

    playerJokers[activePlayer][joker] = true;
    saveGamestate();
    $('#tier').append('<img src="' + joker + '.png">');

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
	redraw();
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
    if (joker === 'morse') {
	var morseText = "";
	questions[currentQuestion].answers.forEach(function(answer) {
            if (answer.right === true &&
		(!morseText || Math.random() > 0.5))
		morseText = answer.text;
        });
	sendToBackend({ morse: morseText });
    }
    if (joker === 'leak') {
	var iframe = $('<iframe class="leaks" src="leakjoker/SPIEGEL ONLINE - Nachrichten.html"></iframe>');
	$('body').append(iframe);
	iframe.load(function() {
	    iframe.animate({ top: "-8000px" }, 15000, function() {
		iframe.remove();
	    });
	    var answers = questions[currentQuestion].answers;
	    for(var i = 0; i < answers.length; i++) {
		if (answers[i].right) {
		    var h2s = iframe.contents().find('.spTopThema h2');
		    var h2 = h2s[Math.floor(Math.random() * h2s.length)];
		    $(h2).text(answers[i].text);
		}
	    }
	});
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
		saveGamestate();
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
	$('#audio_buzz')[0].load();
	$('#audio_buzz')[0].play();
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
	} else if (activePlayer !== null &&
		   key === 'm') {
	    takeJoker(activePlayer, 'morse');
	} else if (activePlayer !== null &&
		   key === 'l') {
	    takeJoker(activePlayer, 'leak');
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

/* State rescue */

function saveGamestate() {
    sendToBackend({ gamestate: {
	currentQuestion: currentQuestion,
	playerNames: playerNames,
	playerJokers: playerJokers,
	playerScores: playerScores
    } });
}

function setGamestate(gamestate) {
    currentQuestion = gamestate.currentQuestion;
    playerNames = gamestate.playerNames;
    playerJokers = gamestate.playerJokers;
    playerScores = gamestate.playerScores;
    startQuiz();
}

function requestGamestate() {
    sendToBackend({ requestGamestate: true });
}

/* Set a default handler that will be overwritten once the game starts */
onBackendMessage = function(msg) {
    if (msg.hasOwnProperty('gamestate')) {
	setGamestate(msg.gamestate);
    }
};
