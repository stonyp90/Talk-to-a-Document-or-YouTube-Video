import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LANGUAGE, french, samples, translate, type Language } from '../src/i18n';

test('English is the default for interface text and sample content', () => {
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(translate(DEFAULT_LANGUAGE, 'App language'), 'App language');
  assert.match(samples[DEFAULT_LANGUAGE], /^The power of small breaks/);
});

test('French is selected explicitly and English labels remain the source keys', () => {
  assert.equal(translate('fr', 'App language'), 'Langue de l’application');
  assert.equal(translate('en', 'Start voice conversation'), 'Start voice conversation');
  for (const key of Object.keys(french) as (keyof typeof french)[]) {
    assert.equal(translate('en', key), key);
    assert.ok(translate('fr', key).trim());
  }
});

test('an unrecognized runtime language falls back to English', () => {
  assert.equal(translate('de' as Language, 'App language'), 'App language');
});
