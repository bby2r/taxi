@extends('layouts.admin')

@section('title', 'Dashboard')
@section('heading', 'Dashboard')

@section('content')
    {{-- Stats Grid --}}
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {{-- Active Orders --}}
        <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
                <p class="text-sm text-gray-500">Active Orders</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">{{ $activeOrders }}</p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                {{-- Heroicon: clock (outline) --}}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            </div>
        </div>

        {{-- Online Drivers --}}
        <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
                <p class="text-sm text-gray-500">Online Drivers</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">{{ $onlineDrivers }}</p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                {{-- Heroicon: user-group (outline) --}}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
            </div>
        </div>

        {{-- Today Revenue --}}
        <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
                <p class="text-sm text-gray-500">Today Revenue</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">{{ number_format($todayRevenue) }} KGS</p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                {{-- Heroicon: banknotes (outline) --}}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
            </div>
        </div>

        {{-- Total Rides --}}
        <div class="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
                <p class="text-sm text-gray-500">Total Rides</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">{{ $totalRides }}</p>
            </div>
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                {{-- Heroicon: map-pin (outline) --}}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
            </div>
        </div>
    </div>

    {{-- Recent Orders --}}
    <div class="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="border-b border-gray-200 px-6 py-4">
            <h3 class="text-base font-semibold text-gray-900">Recent Orders</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                        <th class="px-6 py-3">ID</th>
                        <th class="px-6 py-3">Client</th>
                        <th class="px-6 py-3">Driver</th>
                        <th class="px-6 py-3">Status</th>
                        <th class="px-6 py-3">Price</th>
                        <th class="px-6 py-3">Date</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    @forelse ($recentOrders as $order)
                        <tr class="hover:bg-gray-50">
                            <td class="whitespace-nowrap px-6 py-4 font-medium text-gray-900">#{{ $order->id }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $order->client?->name ?? '—' }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ $order->driver?->name ?? '—' }}</td>
                            <td class="whitespace-nowrap px-6 py-4">
                                @include('admin.partials.order-status-badge', ['status' => $order->status])
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-700">{{ number_format($order->price) }} KGS</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500">{{ $order->created_at->format('M d, Y H:i') }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-gray-500">No orders yet.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
@endsection
