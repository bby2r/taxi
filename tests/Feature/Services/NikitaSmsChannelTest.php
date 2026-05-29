<?php

namespace Tests\Feature\Services;

use App\Services\NikitaSmsChannel;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NikitaSmsChannelTest extends TestCase
{
    private function makeChannel(bool $enabled = true): NikitaSmsChannel
    {
        return new NikitaSmsChannel(
            login: 'test-login',
            password: 'secret',
            sender: 'AlifKG',
            messageTemplate: 'Alif Taxi: код подтверждения {code}. Никому не сообщайте.',
            apiUrl: 'https://smspro.nikita.kg/api/message',
            enabled: $enabled,
        );
    }

    #[Test]
    public function test_send_returns_false_when_disabled(): void
    {
        Http::fake();

        $result = $this->makeChannel(enabled: false)->send('+996700123456', '1234');

        $this->assertFalse($result);
        Http::assertNothingSent();
    }

    #[Test]
    public function test_send_posts_xml_payload_with_credentials_and_test_tag_in_non_production(): void
    {
        Http::fake([
            'smspro.nikita.kg/*' => Http::response('<response><status>0</status></response>', 200),
        ]);

        $result = $this->makeChannel()->send('+996700123456', '1234');

        $this->assertTrue($result);

        Http::assertSent(function ($request) {
            $body = $request->body();

            return str_contains($request->url(), 'smspro.nikita.kg/api/message')
                && str_contains($body, '<login>test-login</login>')
                && str_contains($body, '<pwd>secret</pwd>')
                && str_contains($body, '<sender>AlifKG</sender>')
                && str_contains($body, '<phone>996700123456</phone>')
                && str_contains($body, 'Alif Taxi: код подтверждения 1234')
                && str_contains($body, '<test>1</test>');
        });
    }

    #[Test]
    public function test_send_omits_test_tag_in_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        Http::fake([
            'smspro.nikita.kg/*' => Http::response('<response><status>0</status></response>', 200),
        ]);

        $this->makeChannel()->send('+996700123456', '1234');

        Http::assertSent(fn ($request) => ! str_contains($request->body(), '<test>1</test>'));
    }

    #[Test]
    public function test_send_substitutes_code_placeholder_in_message_template(): void
    {
        Http::fake([
            'smspro.nikita.kg/*' => Http::response('<response><status>0</status></response>', 200),
        ]);

        $this->makeChannel()->send('+996700123456', '9876');

        Http::assertSent(fn ($request) => str_contains($request->body(), 'код подтверждения 9876'));
    }

    #[Test]
    public function test_send_strips_plus_and_non_digits_from_phone(): void
    {
        Http::fake([
            'smspro.nikita.kg/*' => Http::response('<response><status>0</status></response>', 200),
        ]);

        $this->makeChannel()->send('+996 (700) 12-34-56', '1234');

        Http::assertSent(fn ($request) => str_contains($request->body(), '<phone>996700123456</phone>'));
    }

    #[Test]
    public function test_send_returns_false_when_response_lacks_success_status(): void
    {
        Http::fake([
            'smspro.nikita.kg/*' => Http::response('<response><status>2</status></response>', 200),
        ]);

        $this->assertFalse($this->makeChannel()->send('+996700123456', '1234'));
    }

    #[Test]
    public function test_send_returns_false_on_http_failure(): void
    {
        Http::fake([
            'smspro.nikita.kg/*' => Http::response('Server Error', 500),
        ]);

        $this->assertFalse($this->makeChannel()->send('+996700123456', '1234'));
    }

    #[Test]
    public function test_send_returns_false_on_network_exception(): void
    {
        Http::fake(function () {
            throw new \RuntimeException('connection refused');
        });

        $this->assertFalse($this->makeChannel()->send('+996700123456', '1234'));
    }
}
