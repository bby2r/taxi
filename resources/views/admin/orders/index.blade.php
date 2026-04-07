@extends('layouts.admin')

@section('title', 'Orders')
@section('heading', 'Orders')

@section('content')
    {{-- Filter Bar --}}
    <div class="mb-6 flex items-center justify-between">
        <p class="text-sm text-gray-600">Total: {{ $orders->total() }} orders</p>

        <form method="GET" action="{{ route('admin.orders.index') }}" class="flex items-center gap-2">
            <select
                name="status"
                class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
                <option value="">All Statuses</option>
                @foreach ($statuses as $status)
                    <option value="{{ $status->value }}" @selected(request('status') === $status->value)>
                        {{ ucfirst(str_replace('_', ' ', $status->value)) }}
                    </option>
                @endforeach
            </select>

            <button
                type="submit"
                class="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
            >
                Filter
            </button>

            @if (request('status'))
                <a
                    href="{{ route('admin.orders.index') }}"
                    class="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                    Clear
                </a>
            @endif
        </form>
    </div>

    {{-- Table --}}
    <div class="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                        <th class="px-6 py-3">ID</th>
                        <th class="px-6 py-3">Date</th>
                        <th class="px-6 py-3">Client</th>
                        <th class="px-6 py-3">Driver</th>
                        <th class="px-6 py-3">Status</th>
                        <th class="px-6 py-3 text-right">Price</th>
                        <th class="px-6 py-3"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    @forelse ($orders as $order)
                        <tr class="hover:bg-gray-50">
                            <td class="whitespace-nowrap px-6 py-4 font-medium text-gray-900">#{{ $order->id }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500">{{ $order->created_at->format('M d, Y H:i') }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $order->client?->name ?? '—' }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $order->driver?->name ?? '—' }}</td>
                            <td class="whitespace-nowrap px-6 py-4">
                                @include('admin.partials.order-status-badge', ['status' => $order->status])
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-right font-medium text-gray-900">{{ number_format($order->price) }} KGS</td>
                            <td class="whitespace-nowrap px-6 py-4 text-right">
                                <a
                                    href="{{ route('admin.orders.show', $order) }}"
                                    class="text-sm font-medium text-amber-600 hover:text-amber-700"
                                >
                                    View
                                </a>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="px-6 py-8 text-center text-gray-500">No orders found.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    {{-- Pagination --}}
    <div class="mt-4">
        {{ $orders->links() }}
    </div>
@endsection
