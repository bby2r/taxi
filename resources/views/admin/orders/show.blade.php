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
        {{-- Client Card --}}
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Client</h3>
            <dl class="space-y-3">
                <div>
                    <dt class="text-xs text-gray-500">Name</dt>
                    <dd class="text-sm font-medium text-gray-900">{{ $order->client?->name ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Phone</dt>
                    <dd class="text-sm text-gray-700">{{ $order->client?->phone ?? '—' }}</dd>
                </div>
            </dl>
        </div>

        {{-- Driver Card --}}
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Driver</h3>
            <dl class="space-y-3">
                <div>
                    <dt class="text-xs text-gray-500">Name</dt>
                    <dd class="text-sm font-medium text-gray-900">{{ $order->driver?->name ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Phone</dt>
                    <dd class="text-sm text-gray-700">{{ $order->driver?->phone ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Car</dt>
                    <dd class="text-sm text-gray-700">{{ $order->driver?->driverProfile?->car_model ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Plate</dt>
                    <dd class="text-sm text-gray-700">{{ $order->driver?->driverProfile?->car_number ?? '—' }}</dd>
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
@endsection
