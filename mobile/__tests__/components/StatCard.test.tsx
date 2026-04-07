import React from 'react';
import { render } from '@testing-library/react-native';
import StatCard from '../../src/components/StatCard';

describe('StatCard', () => {
  it('renders title, earnings with "сом", and order count', () => {
    const { getByText } = render(
      <StatCard title="Сегодня" orders={10} earnings={500} />
    );

    expect(getByText('Сегодня')).toBeTruthy();
    expect(getByText('500 сом')).toBeTruthy();
    expect(getByText('10 заказов')).toBeTruthy();
  });

  it('uses "заказ" for 1 order', () => {
    const { getByText } = render(
      <StatCard title="Сегодня" orders={1} earnings={100} />
    );

    expect(getByText('1 заказ')).toBeTruthy();
  });

  it('uses "заказа" for 3 orders', () => {
    const { getByText } = render(
      <StatCard title="Неделя" orders={3} earnings={300} />
    );

    expect(getByText('3 заказа')).toBeTruthy();
  });

  it('uses "заказов" for 5 orders', () => {
    const { getByText } = render(
      <StatCard title="Месяц" orders={5} earnings={1000} />
    );

    expect(getByText('5 заказов')).toBeTruthy();
  });

  it('has correct accessibility label', () => {
    const { getByLabelText } = render(
      <StatCard title="Всего" orders={1} earnings={250} />
    );

    expect(getByLabelText('Всего: 1 заказ, 250 сом')).toBeTruthy();
  });
});
