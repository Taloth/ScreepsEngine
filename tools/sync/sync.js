// Inspired by the work of laverdet: https://gist.github.com/laverdet/b67db14ccc8520abea2c

"use strict";
var fspath = require('path');
var http = require('http');
var httpProxy = require('http-proxy');
var connect = require('connect');
var injector = require('connect-injector');
var fs = require('fs');
var wrench = require('wrench');
var watch = require('node-watch');
var URL = require('url');
var md5 = require('MD5');
var beautify = require('./beautify');

if (process.env.syncArgs) {
    process.argv = Array.prototype.concat.call(process.argv, process.env.syncArgs.split(' '));
}

var opts = require('node-getopt').create([
    ['d', 'debug',         'Enabled remote debugging capabilities (Warning: this limits the speed of the game and may cause other glitches. You don\'t need it if debugging in Chrome itself.'],
    ['b', 'beautify',      'Serve beautified versions of the screeps engine code.'],
    ['',  'deployDir=ARG', 'Directory to deploy from'],
    ['',  'srcDir=ARG',    'Directory with original source files'],
    ['',  'cacheDir=ARG',  'Path to the directory to with original source files'],
    ['',  'port=ARG',      'Port number for the proxy server']
]).bindHelp().parseSystem();

var deployDir = fspath.resolve(__dirname, opts.options.deployDir || '../../deploy');
var srcDir = fspath.resolve(__dirname, opts.options.srcDir || '../../src');
var engineCacheDir = fspath.resolve(__dirname, opts.options.cacheDir || '../../enginecache');
var listenPort = parseInt(opts.options.port || '9090');
// Replaces the background Worker with a FakeWorker allowing WebStorm to debug, please note that this may freeze the webpage UI occasionally and speed isn't as high since it runs on a single thread.
var useRemoteDebugger = !!opts.options.debug;
// Whether to beautify the engine.js code before sending it to the browser.
var beautifyEngine = !!opts.options.beautify;

// This all runs in the browser
var clientSide = function() {
    function sync() {
        // Grab reference to the commit button
        var buttons = Array.prototype.slice.call(document.body.getElementsByTagName('button')).filter(function (el) {
            return el.getAttribute('ng:disabled') === '!Script.dirty';
        });
        var commitButton = buttons[0];

        // Override lodash's cloneDeep which is called from inside the internal reset method
        var modules;
        _.cloneDeep = function (cloneDeep) {
            return function (obj) {
                if (obj && typeof obj.main === 'string' && modules) {
                    // Monkey patch!
                    return modules;
                }
                return cloneDeep.apply(this, arguments);
            };
        }(_.cloneDeep);

        // Wait for changes to local filesystem
        function update(now) {
            var req = new XMLHttpRequest;
            req.onreadystatechange = function () {
                if (req.readyState === 4) {
                    if (req.status === 200) {
                        modules = JSON.parse(req.responseText);
                        commitButton.disabled = false;
                        commitButton.click();
                    }
                    setTimeout(update.bind(this, false), req.status === 200 ? 0 : 1000);
                }
            };
            req.open('GET', 'http://localhost:9090/' + (now ? 'get' : 'wait'), true);
            req.send();
        };
        update(true);

        // Look for console messages
        var sconsole = document.body.getElementsByClassName('console-messages-list')[0];
        var lastMessage;
        setInterval(function () {
            var nodes = sconsole.getElementsByClassName('console-message');
            var messages = [];
            var found = false;
            for (var ii = nodes.length - 1; ii >= 0; --ii) {
                var el = nodes[ii];
                var ts = el.getElementsByClassName('timestamp')[0];
                ts = ts && ts.firstChild.nodeValue;
                var msg = el.getElementsByTagName('span')[0].childNodes;
                var txt = '';
                for (var jj = 0; jj < msg.length; ++jj) {
                    if (msg[jj].tagName === 'BR') {
                        txt += '\n';
                    } else if (msg[jj].tagName === 'ANONYMOUS') {
                        msg = msg[jj].childNodes;
                        jj = -1;
                    } else {
                        txt += msg[jj].nodeValue;
                    }
                }
                if (lastMessage && txt === lastMessage[1] && ts === lastMessage[0]) {
                    break;
                }
                messages.push([ts, txt]);
            }
            if (messages.length) {
                var req = new XMLHttpRequest;
                req.open('GET', 'http://localhost:9090/log?log=' + encodeURIComponent(JSON.stringify(messages.reverse())), true);
                req.send();
                lastMessage = messages[messages.length - 1];
            }
        }, 100);
    }

    // Delay injections until the user enters the game proper
    var waitForGameConsole = function() {

        if (!$('.console-messages-list').length) return setTimeout(waitForGameConsole, 1000);

        sync();
    };

    waitForGameConsole();
};

// Set up watch on directory changes
var modules = {};
var knownModules = {};
var writeListener;

function fileNameToModuleName(file) {
    return file.replace(/[\\/]/g, '_').replace(/\.js$/g, '');
}

function updateModule(file) {
    var moduleName = fileNameToModuleName(file);
    if (fs.existsSync(fspath.join(deployDir, file))) {
        knownModules[moduleName] = true;
        var data = fs.readFileSync(fspath.join(deployDir, file), 'utf8');
        data = data.replace(/(require\(['"])((?:.\/)?[a-z.\/]+)(['"]\))/gi, function (m, p1, p2, p3) {
            var resolved = p2;
            if (resolved != 'lodash') {
                resolved = fspath.resolve(fspath.join(deployDir, file, '..'), resolved);
                resolved = fspath.relative(deployDir, resolved);
                resolved = resolved.replace(/[\\\/]/g, '_');

                //console.log('' + file + ': "' + p2 + '" => "' + resolved + '"');
            }
            return p1 + resolved + p3;
        });

        if (modules[moduleName] && modules[moduleName] == data) {
            return false;
        }
        modules[moduleName] = data;
    } else {
        knownModules[moduleName] = false;
        if (!modules[moduleName]) {
            return false;
        }
        delete modules[moduleName];
    }

    if (writeListener) {
        process.nextTick(writeListener);
        writeListener = undefined;
    }

    return true;
}

function updateAllModules(notify) {
    knownModules = {};

    wrench.readdirSyncRecursive(deployDir).forEach(function(file) {
        if (/\.js$/.test(file)) {
            var changed = updateModule(file, false);
            if (changed && notify) {
                console.log('Updated: ' + file);
            }
        }
    });

    for(var key in modules) {
        if (!knownModules[key]) {
            delete modules[key];
            if (notify) {
                console.log('Updated: ' + key);
            }
        }
    }

    if (writeListener) {
        process.nextTick(writeListener);
        writeListener = undefined;
    }
}

updateAllModules();

watch(deployDir, function(file) {
    updateAllModules(true);
});

// Standalone proxy provider
var proxy = httpProxy.createServer({ target: 'http://screeps.com:80', headers: { host: 'screeps.com' } });


var app = connect();

// Handle our root level calls.
app.use(function(req, res, next) {

    var path = URL.parse(req.url);

    // Redirect to website.
    if (path.pathname == '/') {
        res.writeHead(302, {'Location': 'http://' + req.headers.host + '/g/'});
        res.end();
        return;
    } else if (path.pathname == '/inject/fakeworker.js') {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(fs.readFileSync(__dirname + '/fakeworker-0.1.js', 'utf8'));
        return;
    } else if (path.pathname == '/inject/syncClient.js') {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end('~' + clientSide.toString() + '()');
        return;
    } else if (path.pathname == '/log') {
        // ATM I'm not doing anything with the log.
        res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
        res.end();
        return;
    } else if (path.pathname == '/wait' || path.pathname == '/get') {
        if (writeListener) {
            writeListener();
        }
        console.log('Browser is watching');
        writeListener = function() {
            console.log('Serving scripts to browser.');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify(modules));
        };
        if (req.url === '/get') {
            writeListener();
        }
        return;
    }

    next();
});

// Serve individual scripts.
app.use('/get/', function(req, res, next) {
    var path = URL.parse(req.url);
    var moduleName = fileNameToModuleName(path.pathname.replace(/\//, ''));
    res.writeHead(200, {'Content-Type': 'text/javascript'});
    res.end(modules[moduleName]);
});

// Serve individual sources.
app.use('/src/', function(req, res, next) {
    var path = URL.parse(req.url);
    var fileName = fspath.resolve(srcDir, '.' + path.pathname);
    if (!fs.existsSync(fileName)) {
        res.writeHead(404);
        res.end();
    }
    var data = fs.readFileSync(fileName);
    res.writeHead(200);
    res.end(data);
});

// Inject script in the main http file.
app.use(injector(function(req, res) {
    return req.url == '/g/';
}, function (data, req, res, callback) {
    data = data.toString();
    if (useRemoteDebugger) {
        data = data.replace('</head>', '<script src="http://localhost:' + listenPort + '/inject/fakeworker.js"></script></head>');
    }
    data = data.replace('</body>', '<script src="http://localhost:' + listenPort + '/inject/syncClient.js"></script></body>');
    callback(null, data);
}));

if (beautifyEngine) {

    var beautifyCache = {};

    // load cache
    /*
     wrench.readdirSyncRecursive(engineCacheDir).forEach(function(file) {
     if (/build.*\.min\.js$/.test(file)) {
     file = engineCacheDir + file;
     var fileNew = file.replace('.min.', '.new.');

     var data = fs.readFileSync(file).toString();
     var newData = beautify(data);
     fs.writeFileSync(fileNew, newData);
     }
     });*/

    app.use(injector(function(req, res) {
        var path = URL.parse(req.url);
        return path.pathname == '/g/engine.js' || path.pathname == '/g/build.min.js' || path.pathname == '/g/constants.js';
    }, function(data, req, res, callback) {

        var path = URL.parse(req.url);

        data = data.toString();

        var name = path.pathname.match(/^\/g\/([a-z]+)\./)[1];
        var revision = parseInt(path.query.match(/bust=(\d+)+/)[1]);
        var hash = name + '.' + revision;

        var newData = beautifyCache[hash];

        if (!newData) {

            var beautified = data;

            try {

                var revCacheDir = fspath.join(engineCacheDir, revision.toString());
                if (!fs.existsSync(engineCacheDir) ) {
                    fs.mkdirSync(engineCacheDir);
                }
                if (!fs.existsSync(revCacheDir) ) {
                    fs.mkdirSync(revCacheDir);
                }

                // Extract engine code or take build.min code.
                if (path.pathname == '/g/engine.js') {
                    var prefix = data.match(/^(.*?\{ var)/)[0];
                    var suffix = data.match(/ return \(window.URL.*/)[0];
                    var block = data.substring(prefix.length, data.length - suffix.length);
                    var split = block.split('\n');
                    for (var i = 0; i < split.length; i++) {
                        split[i] = split[i]
                            .replace(/^ *d *\+?= *"/, '')
                            .replace(/";$/, '')
                            .replace(/\\(.)/g, function (l, c) {
                                return c == '\\' ? '\\' : c == '"' ? '"' : c == 'n' ? '\n' : undefined;
                            });
                        ;
                    }
                    block = split.join('');

                    beautified = beautify(block);
                    split = beautified.split('\n');
                    for (var i = 0; i < split.length; i++) {
                        split[i] = split[i]
                            .replace(/\\/g, '\\\\')
                            .replace(/"/g, '\\"')
                            .replace(/\n/g, '\\n');
                    }
                    var joined = ' d = "' + split.join('\\n";\n d += "') + '\\n";';

                    newData = prefix + joined + suffix;

                } else {

                    newData = beautified = beautify(data);
                }

                fs.writeFileSync(fspath.join(revCacheDir, name + '.min.js'), data);
                fs.writeFileSync(fspath.join(revCacheDir, name + '.js'), beautified);
                if (beautified != newData) {
                    fs.writeFileSync(fspath.join(revCacheDir, name + '.runtime.js'), newData);
                }

                beautifyCache[hash] = newData;
            } catch (e) {
                console.log(e.toString());
                throw e;
            }

        }

        callback(null, newData);
    }));
}

if (useRemoteDebugger) {
    // Disable the exception catcher in evalCode.
    app.use(injector(function (req, res) {
        var path = URL.parse(req.url);
        return path.pathname == '/g/engine.js';
    }, function (data, req, res, callback) {
        data = data.toString();
        data = data.replace(
                'throw new EvalCodeError(message)',
                'throw e');

        callback(null, data);
    }));
}

// Whitelist of permissible files. (For one, DO NOT whitelist the replay/score endpoints, if you want to play a real game, use the real website)
var whitelist = [
    '/favicon.ico',
    '/g/',
    '/g/app.css',
    '/g/constants.js',
    '/g/engine.js',
    '/g/build.min.js',
    /^\/g\/vendor\//,
    /^\/g\/components\// ];
var blacklist = [
    /replay/g ];
app.use(function(req, res, next) {

    var path = URL.parse(req.url);

    var blacklisted = blacklist.some(function (v) {
        if (typeof v == 'string') {
            return v == path.pathname;
        } else {
            return v.test(path.pathname);
        }
    });

    if (blacklisted) {
        res.writeHead(409);
        res.end();
        return;
    }

    var whitelisted = whitelist.some(function (v) {
        if (typeof v == 'string') {
            return v == path.pathname;
        } else {
            return v.test(path.pathname);
        }
        });

    if (!whitelisted) {
        console.log('Request not on whitelist: ' + path.pathname);
        res.writeHead(409);
        res.end();
    }

    next();
});

// Redirect /g/ traffic to the screeps website.
app.use(function(req, res) {
    if (req.url.indexOf('/g/') === 0) {
        var referrer = req.headers['Referer'];
        if (referrer) {
            console.log(referrer);
            req.headers['Referer'] = referrer.replace('http://localhost:' + listenPort + '/', 'http://screeps.com/');
        }
        proxy.web(req, res);
    } else {
        // Panic on something else
        res.writeHead(400);
        res.end();
    }
});

// Localhost HTTP server
var server = http.createServer(app);
server.timeout = 0;
server.listen(listenPort);

console.log( 'Initialized proxy at http://localhost:' + listenPort + '/');