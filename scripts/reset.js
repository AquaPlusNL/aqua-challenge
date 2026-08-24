/* ============================================================
   Handmatige reset vanaf de commandline.

     npm run reset               wist inzendingen en sessies
     npm run reset inzendingen   wist alleen de inzendingen (en dus de IP-blokkades)
     npm run reset sessies       wist alleen de sessies (de voortgangstracking)

   Let op: de IP-blokkade zit in de inzendingentabel. Wis je die,
   dan mag iedereen weer inzenden.
   ============================================================ */
import { resetDb } from '../src/db.js';

const wat = process.argv[2] || 'alles';
if (!['inzendingen', 'sessies', 'alles'].includes(wat)) {
  console.error(`Onbekende optie "${wat}". Kies uit: inzendingen, sessies, alles.`);
  process.exit(1);
}
const na = resetDb(wat);
console.log(
  `Gereset: ${wat}. Resterend, inzendingen: ${na.inzendingen}, sessies: ${na.sessies}.`,
);
