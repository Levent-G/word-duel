// Name filter checks: node scripts/test-moderation.mjs
import { isOffensive, nameError } from '../src/moderation.js';

const blocked = ['orospu', 'Or0spu Çocuğu', 's1kis', 'FUCK', 'fuuuck you', 'bitch', 'aq', 'Pic', 'yarrak42', 'şerefsiz', 'a.m.k', 'amk'];
const allowed = ['Deniz', 'Mustafa', 'Mali', 'Ocak', 'Gotham', 'Picasso', 'Selin', 'Burak', 'Sikander', 'Malik', 'Cocktail Ali', 'Dickens'];

let failures = 0;
for (const n of blocked) if (!isOffensive(n)) failures++, console.log('FAIL should block:', n);
for (const n of allowed) if (isOffensive(n)) failures++, console.log('FAIL should allow:', n);
if (nameError('A') === null || nameError('Deniz') !== null) failures++, console.log('FAIL nameError basics');
console.log(failures ? `${failures} failures` : `moderation checks passed (${blocked.length} blocked, ${allowed.length} allowed)`);
process.exit(failures ? 1 : 0);
