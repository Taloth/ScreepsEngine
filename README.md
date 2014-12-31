ScreepsEngine
=============

This contains a couple of core modules written in TypeScript to be used with [Screeps](http://screeps.com).
It also contains a Gulpfile to compile these into a complete package.
Finally there is a sync tool that can be used to sync the generated scripts with the browser.

Currently I develop this using JetBrains WebStorm, take a look at [their site](https://www.jetbrains.com/webstorm/), if you're interested.

Use
===

Run ```npm install``` in the root to get all the required packages.

**gulp tasks**

__```gulp build```__

Compiles the typescript files in the ```src``` directory to the ```output```.

__```gulp deploy```__

Simply copies the contents of the ```output``` to the ```deploy```.
This is to allow you to compile your scripts and deploy them once you're satified.

__```gulp sync/syncDeploy```__

Runs a full proxy server on http://localhost:9090/ that sits between the browser and the game.
This allows us to sync your scripts by injecting a client-side helper, but also enables us to provide additional features, such as sourcemaps and engine source stepping.

The sync task deploys using the ```deploy``` directory.
The syncDeploy task deploys directly from the ```output``` directory and thus can be used to update your browser session immediately after saving source changes.

Please note that the proxy uses a blacklist/whitelist to control what gets communicated with the server.
I don't want scores and replays posted for stuff done via a debugging proxy.

__```gulp syncDebug/syncDeployDebug```__

These Debug variants do a bit more trickery client-side, it's purely intended to allow remote debugging from WebStorm, do not use it otherwise.
- We inject a FakeWorker to replace the multi-threaded WebWorker model with a single-thread model. This is required since WebStorm cannot break in a webworker context.
- We disable the engine try-catch mechanism which would swallow uncaught exceptions, allowing you to break on uncaught exceptions.

Architecture
============

Initially I opted to compile all scripts into one file, but that made it somewhat harder to debug properly.
So instead I've separated it into modules.

The important bits:
```lib/Screeps``` is the module that contains the definitions of the core Screeps api.
```world/Game``` contains wrapped instances of that api exposing additional functionality as well as caching.

```lib/*``` contains various other utilities and helpers, such as automatic name generation, although you might not like my pattern.

```engines/*``` intended to contain global decision logic.
```behaviors/*``` intended to contain specific mixins/behaviors that can be applied to for example Creeps.
```mission/*``` intended to contain persistable missions and assignments.

Contribute
==========

Lemme know if you're working on an interesting feature.
I would love to see some collaboration, so if you have something you want to contribute, make an issue or pull request.
