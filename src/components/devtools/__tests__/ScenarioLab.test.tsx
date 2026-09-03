import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { ScenarioLab } from '../ScenarioLab';
import { SCENARIOS } from '@/services/runtime';
import { useChatStore } from '@/stores/chat';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ScenarioLab', () => {
  it('offers every mandatory scenario', () => {
    renderWithProviders(<ScenarioLab />);
    fireEvent.click(screen.getByTestId('scenario-lab-toggle'));
    for (const scenario of SCENARIOS) {
      expect(screen.getByTestId(`scenario-${scenario.id}`)).toBeInTheDocument();
    }
    expect(SCENARIOS).toHaveLength(30);
  });

  it('applies the scenario when one is chosen', () => {
    renderWithProviders(<ScenarioLab />);
    fireEvent.click(screen.getByTestId('scenario-lab-toggle'));
    fireEvent.click(screen.getByTestId('scenario-empty-project'));
    expect(useChatStore.getState().sessions).toEqual([]);
  });

  it('renders nothing outside development', () => {
    // The lab must never reach the shipped UI; in a production bundle this
    // flag is statically false and the component is tree-shaken entirely.
    vi.stubEnv('DEV', false);
    const { container } = renderWithProviders(<ScenarioLab />);
    expect(container).toBeEmptyDOMElement();
  });
});
