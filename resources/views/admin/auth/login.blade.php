<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alif Taxi Админ — Вход</title>
    <link rel="icon" type="image/png" href="{{ asset('favicon.png') }}">
    <link rel="apple-touch-icon" href="{{ asset('apple-touch-icon.png') }}">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">

    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="relative flex min-h-dvh items-center justify-center overflow-hidden bg-sand px-4 font-sans text-ink antialiased">
    {{-- Soft brand glow behind the card --}}
    <div class="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand-soft opacity-60 blur-3xl" aria-hidden="true"></div>

    <div class="relative w-full max-w-sm">
        {{-- Brand mark --}}
        <div class="mb-6 flex items-center justify-center gap-2">
            <span class="text-2xl font-bold tracking-tight text-brand">Alif</span>
            <span class="h-2 w-2 self-center rounded-full bg-accent"></span>
            <span class="text-2xl font-bold tracking-tight text-brand">Taxi</span>
        </div>

        <div class="rounded-2xl border border-ink/10 bg-white p-8 shadow-[0_24px_60px_-30px_rgba(14,29,36,0.45)]">
            <h1 class="text-xl font-bold text-ink">Вход в панель</h1>
            <p class="mt-1 text-sm text-ink-mute">Личный кабинет администратора</p>

            @if ($errors->any())
                <div class="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert" aria-live="polite">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="mt-0.5 h-4 w-4 shrink-0">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    <div>
                        @foreach ($errors->all() as $error)
                            <p>{{ $error }}</p>
                        @endforeach
                    </div>
                </div>
            @endif

            <form method="POST" action="{{ route('admin.login.submit') }}" class="mt-6 space-y-4">
                @csrf

                <div>
                    <label for="phone" class="block text-sm font-medium text-ink-soft">Телефон</label>
                    <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value="{{ old('phone') }}"
                        placeholder="0500 00 00 00"
                        inputmode="tel"
                        autocomplete="username"
                        autofocus
                        required
                        class="mt-1.5 w-full rounded-lg border border-ink/15 bg-white px-4 py-3 text-ink placeholder-ink-mute/60 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                    />
                </div>

                <div>
                    <label for="password" class="block text-sm font-medium text-ink-soft">Пароль</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        placeholder="Пароль"
                        autocomplete="current-password"
                        required
                        class="mt-1.5 w-full rounded-lg border border-ink/15 bg-white px-4 py-3 text-ink placeholder-ink-mute/60 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                    />
                </div>

                <button
                    type="submit"
                    class="w-full rounded-lg bg-brand py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                    Войти
                </button>
            </form>
        </div>

        <a href="{{ route('home') }}" class="mt-6 flex items-center justify-center gap-1.5 text-sm text-ink-mute transition-colors hover:text-brand focus-visible:underline focus-visible:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            На главную
        </a>
    </div>
</body>
</html>
