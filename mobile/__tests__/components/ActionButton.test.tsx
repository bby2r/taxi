import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ActionButton from '../../src/components/ActionButton';

describe('ActionButton', () => {
  it('renders title text', () => {
    const { getByText } = render(
      <ActionButton title="Submit" onPress={jest.fn()} />,
    );
    expect(getByText('Submit')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <ActionButton title="Tap me" onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows ActivityIndicator when loading', () => {
    const { queryByText, UNSAFE_getByType } = render(
      <ActionButton title="Loading" onPress={jest.fn()} loading />,
    );
    // Title should not be visible when loading
    expect(queryByText('Loading')).toBeNull();
    // ActivityIndicator should be rendered
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <ActionButton title="Disabled" onPress={onPress} disabled />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('applies correct backgroundColor for primary variant', () => {
    const { getByRole } = render(
      <ActionButton title="Primary" onPress={jest.fn()} variant="primary" />,
    );
    const button = getByRole('button');
    const flatStyle = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.filter(Boolean))
      : button.props.style;
    expect(flatStyle.backgroundColor).toBe('#FBBF24');
  });

  it('applies correct backgroundColor for danger variant', () => {
    const { getByRole } = render(
      <ActionButton title="Danger" onPress={jest.fn()} variant="danger" />,
    );
    const button = getByRole('button');
    const flatStyle = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.filter(Boolean))
      : button.props.style;
    expect(flatStyle.backgroundColor).toBe('#EF4444');
  });

  it('applies transparent backgroundColor for outline variant', () => {
    const { getByRole } = render(
      <ActionButton title="Outline" onPress={jest.fn()} variant="outline" />,
    );
    const button = getByRole('button');
    const flatStyle = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.filter(Boolean))
      : button.props.style;
    expect(flatStyle.backgroundColor).toBe('transparent');
  });
});
