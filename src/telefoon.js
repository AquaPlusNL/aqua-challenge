/* Telefoonnummer normaliseren naar E.164 (+31612345678).
   Nederlands: 0 of +31 gevolgd door 9 cijfers (mobiel en vast).
   Buitenland: + gevolgd door 8 tot 15 cijfers.
   Geeft null terug als het nummer niet klopt. */
export function normaliseerTelefoon(invoer) {
  let t = String(invoer || '').replace(/[\s().-]/g, '');
  if (t.startsWith('00')) t = '+' + t.slice(2);
  if (t.startsWith('+310')) t = '+31' + t.slice(4);          // +31 (0)6 ...
  if (/^0[1-9][0-9]{8}$/.test(t)) return '+31' + t.slice(1);
  if (/^\+31[1-9][0-9]{8}$/.test(t)) return t;
  if (t.startsWith('+31')) return null;                        // NL met verkeerde lengte
  if (/^\+[1-9][0-9]{7,14}$/.test(t)) return t;
  return null;
}
