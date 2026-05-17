@extends('layouts.admin')

@section('title', 'Order #' . $order->id)
@section('heading', 'Order #' . $order->id)

@section('content')
    {{-- Back Link --}}
    <div class="mb-6">
        <a href="{{ route('admin.orders.index') }}" class="text-sm font-medium text-gray-500 hover:text-gray-700">
            &larr; Back to Orders
        </a>
    </div>

    {{-- Status & Price --}}
    <div class="mb-6 flex items-center justify-between">
        @include('admin.partials.order-status-badge', ['status' => $order->status])
        <span class="text-2xl font-bold text-gray-900">{{ number_format($order->price) }} KGS</span>
    </div>

    {{-- Client & Driver Cards --}}
    <div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        @php
            // Live relation wins (current accurate data), falls back to
            // the snapshot taken at order creation / accept so history
            // survives a user delete or a driver editing their profile.
            $clientName = $order->client?->name ?? ($order->client_snapshot['name'] ?? null);
            $clientPhone = $order->client?->phone ?? ($order->client_snapshot['phone'] ?? null);
            $driverName = $order->driver?->name ?? ($order->driver_snapshot['name'] ?? null);
            $driverPhone = $order->driver?->phone ?? ($order->driver_snapshot['phone'] ?? null);
            $driverCar = $order->driver?->driverProfile?->car_model ?? ($order->driver_snapshot['car_model'] ?? null);
            $driverPlate = $order->driver?->driverProfile?->car_number ?? ($order->driver_snapshot['car_number'] ?? null);
            $clientDeleted = $order->client === null && $order->client_snapshot !== null;
            $driverDeleted = $order->driver === null && $order->driver_snapshot !== null;
        @endphp

        {{-- Client Card --}}
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Client
                @if ($clientDeleted)
                    <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium normal-case text-amber-700">deleted — snapshot</span>
                @endif
            </h3>
            <dl class="space-y-3">
                <div>
                    <dt class="text-xs text-gray-500">Name</dt>
                    <dd class="text-sm font-medium text-gray-900">{{ $clientName ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Phone</dt>
                    <dd class="text-sm text-gray-700">{{ $clientPhone ?? '—' }}</dd>
                </div>
            </dl>
        </div>

        {{-- Driver Card --}}
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Driver
                @if ($driverDeleted)
                    <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium normal-case text-amber-700">deleted — snapshot</span>
                @endif
            </h3>
            <dl class="space-y-3">
                <div>
                    <dt class="text-xs text-gray-500">Name</dt>
                    <dd class="text-sm font-medium text-gray-900">{{ $driverName ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Phone</dt>
                    <dd class="text-sm text-gray-700">{{ $driverPhone ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Car</dt>
                    <dd class="text-sm text-gray-700">{{ $driverCar ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Plate</dt>
                    <dd class="text-sm text-gray-700">{{ $driverPlate ?? '—' }}</dd>
                </div>
            </dl>
        </div>
    </div>

    {{-- Order Details Card --}}
    <div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Order Details</h3>
        <dl class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
                <dt class="text-xs text-gray-500">Pickup Address</dt>
                <dd class="text-sm text-gray-700">{{ $order->pickup_address ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Dropoff Address</dt>
                <dd class="text-sm text-gray-700">{{ $order->dropoff_address ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Pickup Coordinates</dt>
                <dd class="text-sm text-gray-700">{{ $order->pickup_latitude }}, {{ $order->pickup_longitude }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Dropoff Coordinates</dt>
                <dd class="text-sm text-gray-700">
                    @if ($order->dropoff_latitude && $order->dropoff_longitude)
                        {{ $order->dropoff_latitude }}, {{ $order->dropoff_longitude }}
                    @else
                        —
                    @endif
                </dd>
            </div>
        </dl>
    </div>

    {{-- Timeline Card --}}
    <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Timeline</h3>
        <dl class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
                <dt class="text-xs text-gray-500">Created</dt>
                <dd class="text-sm text-gray-700">{{ $order->created_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Accepted</dt>
                <dd class="text-sm text-gray-700">{{ $order->accepted_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Driver Arrived</dt>
                <dd class="text-sm text-gray-700">{{ $order->arrived_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">In Progress</dt>
                <dd class="text-sm text-gray-700">{{ $order->in_progress_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Completed</dt>
                <dd class="text-sm text-gray-700">{{ $order->completed_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Cancelled</dt>
                <dd class="text-sm text-gray-700">{{ $order->cancelled_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Last Updated</dt>
                <dd class="text-sm text-gray-700">{{ $order->updated_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
        </dl>
    </div>

    {{-- Decline history — why drivers passed on this order. Useful for
         spotting mismatched offers (too_far on every driver = dispatch
         radius too wide, etc.). --}}
    @if ($order->declines->isNotEmpty())
        <div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Declines ({{ $order->declines->count() }})
            </h3>
            <table class="min-w-full text-sm">
                <thead>
                    <tr class="text-left text-xs uppercase tracking-wider text-gray-500">
                        <th class="py-2 pr-4">Driver</th>
                        <th class="py-2 pr-4">Reason</th>
                        <th class="py-2 pr-4">When</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($order->declines as $decline)
                        <tr class="border-t border-gray-100">
                            <td class="py-2 pr-4 text-gray-900">{{ $decline->driver?->name ?? '—' }}</td>
                            <td class="py-2 pr-4 text-gray-700">{{ $decline->reason ?? '—' }}</td>
                            <td class="py-2 pr-4 text-gray-500">{{ $decline->created_at?->format('M d, H:i:s') ?? '—' }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif
@endsection
