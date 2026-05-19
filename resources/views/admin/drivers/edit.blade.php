@extends('layouts.admin')

@section('title', 'Редактировать водителя')
@section('heading', 'Редактировать водителя')

@section('content')
    <div class="mx-auto max-w-2xl">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form method="POST" action="{{ route('admin.drivers.update', $driver) }}">
                @csrf
                @method('PUT')

                {{-- Name --}}
                <div class="mb-5">
                    <label for="name" class="mb-1.5 block text-sm font-medium text-gray-700">Имя</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value="{{ old('name', $driver->name) }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @error('name')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Phone --}}
                <div class="mb-5">
                    <label for="phone" class="mb-1.5 block text-sm font-medium text-gray-700">Телефон</label>
                    <input
                        type="text"
                        id="phone"
                        name="phone"
                        value="{{ old('phone', $driver->phone) }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @error('phone')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Password --}}
                <div class="mb-5">
                    <label for="password" class="mb-1.5 block text-sm font-medium text-gray-700">Пароль</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        placeholder="Оставьте пустым, чтобы не менять"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @error('password')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Car Model --}}
                <div class="mb-5">
                    <label for="car_model" class="mb-1.5 block text-sm font-medium text-gray-700">Марка автомобиля</label>
                    <input
                        type="text"
                        id="car_model"
                        name="car_model"
                        value="{{ old('car_model', $driver->driverProfile?->car_model) }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @error('car_model')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Car Number --}}
                <div class="mb-5">
                    <label for="car_number" class="mb-1.5 block text-sm font-medium text-gray-700">Номер автомобиля</label>
                    <input
                        type="text"
                        id="car_number"
                        name="car_number"
                        value="{{ old('car_number', $driver->driverProfile?->car_number) }}"
                        class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400"
                    >
                    @error('car_number')
                        <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Actions --}}
                <div class="flex items-center gap-4">
                    <button
                        type="submit"
                        class="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
                    >
                        Обновить водителя
                    </button>
                    <a
                        href="{{ route('admin.drivers.index') }}"
                        class="text-sm font-medium text-gray-600 hover:text-gray-800"
                    >
                        Отмена
                    </a>
                </div>
            </form>
        </div>

        @php
            $isBlocked = $driver->driverProfile && $driver->driverProfile->blocked_until && $driver->driverProfile->blocked_until->isFuture();
            $declineCount = $driver->driverProfile?->shift_declines_count ?? 0;
        @endphp

        {{-- Block status --}}
        <div class="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-3 text-base font-semibold text-gray-900">Блокировка</h3>

            @if ($isBlocked)
                <div class="flex flex-wrap items-center gap-3">
                    <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Заблокирован
                    </span>
                    <span class="text-sm text-gray-700">
                        до {{ $driver->driverProfile->blocked_until->format('d M Y, H:i') }}
                    </span>
                    <span class="text-xs text-gray-500">
                        (отказов за смену: {{ $declineCount }})
                    </span>
                </div>
                <p class="mt-2 text-xs text-gray-500">
                    Водитель не может выйти на линию пока блокировка активна. Стандартный срок — 2 часа после 5 явных отказов за смену.
                </p>
                <form method="POST" action="{{ route('admin.drivers.unblock', $driver) }}" class="mt-4">
                    @csrf
                    <button
                        type="submit"
                        class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                    >
                        Снять блокировку
                    </button>
                </form>
            @else
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Не заблокирован
                    </span>
                    @if ($declineCount > 0)
                        <span class="text-xs text-gray-500">
                            Отказов за смену: {{ $declineCount }} / 5
                        </span>
                    @endif
                </div>
                @if ($declineCount > 0)
                    <p class="mt-2 text-xs text-gray-500">
                        Счётчик сбросится автоматически при следующем выходе на линию.
                    </p>
                @endif
            @endif
        </div>

        {{-- Push diagnostics --}}
        <div class="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 class="mb-3 text-base font-semibold text-gray-900">Push-уведомления</h3>

            @if (session('success'))
                <div class="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{{ session('success') }}</div>
            @endif
            @if (session('error'))
                <div class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{{ session('error') }}</div>
            @endif

            @if ($driver->expo_push_token)
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Зарегистрирован
                    </span>
                    <span class="text-xs text-gray-500 break-all">{{ $driver->expo_push_token }}</span>
                </div>

                <form method="POST" action="{{ route('admin.drivers.test-push', $driver) }}" class="mt-4">
                    @csrf
                    <button
                        type="submit"
                        class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
                    >
                        Отправить тестовое уведомление
                    </button>
                </form>

                <p class="mt-3 text-xs text-gray-500">
                    Если тест приходит, а заказы — нет: проблема в диспатче (Pusher / геопозиция / уже принят другим). Если тест тоже не приходит, проблема ниже (на устройстве):
                </p>
                <ul class="mt-2 ml-4 list-disc text-xs text-gray-500 space-y-1">
                    <li>Уведомления выключены: <em>Настройки → Приложения → AIYL Taxi → Уведомления</em></li>
                    <li>Андроид «оптимизирует» батарею — особенно Xiaomi/Huawei. Добавь приложение в исключения (<em>Настройки → Батарея → Приложения без ограничений</em>)</li>
                    <li>Принудительная остановка приложения — нужно открыть заново чтобы FCM-связь восстановилась</li>
                    <li>Нет интернета на телефоне</li>
                </ul>
            @else
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Нет токена
                    </span>
                </div>
                <p class="mt-3 text-xs text-gray-500">
                    Водитель не получит push-уведомления о новых заказах когда приложение свернуто. Возможные причины: запретил уведомления при первом запуске, не открывал приложение после установки, или ошибка регистрации. Попроси его открыть приложение и разрешить уведомления — токен зарегистрируется автоматически на следующем переходе в активное состояние.
                </p>
            @endif
        </div>
    </div>
@endsection
