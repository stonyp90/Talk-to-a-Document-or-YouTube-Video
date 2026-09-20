// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VideoOverlay } from './VideoOverlay';

afterEach(cleanup);

describe('VideoOverlay', () => {
  it('renders video element', () => {
    render(<VideoOverlay active={true} />);
    const video = screen.getByTestId('video-overlay');
    expect(video).toBeInTheDocument();
  });

  it('applies default opacity', () => {
    render(<VideoOverlay active={true} />);
    const video = screen.getByTestId('video-overlay');
    expect(video).toHaveStyle({ opacity: '0.15' });
  });

  it('applies custom opacity', () => {
    render(<VideoOverlay active={true} opacity={0.2} />);
    const video = screen.getByTestId('video-overlay');
    expect(video).toHaveStyle({ opacity: '0.2' });
  });

  it('shows ghost state when camera unavailable', () => {
    render(<VideoOverlay active={false} cameraUnavailable={true} />);
    expect(screen.getByText(/camera unavailable/i)).toBeInTheDocument();
  });

  it('renders nothing when inactive and no ghost state', () => {
    const { container } = render(<VideoOverlay active={false} />);
    expect(container.firstChild).toBeNull();
  });
});
