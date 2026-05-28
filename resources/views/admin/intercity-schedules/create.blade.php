@extends('layouts.admin')

@section('title', 'Новое расписание')
@section('heading', 'Новое расписание')

@section('content')
    <div class="mx-auto max-w-2xl">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form method="POST" action="{{ route('admin.intercity-schedules.store') }}">
                @csrf

                @include('admin.intercity-schedules._form', ['routes' => $routes])

                <div class="flex items-center gap-4">
                    <button type="submit" class="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600">
                        Добавить расписание
                    </button>
                    <a href="{{ route('admin.intercity-schedules.index') }}" class="text-sm font-medium text-gray-600 hover:text-gray-800">Отмена</a>
                </div>
            </form>
        </div>
    </div>
@endsection
