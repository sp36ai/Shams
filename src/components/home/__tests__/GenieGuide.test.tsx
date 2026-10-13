/**
 * GenieGuide — the guide is a fixed menu: it answers only its pre-written
 * questions and offers no way to type anything.
 */
import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/renderScreen';
import GenieGuide from '../GenieGuide';
import { GUIDE_ENTRIES, GUIDE_GREETING } from '../../../data/guideFaq';

describe('GenieGuide', () => {
  it('opens with its greeting and one option per pre-written question', async () => {
    await renderScreen(<GenieGuide visible onClose={jest.fn()} />);

    expect(screen.getByText(GUIDE_GREETING)).toBeTruthy();
    for (const entry of GUIDE_ENTRIES) {
      expect(screen.getByTestId(`genie-option-${entry.id}`)).toBeTruthy();
    }
  });

  it('has no text box — the seeker can only pick a question', async () => {
    await renderScreen(<GenieGuide visible onClose={jest.fn()} />);
    // No host TextInput anywhere in the rendered guide.
    expect(JSON.stringify(screen.toJSON())).not.toContain('"type":"TextInput"');
  });

  it('answers a picked question with its pre-written answer', async () => {
    await renderScreen(<GenieGuide visible onClose={jest.fn()} />);
    const entry = GUIDE_ENTRIES.find(e => e.id === 'ask')!;

    await userEvent.setup().press(screen.getByTestId('genie-option-ask'));

    expect(screen.getByText(entry.answer)).toBeTruthy();
    // The question appears once as the option chip and once as the asked bubble.
    expect(screen.getAllByText(entry.question)).toHaveLength(2);
  });

  it('closes from the Close button', async () => {
    const onClose = jest.fn();
    await renderScreen(<GenieGuide visible onClose={onClose} />);
    await userEvent.setup().press(screen.getByTestId('genie-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
