<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIYL Taxi</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="flex min-h-screen flex-col bg-gray-50">
    {{-- Header --}}
    <header class="border-b border-gray-200 bg-white">
        <div class="mx-auto max-w-4xl px-6 py-6">
            <span class="text-2xl font-bold text-amber-500">AIYL Taxi</span>
        </div>
    </header>

    {{-- Hero Section --}}
    <main class="flex flex-1 items-center justify-center px-6">
        <div class="mx-auto max-w-2xl text-center">
            <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Your AIYL Taxi Service
            </h1>
            <p class="mt-6 text-lg leading-8 text-gray-600">
                Fast, reliable rides across the village. Open the mobile app to book your next trip.
            </p>
        </div>
    </main>

    {{-- Footer --}}
    <footer class="border-t border-gray-200 bg-white">
        <div class="mx-auto max-w-4xl px-6 py-4 text-center">
            <p class="text-xs text-gray-400">
                &copy; {{ date('Y') }} AIYL Taxi &middot;
                <a href="{{ route('admin.login') }}" class="text-gray-400 hover:text-gray-500">Admin</a>
            </p>
        </div>
    </footer>
</body>
</html>
