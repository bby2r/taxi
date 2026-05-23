@extends('layouts.admin')

@section('title', 'Коды OTP')
@section('heading', 'Коды OTP')

@section('content')
    {{-- Header --}}
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-gray-600">
            За последние 24 часа: {{ $otps->total() }}
            <span class="ml-2 text-xs text-gray-400">обновляется каждые 10 секунд</span>
        </p>

        <form method="GET" action="{{ route('admin.otps.index') }}" class="flex items-center gap-2">
            <input
                type="text"
                name="phone"
                value="{{ $phone }}"
                placeholder="Поиск по телефону"
                class="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
            <button type="submit" class="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
                Найти
            </button>
            @if ($phone !== '')
                <a href="{{ route('admin.otps.index') }}" class="text-sm text-gray-500 hover:text-gray-700">
                    Сбросить
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
                        <th class="px-6 py-3">Телефон</th>
                        <th class="px-6 py-3">Код</th>
                        <th class="px-6 py-3">Статус</th>
                        <th class="px-6 py-3">Создан</th>
                        <th class="px-6 py-3">Истекает</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    @forelse ($otps as $otp)
                        <tr class="hover:bg-gray-50">
                            <td class="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{{ $otp->phone }}</td>
                            <td class="whitespace-nowrap px-6 py-4 font-mono text-lg tracking-widest text-gray-900">{{ $otp->code }}</td>
                            <td class="whitespace-nowrap px-6 py-4">
                                @if ($otp->isVerified())
                                    <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Использован</span>
                                @elseif ($otp->isExpired())
                                    <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Истёк</span>
                                @else
                                    <span class="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">Активен</span>
                                @endif
                            </td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500">{{ $otp->created_at->format('H:i:s · d.m') }}</td>
                            <td class="whitespace-nowrap px-6 py-4 text-gray-500">{{ $otp->expires_at->format('H:i:s · d.m') }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                                @if ($phone !== '')
                                    Кодов по запросу «{{ $phone }}» за последние 24 часа нет.
                                @else
                                    За последние 24 часа кодов нет.
                                @endif
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    {{-- Pagination --}}
    <div class="mt-4">
        {{ $otps->links() }}
    </div>

    {{-- Auto-refresh every 10s, preserving current query string --}}
    <script>
        setTimeout(() => window.location.reload(), 10000);
    </script>
@endsection
