#!/usr/bin/env node
/*
 * Private author links for the live fair.
 *
 * An author who opens their link appears to every visitor as a verified, golden author
 * avatar, and their booth hologram lights up with "Here now". Each link carries a private
 * key; the fair only stores the matching public key, so nobody can pretend to be an author.
 *
 *   node tools/author-links.mjs                      new keys for every author
 *   node tools/author-links.mjs chuck-barnard        new key for one author (others unchanged)
 *   BASE=https://www.lifecoachcode.com/virtual-book-fair/ node tools/author-links.mjs
 *
 * Paste the printed authorKeys into FAIR_LIVE in assets/js/books.js and send each author
 * their own link. Do not commit the links: anyone with a link can appear as that author.
 */
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const BASE = process.env.BASE || 'https://chatgptmentoring.github.io/Speak-Your-Book/';
const src = readFileSync(new URL('../assets/js/books.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(src, { window });
const only = process.argv.slice(2);
const authors = window.FAIR_AUTHORS.filter((a) => !only.length || only.includes(a.id));
if (!authors.length) { console.error('No author matches. Author ids:', window.FAIR_AUTHORS.map((a) => a.id).join(', ')); process.exit(1); }

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const keys = { ...window.FAIR_LIVE.authorKeys };
const links = [];
for (const a of authors) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  keys[a.id] = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  links.push(`${a.displayName}: ${BASE}?fair-author=${a.id}#key=${jwk.d}`);
}
console.log('// paste into FAIR_LIVE in assets/js/books.js');
console.log('authorKeys: ' + JSON.stringify(keys, null, 2).replace(/"([a-z0-9-]+)":/g, "'$1':").replace(/: "/g, ": '").replace(/",?$/gm, (m) => m.replace('"', "'")));
console.log('\n// private links: send each author their own, never commit them');
links.forEach((l) => console.log(l));
