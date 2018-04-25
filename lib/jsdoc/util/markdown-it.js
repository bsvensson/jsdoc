/**
 * Created by lloy3317 on 10/6/15.
 */

/*global env */

/**
 * Combines markdown parsing with markdown-it, code highlighting using
 * highlight.js, and custom code blocks in markdown using the plugin
 * markdown-it-container.
 *
 * @module jsdoc/util/markdown-it
 * @author Michael Mathews <micmath@gmail.com>
 * @author Ben Blank <ben.blank@gmail.com>
 * @author Lloyd Heberlie <lheberlie@esri..com>
 */
'use strict';

var MarkdownIt = require('markdown-it');
var markdownItContainer = require('markdown-it-container')
var hljs = require('highlight.js');

/**
 * Enumeration of Markdown parsers that are available.
 * @enum {String}
 */
var parserNames = {
  /**
   *
   */
  markdownit: 'markdownit'
};

/**
 * Escape underscores that occur within {@ ... } in order to protect them
 * from the markdown parser(s).
 * @param {String} source the source text to sanitize.
 * @returns {String} `source` where underscores within {@ ... } have been
 * protected with a preceding backslash (i.e. \_) -- the markdown parsers
 * will strip the backslash and protect the underscore.
 */
function escapeUnderscores(source){
  return source.replace(/\{@[^}\r\n]+\}/g, function (wholeMatch){
    return wholeMatch.replace(/(^|[^\\])_/g, '$1\\_');
  });
}

/**
 * Escape HTTP/HTTPS URLs so that they are not automatically converted to HTML links.
 *
 * @param {string} source - The source text to escape.
 * @return {string} The source text with escape characters added to HTTP/HTTPS URLs.
 */
function escapeUrls(source){
  return source.replace(/(https?)\:\/\//g, '$1:\\/\\/');
}

/**
 * Unescape HTTP/HTTPS URLs after Markdown parsing is complete.
 *
 * @param {string} source - The source text to unescape.
 * @return {string} The source text with escape characters removed from HTTP/HTTPS URLs.
 */
function unescapeUrls(source){
  return source.replace(/(https?)\:\\\/\\\//g, '$1://');
}

/**
 * Escape characters in text within a code block.
 *
 * @param {string} source - The source text to escape.
 * @return {string} The escaped source text.
 */
function escapeCode(source){
  return source.replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape \r within a code block with \n.
 *
 * There were cases where markdown / code highlighting
 * was incorrect on Windows.
 *
 * @param {string} source - The source text to correct.
 * @return {string} The replaced source text.
 */
function escapeLFCR(source){
  return source.replace(/\r/g, '\n');
}

/**
 * Retrieve a function that accepts a single parameter containing Markdown source. The function uses
 * the specified parser to transform the Markdown source to HTML, then returns the HTML as a string.
 *
 * @private
 * @param {String} parserName The name of the selected parser.
 * @param {Object} [conf] Configuration for the selected parser, if any.
 * @returns {Function} A function that accepts Markdown source, feeds it to the selected parser, and
 * returns the resulting HTML.
 */
function getParseFunction(parserName, conf){
  var logger = require('jsdoc/util/logger');
  logger.info("getParseFunction(%s, conf)", parserName);
  var markdown = new MarkdownIt({
    html: true,
    linkify: true,
    langPrefix: '',
    highlight: function (code, lang){
      if (code.indexOf("@link") !== -1) {
        return code;
      }
      else {
        return (lang) ? hljs.highlight(lang, code).value : hljs.highlight("js", code).value;
      }
    }
  });

  // --------------------------------------------------------------------
  // Acetate uses the markdown-it parser to translate *.md files into
  // html content. Loading the markdown-it-container plugin allows us to decorate block
  // content in the API Reference markdown and assign calcite-web or other selectors
  // to the content container (div) tag. This provides a mechanism to
  // still write in markdown, but style the content using calcite-web
  // styles or write our own.
  //
  // https://www.npmjs.com/package/markdown-it
  // https://www.npmjs.com/package/markdown-it-container
  //
  // Usage:
  //
  // ::: esri-md class='panel panel-light-blue'
  // Some great ArcGIS API for JavaScript documentation markdown.
  // :::
  //
  // Output:
  //
  // <div class="esri-md panel panel-light-blue">
  // <p>Some great ArcGIS API for JavaScript documentation markdown.</p>
  // </div>
  // --------------------------------------------------------------------
  markdown.use(markdownItContainer, "esri-md", {
    validate: function (params){
      //console.log("validate params (%s)", params);
      var tagMatch = params.trim().match(/^esri-md\s*(.*)$/);
      //console.log("tagMatch: %s", tagMatch);
      return tagMatch;
    },
    render: function (tokens, idx){
      //console.log("tokens: (%s), idx: (%s)", tokens, idx);
      // remove leading and trailng whitespace
      var rawText = tokens[idx].info.trim();
      // --------------------------------------------------------------------
      // RegEx to match class="foo-bar foo-bar-blue" selector
      // or class='foo-bar foo-bar-blue'
      // --------------------------------------------------------------------
      var cssClassMatch = rawText.match(/class=['"][^'"]*['"]\s*/m);
      var cssClass = "";
      if (cssClassMatch) {
        // --------------------------------------------------------------------
        // Extract the foo-bar foo-bar-blue from the attribute and value
        // class="foo-bar foo-bar-blue"
        // Actually we're just replacing the word "class" and the equals sign
        // and quotes around the value.
        // --------------------------------------------------------------------
        cssClass = cssClassMatch[0].replace(/(class|['"=]*)/gm, "");
      }

      if (tokens[idx].nesting === 1) {
        // opening tag
        if (cssClass !== "") {
          return '<div class="esri-md ' + cssClass.trim() + '">\n';
        }
        else {
          return '<div class="esri-md">\n';
        }
      }
      else {
        // closing tag
        return '</div>\n';
      }
    }
  });
  // --------------------------------------------------------------------
  // Modify markdown render rules for opening table elements to include
  // the class="table" decoration on markdown tables.
  //
  // https://github.com/Esri/calcite-web/blob/master/CHANGELOG.md
  // https://github.com/Esri/calcite-web/blob/master/CHANGELOG.md#breaking
  // --------------------------------------------------------------------
  markdown.renderer.rules.table_open = function(tokens, idx) {
    return '<table class="table">';
  };
  // --------------------------------------------------------------------
  // parserFunction
  // --------------------------------------------------------------------
  var parserFunction;

  conf = conf || {};

  if (parserName === parserNames.markdownit) {

    parserFunction = function (source){
      var result;

      source = escapeUnderscores(source);
      source = escapeUrls(source);
      source = escapeLFCR(source);

      result = markdown.render(source)
        .replace(/\s+$/, '')
        .replace(/&#39;/g, "'");
      result = unescapeUrls(result);

      return result;
    };
    parserFunction._parser = parserNames.markdownit;
    return parserFunction;
  }
  else {
    logger.error('Unrecognized Markdown parser "%s". Markdown-it support is disabled.', parserName);
  }
}

/**
 * Retrieve a Markdown parsing function based on the value of the `conf.json` file's
 * `env.conf.markdown` property. The parsing function accepts a single parameter containing Markdown
 * source. The function uses the parser specified in `conf.json` to transform the Markdown source to
 * HTML, then returns the HTML as a string.
 *
 * @returns {function} A function that accepts Markdown source, feeds it to the selected parser, and
 * returns the resulting HTML.
 */
exports.getParser = function (){
  var conf = env.conf.markdown;
  if (conf && conf.parser) {
    return getParseFunction(parserNames[conf.parser], conf);
  }
  else {
    // marked is the default parser
    return getParseFunction(parserNames.markdownit, conf);
  }
};
