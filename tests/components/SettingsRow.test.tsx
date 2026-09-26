import { render, screen } from '@testing-library/react-native';

import { SettingsRow } from '@/components/SettingsRow';

// Explicit rather than relying on RN's default "read every descendant Text
// node" behaviour for a Pressable with no accessibilityLabel — that default
// isn't guaranteed to skip an icon-font glyph like the row's chevron, which
// renders as literal (if invisible-looking) text content.
describe('SettingsRow', () => {
  it('combines the label and value into one accessible name when a value is shown', async () => {
    await render(<SettingsRow label="Parent PIN" value="Set" onPress={() => {}} />);

    expect(screen.getByLabelText('Parent PIN, Set')).toBeTruthy();
  });

  it('uses just the label as the accessible name when there is no value', async () => {
    await render(<SettingsRow label="Sign out" onPress={() => {}} />);

    expect(screen.getByLabelText('Sign out')).toBeTruthy();
  });

  it('is not exposed as a button when it has no onPress', async () => {
    await render(<SettingsRow label="Week" value="Monday → Sunday" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Week, Monday → Sunday')).toBeTruthy();
  });
});
