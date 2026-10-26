#!/usr/bin/env node
/*
 * Builds the WordPress plugin: the fair (index.html + assets) inside wordpress/lcc-virtual-book-fair,
 * zipped as dist/lcc-virtual-book-fair.zip, ready for Plugins > Add New > Upload Plugin.
 *
 *   node tools/build-wp-plugin.mjs
 *
 * The authors' email addresses are taken out of the public books.js and kept in fair-data.php,
 * which the server runs but never sends to visitors. Needs the `zip` command.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'lcc-virtual-book-fair';
const DIST = join(ROOT, 'dist');
const OUT = join(DIST, NAME);
const SKIP = new Set(['assets/img/originals']); // the covers as supplied: the fair uses the optimised ones

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// the fair's content, read the same way the browser does
const booksSrc = readFileSync(join(ROOT, 'assets/js/books.js'), 'utf8');
const window = {};
vm.runInNewContext(booksSrc, { window });
const titleOf = Object.fromEntries(window.FAIR_BOOKS.map((b) => [b.slug, b.title]));
const authors = window.FAIR_AUTHORS.map((a) => ({
  id: a.id,
  name: a.displayName,
  inbox: (a.inbox || '').trim(),
  books: a.books.map((s) => titleOf[s])
}));
const E = window.FAIR_EVENT || {};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, 'wordpress', NAME), OUT, { recursive: true });
cpSync(join(ROOT, 'index.html'), join(OUT, 'fair/index.html'));
cpSync(join(ROOT, 'assets'), join(OUT, 'fair/assets'), {
  recursive: true,
  filter: (src) => !SKIP.has(relative(ROOT, src).split('\\').join('/'))
});

// the public copy of books.js without the authors' addresses
const publicBooks = join(OUT, 'fair/assets/js/books.js');
writeFileSync(publicBooks, readFileSync(publicBooks, 'utf8').replace(/(\binbox:\s*)'[^']*'/g, "$1''"));

const fairFiles = walk(join(OUT, 'fair')).sort();
const leaks = authors.filter((a) => a.inbox).flatMap((a) => fairFiles
  .filter((f) => /\.(html|js|css|json|txt|md)$/.test(f) && readFileSync(f, 'utf8').includes(a.inbox))
  .map((f) => `${a.inbox} in ${relative(OUT, f)}`));
if (leaks.length) {
  console.error('An author address would be public:\n  ' + leaks.join('\n  '));
  process.exit(1);
}

// a version for the fair's files, so browsers fetch them again after each update
const hash = createHash('sha256');
fairFiles.forEach((f) => { hash.update(relative(OUT, f)); hash.update(readFileSync(f)); });
const build = readFileSync(join(OUT, `${NAME}.php`), 'utf8').match(/Version:\s*(\S+)/)[1] + '-' + hash.digest('hex').slice(0, 10);

const php = (v) => {
  if (v === null || v === undefined) return "''";
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) return `array(${v.map(php).join(', ')})`;
  return `array(${Object.entries(v).map(([k, x]) => `${php(k)} => ${php(x)}`).join(', ')})`;
};
writeFileSync(join(OUT, 'fair-data.php'), `<?php
/* Made by tools/build-wp-plugin.mjs from the fair's books.js. Runs on the server only. */
if (!defined('ABSPATH')) {
\texit;
}
return array(
\t'build'   => ${php(build)},
\t'event'   => ${php({ date: E.date || '', register: E.register || '', zoom: (E.stream && E.stream.zoom) || '', stream: (E.stream && E.stream.url) || '' })},
\t'authors' => array(
${authors.map((a) => `\t\t${php(a)},`).join('\n')}
\t),
);
`);

const zip = join(DIST, `${NAME}.zip`);
rmSync(zip, { force: true });
try {
  execFileSync('zip', ['-r', '-X', '-q', zip, NAME], { cwd: DIST });
} catch (e) {
  console.error('Could not run `zip`. The plugin folder is ready in ' + relative(ROOT, OUT) + '; zip that folder yourself.');
  process.exit(1);
}
const mb = (statSync(zip).size / 1048576).toFixed(1);
console.log(`Built ${relative(ROOT, zip)} (${mb} MB, build ${build}): ${authors.length} authors, ${authors.filter((a) => a.inbox).length} with an inbox.`);
if (!existsSync(join(OUT, 'fair/assets/vendor/three/three.module.min.js'))) console.warn('three.js is missing from the build');
