{{-- Stock Laravel starter view, kept available so manual GETs to
     /welcome (or anything pointing at view('welcome')) land somewhere
     branded instead of the framework default. Public site lives at
     view('landing') — see routes/web.php → '/'. --}}
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name', 'Alif Taxi') }}</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,500;9..144,600&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet">

    @if (file_exists(public_path('build/manifest.json')) || file_exists(public_path('hot')))
        @vite(['resources/css/app.css'])
    @endif

    <style>
        :root {
            --canvas: #F4FBFA;
            --canvas-deep: #E8F6F4;
            --ink: #0F2937;
            --ink-soft: #334155;
            --ink-mute: #6B7A8F;
            --primary: #14B8A6;
            --primary-deep: #0F8F80;
            --primary-tint: #CCFBF1;
            --coral: #FF7B1A;
            --rule: rgba(15, 41, 55, 0.08);
        }
        * { box-sizing: border-box; }
        html, body {
            margin: 0; padding: 0;
            background: var(--canvas);
            color: var(--ink);
            font-family: 'Manrope', system-ui, sans-serif;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }
        body {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 32px;
            position: relative;
            overflow-x: hidden;
        }
        body::before {
            content: '';
            position: fixed; inset: 0; pointer-events: none;
            z-index: 0;
            background:
                radial-gradient(circle at 20% 30%, var(--primary-tint) 0%, transparent 50%),
                radial-gradient(circle at 80% 70%, rgba(255, 123, 26, 0.10) 0%, transparent 50%);
        }
        .stage { position: relative; z-index: 1; max-width: 560px; text-align: center; }
        .brand {
            display: inline-flex; align-items: baseline; gap: 10px;
            font-family: 'Fraunces', serif;
            font-variation-settings: 'opsz' 144, 'SOFT' 30;
            font-weight: 600; font-size: 1.5rem;
            color: var(--primary-deep);
            margin-bottom: 48px;
        }
        .brand-dot {
            width: 11px; height: 11px; border-radius: 50%;
            background: var(--coral); display: inline-block;
        }
        h1 {
            font-family: 'Fraunces', serif;
            font-variation-settings: 'opsz' 144, 'SOFT' 50;
            font-weight: 500;
            font-size: clamp(2.5rem, 7vw, 4.5rem);
            letter-spacing: -0.02em;
            line-height: 0.96;
            margin: 0 0 24px;
            color: var(--ink);
        }
        h1 em {
            font-style: italic;
            color: var(--primary-deep);
            font-variation-settings: 'opsz' 144, 'SOFT' 100;
        }
        p {
            color: var(--ink-soft);
            font-size: 1.1rem;
            line-height: 1.55;
            margin: 0 0 36px;
        }
        .actions {
            display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
        }
        .btn {
            display: inline-flex; align-items: center; gap: 10px;
            padding: 16px 26px; border-radius: 999px;
            font-weight: 700; font-size: 0.95rem;
            font-family: 'Manrope', sans-serif;
            transition: transform 0.18s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .btn-primary {
            background: var(--ink); color: var(--canvas);
            box-shadow: 0 8px 28px -10px rgba(15, 41, 55, 0.45);
        }
        .btn-primary:hover {
            background: var(--primary-deep);
            transform: translateY(-2px);
            box-shadow: 0 16px 32px -12px rgba(15, 41, 55, 0.55);
        }
        .btn-ghost {
            color: var(--ink); border: 1.5px solid var(--ink);
            background: transparent;
        }
        .btn-ghost:hover {
            background: var(--ink); color: var(--canvas);
            transform: translateY(-2px);
        }
        a { text-decoration: none; }
    </style>
</head>
<body>
    <div class="stage">
        <div class="brand">
            Alif <span class="brand-dot"></span> Taxi
        </div>
        <h1>Такси <em>по&nbsp;селу</em> и&nbsp;в&nbsp;город.</h1>
        <p>
            Этот URL не&nbsp;связан с&nbsp;маршрутом — публичный сайт открыт по&nbsp;корневому
            адресу. Перейдите туда или сразу в&nbsp;диспетчерскую.
        </p>
        <div class="actions">
            <a href="{{ url('/') }}" class="btn btn-primary">На&nbsp;главную</a>
            @if (Route::has('admin.login'))
                <a href="{{ route('admin.login') }}" class="btn btn-ghost">Вход для&nbsp;диспетчеров</a>
            @endif
        </div>
    </div>
</body>
</html>
