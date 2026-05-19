@extends('layouts.admin')

@section('title', 'Добавить водителя')
@section('heading', 'Добавить водителя')

@section('content')
    <div class="mx-auto max-w-2xl">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form method="POST" action="{{ route('admin.drivers.store') }}">
                @csrf

                {{-- Name --}}
                <div class="mb-5">
                    <label for="name" class="mb-1.5 block text-sm font-medium text-gray-700">Имя</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value="{{ old('name') }}"
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
                        value="{{ old('phone') }}"
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
                        value="{{ old('car_model') }}"
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
                        value="{{ old('car_number') }}"
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
                        Создать водителя
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
    </div>
@endsection
