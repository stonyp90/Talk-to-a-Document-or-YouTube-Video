"use client";

import { useState, useCallback, useRef } from 'react';
import { useKeyboardMode } from './useKeyboardMode';
import styles from './KeyboardComposer.module.css';

interface KeyboardComposerProps {
  onSend: (text: string) => void;
  onCommand: (cmd: { action: string; argument?: string }) => void;
}

const ALL_COMMANDS = [
  { command: '/upload', description: 'Open file upload' },
  { command: '/summarize', description: 'Summarize current source' },
  { command: '/back', description: 'Go back' },
  { command: '/youtube', description: 'Load YouTube source' },
  { command: '/search', description: 'Search within source' },
  { command: '/clear', description: 'Reset conversation' },
  { command: '/settings', description: 'Open settings' },
  { command: '/files', description: 'Open file browser' },
];

export function KeyboardComposer({ onSend, onCommand }: KeyboardComposerProps) {
  const [value, setValue] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const { parseSlashcommand } = useKeyboardMode();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredCommands = ALL_COMMANDS.filter(c =>
    c.command.startsWith(value.split(' ')[0])
  );

  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;

    const cmd = parseSlashcommand(value);
    if (cmd) {
      onCommand(cmd);
    } else {
      onSend(value.trim());
    }
    setValue('');
    setShowAutocomplete(false);
  }, [value, parseSlashcommand, onSend, onCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && showAutocomplete) {
      e.preventDefault();
      setShowAutocomplete(false);
    }
  }, [handleSubmit, showAutocomplete]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setShowAutocomplete(newValue.startsWith('/') && newValue.indexOf(' ') === -1);
  }, []);

  return (
    <div className={styles.composer}>
      {showAutocomplete && filteredCommands.length > 0 && (
        <ul className={styles.autocomplete} role="listbox">
          {filteredCommands.map(cmd => (
            <li
              key={cmd.command}
              role="option"
              className={styles.autocompleteItem}
              onClick={() => {
                setValue(cmd.command + ' ');
                setShowAutocomplete(false);
                inputRef.current?.focus();
              }}
            >
              <span className={styles.commandName}>{cmd.command}</span>
              <span className={styles.commandDesc}>{cmd.description}</span>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message or /command..."
        rows={1}
      />
    </div>
  );
}
