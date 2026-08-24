/* Waar haken kandidaten af?   npm run stats */
import { statistiek } from '../src/db.js';
import { actieveLevels } from '../src/spellen.js';

const s = statistiek(actieveLevels().length);
console.log(`\nSessies gestart:      ${s.sessies}`);
console.log(`Aan level 1 begonnen: ${s.gestartMetSpel}`);
console.log(`Alle levels afgerond: ${s.afgerond}`);
console.log(`Formulier ingevuld:   ${s.inzendingen}\n`);
console.log('Level  bereikt  gehaald  afgehaakt  gem. tijd  foute pogingen');
for (const l of s.perLevel) {
  console.log(
    `  ${l.level}    ${String(l.bereikt).padStart(6)}   ${String(l.gehaald).padStart(6)}` +
      `   ${String(l.afgehaakt).padStart(8)}   ${String(l.gemiddeldeSeconden ?? '-').padStart(8)}s` +
      `   ${String(l.foutePogingen).padStart(13)}`,
  );
}
console.log('');
