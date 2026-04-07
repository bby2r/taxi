<?php

namespace Tests\Feature\Services;

use App\Services\NikitaSmsService;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NikitaSmsServiceHttpTest extends TestCase
{
    #[Test]
    public function test_send_makes_http_request_when_enabled(): void
    {
        Http::fake([
            'smspro.nikita.kg/*' => Http::response('<response><status>0</status></response>', 200),
        ]);

        $service = new NikitaSmsService(
            login: 'test',
            password: 'secret',
            sender: 'Taxi',
            enabled: true,
        );

        $result = $service->send('+996700123456', 'Test message');

        $this->assertTrue($result);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'smspro.nikita.kg')
                && str_contains($request->body(), '+996700123456')
                && str_contains($request->body(), 'Test message');
        });
    }

    #[Test]
    public function test_send_returns_false_on_http_failure(): void
    {
        Http::fake([
            'smspro.nikita.kg/*' => Http::response('Server Error', 500),
        ]);

        $service = new NikitaSmsService(
            login: 'test',
            password: 'secret',
            sender: 'Taxi',
            enabled: true,
        );

        $result = $service->send('+996700123456', 'Test message');

        $this->assertFalse($result);
    }
}
