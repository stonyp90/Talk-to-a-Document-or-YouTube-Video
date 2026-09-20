// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { KeyboardComposer } from './KeyboardComposer';

afterEach(() => {
  cleanup();
});

describe('KeyboardComposer', () => {
  it('renders text input', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onSend with text on Enter', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('calls onCommand with slash command on Enter', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '/upload' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommand).toHaveBeenCalledWith({ action: 'upload', argument: undefined });
  });

  it('shows autocomplete dropdown when typing /', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '/' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn();
    const onCommand = vi.fn();
    render(<KeyboardComposer onSend={onSend} onCommand={onCommand} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });
});
