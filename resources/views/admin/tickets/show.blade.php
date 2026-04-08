@extends('layouts.admin')

@section('title', 'Ticket #' . $ticket->id)
@section('heading', 'Ticket #' . $ticket->id)

@section('content')
    {{-- Flash Message --}}
    @if (session('success'))
        <div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {{ session('success') }}
        </div>
    @endif

    {{-- Back Link --}}
    <div class="mb-6">
        <a href="{{ route('admin.tickets.index') }}" class="text-sm font-medium text-gray-500 hover:text-gray-700">
            &larr; Back to Tickets
        </a>
    </div>

    {{-- Status --}}
    <div class="mb-6">
        @include('admin.partials.ticket-status-badge', ['status' => $ticket->status])
    </div>

    {{-- Driver Info Card --}}
    <div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Driver</h3>
        <dl class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
                <dt class="text-xs text-gray-500">Name</dt>
                <dd class="text-sm font-medium text-gray-900">{{ $ticket->user?->name ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Phone</dt>
                <dd class="text-sm text-gray-700">{{ $ticket->user?->phone ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Car Model</dt>
                <dd class="text-sm text-gray-700">{{ $ticket->user?->driverProfile?->car_model ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Car Number</dt>
                <dd class="text-sm text-gray-700">{{ $ticket->user?->driverProfile?->car_number ?? '—' }}</dd>
            </div>
        </dl>
    </div>

    {{-- Change Details Card --}}
    <div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Change Details</h3>
        <dl class="space-y-3">
            <div>
                <dt class="text-xs text-gray-500">Field</dt>
                <dd class="text-sm font-medium text-gray-900">{{ ucfirst(str_replace('_', ' ', $ticket->field)) }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Old Value</dt>
                <dd class="text-sm text-red-600">{{ $ticket->old_value ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">New Value</dt>
                <dd class="text-sm text-emerald-600">{{ $ticket->new_value }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500">Submitted</dt>
                <dd class="text-sm text-gray-700">{{ $ticket->created_at->format('M d, Y H:i:s') }}</dd>
            </div>
        </dl>
    </div>

    {{-- Reviewer Info (if reviewed) --}}
    @if ($ticket->reviewed_at)
        <div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Review</h3>
            <dl class="space-y-3">
                <div>
                    <dt class="text-xs text-gray-500">Reviewed By</dt>
                    <dd class="text-sm font-medium text-gray-900">{{ $ticket->reviewer?->name ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-gray-500">Reviewed At</dt>
                    <dd class="text-sm text-gray-700">{{ $ticket->reviewed_at->format('M d, Y H:i:s') }}</dd>
                </div>
                @if ($ticket->admin_comment)
                    <div>
                        <dt class="text-xs text-gray-500">Comment</dt>
                        <dd class="text-sm text-gray-700">{{ $ticket->admin_comment }}</dd>
                    </div>
                @endif
            </dl>
        </div>
    @endif

    {{-- Action Buttons (only if Pending) --}}
    @if ($ticket->status === App\Enums\DriverChangeRequestStatus::Pending)
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Actions</h3>

            <div class="flex flex-col gap-4 md:flex-row md:items-start">
                {{-- Approve --}}
                <form method="POST" action="{{ route('admin.tickets.approve', $ticket) }}">
                    @csrf
                    <button
                        type="submit"
                        class="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-600"
                        onclick="return confirm('Are you sure you want to approve this change?')"
                    >
                        Approve
                    </button>
                </form>

                {{-- Reject --}}
                <form method="POST" action="{{ route('admin.tickets.reject', $ticket) }}" class="flex-1">
                    @csrf
                    <div class="flex items-start gap-2">
                        <textarea
                            name="admin_comment"
                            rows="2"
                            placeholder="Rejection reason (optional)"
                            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        ></textarea>
                        <button
                            type="submit"
                            class="inline-flex items-center rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600"
                            onclick="return confirm('Are you sure you want to reject this change?')"
                        >
                            Reject
                        </button>
                    </div>
                    @error('admin_comment')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </form>
            </div>
        </div>
    @endif
@endsection
