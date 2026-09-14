import assert from 'node:assert/strict';
import { test } from 'node:test';
import { foldName, rankItems, uniqueFoldedFields } from './nameSearch.js';

function row(name, extraFields = [], popularity = 0) {
  return {
    foldedFields: uniqueFoldedFields([name, ...extraFields]),
    popularity,
    item: { name },
  };
}

function namesOf(result) {
  return result.items.map((item) => item.name);
}

test('foldName strips accents, punctuation, and case', () => {
  assert.equal(foldName('Mbappé'), 'mbappe');
  assert.equal(foldName('Núñez'), 'nunez');
  assert.equal(foldName("N'Golo Kanté"), 'ngolo kante');
  assert.equal(foldName('Łukasz Piszczek'), 'lukasz piszczek');
});

test('accent-insensitive player match', () => {
  const result = rankItems(
    [
      row('Darwin Núñez', ['Darwin', 'Núñez']),
      row('Gareth Bale'),
    ],
    'nunez',
    20
  );
  assert.deepEqual(namesOf(result), ['Darwin Núñez']);
});

test('token order does not matter', () => {
  const rows = [row('Lionel Messi', ['Lionel Andrés', 'Messi Cuccittini'])];
  assert.deepEqual(namesOf(rankItems(rows, 'messi lionel', 20)), [
    'Lionel Messi',
  ]);
  assert.deepEqual(namesOf(rankItems(rows, 'lionel messi', 20)), [
    'Lionel Messi',
  ]);
});

test('surname query ranks exact last name above similar names', () => {
  const result = rankItems(
    [
      row('João Messias'),
      row('Lionel Messi', ['Lionel', 'Messi']),
      row('Messias Rodrigues'),
    ],
    'messi',
    20
  );
  assert.equal(result.items[0].name, 'Lionel Messi');
});

test('team query real ranks the main club above reserve names', () => {
  const result = rankItems(
    [
      row('Villarreal'),
      row('Real Madrid Castilla', [], 8),
      row('Real Madrid', [], 32),
      row('Real Betis', [], 16),
    ],
    'real',
    20
  );
  assert.equal(result.items[0].name, 'Real Madrid');
  assert.ok(namesOf(result).includes('Real Madrid Castilla'));
  assert.ok(
    namesOf(result).indexOf('Real Madrid') <
      namesOf(result).indexOf('Real Madrid Castilla')
  );
  assert.equal(namesOf(result).includes('Villarreal'), false);
});

test('madrid finds Real Madrid as a last-word match', () => {
  const result = rankItems(
    [row('Atlético Madrid'), row('Real Madrid'), row('Madrid CFF')],
    'madrid',
    20
  );
  assert.ok(namesOf(result).includes('Real Madrid'));
  assert.equal(result.items.length, 3);
});

test('extra words rank the first team below the main name', () => {
  const result = rankItems(
    [row('Real Madrid Castilla'), row('Real Madrid')],
    'real madrid',
    20
  );
  assert.equal(result.items[0].name, 'Real Madrid');
});

test('truncated is true when more than the limit match', () => {
  const rows = Array.from({ length: 25 }, (_, i) => row(`Real Club ${i}`));
  const result = rankItems(rows, 'real', 20);
  assert.equal(result.items.length, 20);
  assert.equal(result.truncated, true);
});

test('empty query returns no rows', () => {
  const result = rankItems([row('Barcelona')], '   ', 20);
  assert.deepEqual(result.items, []);
  assert.equal(result.truncated, false);
});

test('boostForRow lifts match players above similar names', () => {
  const rows = [
    {
      foldedFields: uniqueFoldedFields(['Cristian Romero', 'Cristian', 'Romero']),
      popularity: 20,
      item: { id: 1, name: 'Cristian Romero' },
    },
    {
      foldedFields: uniqueFoldedFields([
        'Cristiano Ronaldo',
        'Cristiano',
        'Ronaldo',
      ]),
      popularity: 30,
      item: { id: 2, name: 'Cristiano Ronaldo' },
    },
  ];

  const without = rankItems(rows, 'cristian', 20);
  assert.equal(without.items[0].name, 'Cristian Romero');

  const withBoost = rankItems(rows, 'cristian', 20, {
    boostForRow: (r) => (r.item.id === 2 ? 800 : 0),
  });
  assert.equal(withBoost.items[0].name, 'Cristiano Ronaldo');
});

test('progressive typing does not bury longer first names behind exact short ones', () => {
  const rows = [
    row('Cristian Romero', ['Cristian', 'Romero'], 20),
    row('Cristiano Ronaldo', ['Cristiano', 'Ronaldo'], 30),
    row('Cristiano Biraghi', ['Cristiano', 'Biraghi'], 10),
  ];

  // Short prefix: longer-name candidates stay competitive (not crushed).
  const mid = rankItems(rows, 'cristi', 20);
  assert.ok(namesOf(mid).includes('Cristiano Ronaldo'));
  assert.ok(
    namesOf(mid).indexOf('Cristiano Ronaldo') <=
      namesOf(mid).indexOf('Cristian Romero') + 1
  );

  // Exact short first name still prefers Cristian, but Cristiano remains close in list.
  const exactShort = rankItems(rows, 'cristian', 20);
  assert.equal(exactShort.items[0].name, 'Cristian Romero');
  assert.ok(namesOf(exactShort).includes('Cristiano Ronaldo'));

  // Completed longer first name prefers Cristiano*.
  const full = rankItems(rows, 'cristiano', 20);
  assert.equal(full.items[0].name, 'Cristiano Ronaldo');
});

test('full display name exact match still ranks first', () => {
  const result = rankItems(
    [
      row('Lionel Messi', ['Lionel', 'Messi'], 10),
      row('Messi Jr', ['Messi', 'Jr'], 40),
    ],
    'lionel messi',
    20
  );
  assert.equal(result.items[0].name, 'Lionel Messi');
});
