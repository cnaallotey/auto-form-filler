// Smoke test for the published entry points: loads the built package through
// its own name (package self-reference) via both require() and import().
const assert = require('assert');
const name = require('../package.json').name;

const expected = ['AutoFormFiller', 'autoFillForm', 'default'];

const cjs = require(name);
for (const key of expected) {
  assert.ok(cjs[key], `require('${name}') is missing export "${key}"`);
}

import(name).then((esm) => {
  for (const key of expected) {
    assert.ok(esm[key], `import('${name}') is missing export "${key}"`);
  }
  assert.strictEqual(esm.default, esm.AutoFormFiller);
  console.log(`${name}: require() and import() entry points OK`);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
