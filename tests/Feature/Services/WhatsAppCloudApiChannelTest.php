<?php

namespace Tests\Feature\Services;

use App\Services\WhatsAppCloudApiChannel;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class WhatsAppCloudApiChannelTest extends TestCase
{
    private function makeChannel(bool $enabled = true): WhatsAppCloudApiChannel
    {
        return new WhatsAppCloudApiChannel(
            accessToken: 'test-token',
            phoneNumberId: '123456789',
            templateName: 'otp_login',
            languageCode: 'ru',
            apiVersion: 'v21.0',
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
    public function test_send_posts_template_payload_to_meta_endpoint(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'messaging_product' => 'whatsapp',
                'contacts' => [['input' => '996700123456', 'wa_id' => '996700123456']],
                'messages' => [['id' => 'wamid.ABCD']],
            ], 200),
        ]);

        $result = $this->makeChannel()->send('+996700123456', '1234');

        $this->assertTrue($result);

        Http::assertSent(function ($request) {
            $url = $request->url();
            $body = $request->data();

            return str_contains($url, 'graph.facebook.com/v21.0/123456789/messages')
                && $request->hasHeader('Authorization', 'Bearer test-token')
                && $body['messaging_product'] === 'whatsapp'
                && $body['to'] === '996700123456'
                && $body['type'] === 'template'
                && $body['template']['name'] === 'otp_login'
                && $body['template']['language']['code'] === 'ru'
                && $body['template']['components'][0]['parameters'][0]['text'] === '1234'
                && $body['template']['components'][1]['parameters'][0]['text'] === '1234';
        });
    }

    #[Test]
    public function test_send_returns_false_on_receiver_not_on_whatsapp(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'error' => [
                    'code' => 131026,
                    'message' => 'Receiver is not a valid WhatsApp user',
                    'type' => 'OAuthException',
                ],
            ], 400),
        ]);

        $result = $this->makeChannel()->send('+996700123456', '1234');

        $this->assertFalse($result);
    }

    #[Test]
    public function test_send_returns_false_on_generic_http_failure(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response('Server Error', 500),
        ]);

        $result = $this->makeChannel()->send('+996700123456', '1234');

        $this->assertFalse($result);
    }

    #[Test]
    public function test_send_returns_false_on_network_exception(): void
    {
        Http::fake(function () {
            throw new \RuntimeException('connection refused');
        });

        $result = $this->makeChannel()->send('+996700123456', '1234');

        $this->assertFalse($result);
    }
}
