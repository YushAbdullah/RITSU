import { describe, expect, it } from 'vitest';
import { newFamilyState, newIndividualState } from '../setup';
import { reduce } from '../store';
import { hashSecret, newSalt, checkCredentials } from '../backend';

describe('account setup', () => {
  it('creates a family with one guardian, the children, starter rules and an empty ledger', () => {
    const s = newFamilyState({ userId: 'u1', familyName: 'Tan family', parentName: 'Mei', parentAvatar: '👩🏻', currency: 'coins', rate: 2, children: [{ name: 'Ali', age: 8, avatar: '🦁' }, { name: ' ', age: 5, avatar: '🐼' }] });
    expect(s.accounts[0]).toMatchObject({ mode: 'family', name: 'Tan family', currency: 'coins', rate: 2 });
    expect(s.members.map((m) => m.role)).toEqual(['guardian', 'child']);
    expect(s.rules.length).toBeGreaterThan(10);
    expect(s.rules.every((r) => r.accountId === s.accounts[0].id)).toBe(true);
    expect(s.transactions).toHaveLength(0);
    // The new state works with the engine straight away.
    const [mum, ali] = s.members;
    const next = reduce(s, { type: 'award', memberId: ali.id, actorId: mum.id, kind: 'merit', points: 2, category: 'Chores', description: 'Made the bed', proof: { kind: 'link', url: 'https://example.com/bed.jpg' } });
    expect(next.transactions).toHaveLength(1);
  });

  it('creates an individual account with personal habits', () => {
    const s = newIndividualState('u2', 'Hafiz', '🧑🏻', 'RM', 0.5, 1800);
    expect(s.members).toHaveLength(1);
    expect(s.rules.every((r) => r.memberId === s.members[0].id)).toBe(true);
  });
});

describe('credentials and PINs', () => {
  it('validates sign-up input', () => {
    expect(() => checkCredentials('bad', 'longenough', 'A')).toThrow(/email/);
    expect(() => checkCredentials('a@b.co', 'short', 'A')).toThrow(/8/);
    expect(() => checkCredentials('a@b.co', 'longenough', ' ')).toThrow(/name/);
  });
  it('hashes PINs with a salt so the same PIN gives different hashes', async () => {
    const a = await hashSecret('1234', newSalt());
    const b = await hashSecret('1234', newSalt());
    expect(a).not.toBe(b);
  });
});

import { parseBackup } from '../backend';
describe('parseBackup', () => {
  const st = newIndividualState('u1', 'Sam', '🙂', 'RM', 0.5, 100);
  it('accepts an exported backup file and a bare state', () => {
    expect(parseBackup(JSON.stringify({ ritsu: 1, state: st })).accounts[0].name).toBe('Sam');
    expect(parseBackup(JSON.stringify(st)).members.length).toBe(1);
  });
  it('rejects files that are not Ritsu data', () => {
    expect(() => parseBackup('not json')).toThrow('not a Ritsu backup');
    expect(() => parseBackup('{"accounts":[]}')).toThrow('not a Ritsu backup');
  });
});
