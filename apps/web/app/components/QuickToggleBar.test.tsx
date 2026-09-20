// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuickToggleBar } from './QuickToggleBar';

afterEach(() => {
  cleanup();
});

describe('QuickToggleBar', () => {
  it('renders mic and camera toggle buttons', () => {
    const onToggleVoice = vi.fn();
    const onToggleCamera = vi.fn();
    render(<QuickToggleBar voiceActive={false} cameraActive={false} onToggleVoice={onToggleVoice} onToggleCamera={onToggleCamera} />);
    expect(screen.getByRole('button', { name: /mic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /camera/i })).toBeInTheDocument();
  });

  it('calls onToggleVoice on mic click', () => {
    const onToggleVoice = vi.fn();
    const onToggleCamera = vi.fn();
    render(<QuickToggleBar voiceActive={false} cameraActive={false} onToggleVoice={onToggleVoice} onToggleCamera={onToggleCamera} />);
    const micButton = screen.getByRole('button', { name: /mic/i });
    fireEvent.click(micButton);
    expect(onToggleVoice).toHaveBeenCalled();
  });

  it('calls onToggleCamera on camera click', () => {
    const onToggleVoice = vi.fn();
    const onToggleCamera = vi.fn();
    render(<QuickToggleBar voiceActive={false} cameraActive={false} onToggleVoice={onToggleVoice} onToggleCamera={onToggleCamera} />);
    const cameraButton = screen.getByRole('button', { name: /camera/i });
    fireEvent.click(cameraButton);
    expect(onToggleCamera).toHaveBeenCalled();
  });

  it('reflects active state', () => {
    const onToggleVoice = vi.fn();
    const onToggleCamera = vi.fn();
    render(<QuickToggleBar voiceActive={true} cameraActive={true} onToggleVoice={onToggleVoice} onToggleCamera={onToggleCamera} />);
    const micButton = screen.getByRole('button', { name: /mic/i });
    const cameraButton = screen.getByRole('button', { name: /camera/i });
    expect(micButton).toHaveAttribute('aria-pressed', 'true');
    expect(cameraButton).toHaveAttribute('aria-pressed', 'true');
  });
});
