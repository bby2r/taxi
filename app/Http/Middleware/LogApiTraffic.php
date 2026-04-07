<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class LogApiTraffic
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $this->logRequest($request);

        $response = $next($request);

        $this->logResponse($request, $response);

        return $response;
    }

    private function logRequest(Request $request): void
    {
        try {
            $user = $request->user();
            $body = $request->except(['password', 'pwd', 'token']);

            $lines = [
                '',
                '┌─── INCOMING REQUEST ───────────────────────',
                "│ {$request->method()} {$request->fullUrl()}",
                '│ IP: '.$request->ip(),
                '│ User: '.($user ? "#{$user->id} {$user->name} ({$user->role})" : 'guest'),
                '│ User-Agent: '.$request->userAgent(),
            ];

            if ($body) {
                $lines[] = '│ Body: '.json_encode($body, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            }

            $lines[] = '└─────────────────────────────────────────────';
            $lines[] = '';

            Log::channel('api_request')->info(implode("\n", $lines));
        } catch (\Throwable) {
            // Never let logging break the request
        }
    }

    private function logResponse(Request $request, Response $response): void
    {
        try {
            $status = $response->getStatusCode();
            $content = $response instanceof JsonResponse
                ? json_encode($response->getData(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
                : '(non-JSON response)';

            $lines = [
                '',
                '┌─── OUTGOING RESPONSE ──────────────────────',
                "│ {$request->method()} {$request->path()} → {$status}",
                "│ Body: {$content}",
                '└─────────────────────────────────────────────',
                '',
            ];

            $level = $status >= 500 ? 'error' : ($status >= 400 ? 'warning' : 'info');

            Log::channel('api_response')->$level(implode("\n", $lines));
        } catch (\Throwable) {
            // Never let logging break the request
        }
    }
}
