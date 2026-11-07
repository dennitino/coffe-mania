import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';
import ts from 'typescript';

// Transpile the repository's real TypeScript modules in memory. This avoids
// changing production import paths or requiring a separate test bundler.
const root = resolve(import.meta.dirname, '../..');
const transpile = (path) => ts.transpileModule(readFileSync(resolve(root, path), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const isoUrl = 'data:text/javascript;base64,' + Buffer.from(transpile('game/src/world/iso.ts')).toString('base64');
const pathFinderSource = transpile('game/src/world/PathFinder.ts').replace(
  /from ['"]\.\/iso['"]/, `from '${isoUrl}'`,
);
const pathFinderUrl = 'data:text/javascript;base64,' + Buffer.from(pathFinderSource).toString('base64');
const { findPath } = await import(pathFinderUrl);

const cost = (start, path) => path.reduce((sum, step, index) => {
  const prev = index === 0 ? start : path[index - 1];
  return sum + (prev.tx !== step.tx && prev.ty !== step.ty ? 14 : 10);
}, 0);

test('A* finds the shortest octile route around obstacles', () => {
  // The previous Manhattan heuristic returned a route of cost 90, not 82.
  const grid = [
    '......#',
    '.S.....',
    '....#..',
    '####...',
    '###..#.',
    '..#..D#',
    '......#',
  ];
  const start = { tx: 1, ty: 1 }, dest = { tx: 5, ty: 5 };
  const path = findPath({
    start, dest, maxTilesX: 7, maxTilesY: 7,
    isWalkable: (tx, ty) => grid[ty]?.[tx] !== '#',
  });
  assert.ok(path);
  assert.deepEqual(path.at(-1), dest);
  assert.equal(cost(start, path), 82);
});

test('A* cannot cut a corner blocked on both sides', () => {
  const path = findPath({
    start: { tx: 0, ty: 0 }, dest: { tx: 1, ty: 1 },
    maxTilesX: 2, maxTilesY: 2,
    isWalkable: (tx, ty) => tx === 0 && ty === 0,
  });
  assert.equal(path, null);
});

test('A* allows a blocked destination when the last step is legal', () => {
  const path = findPath({
    start: { tx: 0, ty: 0 }, dest: { tx: 1, ty: 0 },
    maxTilesX: 2, maxTilesY: 1,
    isWalkable: (tx) => tx === 0,
  });
  assert.deepEqual(path, [{ tx: 1, ty: 0 }]);
});

test('A* uses unique node keys for grids wider than the default 20 tiles', () => {
  const start = { tx: 23, ty: 0 }, dest = { tx: 0, ty: 1 };
  const path = findPath({
    start, dest, maxTilesX: 24, maxTilesY: 2,
    isWalkable: () => true,
  });
  assert.ok(path);
  assert.deepEqual(path.at(-1), dest);
  assert.equal(cost(start, path), 234);
});

test('A* returns an empty path when already at destination', () => {
  const start = { tx: 3, ty: 4 };
  assert.deepEqual(findPath({ start, dest: start, isWalkable: () => true }), []);
});
