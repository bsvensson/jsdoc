/*
  Copyright 2015 the JSDoc Authors.

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
describe('export default', () => {
  const docSet = jsdoc.getDocSetFromFile('test/fixtures/exportdefault.js');
  const member = docSet.getByLongname('module:test')[1];

  it('should use the correct kind and description for the default export', () => {
    expect(member.kind).toBe('member');
    expect(member.description).toBe('Test value');
  });
});
