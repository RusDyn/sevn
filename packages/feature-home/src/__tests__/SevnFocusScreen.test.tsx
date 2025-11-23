import { render, screen } from '@testing-library/react-native';

import { SevnFocusScreen } from '../SevnFocusScreen';

describe('SevnFocusScreen', () => {
  it('shows calm header and footer messages by default', () => {
    render(<SevnFocusScreen />);

    expect(screen.getByText(/Settle in/i)).toBeTruthy();
    expect(screen.getByText(/breath/i)).toBeTruthy();
  });

  it('applies custom focus messages', () => {
    render(
      <SevnFocusScreen messages={{ header: 'Custom header', footer: 'Custom footer' }}>
        <></>
      </SevnFocusScreen>,
    );

    expect(screen.getByText('Custom header')).toBeTruthy();
    expect(screen.getByText('Custom footer')).toBeTruthy();
  });
});
