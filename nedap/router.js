module.exports = function(f) {
	var cbs = {};
	var app = {
		get: function(path, cb) {
			cbs['GET ' + path] = cb;
		},
		post: function(path, cb) {
			cbs['POST ' + path] = cb;
		},
	};
	f(app);
	return function(req, res, next) {
		var cb = cbs[req.method + ' ' + req.url];
		if (cb) {
			cb(req, res);
		} else {
			return next();
		}
	};
};

