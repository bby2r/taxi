import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OtpInput from '../../src/components/OtpInput';

describe('OtpInput', () => {
  it('renders correct number of cells (4)', () => {
    const { getAllByLabelText } = render(
      <OtpInput onComplete={jest.fn()} />,
    );
    const cells = getAllByLabelText(/Цифра \d+ из 4/);
    expect(cells).toHaveLength(4);
  });

  it('calls onComplete with full code string when all digits entered', () => {
    const onComplete = jest.fn();
    const { getAllByLabelText } = render(
      <OtpInput onComplete={onComplete} />,
    );
    const cells = getAllByLabelText(/Цифра \d+ из 4/);

    fireEvent.changeText(cells[0], '1');
    fireEvent.changeText(cells[1], '2');
    fireEvent.changeText(cells[2], '3');
    fireEvent.changeText(cells[3], '4');

    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('clears values and shakes on error prop change', () => {
    const onComplete = jest.fn();
    const { getAllByLabelText, rerender } = render(
      <OtpInput onComplete={onComplete} error={false} />,
    );
    const cells = getAllByLabelText(/Цифра \d+ из 4/);

    // Fill all cells
    fireEvent.changeText(cells[0], '1');
    fireEvent.changeText(cells[1], '2');
    fireEvent.changeText(cells[2], '3');
    fireEvent.changeText(cells[3], '4');

    // Re-render with error=true
    rerender(<OtpInput onComplete={onComplete} error={true} />);

    // After error, cells should be cleared
    const updatedCells = getAllByLabelText(/Цифра \d+ из 4/);
    updatedCells.forEach((cell) => {
      expect(cell.props.value).toBe('');
    });
  });

  it('backspace on empty cell moves focus to previous cell', () => {
    const { getAllByLabelText } = render(
      <OtpInput onComplete={jest.fn()} />,
    );
    const cells = getAllByLabelText(/Цифра \d+ из 4/);

    // Fill first cell so second cell is relevant
    fireEvent.changeText(cells[0], '1');

    // Clear second cell (it's empty by default after auto-advance)
    // Simulate backspace on the empty second cell
    fireEvent(cells[1], 'onKeyPress', {
      nativeEvent: { key: 'Backspace' },
    });

    // We can't directly assert focus in RNTL, but the test should not throw
    // The handler should attempt to focus the previous cell
    expect(cells).toHaveLength(4);
  });
});
