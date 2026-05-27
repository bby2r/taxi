@extends('layouts.admin')

@section('title', 'Редактировать маршрут')
@section('heading', 'Редактировать маршрут межгорода')

@section('content')
    <div class="mx-auto max-w-2xl">
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form method="POST" action="{{ route('admin.intercity-routes.update', $route) }}">
                @csrf
                @method('PUT')
                @include('admin.intercity-routes._form', ['route' => $route, 'regions' => $regions])

                <div class="flex items-center gap-4">
                    <button type="submit" class="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600">
                        Обновить маршрут
                    </button>
                    <a href="{{ route('admin.intercity-routes.index') }}" class="text-sm font-medium text-gray-600 hover:text-gray-800">Отмена</a>
                </div>
            </form>
        </div>
    </div>
@endsection
