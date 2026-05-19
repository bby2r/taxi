@extends('layouts.admin')

@section('title', 'Клиенты')
@section('heading', 'Клиенты')

@section('content')
    {{-- Header --}}
    <div class="mb-6 flex items-center justify-between">
        <p class="text-sm text-gray-600">Всего: {{ $clients->total() }} клиентов</p>
    </div>

    {{-- Flash Messages --}}
    @if (session('success'))
        <div class="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            {{ session('success') }}
        </div>
    @endif

    @if (session('error'))
        <div class="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {{ session('error') }}
        </div>
    @endif

    {{-- Table --}}
    <div class="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                        <th class="px-6 py-3">Имя</th>
                        <th class="px-6 py-3">Телефон</th>
                        <th class="px-6 py-3">Всего заказов</th>
                        <th class="px-6 py-3">Дата регистрации</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    @forelse ($clients as $client)
                        <tr class="hover:bg-gray-50">
                            <td class="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{{ $client->name }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $client->phone }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $client->client_orders_count }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500">{{ $client->created_at->format('d.m.Y') }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4" class="px-6 py-8 text-center text-gray-500">Клиентов нет.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    {{-- Pagination --}}
    <div class="mt-4">
        {{ $clients->links() }}
    </div>
@endsection
