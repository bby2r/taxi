import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import OrderOfferCard from '../../src/components/OrderOfferCard';
import type { Order } from '../../src/api/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    status: 'searching',
    price: 150,
    pickup_address: 'ул. Ленина 42',
    pickup_latitude: 42.87,
    pickup_longitude: 74.59,
    dropoff_address: null,
    dropoff_latitude: null,
    dropoff_longitude: null,
    is_inter_district: false,
    region: null,
    driver: null,
    created_at: '2026-04-07T10:00:00Z',
    accepted_at: null,
    cancelled_by: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('OrderOfferCard', () => {
  it('renders pickup address and price', () => {
    const { getByText } = render(
      <OrderOfferCard
        order={makeOrder()}
        onAccept={jest.fn()}
        onDecline={jest.fn()}
      />
    );
    expect(getByText('ул. Ленина 42')).toBeTruthy();
    expect(getByText('150 сом')).toBeTruthy();
  });

  it('countdown decrements every second', () => {
    const { getByText } = render(
      <OrderOfferCard
        order={makeOrder()}
        onAccept={jest.fn()}
        onDecline={jest.fn()}
        countdownSeconds={5}
      />
    );
    expect(getByText('5')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(getByText('4')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(getByText('3')).toBeTruthy();
  });

  it('calls onDecline when countdown reaches 0', () => {
    const onDecline = jest.fn();
    render(
      <OrderOfferCard
        order={makeOrder()}
        onAccept={jest.fn()}
        onDecline={onDecline}
        countdownSeconds={3}
      />
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('calls onAccept when accept button pressed', () => {
    const onAccept = jest.fn();
    const { getByText } = render(
      <OrderOfferCard
        order={makeOrder()}
        onAccept={onAccept}
        onDecline={jest.fn()}
      />
    );
    fireEvent.press(getByText('Принять'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('opens reason sheet and calls onDecline with selected reason', () => {
    const onDecline = jest.fn();
    const { getByText } = render(
      <OrderOfferCard
        order={makeOrder()}
        onAccept={jest.fn()}
        onDecline={onDecline}
      />
    );
    fireEvent.press(getByText('Отказаться'));
    fireEvent.press(getByText('Слишком далеко'));
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledWith('too_far');
  });
});
