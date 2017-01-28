// ************************************************************************* //
// This is a partial clone of https://github.com/jhurliman/node-rate-limiter //
// using the file system to share the limiters across different,             //
// non-concurrent executions of one or more Node scripts. Note that          //
// incredible things could happen if you use this concurrently instead!!!    //
// :-D                                                                       //
// ************************************************************************* //

const
    fs = require("fs-extra"),
    path = require("path"),
    _ = require("underscore");

const
    APPLICATION_NAME = "im.dico.rate-limiter";

var RateLimiter = function (resourceName, occurrences, timeInterval, options) {

    var _this = this;

    this.initializeMemory = callback => {
        // create an empty cache if it does not exist already
        fs.stat(path.join(_this.options.local, _this.resourceName), (err, stats) => {
            if (!err) return callback(null);
            fs.writeFile(path.join(_this.options.local, _this.resourceName), JSON.stringify([ ]), { "encoding": "utf8" }, callback);
        });
    }

    this.removeTokens = (tokensNo, callback) => {
        if (!callback) { callback = tokensNo; tokensNo = 1; }
        var check = () => {
            var now = new Date();
            _this.initializeMemory(err => {
                fs.readFile(path.join(_this.options.local, _this.resourceName), { "encoding": "utf8" }, (err, memory) => {
                    if (err) {
                        console.error("Could not read from the rate-limiting memory file.");
                        process.exit(1);
                    }
                    // TODO: this try/catch is necessary because it has
                    //       happened that the script failed because the
                    //       file is read but empty.
                    try {
                        memory = JSON.parse(memory).map(x => { return new Date(x); });
                    } catch (err) {
                        memory = [ ];
                    }
                    // memory garbage collection
                    memory = memory.filter(timestamp => {
                        return now - timestamp <= _this.timeInterval;
                    }).sort();
                    // check for minWait
                    if (_.last(memory) && (_this.options.minWait > 0) ? now - _.last(memory) < _this.options.minWait : false) {
                        // I need to wait
                        setTimeout(check, _this.options.minWait - now + _.last(memory));
                    // check for the actual rate
                    } else if (_this.occurrences < memory.length + tokensNo) {
                        // I need to wait
                        setTimeout(check, now - memory[tokensNo - 1]);
                    // it's a go!
                    } else {
                        memory = memory.concat(Array(tokensNo).fill(now));
                        fs.writeFile(path.join(_this.options.local, _this.resourceName), JSON.stringify(memory), { "encoding": "utf8" }, err => {
                            if (err) {
                                console.error("Could not write to the rate-limiting memory file.");
                                process.exit(1);
                            }
                            callback(null, _this.occurrences - memory.length);
                        });
                    }
                });
            });
        };
        check();
    }

    this.resourceName = resourceName;
    this.occurrences = occurrences;
    switch(timeInterval) {
        case "second":
            this.timeInterval = 1000;
            break;
        case "minute":
            this.timeInterval = 60000;
            break;
        case "hour":
            this.timeInterval = 3600000;
            break;
        case "day":
            this.timeInterval = 86400000;
            break;
        default:
            this.timeInterval = parseInt(timeInterval);
    }
    this.options = options ? options : { };
    // TODO: this is suitable to Fedora systems only, what about other Linux distro or other OS's?
    this.options.local = this.options.local ? this.options.local : path.join(process.env.HOME, ".local", APPLICATION_NAME);
    this.options.minWait = this.options.minWait ? this.options.minWait : 0;
    // initialization of folder structure
    fs.ensureDirSync(this.options.local);

};

exports.RateLimiter = RateLimiter;
