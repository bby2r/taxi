@extends('layouts.admin')

@section('title', 'Биллинг')
@section('heading', 'Биллинг водителей')

@section('content')
    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="rounded-lg bg-white p-5 shadow-sm">
            <p class="text-sm text-gray-500">Текущий долг (всего)</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ number_format($totals['pending'], 0, '.', ' ') }} сом</p>
        </div>
        <div class="rounded-lg bg-white p-5 shadow-sm">
            <p class="text-sm text-gray-500">Комиссия за неделю</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ number_format($totals['week_commission'], 0, '.', ' ') }} сом</p>
        </div>
        <div class="rounded-lg bg-white p-5 shadow-sm">
            <p class="text-sm text-gray-500">Водителей с долгом</p>
            <p class="mt-2 text-2xl font-semibold text-gray-900">{{ $totals['drivers_with_debt'] }}</p>
        </div>
    </div>

    <div class="overflow-hidden rounded-lg bg-white shadow-sm">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Водитель</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Телефон</th>
                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Поездок (нед)</th>
                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Заработок (нед)</th>
                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Комиссия (нед)</th>
                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Долг</th>
                    <th scope="col" class="px-6 py-3"></th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
                @forelse ($rows as $row)
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ $row['driver']->name }}</td>
                        <td class="px-6 py-4 text-sm text-gray-600">{{ $row['driver']->phone }}</td>
                        <td class="px-6 py-4 text-right text-sm text-gray-700">{{ $row['week_orders'] }}</td>
                        <td class="px-6 py-4 text-right text-sm text-gray-700">{{ number_format($row['week_earnings'], 0, '.', ' ') }} сом</td>
                        <td class="px-6 py-4 text-right text-sm text-gray-700">{{ number_format($row['week_commission'], 0, '.', ' ') }} сом</td>
                        <td class="px-6 py-4 text-right text-sm font-semibold {{ $row['balance'] > 0 ? 'text-red-600' : 'text-emerald-600' }}">
                            {{ number_format($row['balance'], 0, '.', ' ') }} сом
                        </td>
                        <td class="px-6 py-4 text-right text-sm">
                            <a href="{{ route('admin.billing.show', $row['driver']) }}" class="font-medium text-amber-600 hover:text-amber-700">Открыть</a>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="7" class="px-6 py-10 text-center text-sm text-gray-500">Нет водителей</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
