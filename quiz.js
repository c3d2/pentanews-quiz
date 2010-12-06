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
    $.ajax({ url: 'data/questions.json',
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
	setupWs();
    };
    ws.onmessage = function(data) {
	try {
	    console.log('fromBackend: ' + data);
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

    var tick = function() {
	if (t > 0) {
	    t--;
	    $('#timer').text('' + t);
	} else {
	    that.halt();
	    $('#timer').addClass('elapsed');
	    cb();
	}
    };
    this.interval = window.setInterval(tick, 1000);

    /* appear: */
    tick();
    $('#timer').fadeIn(1000);

};
Timer.prototype.halt = function() {
    if (this.interval)
	window.clearInterval(this.interval);
};
Timer.prototype.clear = function() {
    this.halt();
    delete this.interval;
    $('#timer').removeClass('elapsed');
    $('#timer').hide();
};
var TIMER_QUESTION = 90;
var TIMER_ANSWER = 60;
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
            $('#scoreboard dl').append('<dt></dt><dd><span class="score">0</span><img src="fiftyfifty.png" class="fiftyfifty"><img src="audience.png" class="audience"><img src="phone.png" class="phone"><span class="nedap">NEDAP</span></dd>');
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

    var switchToAnswer = function() {
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
            } else {
		playerScores[activePlayer] -= q.tier;

		if (choice !== null)
		    // Hilight the wrong choice
		    answerEl.addClass('wrong');
            }

	} else {
	    /* no player wanted to answer, punish all */
	    for(var i = 0; i < playerNames.length; i++) {
		if (playerNames[i]) {
		    playerScores[i] -= q.tier;
		}
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
    timer.set(TIMER_QUESTION, switchToAnswer);

    keyHandler = function(key, keyCode) {
        if (keyCode === 27) {
            // Shortcut: cancel this state
            $('#game').hide();
            switchToScoreboard();
        } else if (activePlayer === null &&
		   "abcde".indexOf(key) >= 0) {
            // No active player before, but somebody hit a button!
            var player = "abcde".indexOf(key);
            if (playerNames[player]) {
                activePlayer = player;
		updateTier();
		timer.set(TIMER_ANSWER, switchToAnswer);
	    }
        } else if (activePlayer !== null &&
                   "1234".indexOf(key) >= 0) {
            // player pronounced the answer
            if (choice !== null)
                $('#answer' + choice).removeClass('selected');

            choice = "1234".indexOf(key);
            $('#answer' + choice).addClass('selected');
        } else if (activePlayer !== null &&
                   keyCode === 13) {
	    switchToAnswer();
	} else if (activePlayer !== null &&
		   key === 'q') {
	    takeJoker(activePlayer, 'fiftyfifty');
	} else if (activePlayer !== null &&
		   key === 'w') {
	    takeJoker(activePlayer, 'audience');
	} else if (activePlayer !== null &&
		   key === 'e') {
	    takeJoker(activePlayer, 'phone');
	} else if (activePlayer !== null &&
		   key === 'n') {
	    takeJoker(activePlayer, 'nedap');
	}
    };

    $('#polls').hide();
    // Instantly show the question:
    $('#game').show();
}
