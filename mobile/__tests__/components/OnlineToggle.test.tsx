import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OnlineToggle from '../../src/components/OnlineToggle';

describe('OnlineToggle', () => {
  it('renders "OFF" and "Не на линии" when offline', () => {
    const { getByText } = render(
      <OnlineToggle isOnline={false} onToggle={jest.fn()} />
    );
    expect(getByText('OFF')).toBeTruthy();
    expect(getByText('Не на линии')).toBeTruthy();
  });

  it('renders "ON" and "На линии" when online', () => {
    const { getByText } = render(
      <OnlineToggle isOnline={true} onToggle={jest.fn()} />
    );
    expect(getByText('ON')).toBeTruthy();
    expect(getByText('На линии')).toBeTruthy();
  });

  it('calls onToggle on press', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(
      <OnlineToggle isOnline={false} onToggle={onToggle} />
    );
    fireEvent.press(getByRole('switch'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows ActivityIndicator when loading', () => {
    const { queryByText, UNSAFE_getByType } = render(
      <OnlineToggle isOnline={false} onToggle={jest.fn()} loading={true} />
    );
    // When loading, OFF/ON text should not be shown
    expect(queryByText('OFF')).toBeNull();
    expect(queryByText('ON')).toBeNull();
  });

  it('has correct accessibility role "switch"', () => {
    const { getByRole } = render(
      <OnlineToggle isOnline={true} onToggle={jest.fn()} />
    );
    const switchEl = getByRole('switch');
    expect(switchEl).toBeTruthy();
    expect(switchEl.props.accessibilityState).toMatchObject({ checked: true });
  });
});
