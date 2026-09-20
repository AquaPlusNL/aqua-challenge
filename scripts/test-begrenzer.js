/* Snelheidsbegrenzer. Het gedrag dat je niet ziet in een API-test zonder er een
   minuut op te wachten: dat een geweigerd verzoek niet meetelt, en dat je er na
   het venster weer in mag. */
import assert from 'node:assert/strict';
import { begrens } from '../src/begrenzer.js';

const venster = 50;

/* Binnen de limiet mag je erin, daarboven niet. */
assert.equal(begrens('a', 3, venster), true);
assert.equal(begrens('a', 3, venster), true);
assert.equal(begrens('a', 3, venster), true);
assert.equal(begrens('a', 3, venster), false);

/* Geweigerde verzoeken tellen niet mee: na drie extra pogingen staat de teller
   nog steeds op drie, dus zodra het venster verstrijkt mag je meteen weer. */
assert.equal(begrens('a', 3, venster), false);
assert.equal(begrens('a', 3, venster), false);
await new Promise((k) => setTimeout(k, venster + 10));
assert.equal(begrens('a', 3, venster), true);

/* Sleutels staan los van elkaar. */
assert.equal(begrens('b', 1, venster), true);
assert.equal(begrens('b', 1, venster), false);

console.log('begrenzer ok');
