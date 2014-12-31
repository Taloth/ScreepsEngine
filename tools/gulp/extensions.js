var es = require('event-stream');
var path = require('path');
var concat = require('gulp-concat-util');

var pause = exports.pause = function (callback) {
    var arr = []
    return es.through(function (data) { arr.push(data) },
        function () {
            var self = this;
            if(callback) arr = callback(null, arr) || arr;
            arr.forEach(function(item) {
                self.emit('data', item);
            });
            this.emit('end')
        })
}

var concatReferences = exports.concatReferences = function() {

    var referenceMap = {};
    var regexp = /^\/\/\/\<reference path='(.*?)'\/\>$/gm;
    var buffer = [];
    var endLock = 0;

    function buildReferenceMap(file) {
        buffer.push(file);

        var data = file.contents.toString();
        var match;
        var refMap = referenceMap[file.path] || (referenceMap[file.path] = { references: [], referrers: [] });
        refMap.file = file;
        while (match = regexp.exec(data)) {
            var refPath = path.resolve(file.path + '/..', match[1]).replace(/\.ts$/, '.js');
            var refMapReverse = referenceMap[refPath] || (referenceMap[refPath] = { references: [], referrers: [] });
            refMap.references.push(refPath);
            refMapReverse.referrers.push(file.path);
        }
    }

    function processReferences(filePath, stream, knownReferences) {
        if (knownReferences.indexOf(filePath) === -1) {
            knownReferences.push(filePath);

            var refMap = referenceMap[filePath];
            refMap.references.forEach(function(ref) {
                processReferences(ref, stream, knownReferences);
            }, this);

            if (refMap.file) {
                stream.write(refMap.file);
            }
        }
    }

    function processFile(file) {
        if (!referenceMap[file.path].referrers.length) {
            // Only emit files that aren't referenced somewhere else.

            var self = this;
            var stream = concat(file.relative, {process: function(src) {
                var rootPath = file.path;
                var filePath = this.path;
                var data = src.replace(/(require\(['"])((?:.\/)?[a-z.\/]+)(['"]\))/gi, function(m,p1,p2,p3) {
                    if (p2.indexOf('.') === 0) {
                        var resolved = path.resolve(filePath + '/..', p2);
                        resolved = path.relative(rootPath + '/..', resolved);
                        if (resolved.indexOf('.') !== 0) {
                            //resolved = '.\\' + resolved;
                        }
                        p2 = resolved.replace(/\\/g, '/');
                    }
                    return p1 + p2 + p3;
                });
                return data;
            }});
            endLock++;
            stream.on('data', function (data) {
                self.emit('data', data);
            });
            stream.on('end', function ()
            {
                if (--endLock == 0) {
                    self.emit('end');
                }
            });
            var knownReferences = [];

            processReferences(file.path, stream, knownReferences);

            stream.end();
        }
    }

    function endStream() {

        endLock++;

        // The input data events are already sorted by reference.
        buffer.forEach(processFile, this);

        if (--endLock == 0) {
            this.emit('end');
        }
    }

    return es.through(buildReferenceMap, endStream);
}