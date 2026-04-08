@php
$colors = match($status) {
    App\Enums\DriverChangeRequestStatus::Pending  => 'bg-yellow-100 text-yellow-700',
    App\Enums\DriverChangeRequestStatus::Approved  => 'bg-emerald-100 text-emerald-700',
    App\Enums\DriverChangeRequestStatus::Rejected  => 'bg-red-100 text-red-700',
    default                                        => 'bg-gray-100 text-gray-700',
};
@endphp
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {{ $colors }}">
    {{ ucfirst($status->value) }}
</span>
