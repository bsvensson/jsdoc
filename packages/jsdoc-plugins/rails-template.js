/*
  Copyright 2012 the JSDoc Authors.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
/**
 * Strips the rails template tags from a js.erb file
 * @module @jsdoc/plugins/railsTemplate
 */
/** @alias module:@jsdoc/plugins/railsTemplate.handlers */
export const handlers = {
  /**
   * Remove rails tags from the source input (e.g. <% foo bar %>)
   *
   * @param e
   * @param e.filename
   * @param e.source
   * @alias module:@jsdoc/plugins/railsTemplate.handlers.beforeParse
   */
  beforeParse(e) {
    if (e.filename.match(/\.erb$/)) {
      e.source = e.source.replace(/<%.*%>/g, '');
    }
  },
};
