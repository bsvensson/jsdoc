/**
 * Logging tools for JSDoc.
 *
 * Log messages are printed to the console based on the current logging level. By default, messages
 * at level `{@link module:jsdoc/util/logger.LEVELS.ERROR}` or above are logged; all other messages
 * are ignored.
 *
 * In addition, the module object emits an event whenever a logger method is called, regardless of
 * the current logging level. The event's name is the string `logger:` followed by the logger's name
 * (for example, `logger:error`). The event handler receives an array of arguments that were passed
 * to the logger method.
 *
 * Each logger method accepts a `message` parameter that may contain zero or more placeholders. Each
 * placeholder is replaced by the corresponding argument following the message. If the placeholder
 * does not have a corresponding argument, the placeholder is not replaced.
 *
 * The following placeholders are supported:
 *
 * + `%s`: String.
 * + `%d`: Number.
 * + `%j`: JSON.
 *
 * @module jsdoc/util/logger
 * @extends module:events.EventEmitter
 * @example
 * var logger = require('jsdoc/util/logger');
 *
 * var data = {
 *   foo: 'bar'
 * };
 * var name = 'baz';
 *
 * logger.warn('%j %s', data, name);  // prints '{"foo":"bar"} baz'
 * @see http://nodejs.org/api/util.html#util_util_format_format
 */
'use strict';

var runtime = require('jsdoc/util/runtime');
var util = require('util');

function Logger() {}
util.inherits(Logger, require('events').EventEmitter);

var logger = module.exports = new Logger();

/**
 * Logging levels for the JSDoc logger. The default logging level is
 * {@link module:jsdoc/util/logger.LEVELS.ERROR}.
 *
 * @alias module:jsdoc/util/logger.LEVELS
 * @enum
 * @type {number}
 */
var LEVELS = logger.LEVELS = {
    /**
     * Do not log any messages.
     *
     * @alias module:jsdoc/util/logger.LEVELS.SILENT
     */
    SILENT: 0,
    /**
     * Log fatal errors that prevent JSDoc from running.
     *
     * @alias module:jsdoc/util/logger.LEVELS.FATAL
     */
    FATAL: 10,
    /**
     * Log all errors, including errors from which JSDoc can recover.
     *
     * @alias module:jsdoc/util/logger.LEVELS.ERROR
     */
    ERROR: 20,
    /**
     * Log the following messages:
     *
     * + Warnings
     * + Errors
     *
     * @alias module:jsdoc/util/logger.LEVELS.WARN
     */
    WARN: 30,
    /**
     * Log the following messages:
     *
     * + Informational messages
     * + Warnings
     * + Errors
     *
     * @alias module:jsdoc/util/logger.LEVELS.INFO
     */
    INFO: 40,
    /**
     * Log the following messages:
     *
     * + Debugging messages
     * + Informational messages
     * + Warnings
     * + Errors
     *
     * @alias module:jsdoc/util/logger.LEVELS.DEBUG
     */
    DEBUG: 50,
    /**
     * Log all messages.
     *
     * @alias module:jsdoc/util/logger.LEVELS.VERBOSE
     */
    VERBOSE: 1000
};

var DEFAULT_LEVEL = LEVELS.WARN;
var logLevel = DEFAULT_LEVEL;

var PREFIXES = {
    DEBUG: 'DEBUG - ',
    ERROR: 'ERROR - ',
    INFO: 'INFO - ',
    FATAL: 'FATAL - ',
    WARN: 'WARNING - '
};

function logDetails() {
    try {
      throw Error('');
    }
    catch(err) {
        try {
            // should be the root of the directory running the node script
            var replaceString = process.cwd();
            // --------------------------------------------------------------------
            // Retrieve the line number from Error Object's stack trace
            // at exports.handlers.parseBegin (/Users/lloy3317/Git/Development/Devtopia/arcgis-js-sdk-4/bin/jsdoc/plugins/esriPlugin.js:163:12)
            //
            // This would be the 163 in the line above
            // --------------------------------------------------------------------
            var lineNumber = err.stack.split("\n")[5].split(":")[1];
            // --------------------------------------------------------------------
            // Retrieve the file name and base path from the full path
            // --------------------------------------------------------------------
            var rawFile = err.stack.split("\n")[5];
            // Replace the full root path with an empty string
            var replaceRawFileContents = rawFile.replace(replaceString, "");
            // --------------------------------------------------------------------
            // Use a regular expression to pull the base path and file name from
            // the Error's Object stack trace
            //
            // e.g., /bin/jsdoc/plugins/esriPlugin.js
            // --------------------------------------------------------------------
            var filename = replaceRawFileContents.match(/(\/[a-zA-Z-0-9_]+)+\.js/m);
            // --------------------------------------------------------------------
            // Build the string for the detailed log info. e.g.,
            //
            // /node_modules/jsdoc-esri/lib/jsdoc/src/parser.js : 240 -
            // --------------------------------------------------------------------
            var details = filename[0] + " : " + lineNumber + " - ";
            return details;
        }
        catch(error) {
            return null;
        }
    }
}

// Add a prefix to a log message if necessary.
function addPrefix(args, prefix) {
    var updatedArgs;

    if (prefix && typeof args[0] === 'string') {
        updatedArgs = args.slice(0);
        var details = logDetails();
        if (details) {
            updatedArgs[0] = prefix + details + updatedArgs[0];
        }
        else {
            updatedArgs[0] = prefix + updatedArgs[0];
        }
    }

    return updatedArgs || args;
}

// TODO: document events
function wrapLogFunction(name, func) {
    var eventName = 'logger:' + name;
    var upperCaseName = name.toUpperCase();
    var level = LEVELS[upperCaseName];
    var prefix = PREFIXES[upperCaseName];

    return function() {
        var loggerArgs;

        var args = Array.prototype.slice.call(arguments, 0);

        if (logLevel >= level) {
            loggerArgs = addPrefix(args, prefix);
            func.apply(null, loggerArgs);
        }

        args.unshift(eventName);
        logger.emit.apply(logger, args);
    };
}

// Print a message to STDOUT without a terminating newline.
function printToStdout() {
    var args = Array.prototype.slice.call(arguments, 0);

    process.stdout.write( util.format.apply(util, args) );
}

/**
 * Log a message at log level {@link module:jsdoc/util/logger.LEVELS.DEBUG}.
 *
 * @alias module:jsdoc/util/logger.debug
 * @param {string} message - The message to log.
 * @param {...*=} values - The values that will replace the message's placeholders.
 */
logger.debug = wrapLogFunction('debug', console.info);
/**
 * Print a string at log level {@link module:jsdoc/util/logger.LEVELS.DEBUG}. The string is not
 * terminated by a newline.
 *
 * @alias module:jsdoc/util/logger.printDebug
 * @param {string} message - The message to log.
 * @param {...*=} values - The values that will replace the message's placeholders.
 */
logger.printDebug = wrapLogFunction('debug', printToStdout);
/**
 * Log a message at log level {@link module:jsdoc/util/logger.LEVELS.ERROR}.
 *
 * @alias module:jsdoc/util/logger.error
 * @param {string} message - The message to log.
 * @param {...*=} values - The values that will replace the message's placeholders.
 */
logger.error = wrapLogFunction('error', console.error);
/**
 * Log a message at log level {@link module:jsdoc/util/logger.LEVELS.FATAL}.
 *
 * @alias module:jsdoc/util/logger.fatal
 * @param {string} message - The message to log.
 * @param {...*=} values - The values that will replace the message's placeholders.
 */
logger.fatal = wrapLogFunction('fatal', console.error);
/**
 * Log a message at log level {@link module:jsdoc/util/logger.LEVELS.INFO}.
 *
 * @alias module:jsdoc/util/logger.info
 * @param {string} message - The message to log.
 * @param {...*=} values - The values that will replace the message's placeholders.
 */
logger.info = wrapLogFunction('info', console.info);
/**
 * Print a string at log level {@link module:jsdoc/util/logger.LEVELS.INFO}. The string is not
 * terminated by a newline.
 *
 * @alias module:jsdoc/util/logger.printInfo
 * @param {string} message - The message to log.
 * @param {...*=} values - The values that will replace the message's placeholders.
 */
logger.printInfo = wrapLogFunction('info', printToStdout);
/**
 * Log a message at log level {@link module:jsdoc/util/logger.LEVELS.VERBOSE}.
 *
 * @alias module:jsdoc/util/logger.verbose
 * @param {string} message - The message to log.
 * @param {...*=} values - The values that will replace the message's placeholders.
 */
logger.verbose = wrapLogFunction('verbose', console.info);
/**
 * Print a string at log level {@link module:jsdoc/util/logger.LEVELS.VERBOSE}. The string is not
 * terminated by a newline.
 *
 * @alias module:jsdoc/util/logger.printVerbose
 * @param {string} message - The message to log.
 * @param {...*=} values - The values that will replace the message's placeholders.
 */
logger.printVerbose = wrapLogFunction('verbose', printToStdout);
/**
 * Log a message at log level {@link module:jsdoc/util/logger.LEVELS.WARN}.
 *
 * @alias module:jsdoc/util/logger.warn
 * @param {string} message - The message to log.
 * @param {...*=} values - The values that will replace the message's placeholders.
 */
logger.warn = wrapLogFunction('warn', console.warn);

/**
 * Set the log level.
 *
 * @alias module:jsdoc/util/logger.setLevel
 * @param {module:jsdoc/util/logger.LEVELS} level - The log level to use.
 */
logger.setLevel = function setLevel(level) {
    logLevel = (level !== undefined) ? level : DEFAULT_LEVEL;
};

/**
 * Get the current log level.
 *
 * @alias module:jsdoc/util/logger.getLevel
 * @return {module:jsdoc/util/logger.LEVELS} The current log level.
 */
logger.getLevel = function getLevel() {
    return logLevel;
};

