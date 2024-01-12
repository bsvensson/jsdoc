/**
 * @module jsdoc/util/templateHelper
 */
const catharsis = require('catharsis');
let dictionary = require('jsdoc/tag/dictionary');
const env = require('jsdoc/env');
const inline = require('jsdoc/tag/inline');
const logger = require('jsdoc/util/logger');
const name = require('jsdoc/name');
const util = require('util');

const hasOwnProp = Object.prototype.hasOwnProperty;

const MODULE_NAMESPACE = 'module:';

const files = {};
const ids = {};

// each container gets its own html file
const containers = ['class', 'module', 'external', 'namespace', 'mixin', 'interface'];

let tutorials;

/** Sets tutorials map.
    @param {jsdoc.tutorial.Tutorial} root - Root tutorial node.
 */
exports.setTutorials = root => {
    tutorials = root;
};

exports.globalName = name.SCOPE.NAMES.GLOBAL;
exports.fileExtension = '.html';
exports.scopeToPunc = name.scopeToPunc;

const linkMap = exports.linkMap = {
    // two-way lookup
    longnameToUrl: {},
    urlToLongname: {},

    // one-way lookup (IDs are only unique per file)
    longnameToId: {}
};

// two-way lookup
const tutorialLinkMap = {
    nameToUrl: {},
    urlToName: {}
};

const longnameToUrl = exports.longnameToUrl = linkMap.longnameToUrl;
const longnameToId = exports.longnameToId = linkMap.longnameToId;

const registerLink = exports.registerLink = (longname, fileUrl) => {
    linkMap.longnameToUrl[longname] = fileUrl;
    linkMap.urlToLongname[fileUrl] = longname;
};

const registerId = exports.registerId = (longname, fragment) => {
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
const parseEsriAPIString = exports.parseEsriAPIString = (parseType, parseValue) => {
  // --------------------------------------------------------------------
  // Regular expression to match
  //
  // esri/foo/bar/
  // --------------------------------------------------------------------
  const pathMatchRegEx = /esri\/(\w*\/)*(?=([-a-zA-Z0-9#_\[\] :<~>'.,"()]*$|$))/gm;
  // --------------------------------------------------------------------
  // Regular expression to match the /ModuleClassName in
  // esri/foo/bar/ModuleClassName
  // --------------------------------------------------------------------
  const nameMatchRegEx = /\/\w*(?=([-a-zA-Z0-9#_\[\] :<~>'.,"()]*$|$))/gm;

  const rawValue = parseValue;

  // --------------------------------------------------------------------
  // Return the esri/foo/bar portion of esri/foo/bar/ModuleClassName
  // --------------------------------------------------------------------
  if (parseType.toLowerCase() === "folder") {
    if (rawValue.match(pathMatchRegEx)) {
      let matchValue = rawValue.match(pathMatchRegEx)[0];
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
      const modPathNameTildeNameRegEx =  /esri\/(\w*\/)*(?=\w*~\w*$)/gm;
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
        const matchModPathNameTildeRegEx = /(\w*:)?esri\/(\w*\/)*\w*~(?=\w*$)/gm;
        return rawValue.replace(matchModPathNameTildeRegEx, "");
      }
      else {
        let matchValue = rawValue.match(nameMatchRegEx)[0];
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
    let path = "";
    if (rawValue.match(pathMatchRegEx)) {
      let matchValue = rawValue.match(pathMatchRegEx)[0];
      path = matchValue.substr(0, matchValue.length - 1);
    }
    else {
      logger.debug("%s failed to match path Regular Expression", rawValue);
      return rawValue;
    }
    if (rawValue.match(nameMatchRegEx)) {
      let matchValue = rawValue.match(nameMatchRegEx)[0];
      path += matchValue;
    }
    else {
      logger.debug("%s failed to match name Regular Expression", rawValue);
      return rawValue;
    }
    return path;
  }
  else {
    return parseValue;
  }
};

function getNamespace(kind) {
    if (dictionary.isNamespace(kind)) {
        // --------------------------------------------------------------------
        // Adapted to remove the : in the url has for events
        // esri-views-MapView.html#event:double-click vs
        // esri-views-MapView.html#event-double-click
        // --------------------------------------------------------------------
        if(/event/i.test(kind)) {
            return `${kind}-`;
        } else {
            return `${kind}:`;
        }
    }

    return '';
}

function formatNameForLink(doclet) {
    // let newName = getNamespace(doclet.kind) + (doclet.name || '') + (doclet.variation || '');
    let newName = getNamespace(doclet.kind) + (doclet.name || '');
    const scopePunc = exports.scopeToPunc[doclet.scope] || '';

    // Only prepend the scope punctuation if it's not the same character that marks the start of a
    // fragment ID. Using `#` in HTML5 fragment IDs is legal, but URLs like `foo.html##bar` are
    // just confusing.
    if (scopePunc !== '#') {
        newName = scopePunc + newName;
    }

    return newName;
}

function makeUniqueFilename(filename, str) {
    let key = filename.toLowerCase();
    let nonUnique = true;

    // don't allow filenames to begin with an underscore
    if (!filename.length || filename[0] === '_') {
        filename = `-${filename}`;
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
 *
 * @function
 * @param {string} str The string to convert.
 * @return {string} The filename to use for the string.
 */
const getUniqueFilename = exports.getUniqueFilename = str => {
    const namespaces = dictionary.getNamespaces().join('|');
    let basename = (str || '')
        // use - instead of : in namespace prefixes
        .replace(new RegExp(`^(${namespaces}):`), '$1-')
        // replace characters that can cause problems on some filesystems
        .replace(/[\\/?*:|'"<>]/g, '-')
        // use - instead of ~ to denote 'inner'
        .replace(/~/g, '-')
        // use _ instead of # to denote 'instance'
        .replace(/#/g, '_')
        // use _ instead of / (for example, in module names)
        .replace(/\//g, '_')
        // remove the variation, if any
        .replace(/\([\s\S]*\)$/, '')
        // make sure we don't create hidden files, or files whose names start with a dash
        .replace(/^[.-]/, '');

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
    let fileUrl;

    if (hasOwnProp.call(longnameToUrl, longname)) {
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
    let key;
    let nonUnique = true;

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
exports.getUniqueId = makeUniqueId;

const htmlsafe = exports.htmlsafe = str => {
    if (typeof str !== 'string') {
        str = String(str);
    }

    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;');
};

const parseType = exports.parseType = longname => {
    let err;

    try {
        return catharsis.parse(longname, {jsdoc: true});
    }
    catch (e) {
        err = new Error(`unable to parse ${longname}: ${e.message}`);
        logger.error(err);

        return longname;
    }
};

// --------------------------------------------------------------------
// cleanseStringify
// --------------------------------------------------------------------
/**
 * Helper function to supplement the original stringifyType function.
 * This function was necessary to update the signatures of more complex
 * data types such as Promises that return Collections or Array of some
 * data type, as well as Arrays of data types and multi-dimensional
 * Arrays.
 *
 * @param parsedType
 * @param stringifiedValue
 * @returns {*}
 */
function cleanseStringify(parsedType, stringifiedValue){
  // --------------------------------------------------------------------
  // Replace the module:esri/foo/bar/ClassName with ClassName
  // --------------------------------------------------------------------
  if (stringifiedValue.match(/module:(\w*\/)*/gm)) {
    stringifiedValue = stringifiedValue.replace(/module:(\w*\/)*/gm, "");

    if (stringifiedValue.match(/\w*~/gm)) {
      stringifiedValue = stringifiedValue.replace(/\w*~/gm, "");
    }
  }

  // --------------------------------------------------------------------
  // Fix cases where lowercased versions of data types were used in the
  // JSDoc such as object, function, number, string, boolean
  // --------------------------------------------------------------------
  if (/>(object|function|number|string|boolean)<\/a>/g.test(stringifiedValue)) {
    // find the match
      const typeRegEx = /\w*(?=<\/a>)/i;
      const linkTextMatches = stringifiedValue.match(typeRegEx);
      linkTextMatches.forEach((linkTextMatch) => {
        const linkTextFixed = linkTextMatch[0].toUpperCase() + linkTextMatch.substring(1);
        const linkTextRegEx = new RegExp(linkTextMatch, "g");
        if (linkTextRegEx.test(stringifiedValue)) {
            stringifiedValue = stringifiedValue.replace(linkTextRegEx, linkTextFixed);
        }
      })
  }

  return stringifiedValue;
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
const stringifyType = exports.stringifyType = (parsedType, cssClass, stringifyLinkMap) => {
    // --------------------------------------------------------------------
    // Perform the normal catharsis stringify
    // --------------------------------------------------------------------
    let stringifiedType = catharsis.stringifyEsri(parsedType, {
        cssClass: cssClass,
        htmlSafe: true,
        links: stringifyLinkMap
    });

    // --------------------------------------------------------------------
    // Perform the Esri catharsis and parse, except for arrays containing
    // union type such as Array.<(string|Array.<string>)> or
    // Array.<(ColorVariable|SizeVariable)>
    // See arcgis-js-sdk #3855
    // --------------------------------------------------------------------
    if (/array\.?<\([^)]*\)>/i.test(parsedType.typeExpression)) {
      stringifiedType = catharsis.stringify(parsedType, {
        cssClass: cssClass,
        htmlSafe: true,
        links: stringifyLinkMap
      });
    }

    // --------------------------------------------------------------------
    // Modify the default stringification
    // --------------------------------------------------------------------
    stringifiedType = cleanseStringify(parsedType, stringifiedType);

    return stringifiedType;
};

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

    // --------------------------------------------------------------------
    // Replace periods and or tildes at the front of the fragment.
    // --------------------------------------------------------------------
    //return `#${fragmentId}`;
    return `#${fragmentId.replace(/^[~.]/, "")}`;
}

function getShortName(longname) {

    return name.shorten(longname).name;
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
 * @param {boolean=} options.shortenName - Indicates whether to extract the short name from the
 * longname and display the short name in the link text. Ignored if `linkText` is specified.
 * @return {string} The HTML link, or the link text if the link is not available.
 */
function buildLink(longname, linkText, options) {
    const classString = options.cssClass ? util.format(' class="%s"', options.cssClass) : '';
    let fileUrl;
    const fragmentString = fragmentHash(options.fragmentId);
    let stripped;
    let text;

    let parsedType;

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
    else if (longname && isComplexTypeExpression(longname) && /\{@.+\}/.test(longname) === false &&
        /^<[\s\S]+>/.test(longname) === false) {

        parsedType = parseType(longname);
        return stringifyType(parsedType, options.cssClass, options.linkMap);
    }
    else {
        fileUrl = hasOwnProp.call(options.linkMap, longname) ? options.linkMap[longname] : '';
        text = linkText || (options.shortenName ? getShortName(longname) : longname);

        // --------------------------------------------------------------------
        //
        // --------------------------------------------------------------------
        if (/^(object|function|number|string|boolean)$/.test(linkText)) {
            // text = options.monospace ? `<code>${text}</code>` : text;
            text = linkText[0].toUpperCase() + linkText.substring(1);
        }

        // --------------------------------------------------------------------
        // MDN links for built-in Javascript types such as string and Object
        //
        // For other registered links, also see the publish function
        // helper.registerLink
        // --------------------------------------------------------------------
        if (!fileUrl && text !== "") {
            if (text === 'Array') {
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
 * @function
 * @param {string} longname - The longname (or URL) that is the target of the link.
 * @param {string=} linkText - The text to display for the link, or `longname` if no text is
 * provided.
 * @param {string=} cssClass - The CSS class (or classes) to include in the link's `<a>` tag.
 * @param {string=} fragmentId - The fragment identifier (for example, `name` in `foo.html#name`) to
 * append to the link target.
 * @return {string} The HTML link, or a plain-text string if the link is not available.
 */
const linkto = exports.linkto = (longname, linkText, cssClass, fragmentId) => buildLink(longname, linkText, {
    cssClass: cssClass,
    fragmentId: fragmentId,
    linkMap: longnameToUrl
});

function useMonospace(tag, text) {
    let cleverLinks;
    let monospaceLinks;
    let result;

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
    let linkText;
    let target;
    let splitIndex;

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

    if (linkText) {
        linkText = linkText.trim();
    }
    if (target) {
        target = target.trim();
    }

    return {
        linkText: linkText,
        target: target || text
    };
}

const tutorialToUrl = exports.tutorialToUrl = tutorial => {
    let fileUrl;
    const node = tutorials.getByName(tutorial);

    // no such tutorial
    if (!node) {
        logger.error( new Error(`No such tutorial: ${tutorial}`) );

        return null;
    }

    // define the URL if necessary
    if (!hasOwnProp.call(tutorialLinkMap.nameToUrl, node.name)) {
        fileUrl = `tutorial-${getUniqueFilename(node.name)}`;
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
 * @function
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
const toTutorial = exports.toTutorial = (tutorial, content, missingOpts) => {
    let classname;
    let link;
    let node;
    let tag;


    if (!tutorial) {
        logger.error( new Error('Missing required parameter: tutorial') );

        return null;
    }

    node = tutorials.getByName(tutorial);
    // no such tutorial
    if (!node) {
        missingOpts = missingOpts || {};
        tag = missingOpts.tag;
        classname = missingOpts.classname;

        link = tutorial;
        if (missingOpts.prefix) {
            link = missingOpts.prefix + link;
        }
        if (tag) {
            link = `<${tag}${classname ? (` class="${classname}">`) : '>'}${link}`;
            link += `</${tag}>`;
        }

        return link;
    }

    content = content || node.title;

    return `<a href="${tutorialToUrl(tutorial)}">${content}</a>`;
};

function shouldShortenLongname() {
    if (env.conf && env.conf.templates && env.conf.templates.useShortNamesInLinks) {
        return true;
    }

    return false;
}

/**
 * Find `{@link ...}` and `{@tutorial ...}` inline tags and turn them into HTML links.
 *
 * @param {string} str - The string to search for `{@link ...}` and `{@tutorial ...}` tags.
 * @return {string} The linkified text.
 */
exports.resolveLinks = str => {
    let replacers;

    function extractLeadingText(string, completeTag) {
        const tagIndex = string.indexOf(completeTag);
        let leadingText = null;
        const leadingTextRegExp = /\[(.+?)\]/g;
        let leadingTextInfo = leadingTextRegExp.exec(string);

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

    function processLink(string, {completeTag, text, tag}) {
        const leading = extractLeadingText(string, completeTag);
        let linkText = leading.leadingText;
        let monospace;
        let split;
        let target;

        string = leading.string;

        split = splitLinkText(text);
        target = split.target;
        linkText = linkText || split.linkText;

        monospace = useMonospace(tag, text);

        return string.replace( completeTag, buildLink(target, linkText, {
            linkMap: longnameToUrl,
            monospace: monospace,
            shortenName: shouldShortenLongname()
        }) );
    }

    function processTutorial(string, {completeTag, text}) {
        const leading = extractLeadingText(string, completeTag);

        string = leading.string;

        return string.replace( completeTag, toTutorial(text, leading.leadingText) );
    }

    replacers = {
        link: processLink,
        linkcode: processLink,
        linkplain: processLink,
        tutorial: processTutorial
    };

    return inline.replaceInlineTags(str, replacers).newString;
};

/**
 * Convert tag text like `Jane Doe <jdoe@example.org>` into a `mailto:` link.
 *
 * @param {string} str - The tag text.
 * @return {string} The linkified text.
 */
exports.resolveAuthorLinks = str => {
    let author = '';
    let matches;

    if (str) {
        matches = str.match(/^\s?([\s\S]+)\b\s+<(\S+@\S+)>\s?$/);

        if (matches && matches.length === 3) {
            author = `<a href="mailto:${matches[2]}">${htmlsafe(matches[1])}</a>`;
        }
        else {
            author = htmlsafe(str);
        }
    }

    return author;
};

/**
 * Find items in a TaffyDB database that match the specified key-value pairs.
 *
 * @function
 * @param {TAFFY} data The TaffyDB database to search.
 * @param {object|function} spec Key-value pairs to match against (for example,
 * `{ longname: 'foo' }`), or a function that returns `true` if a value matches or `false` if it
 * does not match.
 * @return {array<object>} The matching items.
 */
const find = exports.find = (data, spec) => data(spec).get();

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
exports.getMembers = data => {
    const members = {
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
    members.externals = members.externals.map(doclet => {
        doclet.name = doclet.name.replace(/(^"|"$)/g, '');

        return doclet;
    });

    // functions that are also modules (as in `module.exports = function() {};`) are not globals
    members.globals = members.globals.filter(doclet => !isModuleExports(doclet));

    return members;
};

/**
 * Retrieve the member attributes for a doclet (for example, `virtual`, `static`, and
 * `readonly`).
 * @param {object} d The doclet whose attributes will be retrieved.
 * @return {array<string>} The member attributes for the doclet.
 */
exports.getAttribs = d => {
    const attribs = [];

    if (!d) {
        return attribs;
    }

    if (d.async) {
        attribs.push('async');
    }

    if (d.generator) {
        attribs.push('generator');
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
exports.getSignatureTypes = ({type}, cssClass) => {
    let types = [];

    if (type && type.names) {
        types = type.names;
    }

    if (types && types.length) {
        types = types.map(t => linkto(t, htmlsafe(t), cssClass));
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
exports.getSignatureParams = ({params}, optClass) => {
    const pnames = [];

    if (params) {
        params.forEach(p => {
            if (p.name && !p.name.includes('.')) {
                if (p.optional && optClass) {
		            // add support for optional, repeatable parameters
                    // pnames.push(`<span class="${optClass}">${p.name}</span>`);
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
 * Retrieve links to types that the member can return or yield.
 *
 * @param {Object} d - The doclet whose types will be retrieved.
 * @param {string} [cssClass] - The CSS class to include in the `class` attribute for each link.
 * @return {Array.<string>} HTML links to types that the member can return or yield.
 */
exports.getSignatureReturns = ({yields, returns}, cssClass) => {
    let returnTypes = [];
    if (yields || returns) {
        (yields || returns).forEach(r => {
            if (r && r.type && r.type.names) {
                if (!returnTypes.length) {
                    returnTypes = r.type.names;
                }
            }
        });
    }

    if (returnTypes && returnTypes.length) {
        returnTypes = returnTypes.map(r => linkto(r, htmlsafe(parseEsriAPIString("name", r)), cssClass));
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
exports.getAncestors = (data, doclet) => {
    const ancestors = [];
    let doc = doclet;
    let previousDoc;

    while (doc) {
        previousDoc = doc;
        doc = find(data, {longname: doc.memberof})[0];

        // prevent infinite loop that can be caused by duplicated module definitions
        if (previousDoc === doc) {
            break;
        }

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
exports.getAncestorLinks = (data, doclet, cssClass) => {
    const ancestors = exports.getAncestors(data, doclet);
    const links = [];

    ancestors.forEach(ancestor => {
        const linkText = (exports.scopeToPunc[ancestor.scope] || '') + ancestor.name;
        const link = linkto(ancestor.longname, linkText, cssClass);

        links.push(link);
    });

    if (links.length) {
        links[links.length - 1] += (exports.scopeToPunc[doclet.scope] || '');
    }

    return links;
};

/**
 * Iterates through all the doclets in `data`, ensuring that if a method `@listens` to an event,
 * then that event has a `listeners` array with the longname of the listener in it.
 *
 * @param {TAFFY} data - The TaffyDB database to search.
 */
exports.addEventListeners = data => {
    // just a cache to prevent me doing so many lookups
    const _events = {};
    let doc;
    let l;
    // TODO: do this on the *pruned* data
    // find all doclets that @listen to something.
    /* eslint-disable no-invalid-this */
    const listeners = find(data, function() {
        return this.listens && this.listens.length;
    });
    /* eslint-enable no-invalid-this */

    if (!listeners.length) {
        return;
    }

    listeners.forEach(({listens, longname}) => {
        l = listens;
        l.forEach(eventLongname => {
            doc = _events[eventLongname] || find(data, {
                longname: eventLongname,
                kind: 'event'
            })[0];
            if (doc) {
                if (!doc.listeners) {
                    doc.listeners = [longname];
                } else {
                    doc.listeners.push(longname);
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
exports.prune = data => {
    data({undocumented: true}).remove();
    data({ignore: true}).remove();
    data({memberof: '<anonymous>'}).remove();

    if (!env.opts.access || (env.opts.access && !env.opts.access.includes('all'))) {
        if (env.opts.access && !env.opts.access.includes('package')) {
            data({access: 'package'}).remove();
        }
        if (env.opts.access && !env.opts.access.includes('public')) {
            data({access: 'public'}).remove();
        }
        if (env.opts.access && !env.opts.access.includes('protected')) {
            data({access: 'protected'}).remove();
        }
        if (!env.opts.private && (!env.opts.access || (env.opts.access && !env.opts.access.includes('private')))) {
            data({access: 'private'}).remove();
        }
        if (env.opts.access && !env.opts.access.includes('undefined')) {
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
exports.createLink = doclet => {
    let fakeContainer;
    let filename;
    let fileUrl;
    let fragment = '';
    const longname = doclet.longname;
    let match;

    // handle doclets in which doclet.longname implies that the doclet gets its own HTML file, but
    // doclet.kind says otherwise. this happens due to mistagged JSDoc (for example, a module that
    // somehow has doclet.kind set to `member`).
    // TODO: generate a warning (ideally during parsing!)
    if (!containers.includes(doclet.kind)) {
        match = /(\S+):/.exec(longname);
        if (match && containers.includes(match[1])) {
            fakeContainer = match[1];
        }
    }

    // the doclet gets its own HTML file
    if ( containers.includes(doclet.kind) || isModuleExports(doclet) ) {
        filename = getFilename(longname);
    }
    // mistagged version of a doclet that gets its own HTML file
    else if ( !containers.includes(doclet.kind) && fakeContainer ) {
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

/**
 * Convert an array of doclet longnames into a tree structure, optionally attaching doclets to the
 * tree.
 *
 * @function
 * @see module:jsdoc/name.longnamesToTree
 * @param {Array<string>} longnames - The longnames to convert into a tree.
 * @param {Object<string, module:jsdoc/doclet.Doclet>} doclets - The doclets to attach to a tree.
 * Each property should be the longname of a doclet, and each value should be the doclet for that
 * longname.
 * @return {Object} A tree with information about each longname.
 */
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

