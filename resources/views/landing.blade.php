<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Alif Taxi — современное такси для жителей Таласа и соседних сёл. Заказ за 5 секунд, водитель на карте, цена известна заранее.">
    <title>Alif Taxi — такси по селу и в город</title>

    {{-- Open Graph / Twitter — controls how the link previews when shared in WhatsApp, Telegram, etc. --}}
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Alif Taxi">
    <meta property="og:title" content="Alif Taxi — такси по селу и в город">
    <meta property="og:description" content="Заказ за 5 секунд, водитель на карте в реальном времени, цена известна заранее. Местное такси для Таласской области.">
    <meta property="og:url" content="{{ url('/') }}">
    <meta property="og:image" content="{{ asset('apple-touch-icon.png') }}">
    <meta property="og:locale" content="ru_RU">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Alif Taxi — такси по селу и в город">
    <meta name="twitter:description" content="Заказ за 5 секунд, водитель на карте, цена известна заранее.">
    <meta name="twitter:image" content="{{ asset('apple-touch-icon.png') }}">

    <link rel="icon" type="image/png" href="{{ asset('favicon.png') }}">
    <link rel="apple-touch-icon" href="{{ asset('apple-touch-icon.png') }}">

    {{-- Distinctive type pairing: Fraunces (expressive serif with optical-size & soft variant axis)
         for editorial display, Manrope for the warm geometric sans body. Pre-connect to keep
         font load off the critical path. --}}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">

    <style>
        :root {
            --bg: #FAF6EC;            /* warm cream — never use pure white, feels cold/sterile */
            --bg-deep: #F1EAD8;        /* sandy beige for layered cards */
            --ink: #0E1D24;            /* near-black with cool tint, easier on eyes than #000 */
            --ink-soft: #34464E;
            --ink-mute: #708189;
            --teal: #0E5A57;           /* primary deep teal, Alif brand */
            --teal-deep: #073F3D;
            --teal-soft: #D7E7E5;
            --amber: #E8973A;          /* warm action accent, less harsh than pure orange */
            --amber-deep: #B66A1C;
            --rule: rgba(14, 29, 36, 0.08);
        }

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { margin: 0; padding: 0; }

        html {
            background: var(--bg);
            color: var(--ink);
            font-family: 'Manrope', system-ui, sans-serif;
            font-size: 16px;
            line-height: 1.55;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            scroll-behavior: smooth;
        }

        body {
            min-height: 100vh;
            min-height: 100dvh;
            position: relative;
            overflow-x: hidden;
        }

        /* Subtle film grain over the whole page — adds analog warmth on
           OLED screens, prevents the cream from looking "plastic". */
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 100;
            opacity: 0.45;
            mix-blend-mode: multiply;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        a { color: inherit; text-decoration: none; }

        /* Keyboard focus — a visible ring on every interactive element (a11y, CRITICAL). */
        :focus-visible {
            outline: 2.5px solid var(--teal);
            outline-offset: 3px;
            border-radius: 6px;
        }
        .btn-primary:focus-visible, .nav-cta:focus-visible {
            outline-color: var(--amber-deep);
        }
        .drivers-section :focus-visible, .btn-amber:focus-visible {
            outline-color: var(--amber);
        }
        /* Anchor jumps clear the sticky header instead of hiding under it. */
        section[id] { scroll-margin-top: 84px; }
        /* Remove the 300ms tap delay on touch devices. */
        .btn-primary, .btn-ghost, .btn-amber, .nav-cta, .nav-links a, .footer-links a {
            touch-action: manipulation;
        }

        h1, h2, h3 {
            font-family: 'Fraunces', Georgia, serif;
            font-variation-settings: 'opsz' 144, 'SOFT' 50;
            font-weight: 500;
            letter-spacing: -0.02em;
            line-height: 0.95;
            margin: 0;
        }

        .display-xl {
            font-size: clamp(3.5rem, 11vw, 9.5rem);
            font-weight: 500;
        }
        .display-lg {
            font-size: clamp(2.5rem, 6.5vw, 5.25rem);
            font-weight: 500;
        }
        .display-md {
            font-size: clamp(1.75rem, 3.4vw, 2.75rem);
            font-weight: 500;
            letter-spacing: -0.015em;
        }

        .container {
            max-width: 1280px;
            margin: 0 auto;
            padding: 0 24px;
        }
        @media (min-width: 768px) {
            .container { padding: 0 48px; }
        }

        /* ─── Header ───────────────────────────── */
        .nav {
            position: sticky; top: 0; z-index: 50;
            backdrop-filter: blur(12px);
            background: rgba(250, 246, 236, 0.78);
            border-bottom: 1px solid var(--rule);
        }
        .nav-inner {
            display: flex; align-items: center; justify-content: space-between;
            padding: 18px 0;
        }
        .brand {
            display: inline-flex; align-items: baseline; gap: 8px;
            font-family: 'Fraunces', serif;
            font-variation-settings: 'opsz' 144, 'SOFT' 30;
            font-weight: 600;
            font-size: 1.5rem;
            color: var(--teal);
        }
        .brand-dot {
            width: 10px; height: 10px; border-radius: 50%;
            background: var(--amber); display: inline-block;
        }
        .nav-links {
            display: none; align-items: center; gap: 32px;
            font-size: 0.95rem; color: var(--ink-soft);
        }
        .nav-links a:hover { color: var(--teal); }
        @media (min-width: 768px) { .nav-links { display: flex; } }
        .nav-cta {
            background: var(--ink); color: var(--bg);
            padding: 13px 20px; border-radius: 999px;
            font-size: 0.9rem; font-weight: 600;
            transition: background 0.2s ease;
        }
        .nav-cta:hover { background: var(--teal); }

        /* ─── Hero ─────────────────────────────── */
        .hero {
            padding: 64px 0 32px;
            position: relative;
        }
        @media (min-width: 768px) { .hero { padding: 96px 0 48px; } }

        .hero-eyebrow {
            display: inline-flex; align-items: center; gap: 8px;
            text-transform: uppercase;
            font-size: 0.78rem; font-weight: 700;
            letter-spacing: 0.18em;
            color: var(--teal-deep);
            margin-bottom: 28px;
        }
        .pulse {
            width: 7px; height: 7px; border-radius: 50%;
            background: var(--amber); display: inline-block;
            box-shadow: 0 0 0 0 rgba(232, 151, 58, 0.6);
            animation: pulse 1.8s ease-out infinite;
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(232, 151, 58, 0.55); }
            70% { box-shadow: 0 0 0 12px rgba(232, 151, 58, 0); }
            100% { box-shadow: 0 0 0 0 rgba(232, 151, 58, 0); }
        }

        .hero-title { color: var(--ink); }
        .hero-title em {
            font-style: italic;
            color: var(--teal);
            font-variation-settings: 'opsz' 144, 'SOFT' 100;
        }
        .hero-title .accent {
            color: var(--amber-deep);
            font-style: italic;
            font-variation-settings: 'opsz' 144, 'SOFT' 100;
        }

        .hero-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 48px;
            align-items: end;
        }
        @media (min-width: 1024px) {
            .hero-grid { grid-template-columns: 1.4fr 1fr; gap: 64px; }
        }

        .hero-sub {
            margin-top: 28px;
            font-size: clamp(1.05rem, 1.3vw, 1.25rem);
            color: var(--ink-soft);
            max-width: 540px;
            line-height: 1.6;
        }

        .hero-cta-row {
            margin-top: 36px;
            display: flex; flex-wrap: wrap; gap: 12px;
        }

        .btn-primary, .btn-ghost {
            display: inline-flex; align-items: center; gap: 10px;
            padding: 16px 26px; border-radius: 999px;
            font-weight: 700; font-size: 0.95rem;
            transition: transform 0.18s ease, background 0.2s ease, box-shadow 0.2s ease;
            cursor: pointer; border: none;
        }
        .btn-primary {
            background: var(--ink); color: var(--bg);
            box-shadow: 0 8px 28px -10px rgba(14, 29, 36, 0.5);
        }
        .btn-primary:hover {
            background: var(--teal-deep);
            transform: translateY(-2px);
            box-shadow: 0 16px 32px -12px rgba(14, 29, 36, 0.55);
        }
        .btn-ghost {
            background: transparent;
            color: var(--ink);
            border: 1.5px solid var(--ink);
        }
        .btn-ghost:hover {
            background: var(--ink);
            color: var(--bg);
            transform: translateY(-2px);
        }

        /* ─── Hero phone mockup ─────────────────── */
        .phone-wrap {
            position: relative;
            display: flex; justify-content: center; align-items: flex-end;
            min-height: 480px;
        }
        .phone {
            width: 280px; height: 560px;
            background: var(--ink);
            border-radius: 42px;
            padding: 12px;
            box-shadow:
                0 50px 100px -30px rgba(14, 29, 36, 0.45),
                0 30px 60px -20px rgba(14, 90, 87, 0.3),
                inset 0 0 0 2px rgba(255, 255, 255, 0.04);
            transform: rotate(-3deg);
            position: relative;
            z-index: 2;
        }
        .phone-screen {
            width: 100%; height: 100%;
            border-radius: 32px;
            background: linear-gradient(155deg, var(--teal-deep) 0%, var(--teal) 60%, #0a4a48 100%);
            overflow: hidden;
            position: relative;
            display: flex; flex-direction: column;
        }
        .phone-status {
            display: flex; justify-content: space-between;
            padding: 14px 22px 8px;
            font-family: 'Manrope', sans-serif;
            font-size: 0.7rem; color: var(--bg);
            font-weight: 600;
        }
        .phone-map {
            flex: 1;
            position: relative;
            background:
                radial-gradient(circle at 30% 30%, rgba(232, 151, 58, 0.18) 0%, transparent 40%),
                radial-gradient(circle at 70% 60%, rgba(215, 231, 229, 0.1) 0%, transparent 40%);
        }
        /* Animated route line drawn across the phone-map */
        .route-svg {
            position: absolute; inset: 0;
            width: 100%; height: 100%;
        }
        .route-path {
            stroke: var(--amber);
            stroke-width: 3.5;
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 1000;
            stroke-dashoffset: 1000;
            animation: draw 3.5s ease-out 0.6s forwards infinite alternate;
            filter: drop-shadow(0 2px 8px rgba(232, 151, 58, 0.5));
        }
        @keyframes draw {
            0% { stroke-dashoffset: 1000; }
            45% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: 0; }
        }
        .map-pin {
            position: absolute;
            width: 14px; height: 14px; border-radius: 50%;
            border: 3px solid var(--bg);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        .map-pin.start {
            top: 22%; left: 18%;
            background: var(--bg);
        }
        .map-pin.end {
            bottom: 28%; right: 22%;
            background: var(--amber);
            animation: ping 2s ease-out infinite;
        }
        @keyframes ping {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
        }
        .phone-card {
            background: var(--bg);
            border-radius: 24px 24px 0 0;
            padding: 18px 20px 22px;
            position: relative;
            margin-top: -1px;
        }
        .phone-card-eyebrow {
            display: flex; align-items: center; gap: 6px;
            font-size: 0.68rem; font-weight: 700;
            color: var(--ink-mute);
            letter-spacing: 0.1em; text-transform: uppercase;
            margin-bottom: 6px;
        }
        .phone-card-title {
            font-family: 'Fraunces', serif;
            font-size: 1.4rem; font-weight: 600;
            color: var(--ink);
            letter-spacing: -0.01em;
            line-height: 1.1;
            margin-bottom: 10px;
        }
        .phone-card-row {
            display: flex; justify-content: space-between; align-items: baseline;
            font-size: 0.8rem; color: var(--ink-soft);
            padding-top: 10px;
            border-top: 1px solid var(--rule);
        }
        .phone-card-price {
            font-family: 'Fraunces', serif;
            font-size: 1.6rem; font-weight: 600;
            color: var(--teal-deep);
        }

        /* Background ornament — a deep teal arc-mountain motif behind the phone */
        .hero-ornament {
            position: absolute;
            right: -120px; top: 50%;
            transform: translateY(-50%);
            width: 600px; height: 600px;
            background:
                radial-gradient(circle at center, var(--teal-soft) 0%, transparent 60%);
            opacity: 0.6;
            z-index: 0;
            pointer-events: none;
        }
        @media (max-width: 1023px) {
            .hero-ornament { right: -50%; }
        }

        /* ─── Numbers band ──────────────────────── */
        .numbers {
            margin-top: 64px;
            padding: 40px 0;
            border-top: 1px solid var(--rule);
            border-bottom: 1px solid var(--rule);
        }
        .numbers-grid {
            display: grid; gap: 32px;
            grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 768px) {
            .numbers-grid { grid-template-columns: repeat(4, 1fr); }
        }
        .stat-figure {
            font-family: 'Fraunces', serif;
            font-size: clamp(2.5rem, 4vw, 3.5rem);
            font-weight: 500;
            color: var(--teal);
            letter-spacing: -0.025em;
            line-height: 1;
            font-variation-settings: 'opsz' 144, 'SOFT' 30;
        }
        .stat-label {
            margin-top: 10px;
            font-size: 0.88rem; color: var(--ink-soft);
            line-height: 1.4;
        }

        /* ─── Section heading ────────────────────── */
        .section {
            padding: 110px 0;
            position: relative;
        }
        .section-eyebrow {
            font-size: 0.78rem; font-weight: 700;
            letter-spacing: 0.18em; text-transform: uppercase;
            color: var(--amber-deep);
            display: inline-flex; align-items: center; gap: 12px;
            margin-bottom: 24px;
        }
        .section-eyebrow::before {
            content: ''; width: 32px; height: 1px; background: var(--amber-deep);
        }

        /* ─── How it works (clients) ────────────── */
        .how-grid {
            display: grid; gap: 16px;
            grid-template-columns: 1fr;
            margin-top: 48px;
        }
        @media (min-width: 768px) {
            .how-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; }
        }
        .step-card {
            background: var(--bg-deep);
            padding: 32px 28px;
            border-radius: 24px;
            position: relative;
            min-height: 280px;
            display: flex; flex-direction: column;
            transition: transform 0.3s ease, background 0.3s ease;
        }
        .step-card:hover {
            transform: translateY(-4px);
            background: var(--teal-soft);
        }
        .step-num {
            font-family: 'Fraunces', serif;
            font-variation-settings: 'opsz' 144, 'SOFT' 100;
            font-size: 3.5rem; font-style: italic;
            color: var(--teal);
            line-height: 1;
            margin-bottom: 24px;
            opacity: 0.85;
        }
        .step-title {
            font-family: 'Fraunces', serif;
            font-size: 1.45rem; font-weight: 600;
            color: var(--ink);
            letter-spacing: -0.01em;
            line-height: 1.15;
            margin-bottom: 12px;
        }
        .step-desc {
            color: var(--ink-soft);
            font-size: 0.95rem;
            line-height: 1.55;
            margin-top: auto;
        }

        /* ─── For drivers ───────────────────────── */
        .drivers-section {
            background: var(--ink);
            color: var(--bg);
            margin: 96px -24px 0;
            padding: 110px 0;
            border-radius: 0;
        }
        @media (min-width: 768px) {
            .drivers-section { margin: 96px -48px 0; }
        }
        @media (min-width: 1280px) {
            .drivers-section {
                margin: 96px 24px 0;
                border-radius: 36px;
            }
        }

        .drivers-grid {
            display: grid; gap: 48px;
            grid-template-columns: 1fr;
            align-items: center;
        }
        @media (min-width: 1024px) {
            .drivers-grid { grid-template-columns: 1fr 1fr; gap: 80px; }
        }

        .drivers-title { color: var(--bg); }
        .drivers-title em { color: var(--amber); font-style: italic;
            font-variation-settings: 'opsz' 144, 'SOFT' 100; }

        .drivers-sub {
            margin-top: 24px;
            color: rgba(250, 246, 236, 0.75);
            font-size: 1.1rem;
            line-height: 1.55;
            max-width: 480px;
        }

        .perks {
            margin-top: 36px;
            display: flex; flex-direction: column; gap: 18px;
        }
        .perk {
            display: flex; align-items: flex-start; gap: 18px;
        }
        .perk-bullet {
            flex-shrink: 0;
            width: 36px; height: 36px;
            border-radius: 50%;
            background: var(--amber); color: var(--ink);
            display: flex; align-items: center; justify-content: center;
            font-family: 'Fraunces', serif;
            font-weight: 700; font-size: 1rem;
        }
        .perk-bullet svg { width: 18px; height: 18px; }
        .perk-text {
            font-size: 0.98rem;
            color: rgba(250, 246, 236, 0.88);
            line-height: 1.5;
        }
        .perk-text strong { color: var(--bg); font-weight: 700; }

        .btn-amber {
            display: inline-flex; align-items: center; gap: 10px;
            background: var(--amber); color: var(--ink);
            padding: 16px 26px; border-radius: 999px;
            font-weight: 700; font-size: 0.95rem;
            margin-top: 36px;
            transition: transform 0.18s ease, background 0.2s ease;
        }
        .btn-amber:hover {
            background: #FBA94A;
            transform: translateY(-2px);
        }

        .driver-card {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 32px;
            backdrop-filter: blur(8px);
        }
        .driver-card-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            margin-bottom: 24px;
        }
        .driver-card-label {
            font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase;
            color: var(--amber);
            font-weight: 700;
        }
        .driver-card-stat {
            font-family: 'Fraunces', serif;
            font-size: 4rem; font-weight: 500;
            color: var(--bg);
            line-height: 1;
            letter-spacing: -0.03em;
            font-variation-settings: 'opsz' 144, 'SOFT' 50;
        }
        .driver-card-tag {
            display: inline-block;
            background: var(--amber); color: var(--ink);
            padding: 4px 10px; border-radius: 999px;
            font-size: 0.7rem; font-weight: 700;
            letter-spacing: 0.05em;
        }
        .driver-card-row {
            display: flex; justify-content: space-between; align-items: baseline;
            padding: 14px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 0.92rem;
        }
        .driver-card-row span:first-child { color: rgba(250, 246, 236, 0.6); }
        .driver-card-row span:last-child { color: var(--bg); font-weight: 600; }

        /* ─── Why us — comparison ─────────────────── */
        .compare-grid {
            display: grid; gap: 20px;
            grid-template-columns: 1fr;
            margin-top: 48px;
        }
        @media (min-width: 768px) {
            .compare-grid { grid-template-columns: 1fr 1fr; gap: 24px; }
        }
        .compare-card {
            padding: 36px 32px;
            border-radius: 28px;
            border: 1px solid var(--rule);
        }
        .compare-card.bad { background: transparent; }
        .compare-card.good { background: var(--teal); color: var(--bg); border-color: var(--teal); }
        .compare-card.good .compare-title { color: var(--bg); }
        .compare-card.good .compare-list li { color: rgba(250, 246, 236, 0.92); }
        .compare-card.good .compare-list li::before { color: var(--amber); }
        .compare-tag {
            display: inline-block;
            font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase;
            font-weight: 700; padding: 5px 11px; border-radius: 999px;
            margin-bottom: 18px;
        }
        .compare-card.bad .compare-tag { background: var(--bg-deep); color: var(--ink-mute); }
        .compare-card.good .compare-tag { background: var(--amber); color: var(--ink); }
        .compare-title {
            font-family: 'Fraunces', serif;
            font-size: 1.5rem; font-weight: 600;
            color: var(--ink);
            letter-spacing: -0.01em;
            margin-bottom: 24px;
        }
        .compare-list { list-style: none; padding: 0; margin: 0; }
        .compare-list li {
            padding: 12px 0 12px 30px;
            position: relative;
            color: var(--ink-soft);
            font-size: 0.96rem;
            line-height: 1.45;
        }
        .compare-list li::before {
            content: '—';
            position: absolute; left: 0; top: 12px;
            color: var(--ink-mute); font-weight: 600;
        }
        .compare-card.good .compare-list li::before { content: '✓'; font-weight: 700; }

        /* ─── Final CTA ───────────────────────────── */
        .final {
            text-align: center;
            padding: 130px 0;
        }
        .final-title {
            color: var(--ink);
            margin-bottom: 32px;
        }
        .final-title em { color: var(--teal); font-style: italic;
            font-variation-settings: 'opsz' 144, 'SOFT' 100; }
        .final .hero-cta-row { justify-content: center; margin-top: 8px; }

        /* ─── Footer ──────────────────────────────── */
        footer {
            border-top: 1px solid var(--rule);
            padding: 56px 0 36px;
            color: var(--ink-soft);
        }
        .footer-grid {
            display: grid; gap: 36px;
            grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
            .footer-grid { grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; }
        }
        .footer-tag {
            font-size: 0.92rem;
            margin-top: 14px;
            max-width: 320px;
            line-height: 1.55;
        }
        .footer-h {
            font-family: 'Fraunces', serif;
            font-weight: 600;
            font-size: 0.95rem;
            color: var(--ink);
            margin-bottom: 16px;
            letter-spacing: -0.005em;
        }
        .footer-links {
            display: flex; flex-direction: column; gap: 10px;
            font-size: 0.92rem;
        }
        .footer-links a:hover { color: var(--teal); }
        .footer-bottom {
            margin-top: 56px;
            padding-top: 24px;
            border-top: 1px solid var(--rule);
            display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px;
            font-size: 0.82rem;
            color: var(--ink-mute);
        }

        /* Reveal on scroll — single staggered orchestration, no scattered
           micro-interactions. CSS-only via intersection observer is not
           supported broadly; we use animation-play-state via a small JS
           helper at the bottom of the page. */
        .reveal {
            opacity: 0;
            transform: translateY(28px);
            transition: opacity 0.85s cubic-bezier(0.2, 0.65, 0.25, 1),
                        transform 0.85s cubic-bezier(0.2, 0.65, 0.25, 1);
        }
        .reveal.in {
            opacity: 1;
            transform: translateY(0);
        }
        .reveal.delay-1 { transition-delay: 0.08s; }
        .reveal.delay-2 { transition-delay: 0.16s; }
        .reveal.delay-3 { transition-delay: 0.24s; }
        .reveal.delay-4 { transition-delay: 0.32s; }
        .reveal.delay-5 { transition-delay: 0.40s; }

        @media (prefers-reduced-motion: reduce) {
            html { scroll-behavior: auto; }
            .reveal { opacity: 1; transform: none; transition: none; }
            .route-path { animation: none; stroke-dashoffset: 0; }
            .pulse { animation: none; }
            .map-pin.end { animation: none; }
        }
    </style>
</head>
<body>
    <header class="nav">
        <div class="container nav-inner">
            <a href="{{ route('home') }}" class="brand">
                Alif <span class="brand-dot"></span> Taxi
            </a>
            <nav class="nav-links">
                <a href="#how">Как это работает</a>
                <a href="#drivers">Водителям</a>
                <a href="#compare">Почему мы</a>
            </nav>
            <a href="#download" class="nav-cta">Скачать</a>
        </div>
    </header>

    <main>
        {{-- HERO ─────────────────────────────────────────────── --}}
        <section class="hero">
            <div class="container">
                <div class="hero-eyebrow reveal in">
                    <span class="pulse"></span>
                    Таласская область · Кыргызстан
                </div>

                <div class="hero-grid">
                    <div>
                        <h1 class="display-xl hero-title reveal delay-1 in">
                            Такси <em>по&nbsp;селу</em><br>
                            и&nbsp;в&nbsp;<span class="accent">город.</span>
                        </h1>
                        <p class="hero-sub reveal delay-2 in">
                            Заказ за&nbsp;пять секунд. Видишь водителя
                            на&nbsp;карте&nbsp;в&nbsp;реальном времени. Цена известна
                            заранее, без&nbsp;звонков и&nbsp;торга.
                        </p>
                        <div class="hero-cta-row reveal delay-3 in">
                            <a href="#download" class="btn-primary">
                                Скачать приложение
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M3 7h8m0 0L7 3m4 4l-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </a>
                            <a href="#drivers" class="btn-ghost">Стать водителем</a>
                        </div>
                    </div>

                    <div class="phone-wrap reveal delay-4 in">
                        <div class="hero-ornament"></div>
                        <div class="phone">
                            <div class="phone-screen">
                                <div class="phone-status">
                                    <span>14:32</span>
                                    <span>●●● 100%</span>
                                </div>
                                <div class="phone-map">
                                    <svg class="route-svg" viewBox="0 0 280 380" preserveAspectRatio="none">
                                        <path class="route-path" d="M 50 90 Q 90 140 130 170 T 220 270" />
                                    </svg>
                                    <div class="map-pin start"></div>
                                    <div class="map-pin end"></div>
                                </div>
                                <div class="phone-card">
                                    <div class="phone-card-eyebrow">
                                        <span class="pulse" style="--pulse-color: var(--teal);"></span>
                                        Водитель в&nbsp;пути · 4&nbsp;мин
                                    </div>
                                    <div class="phone-card-title">Азамат К.</div>
                                    <div class="phone-card-row">
                                        <span>Toyota Camry · 01&nbsp;KG&nbsp;123</span>
                                        <span class="phone-card-price">180 сом</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- Numbers band ─────────────────── --}}
                <div class="numbers reveal delay-5 in">
                    <div class="numbers-grid">
                        <div>
                            <div class="stat-figure">5<span style="color: var(--amber);">″</span></div>
                            <div class="stat-label">среднее время&nbsp;на оформление заказа</div>
                        </div>
                        <div>
                            <div class="stat-figure">100<span style="color: var(--amber);">%</span></div>
                            <div class="stat-label">фиксированная цена &mdash; никакого торга</div>
                        </div>
                        <div>
                            <div class="stat-figure">24<span style="color: var(--amber);">/7</span></div>
                            <div class="stat-label">диспетчерская поддержка через WhatsApp</div>
                        </div>
                        <div>
                            <div class="stat-figure">7<span style="color: var(--amber);">%</span></div>
                            <div class="stat-label">комиссия с&nbsp;водителей &mdash; самая низкая в&nbsp;регионе</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {{-- HOW IT WORKS ─────────────────────────────────────── --}}
        <section class="section" id="how">
            <div class="container">
                <div class="section-eyebrow reveal">Для клиентов</div>
                <h2 class="display-lg reveal delay-1">Как это&nbsp;работает.</h2>

                <div class="how-grid">
                    <div class="step-card reveal delay-1">
                        <div class="step-num">01</div>
                        <div class="step-title">Открой приложение</div>
                        <div class="step-desc">
                            Карта подтянет твою&nbsp;точку автоматически.
                            Выбираешь&nbsp;&mdash; в&nbsp;селе&nbsp;или&nbsp;в&nbsp;другой город.
                        </div>
                    </div>
                    <div class="step-card reveal delay-2">
                        <div class="step-num">02</div>
                        <div class="step-title">Подтверди заказ</div>
                        <div class="step-desc">
                            Цена видна сразу. Если&nbsp;нужно&nbsp;&mdash; добавь
                            комментарий: где встретить, есть&nbsp;ли багаж.
                        </div>
                    </div>
                    <div class="step-card reveal delay-3">
                        <div class="step-num">03</div>
                        <div class="step-title">Жди водителя</div>
                        <div class="step-desc">
                            Видишь машину на&nbsp;карте в&nbsp;реальном времени.
                            Уведомление, когда подъедет.
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {{-- FOR DRIVERS ──────────────────────────────────────── --}}
        <section class="drivers-section" id="drivers">
            <div class="container">
                <div class="drivers-grid">
                    <div>
                        <div class="section-eyebrow reveal" style="color: var(--amber);">Для водителей</div>
                        <h2 class="display-lg drivers-title reveal delay-1">
                            Работай <em>на себя.</em><br>Без диспетчера.
                        </h2>
                        <p class="drivers-sub reveal delay-2">
                            Заказы приходят в&nbsp;приложение, ты&nbsp;выбираешь&nbsp;&mdash;
                            принять или&nbsp;нет. Никаких посредников.
                            Никаких WhatsApp-чатов с&nbsp;путаницей очередности.
                        </p>

                        <div class="perks">
                            <div class="perk reveal delay-3">
                                <div class="perk-bullet" aria-hidden="true">
                                    {{-- wallet --}}
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-11A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h12a1.5 1.5 0 0 0 1.5-1.5V9a1.5 1.5 0 0 0-1.5-1.5H6.5"/>
                                        <circle cx="16.5" cy="13.5" r="1.15" fill="currentColor" stroke="none"/>
                                    </svg>
                                </div>
                                <div class="perk-text">
                                    <strong>7% комиссия.</strong>
                                    Остальное&nbsp;&mdash; твоё. Самая низкая ставка в&nbsp;регионе.
                                </div>
                            </div>
                            <div class="perk reveal delay-4">
                                <div class="perk-bullet" aria-hidden="true">
                                    {{-- map pin --}}
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                                        <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
                                    </svg>
                                </div>
                                <div class="perk-text">
                                    <strong>Ближний&nbsp;к&nbsp;клиенту&nbsp;&mdash;&nbsp;первый.</strong>
                                    Алгоритм честный, без&nbsp;любимчиков.
                                </div>
                            </div>
                            <div class="perk reveal delay-5">
                                <div class="perk-bullet" aria-hidden="true">
                                    {{-- clock --}}
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                                    </svg>
                                </div>
                                <div class="perk-text">
                                    <strong>Гибкий график.</strong>
                                    Выход&nbsp;на&nbsp;линию&nbsp;в&nbsp;один тап. Работаешь
                                    когда хочешь.
                                </div>
                            </div>
                        </div>

                        <a href="https://wa.me/996509397226?text={{ urlencode('Здравствуйте, хочу стать водителем Alif Taxi.') }}" class="btn-amber" target="_blank" rel="noopener">
                            Написать в WhatsApp
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M3 7h8m0 0L7 3m4 4l-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </a>
                    </div>

                    <div class="driver-card reveal delay-3">
                        <div class="driver-card-header">
                            <div>
                                <div class="driver-card-label">Заработок · ноябрь</div>
                                <div class="driver-card-stat">38 400 <span style="font-size: 1.2rem; color: var(--amber);">сом</span></div>
                            </div>
                            <span class="driver-card-tag">пример</span>
                        </div>
                        <div class="driver-card-row"><span>Заказов</span><span>142</span></div>
                        <div class="driver-card-row"><span>Часов в&nbsp;день&nbsp;(в среднем)</span><span>6,5</span></div>
                        <div class="driver-card-row"><span>Комиссия платформы</span><span>2 688&nbsp;сом</span></div>
                        <div class="driver-card-row"><span>Чистая прибыль</span><span style="color: var(--amber);">35 712&nbsp;сом</span></div>
                    </div>
                </div>
            </div>
        </section>

        {{-- COMPARE ──────────────────────────────────────────── --}}
        <section class="section" id="compare">
            <div class="container">
                <div class="section-eyebrow reveal">Почему мы</div>
                <h2 class="display-lg reveal delay-1">Не&nbsp;<em>WhatsApp.</em></h2>
                <p style="margin-top: 24px; color: var(--ink-soft); font-size: 1.1rem; max-width: 540px;" class="reveal delay-2">
                    В&nbsp;Таласе такси заказывают через сборные чаты.
                    Это&nbsp;работало&nbsp;&mdash; пока не&nbsp;появилось приложение,
                    которое всё делает за&nbsp;тебя.
                </p>

                <div class="compare-grid">
                    <div class="compare-card bad reveal delay-2">
                        <span class="compare-tag">До</span>
                        <div class="compare-title">Чат WhatsApp</div>
                        <ul class="compare-list">
                            <li>Пишешь в&nbsp;чат, ждёшь кто ответит первым</li>
                            <li>Цена по&nbsp;договорённости, всегда торг</li>
                            <li>Не&nbsp;знаешь когда подъедет</li>
                            <li>Спам и&nbsp;посторонние сообщения</li>
                            <li>Если&nbsp;водитель не&nbsp;ответил&nbsp;&mdash; перезаказываешь вручную</li>
                        </ul>
                    </div>
                    <div class="compare-card good reveal delay-3">
                        <span class="compare-tag">Сейчас</span>
                        <div class="compare-title">Alif Taxi</div>
                        <ul class="compare-list">
                            <li>Алгоритм находит ближайшего за&nbsp;секунды</li>
                            <li>Цена фиксированная, показывается до&nbsp;заказа</li>
                            <li>Видишь машину на&nbsp;карте всё время</li>
                            <li>Только заказы&nbsp;&mdash; никакой посторонней болтовни</li>
                            <li>Не&nbsp;принял один&nbsp;&mdash; автоматически уходит&nbsp;к&nbsp;следующему</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        {{-- FINAL CTA ───────────────────────────────────────── --}}
        <section class="final" id="download">
            <div class="container">
                <h2 class="display-lg final-title reveal">
                    Готов <em>попробовать?</em>
                </h2>
                <p style="color: var(--ink-soft); font-size: 1.1rem; max-width: 480px; margin: 0 auto;" class="reveal delay-1">
                    Приложение в&nbsp;Google&nbsp;Play открывается на&nbsp;закрытом тестировании.
                    Напиши нам&nbsp;&mdash; добавим тебя в&nbsp;список.
                </p>
                <div class="hero-cta-row reveal delay-2">
                    <a href="https://wa.me/996509397226?text={{ urlencode('Здравствуйте, хочу попробовать приложение Alif Taxi.') }}" class="btn-primary" target="_blank" rel="noopener">
                        Запросить доступ
                    </a>
                    <a href="{{ route('privacy') }}" class="btn-ghost">Политика конфиденциальности</a>
                </div>
            </div>
        </section>
    </main>

    <footer>
        <div class="container">
            <div class="footer-grid">
                <div>
                    <a href="{{ route('home') }}" class="brand">
                        Alif <span class="brand-dot"></span> Taxi
                    </a>
                    <p class="footer-tag">
                        Местное такси для Таласской области.
                        Создано в&nbsp;Кыргызстане для&nbsp;Кыргызстана.
                    </p>
                </div>
                <div>
                    <div class="footer-h">Сервис</div>
                    <div class="footer-links">
                        <a href="#how">Как это работает</a>
                        <a href="#drivers">Водителям</a>
                        <a href="#compare">Почему мы</a>
                    </div>
                </div>
                <div>
                    <div class="footer-h">Поддержка</div>
                    <div class="footer-links">
                        <a href="https://wa.me/996509397226" target="_blank" rel="noopener">WhatsApp</a>
                        <a href="tel:+996509397226">+996 509 397 226</a>
                    </div>
                </div>
                <div>
                    <div class="footer-h">Документы</div>
                    <div class="footer-links">
                        <a href="{{ route('privacy') }}">Политика конфиденциальности</a>
                        <a href="{{ route('admin.login') }}">Вход для&nbsp;диспетчеров</a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <span>© {{ date('Y') }} Alif Taxi · г. Талас, Кыргызстан</span>
                <span>Сделано в&nbsp;Таласе</span>
            </div>
        </div>
    </footer>

    {{-- Single staggered reveal on scroll. Falls back to "in" class on
         load if IntersectionObserver isn't available (very old browsers). --}}
    <script>
        (function () {
            const els = document.querySelectorAll('.reveal');
            if (!('IntersectionObserver' in window)) {
                els.forEach(function (el) { el.classList.add('in'); });
                return;
            }
            const io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in');
                        io.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
            els.forEach(function (el) { io.observe(el); });
        })();
    </script>
</body>
</html>
