var ws, sendToBackend, onBackendMessage;
function setupWs() {
    var url = 'ws://' + document.location.host + '/censor.ws';
    ws = new WebSocket(url);

    ws.onerror = function(e) {
	console.error(e.message);
    };
    ws.onclose = function() {
	console.error('WebSocket closed');
	window.setTimeout(setupWs, 1000);
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
	sendToBackend({ toBackend: "ping" });
    };
}
setupWs();

var MAX_IMAGES = 3;
var imgsDisplayed = 0, queue = [];

function mayDisplayNext() {
    if (imgsDisplayed >= MAX_IMAGES)
	return;

    displayImage(queue.shift());
}

function humanSize(size) {
    var unit = "";
    var units = ["K", "M"];
    while(size > 1024 && units.length > 0) {
	size /= 1024;
	unit = units.shift();
    }
    return (Math.round(size * 10) / 10) + " " + unit + "B";
}

function displayImage(img) {
    var div = $("<div class=\"image\"><p><a class=\"accept\">Accept</a> <a class=\"reject\">Reject</a> <a class=\"postpone\">Postpone</a></p><h2></h2><img/></div>");
    div.find("h2").text(img.name + " (" + humanSize(img.size) + ")");
    div.find("img").attr('src', img.path);
    $('body').append(div);
    imgsDisplayed++;

    var goAway = function() {
	div.remove();
	imgsDisplayed--;
	mayDisplayNext();
    };
    div.find(".accept").click(function() {
	sendToBackend({ gif: img.path });
	goAway();
    });
    div.find(".reject").click(goAway);
    div.find(".postpone").click(function() {
	queue.push(img);
	goAway();
    });
}

onBackendMessage = function(msg) {
    if (msg.gif) {
	queue.push(msg.gif);
	mayDisplayNext();
    }
};
