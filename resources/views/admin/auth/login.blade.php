<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIYL Taxi Админ — Вход</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
    <div class="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <h1 class="text-2xl font-bold text-gray-900">AIYL Taxi Админ</h1>
        <p class="mt-1 text-sm text-gray-500">Вход в личный кабинет</p>

        @if ($errors->any())
            <div class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                @foreach ($errors->all() as $error)
                    <p>{{ $error }}</p>
                @endforeach
            </div>
        @endif

        <form method="POST" action="{{ route('admin.login.submit') }}" class="mt-6 space-y-4">
            @csrf

            <div>
                <label for="phone" class="block text-sm font-medium text-gray-700">Телефон</label>
                <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value="{{ old('phone') }}"
                    placeholder="Номер телефона"
                    required
                    class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
            </div>

            <div>
                <label for="password" class="block text-sm font-medium text-gray-700">Пароль</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    placeholder="Пароль"
                    required
                    class="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
            </div>

            <button
                type="submit"
                class="w-full rounded-lg bg-amber-400 py-3 font-semibold text-gray-900 hover:bg-amber-500 focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:outline-none"
            >
                Войти
            </button>
        </form>
    </div>
</body>
</html>
