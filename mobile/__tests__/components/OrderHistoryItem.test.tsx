import React from 'react';
import { render } from '@testing-library/react-native';
import OrderHistoryItem from '../../src/components/OrderHistoryItem';
import type { Order } from '../../src/api/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    status: 'completed',
    price: 150,
    pickup_address: 'ул. Киевская 123',
    pickup_latitude: 42.87,
    pickup_longitude: 74.59,
    driver: null,
    created_at: '2026-03-15T14:30:00Z',
    accepted_at: null,
    ...overrides,
  };
}

describe('OrderHistoryItem', () => {
  it('renders formatted date', () => {
    const order = makeOrder({ created_at: '2026-03-15T14:30:00Z' });
    const { getByText } = render(<OrderHistoryItem order={order} />);
    // dayjs with Russian locale formats month abbreviation and renders in local TZ
    // Match the date portion and year reliably
    expect(getByText(/15.*мар.*2026/)).toBeTruthy();
  });

  it('renders pickup address', () => {
    const order = makeOrder({ pickup_address: 'ул. Киевская 123' });
    const { getByText } = render(<OrderHistoryItem order={order} />);
    expect(getByText('ул. Киевская 123')).toBeTruthy();
  });

  it('renders fallback address when pickup_address is null', () => {
    const order = makeOrder({ pickup_address: null });
    const { getByText } = render(<OrderHistoryItem order={order} />);
    expect(getByText('Без адреса')).toBeTruthy();
  });

  it('renders price with "сом" suffix', () => {
    const order = makeOrder({ price: 250 });
    const { getByText } = render(<OrderHistoryItem order={order} />);
    expect(getByText('250 сом')).toBeTruthy();
  });

  it('shows green badge with "Завершён" for completed status', () => {
    const order = makeOrder({ status: 'completed' });
    const { getByText } = render(<OrderHistoryItem order={order} />);
    const badge = getByText('Завершён');
    expect(badge).toBeTruthy();
  });

  it('shows red badge with "Отменён" for cancelled status', () => {
    const order = makeOrder({ status: 'cancelled' });
    const { getByText } = render(<OrderHistoryItem order={order} />);
    const badge = getByText('Отменён');
    expect(badge).toBeTruthy();
  });

  it('shows yellow badge with "В процессе" for searching status', () => {
    const order = makeOrder({ status: 'searching' });
    const { getByText } = render(<OrderHistoryItem order={order} />);
    const badge = getByText('В процессе');
    expect(badge).toBeTruthy();
  });

  it('has accessibility label with order details', () => {
    const order = makeOrder({
      pickup_address: 'Проспект Мира',
      price: 100,
      status: 'completed',
    });
    const { getByLabelText } = render(<OrderHistoryItem order={order} />);
    expect(getByLabelText(/Проспект Мира.*100 сом.*Завершён/)).toBeTruthy();
  });
});
