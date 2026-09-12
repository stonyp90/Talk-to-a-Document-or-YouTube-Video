import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMode, DEFAULT_MODE, MODES, MODE_STORAGE_KEY, parseSavedMode } from '../src/modes';
import { translate } from '../src/i18n';

test('voice to action is the default and the first choice, as on the web', () => {
  assert.equal(DEFAULT_MODE, 'voice');
  assert.deepEqual(MODES.map((mode) => mode.id), ['voice', 'text', 'motion']);
  assert.equal(MODES[0].label, 'Voice to action');
  assert.equal(MODES[1].label, 'Keyboard to action');
});

test('the motion beta is announced but cannot be chosen', () => {
  const motion = MODES.find((mode) => mode.id === 'motion');
  assert.equal(motion?.available, false);
  assert.equal(motion?.detail, 'Beta');
  const kept = chooseMode('text', 'motion');
  assert.equal(kept.mode, 'text');
  assert.match(kept.notice, /not available yet/);
});

test('choosing a mode that exists switches and explains itself', () => {
  assert.deepEqual(chooseMode('voice', 'text'), {
    mode: 'text',
    notice: 'Keyboard to action: everything works by typing and clicking.',
  });
  assert.deepEqual(chooseMode('text', 'voice'), {
    mode: 'voice',
    notice: 'Voice to action: say a command, or use the controls as usual.',
  });
});

test('a saved choice is read back under the same key the web uses', () => {
  assert.equal(MODE_STORAGE_KEY, 'ursly-mode-v1');
  assert.equal(parseSavedMode('text'), 'text');
  assert.equal(parseSavedMode('voice'), 'voice');
  assert.equal(parseSavedMode(null), 'voice');
  assert.equal(parseSavedMode('gesture'), 'voice');
});

test('every mode label has an explicit French translation', () => {
  for (const mode of MODES) {
    assert.notEqual(translate('fr', mode.label), mode.label);
    assert.notEqual(translate('fr', mode.short), mode.short);
    if (mode.detail) assert.notEqual(translate('fr', mode.detail), mode.detail);
  }
});
