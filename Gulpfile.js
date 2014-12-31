var gulp = require('gulp');
var gutil = require('gulp-util');
var map = require('map-stream');
var es = require('event-stream');
var ts = require('gulp-typescript');
var sourcemaps = require('gulp-sourcemaps');
var replace = require('gulp-replace');
var nodemon = require('gulp-nodemon')

var ext = require('./tools/gulp/extensions');

var paths = {
    ts: ['src/**/*.ts', 'extern/lodash.d.ts'],
    outputDir: 'output/',
    deployDir: 'deploy/'
};

var tsProject = ts.createProject({
    target: 'es5',
    module: 'commonjs',
    declarationFiles: false,
    noExternalResolve: false,
    sortOutput: true,
    sourceRoot: '../src'
});

gulp.task('watch', function () {
    gulp.watch(paths.ts, ['build'])
});

gulp.task('default', ['build']);

gulp.task('build', ['compile']);

gulp.task('compile', function() {

    var hasCompileError = false;
    var tsResult = gulp.src(paths.ts)
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject, undefined, { error: function(error) {
            ts.reporter.defaultReporter().error(error);
            // Sometimes the errors get swallowed and don't trigger a task error.
            hasCompileError = true;
        }}));

    var jsSaved = tsResult.js
        .pipe(ext.concatReferences())
        .pipe(replace('this.__extends || function', 'function'))
        .pipe(sourcemaps.write({
            includeContent: false,
            sourceRoot: function(file) {
                return '../src';
            },
            sourceMappingURLPrefix: ''
        }))
        .pipe(gulp.dest(paths.outputDir));

    var dtsSaved = tsResult.dts
        .pipe(gulp.dest(paths.outputDir));

    return es.merge(jsSaved, dtsSaved)
        .on('end', function() {
            if (hasCompileError) {
                var err = new gutil.PluginError('compile', 'Compilation failed');
                err.toString = function() { return ''; };
                this.emit('error', err);
            }
        });
});

gulp.task('deploy', function() {
    return gulp
        .src(paths.outputDir + '**/*.*')
        .pipe(gulp.dest(paths.deployDir));
});

/* Sync from the deploy dir*/
gulp.task('sync', function() {
    nodemon({
        script: 'tools/sync/sync.js',
        watch: 'tools/sync/',
        env: { 'syncArgs': '--beautify' }
        });
});

/* Sync from the deploy dir (with remote debugging) */
gulp.task('syncDebug', function() {
    nodemon({
        script: 'tools/sync/sync.js',
        watch: 'tools/sync/',
        env: { 'syncArgs': '--beautify --debug' }
    });
});

/* Sync directly from the compile/output dir */
gulp.task('syncDeploy', function() {
    nodemon({
        script: 'tools/sync/sync.js',
        watch: 'tools/sync/',
        env: { 'syncArgs': '--beautify --deployDir ../../output' }
    });
});

/* Sync directly from the compile/output dir (with remote debugging) */
gulp.task('syncDeployDebug', function() {
    nodemon({
        script: 'tools/sync/sync.js',
        watch: 'tools/sync/',
        env: { 'syncArgs': '--beautify --debug --deployDir ../../output' }
    });
});
