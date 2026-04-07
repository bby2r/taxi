import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import DriverCard from '../../src/components/DriverCard';
import type { Driver } from '../../src/api/types';

jest.spyOn(Linking, 'openURL').mockImplementation(jest.fn());

const testDriver: Driver = {
  name: 'Азамат',
  phone: '+996555111222',
  car_model: 'Toyota Camry',
  car_number: '01KG123ABC',
  latitude: 42.88,
  longitude: 74.60,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DriverCard', () => {
  it('renders driver name, car model, car number', () => {
    const { getByText } = render(
      <DriverCard driver={testDriver} status="accepted" />,
    );
    expect(getByText('Азамат')).toBeTruthy();
    expect(getByText('Toyota Camry · 01KG123ABC')).toBeTruthy();
  });

  it('shows correct status text for accepted state', () => {
    const { getByText } = render(
      <DriverCard driver={testDriver} status="accepted" />,
    );
    expect(getByText('В пути к вам')).toBeTruthy();
  });

  it('shows correct status text for arrived state', () => {
    const { getByText } = render(
      <DriverCard driver={testDriver} status="arrived" />,
    );
    expect(getByText('Водитель прибыл!')).toBeTruthy();
  });

  it('shows correct status text for in_progress state', () => {
    const { getByText } = render(
      <DriverCard driver={testDriver} status="in_progress" />,
    );
    expect(getByText('Поездка...')).toBeTruthy();
  });

  it('phone button triggers Linking.openURL with tel: scheme', () => {
    const { getByLabelText } = render(
      <DriverCard driver={testDriver} status="accepted" />,
    );
    const phoneButton = getByLabelText('Позвонить водителю');
    fireEvent.press(phoneButton);
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+996555111222');
  });
});
