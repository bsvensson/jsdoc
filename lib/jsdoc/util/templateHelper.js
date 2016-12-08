/*global env: true */
/**
 * @module jsdoc/util/templateHelper
 */
'use strict';

var catharsis = require('catharsis');
var dictionary = require('jsdoc/tag/dictionary');
var logger = require('jsdoc/util/logger');
var name = require('jsdoc/name');
var util = require('util');

var hasOwnProp = Object.prototype.hasOwnProperty;

var MODULE_NAMESPACE = 'module:';

var files = {};
var ids = {};

// each container gets its own html file
var containers = ['class', 'module', 'external', 'namespace', 'mixin', 'interface'];

var tutorials;

/** Sets tutorials map.
    @param {jsdoc.tutorial.Tutorial} root - Root tutorial node.
 */
exports.setTutorials = function(root) {
    tutorials = root;
};

exports.globalName = name.SCOPE.NAMES.GLOBAL;
exports.fileExtension = '.html';
exports.scopeToPunc = name.scopeToPunc;

var linkMap = {
    // two-way lookup
    longnameToUrl: {},
    urlToLongname: {},

    // one-way lookup (IDs are only unique per file)
    longnameToId: {}
};

// two-way lookup
var tutorialLinkMap = {
    nameToUrl: {},
    urlToName: {}
};

var longnameToUrl = exports.longnameToUrl = linkMap.longnameToUrl;
var longnameToId = exports.longnameToId = linkMap.longnameToId;

var registerLink = exports.registerLink = function(longname, fileUrl) {
    linkMap.longnameToUrl[longname] = fileUrl;
    linkMap.urlToLongname[fileUrl] = longname;
};

var registerId = exports.registerId = function(longname, fragment) {
    linkMap.longnameToId[longname] = fragment;
};

/**
 * Manipulates a string to parse out either the Esri module path or Esri module name
 * for Functions, Classes, and Objects in the ArcGIS API for JavaScript.
 *
 * This function is loaded as a helper in the esrijs-sdk jsdoc template based upon the
 * jaguar template. This helper function is used in the following templates:
 * layout.tmpl, members.tmpl, method.tmpl, navigation.tmpl, and returns.tmpl.
 *
 * Returns the folder, name, or absolute path given a string containing
 * an Esri Class, Object, or Function. Such as:
 *   // module:esri/Basemap#constructor#_lyrLoadHandler
 *   // module:esri/Basemap~loadedLayer
 *   // module:esri/Camera#normalizeCtorArgs~ret.position
 *   // module:esri/Graphic#classMetadata.properties.popupTemplate.type
 *   // module:esri/Graphic#setAttribute#attributes[undefined]
 *   // module:esri/kernel._appBaseUrl
 *   // module:esri/Map#_computeInitialState~firstLayer
 *   // module:esri/core/Promise.constructor~value
 *
 *   esri/foo/bar/ModuleClassName
 *
 *   folder would return esri/foo/bar
 *   name would return ModuleClassName
 *   path would return esri/foo/bar/ModuleClassName
 *
 * @param {string} parseType The parse operation to invoke.
 * @param {string} parseValue The string to convert.
 * @return {string} The string segment to return that has been parsed from the input value.
 */
var parseEsriAPIString = exports.parseEsriAPIString = function (parseType, parseValue){
  // --------------------------------------------------------------------
  // Regular expression to match
  //
  // esri/foo/bar/
  // --------------------------------------------------------------------
  var pathMatchRegEx = /esri\/(\w*\/)*(?=([-a-zA-Z0-9#_\[\] :<~>'."()]*$|$))/gm;
  // --------------------------------------------------------------------
  // Regular expression to match the /ModuleClassName in
  // esri/foo/bar/ModuleClassName
  // --------------------------------------------------------------------
  var nameMatchRegEx = /\/\w*(?=([-a-zA-Z0-9#_\[\] :<~>'."()]*$|$))/gm;

  var rawValue = parseValue;

  // --------------------------------------------------------------------
  // Return the esri/foo/bar portion of esri/foo/bar/ModuleClassName
  // --------------------------------------------------------------------
  if (parseType.toLowerCase() === "folder") {
    if (rawValue.match(pathMatchRegEx)) {
      var matchValue = rawValue.match(pathMatchRegEx)[0];
      return matchValue.substr(0, matchValue.length - 1);
    }
    else {
			logger.debug("%s failed to match path Regular Expression", rawValue);
      return rawValue;
    }
  }
  // --------------------------------------------------------------------
  // Return the esri/foo/bar portion of esri/foo/bar/ModuleClassName
  // --------------------------------------------------------------------
  else if (parseType.toLowerCase() === "name") {
    if (rawValue.match(nameMatchRegEx)) {
      // --------------------------------------------------------------------
      // Matches cases where we want to pull off the portion at the end of
      // module after the tilde
      //
      // module:esri/core/Accessor~WatchHandle
      // module:esri/core/watchUtils~PausableWatchHandle
      // --------------------------------------------------------------------
      var modPathNameTildeNameRegEx =  /esri\/(\w*\/)*(?=\w*~\w*$)/gm;
      if(rawValue.match(modPathNameTildeNameRegEx)){
        // --------------------------------------------------------------------
        // Matches special cases for type definitions that have the tilde separator
        // foo(?=bar)
        // Lookahead assertion. The pattern foo will only match if followed by
        // a match of pattern bar.
        // Strings matching: module:esri/tasks/support/ClosestFacilityParameters~
        // followed by: AttributeParameters
        // module:esri/tasks/support/ClosestFacilityParameters~AttributeParameters
        // --------------------------------------------------------------------
        var matchModPathNameTildeRegEx = /(\w*:)?esri\/(\w*\/)*\w*~(?=\w*$)/gm;
        return rawValue.replace(matchModPathNameTildeRegEx, "");
      }
      else {
        var matchValue = rawValue.match(nameMatchRegEx)[0];
        return matchValue.replace("/", "");
      }
    }
    else {
      logger.debug("%s failed to match name Regular Expression", rawValue);
      return rawValue;
    }
  }
  // --------------------------------------------------------------------
  // Return the esri/foo/bar/ModuleClassName portion from
  // module:esri/Basemap#constructor#_lyrLoadHandler
  // module:esri/Basemap~loadedLayer
  // module:esri/Camera#normalizeCtorArgs~ret.position
  // module:esri/Graphic#classMetadata.properties.popupTemplate.type
  // module:esri/Graphic#setAttribute#attributes[undefined]
  // module:esri/kernel._appBaseUrl
  // module:esri/Map#_computeInitialState~firstLayer
  // module:esri/core/Promise.constructor~value
  // --------------------------------------------------------------------
  else if (parseType.toLowerCase() === "path") {
    var path = "";
    if (rawValue.match(pathMatchRegEx)) {
      var matchValue = rawValue.match(pathMatchRegEx)[0];
      path = matchValue.substr(0, matchValue.length - 1);
    }
    else {
      logger.debug("%s failed to match path Regular Expression", rawValue);
      return rawValue;
    }
    if (rawValue.match(nameMatchRegEx)) {
      var matchValue = rawValue.match(nameMatchRegEx)[0];
      path += matchValue;
    }
    else {
      return rawValue;
      logger.debug("%s failed to match name Regular Expression", rawValue);
    }
    return path;
  }
  else {
    return parseValue;
  }
};

function getNamespace(kind) {
    if (dictionary.isNamespace(kind)) {
        return kind + ':';
    }
    return '';
}

function formatNameForLink(doclet, options) {
    var newName = getNamespace(doclet.kind) + (doclet.name || '') + (doclet.variation && options.prependScope || '');
    var scopePunc = exports.scopeToPunc[doclet.scope] || '';

    // Only prepend the scope punctuation if it's not the same character that marks the start of a
    // fragment ID. Using `#` in HTML5 fragment IDs is legal, but URLs like `foo.html##bar` are
    // just confusing.
    if (scopePunc !== '#' && options.prependScope) {
        newName = scopePunc + newName;
    }

    return newName;
}

function makeUniqueFilename(filename, str) {
    var key = filename.toLowerCase();
    var nonUnique = true;

    // don't allow filenames to begin with an underscore
    if (!filename.length || filename[0] === '_') {
        filename = '-' + filename;
        key = filename.toLowerCase();
    }

    // append enough underscores to make the filename unique
    while (nonUnique) {
        if ( hasOwnProp.call(files, key) ) {
            filename += '_';
            key = filename.toLowerCase();
        } else {
            nonUnique = false;
        }
    }

    files[key] = str;
    return filename;
}

/**
 * Convert a string to a unique filename, including an extension.
 *
 * Filenames are cached to ensure that they are used only once. For example, if the same string is
 * passed in twice, two different filenames will be returned.
 *
 * Also, filenames are not considered unique if they are capitalized differently but are otherwise
 * identical.
 * @param {string} str The string to convert.
 * @return {string} The filename to use for the string.
 */
var getUniqueFilename = exports.getUniqueFilename = function(str) {
    var namespaces = dictionary.getNamespaces().join('|');
    var basename = (str || '')
        // use - instead of : in namespace prefixes
        .replace(new RegExp('^(' + namespaces + '):'), '$1-')
        // replace characters that can cause problems on some filesystems
        .replace(/[\\\/?*:|'"<>]/g, '-')
        // use - instead of ~ to denote 'inner'
        .replace(/~/g, '-')
        // use _ instead of # to denote 'instance'
        .replace(/\#/g, '_')
        // use _ instead of / (for example, in module names)
        .replace(/\//g, '_')
        // remove the variation, if any
        .replace(/\([\s\S]*\)$/, '')
        // make sure we don't create hidden files, or files whose names start with a dash
        .replace(/^[\.\-]/, '');

    // in case we've now stripped the entire basename (uncommon, but possible):
    basename = basename.length ? basename : '_';

    return makeUniqueFilename(basename, str) + exports.fileExtension;
};

/**
 * Get a longname's filename if one has been registered; otherwise, generate a unique filename, then
 * register the filename.
 * @private
 */
function getFilename(longname) {
    var fileUrl;

    if ( hasOwnProp.call(longnameToUrl, longname) ) {
        fileUrl = longnameToUrl[longname];
    }
    else {
        fileUrl = getUniqueFilename(longname);
        registerLink(longname, fileUrl);
    }

    return fileUrl;
}

/**
 * Check whether a symbol is the only symbol exported by a module (as in
 * `module.exports = function() {};`).
 *
 * @private
 * @param {module:jsdoc/doclet.Doclet} doclet - The doclet for the symbol.
 * @return {boolean} `true` if the symbol is the only symbol exported by a module; otherwise,
 * `false`.
 */
function isModuleExports(doclet) {
    return doclet.longname && doclet.longname === doclet.name &&
        doclet.longname.indexOf(MODULE_NAMESPACE) === 0 && doclet.kind !== 'module';
}

function makeUniqueId(filename, id) {
    var key;
    var nonUnique = true;

    key = id.toLowerCase();

    // HTML5 IDs cannot contain whitespace characters
    id = id.replace(/\s/g, '');

    // append enough underscores to make the identifier unique
    while (nonUnique) {
        if ( hasOwnProp.call(ids, filename) && hasOwnProp.call(ids[filename], key) ) {
            id += '_';
            key = id.toLowerCase();
        }
        else {
            nonUnique = false;
        }
    }

    ids[filename] = ids[filename] || {};
    ids[filename][key] = id;

    return id;
}

/**
 * Get a doclet's ID if one has been registered; otherwise, generate a unique ID, then register
 * the ID.
 * @private
 */
function getId(longname, id) {
    if ( hasOwnProp.call(longnameToId, longname) ) {
        id = longnameToId[longname];
    }
    else if (!id) {
        // no ID required
        return '';
    }
    else {
        id = makeUniqueId(longname, id);
        registerId(longname, id);
    }

    return id;
}

/**
 * Convert a doclet to an identifier that is unique for a specified filename.
 *
 * Identifiers are not considered unique if they are capitalized differently but are otherwise
 * identical.
 *
 * @method
 * @param {string} filename - The file in which the identifier will be used.
 * @param {string} doclet - The doclet to convert.
 * @return {string} A unique identifier based on the file and doclet.
 */
var getUniqueId = exports.getUniqueId = makeUniqueId;

var htmlsafe = exports.htmlsafe = function(str) {
    if (typeof str !== 'string') {
        str = String(str);
    }

    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;');
};

function parseType(longname) {
    var err;

    try {
        return catharsis.parse(longname, {jsdoc: true});
    }
    catch (e) {
        err = new Error('unable to parse ' + longname + ': ' + e.message);
        require('jsdoc/util/logger').error(err);
        return longname;
    }
}

/**
 * Modified version of the original stringifyType function from the jsdoc repo
 * https://github.com/jsdoc3/jsdoc
 * This function has been modified to handle situation for the
 * ArcGIS API for JavaScript's Classes, Object, and Functions
 *
 * For more information on catharsis see the link below:
 * https://github.com/hegemonic/catharsis#stringifyparsedtype-options
 *
 * @method
 * @param {string} parsedType - The JSON object representing the JSDOC type expression.
 * @param {string} cssClass - Any CSS classes to add to the html anchor being returned.
 * @param {string} stringifyLinkMap - The linkMap of registered links, converts longname to url link.
 * @return {string} The html anchor element with the inserted url.
 */
function stringifyType(parsedType, cssClass, stringifyLinkMap) {

    // --------------------------------------------------------------------
    // Perform the normal catharsis stringify
    // --------------------------------------------------------------------
    var stringifiedType = require('catharsis').stringify(parsedType, {
        cssClass: cssClass,
        htmlSafe: true,
        links: stringifyLinkMap
    });

    // --------------------------------------------------------------------
    // For cases in the doc where we have a type or return type that is
    // an array of Esri objects, we want to format the links in a certain
    // manner.
    // Such as:
    // Array.&lt;<a href="module-esri-Graphic.html">Graphic</a>>
    //
    // Should look like:
    // <a href="module-esri-Graphic.html">Graphic[]</a>
    // --------------------------------------------------------------------

    // --------------------------------------------------------------------
    // Look for matches where we find esri/foo/bar/ClassObjectFunctionName
    // in the html anchor tag
    //
    // Such as:
    // Array.&lt;<a href="module-esri-Graphic.html">module:esri/Graphic</a>>
    // --------------------------------------------------------------------
    if (stringifiedType.match(/esri\/(\w*\/)*/m)){
        // --------------------------------------------------------------------
        // remove the module:esri/foo/bar or class:esri/foo/bar from
        // module:esri/foo/bar/Name
        //
        // Such as:
        // Array.&lt;<a href="module-esri-Graphic.html">module:esri/Graphic</a>>
        // would be:
        // Array.&lt;<a href="module-esri-Graphic.html">esri/Graphic</a>>
        // --------------------------------------------------------------------
        stringifiedType = stringifiedType.replace(/\w+:(\w*\/)*/gm, "");

        // --------------------------------------------------------------------
        // Given an anchor element such as:
        // Array.&lt;<a href="module-esri-Graphic.html">Graphic</a>>
        //
        // Look for the html anchor element such as
        // <a href="module-esri-Graphic.html">Graphic</a>
        // --------------------------------------------------------------------
        var anchorElementPatternMatch = stringifiedType.match(/<[^>]*>[a-zA-Z0-9:\/]*<[^>]*>/m);
        if (anchorElementPatternMatch) {
            var anchorElementSyntax = anchorElementPatternMatch[0];
            // --------------------------------------------------------------------
            // Given an anchor element such as:
            // <a href="module-esri-Graphic.html">Graphic</a>
            //
            // Look for the text inside of the html anchor element text such as
            // Graphic
            //
            // Regular Expression for negative look behind assertion
            // --------------------------------------------------------------------
            var linkTextPatternMatch = anchorElementSyntax.match(/[a-zA-Z0-9:\/]*(?=<\/a>)/m);
            if (linkTextPatternMatch) {
                var anchorElementLinkText = linkTextPatternMatch[0];
                // --------------------------------------------------------------------
                // Given an anchor element such as:
                // <a href="module-esri-Graphic.html">Graphic</a>
                //
                // Replace the text inside of the html anchor element text
                // From : Graphic to Graphic []
                // Such as:
                // <a href="module-esri-Graphic.html">Graphic[]</a>
                // --------------------------------------------------------------------
                var modifiedAnchorElement = anchorElementSyntax.replace(/[a-zA-Z0-9:\/]*(?=<\/a>)/m, anchorElementLinkText + "[]");
                //console.log("anchorElement: ", anchorElementSyntax,  " linkText: ", anchorElementLinkText, " modifiedLink: ", modifiedAnchorElement);
                stringifiedType = modifiedAnchorElement;
            }
        }
    }
    return stringifiedType;
}

function hasUrlPrefix(text) {
    return (/^(http|ftp)s?:\/\//).test(text);
}

function isComplexTypeExpression(expr) {
    // record types, type unions, and type applications all count as "complex"
    return /^{.+}$/.test(expr) || /^.+\|.+$/.test(expr) || /^.+<.+>$/.test(expr);
}

function fragmentHash(fragmentId) {
    if (!fragmentId) {
        return '';
    }

    return '#' + fragmentId;
}

/**
 * Build an HTML link to the symbol with the specified longname. If the longname is not
 * associated with a URL, this method simply returns the link text, if provided, or the longname.
 *
 * The `longname` parameter can also contain a URL rather than a symbol's longname.
 *
 * This method supports type applications that can contain one or more types, such as
 * `Array.<MyClass>` or `Array.<(MyClass|YourClass)>`. In these examples, the method attempts to
 * replace `Array`, `MyClass`, and `YourClass` with links to the appropriate types. The link text
 * is ignored for type applications.
 *
 * @param {string} longname - The longname (or URL) that is the target of the link.
 * @param {string=} linkText - The text to display for the link, or `longname` if no text is
 * provided.
 * @param {Object} options - Options for building the link.
 * @param {string=} options.cssClass - The CSS class (or classes) to include in the link's `<a>`
 * tag.
 * @param {string=} options.fragmentId - The fragment identifier (for example, `name` in
 * `foo.html#name`) to append to the link target.
 * @param {string=} options.linkMap - The link map in which to look up the longname.
 * @param {boolean=} options.monospace - Indicates whether to display the link text in a monospace
 * font.
 * @return {string} The HTML link, or the link text if the link is not available.
 */
function buildLink(longname, linkText, options) {
    var classString = options.cssClass ? util.format(' class="%s"', options.cssClass) : '';
    var fileUrl;
    var fragmentString = fragmentHash(options.fragmentId);
    var stripped;
    var text;

    var parsedType;

    // --------------------------------------------------------------------
    // Used to identify a matching array signature
    // Array.<ClosestFacilityParameters~AttributeParameters>
    // array.<number>
    // array.<*>
    // array.<object>
    // array.<string>
    // array.<promise>
    // array.<array.<number>>
    // array.<array.<array.<number>>>
    //
    // Array\.<[\w~:/*]*>
    // --------------------------------------------------------------------
    var matchArrayRegEx = /Array\.<[\w~:/*]*>/gi;

    // --------------------------------------------------------------------
    // foo(?=bar)
    // Lookahead assertion. The pattern foo will only match if followed by
    // a match of pattern bar.
    // Used to identify a matching array signature which contains the
    // array type signature (numbers, objects, wild card (*), etc
    // matches array containing a word, word containing words and tilde, or an asterisk
    // This will also let us know if we have a single or multi-dimensional
    // array based upon the match array length
    //
    // If the content inside of the <bar> matches then there will be one or
    // more array matches "array.<" single to multidimensional
    //
    // Array\.<(?=[\w~*])
    // --------------------------------------------------------------------
    var matchSingleToMultiDimensionalArrayRegEx = /Array\.<(?=[\w~*])/gi;

    // --------------------------------------------------------------------
    // foo(?=bar)
    // Lookahead assertion. The pattern foo will only match if followed by
    // a match of pattern bar.
    // Used to match the array type, e.g., the portion inside of the <foo>
    // brackets
    // matches the content inside of the array syntax
    //
    // [\w~:/*]*(?=>)
    // --------------------------------------------------------------------
    var matchArrayTypeRegEx = /[\w~:/*]*(?=>)/i;

    // handle cases like:
    // @see <http://example.org>
    // @see http://example.org
    stripped = longname ? longname.replace(/^<|>$/g, '') : '';
    if ( hasUrlPrefix(stripped) ) {
        fileUrl = stripped;
        text = linkText || stripped;
    }
    // handle complex type expressions that may require multiple links
    // (but skip anything that looks like an inline tag or HTML tag)
    // TODO: be smarter about arrays. e.g Array.<module:esri/Graphic>
    else if (longname && isComplexTypeExpression(longname) && /\{\@.+\}/.test(longname) === false &&
        /^<[\s\S]+>/.test(longname) === false) {
        if ( longname.toLowerCase() === 'object.<string, string>') {
                fileUrl = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String';
                text = "String[]";
        } else if (longname.match(matchArrayRegEx) && longname.match(matchSingleToMultiDimensionalArrayRegEx)){
            // --------------------------------------------------------------------
            // The matchArray will be an array:
            // ['array.<','array.<','array.<']
            // --------------------------------------------------------------------
            var matchArray = longname.match(matchSingleToMultiDimensionalArrayRegEx);
            var matchTypeArray = longname.match(matchArrayTypeRegEx);
            if(matchArray && matchTypeArray){
              // --------------------------------------------------------------------
              // arraySuffixRaw will be a string:
              // 'array.<[],array.<[],array.<[]'
              // --------------------------------------------------------------------
              var arraySuffixRaw = matchArray.join('[]') + "[]";
              // --------------------------------------------------------------------
              // arraySuffixSignature will be a string:
              // '[],[],[]'
              // --------------------------------------------------------------------
              var arraySuffixSignature = arraySuffixRaw.replace(/Array\.</ig, "");
              // --------------------------------------------------------------------
              // arrayPrefixType will be a string:
              // *, object, string, promise, number, or something more complex
              // module:esri/tasks/support/ClosestFacilityParameters~AttributeParameters
              // --------------------------------------------------------------------
              var arrayPrefixType = matchTypeArray[0];
              var matchLowerCaseWordRegEx = /^[a-z]*$/m;
              // --------------------------------------------------------------------
              // If the array data type is lowercase, convert it to sentence case
              // e.g., string converted to String
              // this way when we do the linkMap lookup it can find the url that
              // matches the name.
              // URLs are registered in publish.js
              // helper.registerLink('Node', 'https://developer.mozilla.org/en-US/docs/Web/API/Node');
              // then we look them up here using longnameToUrl which looks them up
              // in the linkMap
              // --------------------------------------------------------------------
              if (arrayPrefixType.match(matchLowerCaseWordRegEx)){
                var arrayPrefixSignature = arrayPrefixType.charAt(0).toUpperCase() + arrayPrefixType.substr(1).toLowerCase();
                text = arrayPrefixSignature + arraySuffixSignature;
                fileUrl = longnameToUrl[arrayPrefixSignature];
              }
              else if (arrayPrefixType === "*"){
                // --------------------------------------------------------------------
                // If the signature is: array.<*>
                // then return *[] or *[][] or *[][][]
                // the suffixSignature is generated
                // --------------------------------------------------------------------
                text = "*" + arraySuffixSignature;
              }
              else {
                // --------------------------------------------------------------------
                // If the signature is a complex Esri type such as
                // Array.<module:esri/tasks/support/ClosestFacilityParameters~AttributeParameters>
                // lookup the "module:esri/tasks/support/ClosestFacilityParameters~AttributeParameters"
                // key in the linkMap
                // --------------------------------------------------------------------
                var arrayPrefixSignature = parseEsriAPIString("name", arrayPrefixType);
                text = arrayPrefixSignature + arraySuffixSignature;
                fileUrl = longnameToUrl[arrayPrefixType];
              }
            }
            else {
              logger.warn("We matched an array signature, but for some reason they are invalid.");
            }
        } else {
            // TODO: be smarter, parse it and check the individual parts
            //      Object.<string, number>
            //      Object<string,HTMLSpanElement>
            parsedType = parseType(longname);
            return stringifyType(parsedType, options.cssClass, options.linkMap);
        }
    }
    else {
        fileUrl = hasOwnProp.call(options.linkMap, longname) ? options.linkMap[longname] : '';
        text = linkText || longname;

        // --------------------------------------------------------------------
        // MDN links for built-in Javascript types such as string and Object
        //
        // For other registered links, also see the publish function in the repo
        // https://github.com/bsvensson/jaguarjs-jsdoc
        // publish.js
        // https://github.com/bsvensson/jaguarjs-jsdoc/blob/esrijs-sdk/publish.js#L299
        // --------------------------------------------------------------------
        if (!fileUrl) {
            if (text.toLowerCase() === 'boolean') {
                fileUrl = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean';
                text = text[0].toUpperCase() + text.substring(1);
            } else if (text.toLowerCase() === 'function') {
                fileUrl = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function';
                text = text[0].toUpperCase() + text.substring(1);
            } else if (text.toLowerCase() === 'number') {
                fileUrl = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number';
                text = text[0].toUpperCase() + text.substring(1);
            } else if (text.toLowerCase() === 'string') {
                fileUrl = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String';
                text = text[0].toUpperCase() + text.substring(1);
            } else if (text === 'Array') {
                fileUrl = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array';
            }
        }
    }
    if (fileUrl && text.match(/esri\/(\w*\/)*/m)){
        text = parseEsriAPIString("name", text);
    }
    text = options.monospace ? '<code>' + text + '</code>' : text;

    if (!fileUrl) {
        return text;
    }
    else {
        return util.format('<a href="%s"%s>%s</a>', encodeURI(fileUrl + fragmentString),
            classString, text);
    }
}

/**
 * Retrieve an HTML link to the symbol with the specified longname. If the longname is not
 * associated with a URL, this method simply returns the link text, if provided, or the longname.
 *
 * The `longname` parameter can also contain a URL rather than a symbol's longname.
 *
 * This method supports type applications that can contain one or more types, such as
 * `Array.<MyClass>` or `Array.<(MyClass|YourClass)>`. In these examples, the method attempts to
 * replace `Array`, `MyClass`, and `YourClass` with links to the appropriate types. The link text
 * is ignored for type applications.
 *
 * @param {string} longname - The longname (or URL) that is the target of the link.
 * @param {string=} linkText - The text to display for the link, or `longname` if no text is
 * provided.
 * @param {string=} cssClass - The CSS class (or classes) to include in the link's `<a>` tag.
 * @param {string=} fragmentId - The fragment identifier (for example, `name` in `foo.html#name`) to
 * append to the link target.
 * @return {string} The HTML link, or a plain-text string if the link is not available.
 */
var linkto = exports.linkto = function(longname, linkText, cssClass, fragmentId) {
    return buildLink(longname, linkText, {
        cssClass: cssClass,
        fragmentId: fragmentId,
        linkMap: longnameToUrl
    });
};

function useMonospace(tag, text) {
    var cleverLinks;
    var monospaceLinks;
    var result;

    if ( hasUrlPrefix(text) ) {
        result = false;
    }
    else if (tag === 'linkplain') {
        result = false;
    }
    else if (tag === 'linkcode') {
        result = true;
    }
    else {
        cleverLinks = env.conf.templates.cleverLinks;
        monospaceLinks = env.conf.templates.monospaceLinks;

        if (monospaceLinks || cleverLinks) {
            result = true;
        }
    }

    return result || false;
}

function splitLinkText(text) {
    var linkText;
    var target;
    var splitIndex;

    // if a pipe is not present, we split on the first space
    splitIndex = text.indexOf('|');
    if (splitIndex === -1) {
        splitIndex = text.search(/\s/);
    }

    if (splitIndex !== -1) {
        linkText = text.substr(splitIndex + 1);
        // Normalize subsequent newlines to a single space.
        linkText = linkText.replace(/\n+/, ' ');
        target = text.substr(0, splitIndex);
    }

    return {
        linkText: linkText,
        target: target || text
    };
}

var tutorialToUrl = exports.tutorialToUrl = function(tutorial) {
    var fileUrl;
    var node = tutorials.getByName(tutorial);

    // no such tutorial
    if (!node) {
        require('jsdoc/util/logger').error( new Error('No such tutorial: ' + tutorial) );
        return null;
    }

    // define the URL if necessary
    if (!hasOwnProp.call(tutorialLinkMap.nameToUrl, node.name)) {
        fileUrl = 'tutorial-' + getUniqueFilename(node.name);
        tutorialLinkMap.nameToUrl[node.name] = fileUrl;
        tutorialLinkMap.urlToName[fileUrl] = node.name;
    }

    return tutorialLinkMap.nameToUrl[node.name];
};

/**
 * Retrieve a link to a tutorial, or the name of the tutorial if the tutorial is missing. If the
 * `missingOpts` parameter is supplied, the names of missing tutorials will be prefixed by the
 * specified text and wrapped in the specified HTML tag and CSS class.
 *
 * @todo Deprecate missingOpts once we have a better error-reporting mechanism.
 * @param {string} tutorial The name of the tutorial.
 * @param {string} content The link text to use.
 * @param {object} [missingOpts] Options for displaying the name of a missing tutorial.
 * @param {string} missingOpts.classname The CSS class to wrap around the tutorial name.
 * @param {string} missingOpts.prefix The prefix to add to the tutorial name.
 * @param {string} missingOpts.tag The tag to wrap around the tutorial name.
 * @return {string} An HTML link to the tutorial, or the name of the tutorial with the specified
 * options.
 */
var toTutorial = exports.toTutorial = function(tutorial, content, missingOpts) {
    if (!tutorial) {
        require('jsdoc/util/logger').error( new Error('Missing required parameter: tutorial') );
        return null;
    }

    var node = tutorials.getByName(tutorial);
    // no such tutorial
    if (!node) {
        missingOpts = missingOpts || {};
        var tag = missingOpts.tag;
        var classname = missingOpts.classname;

        var link = tutorial;
        if (missingOpts.prefix) {
            link = missingOpts.prefix + link;
        }
        if (tag) {
            link = '<' + tag + (classname ? (' class="' + classname + '">') : '>') + link;
            link += '</' + tag + '>';
        }
        return link;
    }

    content = content || node.title;

    return '<a href="' + tutorialToUrl(tutorial) + '">' + content + '</a>';
};

/** Find symbol {@link ...} and {@tutorial ...} strings in text and turn into html links */
exports.resolveLinks = function(str) {
    var replaceInlineTags = require('jsdoc/tag/inline').replaceInlineTags;

    function extractLeadingText(string, completeTag) {
        var tagIndex = string.indexOf(completeTag);
        var leadingText = null;
        var leadingTextRegExp = /\[(.+?)\]/g;
        var leadingTextInfo = leadingTextRegExp.exec(string);

        // did we find leading text, and if so, does it immediately precede the tag?
        while (leadingTextInfo && leadingTextInfo.length) {
            if (leadingTextInfo.index + leadingTextInfo[0].length === tagIndex) {
                string = string.replace(leadingTextInfo[0], '');
                leadingText = leadingTextInfo[1];
                break;
            }

            leadingTextInfo = leadingTextRegExp.exec(string);
        }

        return {
            leadingText: leadingText,
            string: string
        };
    }

    function processLink(string, tagInfo) {
        var leading = extractLeadingText(string, tagInfo.completeTag);
        var linkText = leading.leadingText;
        var monospace;
        var split;
        var target;
        string = leading.string;

        split = splitLinkText(tagInfo.text);
        target = split.target;
        linkText = linkText || split.linkText;

        monospace = useMonospace(tagInfo.tag, tagInfo.text);

        return string.replace( tagInfo.completeTag, buildLink(target, linkText, {
            linkMap: longnameToUrl,
            monospace: monospace
        }) );
    }

    function processTutorial(string, tagInfo) {
        var leading = extractLeadingText(string, tagInfo.completeTag);
        string = leading.string;

        return string.replace( tagInfo.completeTag, toTutorial(tagInfo.text, leading.leadingText) );
    }

    var replacers = {
        link: processLink,
        linkcode: processLink,
        linkplain: processLink,
        tutorial: processTutorial
    };

    return replaceInlineTags(str, replacers).newString;
};

/** Convert tag text like "Jane Doe <jdoe@example.org>" into a mailto link */
exports.resolveAuthorLinks = function(str) {
    var author;
    var matches = str.match(/^\s?([\s\S]+)\b\s+<(\S+@\S+)>\s?$/);
    if (matches && matches.length === 3) {
        author = '<a href="mailto:' + matches[2] + '">' + htmlsafe(matches[1]) + '</a>';
    }
    else {
        author = htmlsafe(str);
    }

    return author;
};

/**
 * Find items in a TaffyDB database that match the specified key-value pairs.
 * @param {TAFFY} data The TaffyDB database to search.
 * @param {object|function} spec Key-value pairs to match against (for example,
 * `{ longname: 'foo' }`), or a function that returns `true` if a value matches or `false` if it
 * does not match.
 * @return {array<object>} The matching items.
 */
var find = exports.find = function(data, spec) {
    return data(spec).get();
};

/**
 * Retrieve all of the following types of members from a set of doclets:
 *
 * + Classes
 * + Externals
 * + Globals
 * + Mixins
 * + Modules
 * + Namespaces
 * + Events
 * @param {TAFFY} data The TaffyDB database to search.
 * @return {object} An object with `classes`, `externals`, `globals`, `mixins`, `modules`,
 * `events`, and `namespaces` properties. Each property contains an array of objects.
 */
exports.getMembers = function(data) {
    var members = {
        classes: find( data, {kind: 'class'} ),
        externals: find( data, {kind: 'external'} ),
        events: find( data, {kind: 'event'} ),
        globals: find(data, {
            kind: ['member', 'function', 'constant', 'typedef'],
            memberof: { isUndefined: true }
        }),
        mixins: find( data, {kind: 'mixin'} ),
        modules: find( data, {kind: 'module'} ),
        namespaces: find( data, {kind: 'namespace'} ),
        interfaces: find( data, {kind: 'interface'} )
    };

    // strip quotes from externals, since we allow quoted names that would normally indicate a
    // namespace hierarchy (as in `@external "jquery.fn"`)
    // TODO: we should probably be doing this for other types of symbols, here or elsewhere; see
    // jsdoc3/jsdoc#396
    members.externals = members.externals.map(function(doclet) {
        doclet.name = doclet.name.replace(/(^"|"$)/g, '');
        return doclet;
    });

    // functions that are also modules (as in `module.exports = function() {};`) are not globals
    members.globals = members.globals.filter(function(doclet) {
        return !isModuleExports(doclet);
    });

    return members;
};

/**
 * Retrieve the member attributes for a doclet (for example, `virtual`, `static`, and
 * `readonly`).
 * @param {object} d The doclet whose attributes will be retrieved.
 * @return {array<string>} The member attributes for the doclet.
 */
exports.getAttribs = function(d) {
    var attribs = [];

    if (!d) {
        return attribs;
    }

    if (d.virtual) {
        attribs.push('abstract');
    }

    if (d.access && d.access !== 'public') {
        attribs.push(d.access);
    }

    if (d.scope && d.scope !== 'instance' && d.scope !== name.SCOPE.NAMES.GLOBAL) {
        if (d.kind === 'function' || d.kind === 'member' || d.kind === 'constant') {
            attribs.push(d.scope);
        }
    }

    if (d.readonly === true) {
        if (d.kind === 'member') {
            attribs.push('readonly');
        }
    }

    if (d.kind === 'constant') {
        attribs.push('constant');
    }

    if (d.nullable === true) {
        attribs.push('nullable');
    }
    else if (d.nullable === false) {
        attribs.push('non-null');
    }

    return attribs;
};

/**
 * Retrieve links to allowed types for the member.
 *
 * @param {Object} d - The doclet whose types will be retrieved.
 * @param {string} [cssClass] - The CSS class to include in the `class` attribute for each link.
 * @return {Array.<string>} HTML links to allowed types for the member.
 */
exports.getSignatureTypes = function(d, cssClass) {
    var types = [];

    if (d.type && d.type.names) {
        types = d.type.names;
    }

    if (types && types.length) {
        types = types.map(function(t) {
            return linkto(t, htmlsafe(t), cssClass);
        });
    }

    return types;
};

/**
 * Retrieve names of the parameters that the member accepts. If a value is provided for `optClass`,
 * the names of optional parameters will be wrapped in a `<span>` tag with that class.
 * @param {object} d The doclet whose parameter names will be retrieved.
 * @param {string} [optClass] The class to assign to the `<span>` tag that is wrapped around the
 * names of optional parameters. If a value is not provided, optional parameter names will not be
 * wrapped with a `<span>` tag. Must be a legal value for a CSS class name.
 * @return {array<string>} An array of parameter names, with or without `<span>` tags wrapping the
 * names of optional parameters.
 */
exports.getSignatureParams = function(d, optClass) {
    var pnames = [];

    if (d.params) {
        d.params.forEach(function(p) {
            if (p.name && p.name.indexOf('.') === -1) {
                if (p.optional && optClass) {
									  // add support for optional, repeatable parameters
                    if (p.variable) {
                        pnames.push('<span class="' + optClass + ' repeatable">' + p.name + '</span>');
                    }
                    else {
                        pnames.push('<span class="' + optClass + '">' + p.name + '</span>');
                    }
                }
                else if (p.variable) {
									  // add support for repeatable parameters
                    pnames.push('<span class="repeatable">' + p.name + '</span>');
                }
                else {
                    pnames.push(p.name);
                }
            }
        });
    }

    return pnames;
};

/**
 * Retrieve links to types that the member can return.
 *
 * @param {Object} d - The doclet whose types will be retrieved.
 * @param {string} [cssClass] - The CSS class to include in the `class` attribute for each link.
 * @return {Array.<string>} HTML links to types that the member can return.
 */
exports.getSignatureReturns = function(d, cssClass) {
    var returnTypes = [];
    if (d.returns) {
        d.returns.forEach(function(r) {
            if (r && r.type && r.type.names) {
                if (!returnTypes.length) {
                    returnTypes = r.type.names;
                }
            }
        });
    }

    if (returnTypes && returnTypes.length) {
        returnTypes = returnTypes.map(function(r) {
            return linkto(r, htmlsafe(parseEsriAPIString("name", r)), cssClass);
        });
    }

    return returnTypes;
};

/**
 * Retrieve an ordered list of doclets for a symbol's ancestors.
 *
 * @param {TAFFY} data - The TaffyDB database to search.
 * @param {Object} doclet - The doclet whose ancestors will be retrieved.
 * @return {Array.<module:jsdoc/doclet.Doclet>} A array of ancestor doclets, sorted from most to
 * least distant.
 */
exports.getAncestors = function(data, doclet) {
    var ancestors = [];
    var doc = doclet;

    while (doc) {
        doc = find(data, {longname: doc.memberof})[0];

        if (doc) {
            ancestors.unshift(doc);
        }
    }

    return ancestors;
};

/**
 * Retrieve links to a member's ancestors.
 *
 * @param {TAFFY} data - The TaffyDB database to search.
 * @param {Object} doclet - The doclet whose ancestors will be retrieved.
 * @param {string} [cssClass] - The CSS class to include in the `class` attribute for each link.
 * @return {Array.<string>} HTML links to a member's ancestors.
 */
exports.getAncestorLinks = function(data, doclet, cssClass) {
    var ancestors = exports.getAncestors(data, doclet);
    var links = [];

    ancestors.forEach(function(ancestor) {
        var linkText = (exports.scopeToPunc[ancestor.scope] || '') + ancestor.name;
        var link = linkto(ancestor.longname, linkText, cssClass);
        links.push(link);
    });

    if (links.length) {
        links[links.length - 1] += (exports.scopeToPunc[doclet.scope] || '');
    }

    return links;
};

/**
 * Iterates through all the doclets in `data`, ensuring that if a method
 * @listens to an event, then that event has a 'listeners' array with the
 * longname of the listener in it.
 *
 * @param {TAFFY} data - The TaffyDB database to search.
 */
exports.addEventListeners = function(data) {
    // TODO: do this on the *pruned* data
    // find all doclets that @listen to something.
    var listeners = find(data, function () { return this.listens && this.listens.length; });

    if (!listeners.length) {
        return;
    }

    var doc,
        l,
        _events = {}; // just a cache to prevent me doing so many lookups

    listeners.forEach(function (listener) {
        l = listener.listens;
        l.forEach(function (eventLongname) {
            doc = _events[eventLongname] || find(data, {longname: eventLongname, kind: 'event'})[0];
            if (doc) {
                if (!doc.listeners) {
                    doc.listeners = [listener.longname];
                } else {
                    doc.listeners.push(listener.longname);
                }
                _events[eventLongname] = _events[eventLongname] || doc;
            }
        });
    });
};

/**
 * Remove members that will not be included in the output, including:
 *
 * + Undocumented members.
 * + Members tagged `@ignore`.
 * + Members of anonymous classes.
 * + Members tagged `@private`, unless the `private` option is enabled.
 * + Members tagged with anything other than specified by the `access` options.
 * @param {TAFFY} data The TaffyDB database to prune.
 * @return {TAFFY} The pruned database.
 */
exports.prune = function(data) {
    data({undocumented: true}).remove();
    data({ignore: true}).remove();
    data({memberof: '<anonymous>'}).remove();

    if (!env.opts.access || (env.opts.access && env.opts.access.indexOf('all') === -1)) {
        if (env.opts.access && env.opts.access.indexOf('public') === -1) {
            data({access: 'public'}).remove();
        }
        if (env.opts.access && env.opts.access.indexOf('protected') === -1) {
            data({access: 'protected'}).remove();
        }
        if (!env.opts.private && (!env.opts.access || (env.opts.access && env.opts.access.indexOf('private') === -1))) {
            data({access: 'private'}).remove();
        }
        if (env.opts.access && env.opts.access.indexOf('undefined') === -1) {
            data({access: {isUndefined: true}}).remove();
        }
    }

    return data;
};

/**
 * Create a URL that points to the generated documentation for the doclet.
 *
 * If a doclet corresponds to an output file (for example, if the doclet represents a class), the
 * URL will consist of a filename.
 *
 * If a doclet corresponds to a smaller portion of an output file (for example, if the doclet
 * represents a method), the URL will consist of a filename and a fragment ID.
 *
 * @param {module:jsdoc/doclet.Doclet} doclet - The doclet that will be used to create the URL.
 * @return {string} The URL to the generated documentation for the doclet.
 */
exports.createLink = function(doclet) {
    var fakeContainer;
    var filename;
    var fileUrl;
    var fragment = '';
    var longname = doclet.longname;
    var match;

    // handle doclets in which doclet.longname implies that the doclet gets its own HTML file, but
    // doclet.kind says otherwise. this happens due to mistagged JSDoc (for example, a module that
    // somehow has doclet.kind set to `member`).
    // TODO: generate a warning (ideally during parsing!)
    if (containers.indexOf(doclet.kind) === -1) {
        match = /(\S+):/.exec(longname);
        if (match && containers.indexOf(match[1]) !== -1) {
            fakeContainer = match[1];
        }
    }

    // the doclet gets its own HTML file
    if ( containers.indexOf(doclet.kind) !== -1 || isModuleExports(doclet) ) {
        filename = getFilename(longname);
    }
    // mistagged version of a doclet that gets its own HTML file
    else if ( containers.indexOf(doclet.kind) === -1 && fakeContainer ) {
        filename = getFilename(doclet.memberof || longname);
        if (doclet.name !== doclet.longname) {
            fragment = formatNameForLink(doclet, {prependScope: false});
            fragment = getId(longname, fragment);
        }
    }
    // the doclet is within another HTML file
    else {
        filename = getFilename(doclet.memberof || exports.globalName);
        if ( (doclet.name !== doclet.longname) || (doclet.scope === name.SCOPE.NAMES.GLOBAL) ) {
            fragment = formatNameForLink(doclet, {prependScope: false});
            fragment = getId(longname, fragment);
        }
    }

    fileUrl = encodeURI( filename + fragmentHash(fragment) );

    return fileUrl;
};

// TODO: docs
exports.longnamesToTree = name.longnamesToTree;

/**
 * Replace the existing tag dictionary with a new tag dictionary.
 *
 * Used for testing only. Do not call this method directly. Instead, call
 * {@link module:jsdoc/doclet._replaceDictionary}, which also updates this module's tag dictionary.
 *
 * @private
 * @param {module:jsdoc/tag/dictionary.Dictionary} dict - The new tag dictionary.
 */
exports._replaceDictionary = function _replaceDictionary(dict) {
    dictionary = dict;
};
