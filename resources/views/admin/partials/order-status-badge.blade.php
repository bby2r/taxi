@php
$colors = match($status) {
    App\Enums\OrderStatus::Searching  => 'bg-yellow-100 text-yellow-700',
    App\Enums\OrderStatus::Accepted   => 'bg-blue-100 text-blue-700',
    App\Enums\OrderStatus::Arrived    => 'bg-indigo-100 text-indigo-700',
    App\Enums\OrderStatus::InProgress => 'bg-purple-100 text-purple-700',
    App\Enums\OrderStatus::Completed  => 'bg-emerald-100 text-emerald-700',
    App\Enums\OrderStatus::Cancelled  => 'bg-red-100 text-red-700',
    default                           => 'bg-gray-100 text-gray-700',
};
@endphp
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {{ $colors }}">
    {{ $status->value }}
</span>
