import assert from 'node:assert/strict';
import { normaliseerTelefoon as n } from '../src/telefoon.js';

assert.equal(n('06 12 34 56 78'), '+31612345678');
assert.equal(n('0612345678'), '+31612345678');
assert.equal(n('010-1234567'), '+31101234567');
assert.equal(n('+31 6 12345678'), '+31612345678');
assert.equal(n('+31 (0)6 12345678'), '+31612345678');
assert.equal(n('0031612345678'), '+31612345678');
assert.equal(n('+32 470 12 34 56'), '+32470123456');
assert.equal(n('061234567890'), null);   // te lang
assert.equal(n('061234567'), null);      // te kort
assert.equal(n('+3161234567'), null);    // NL te kort
assert.equal(n('12345678'), null);       // geen prefix
assert.equal(n(''), null);
console.log('telefoon ok');
