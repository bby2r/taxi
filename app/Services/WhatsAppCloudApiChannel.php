<?php

namespace App\Services;

use App\Contracts\OtpChannel;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppCloudApiChannel implements OtpChannel
{
    public function __construct(
        private readonly string $accessToken,
        private readonly string $phoneNumberId,
        private readonly string $templateName,
        private readonly string $languageCode,
        private readonly string $apiVersion,
        private readonly bool $enabled,
    ) {}

    public function send(string $phone, string $code): bool
    {
        if (! $this->enabled) {
            Log::info('WhatsApp OTP channel disabled, skipping send.', [
                'phone' => $phone,
            ]);

            return false;
        }

        $endpoint = sprintf(
            'https://graph.facebook.com/%s/%s/messages',
            $this->apiVersion,
            $this->phoneNumberId,
        );

        try {
            $response = Http::withToken($this->accessToken)
                ->asJson()
                ->post($endpoint, $this->buildPayload($phone, $code));

            if ($response->successful()) {
                Log::info('WhatsApp OTP sent successfully.', [
                    'phone' => $phone,
                    'wamid' => $response->json('messages.0.id'),
                ]);

                return true;
            }

            Log::warning('WhatsApp OTP send failed.', [
                'phone' => $phone,
                'status' => $response->status(),
                'error_code' => $response->json('error.code'),
                'error_subcode' => $response->json('error.error_subcode'),
                'error_message' => $response->json('error.message'),
            ]);

            return false;
        } catch (\Throwable $e) {
            Log::error('WhatsApp OTP exception.', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Build a Cloud API authentication-template payload. The template must be
     * pre-approved in Meta Business with one body parameter and a copy-code
     * (URL sub_type) button — Meta's standard authentication template shape.
     *
     * @return array<string, mixed>
     */
    private function buildPayload(string $phone, string $code): array
    {
        return [
            'messaging_product' => 'whatsapp',
            'to' => ltrim($phone, '+'),
            'type' => 'template',
            'template' => [
                'name' => $this->templateName,
                'language' => ['code' => $this->languageCode],
                'components' => [
                    [
                        'type' => 'body',
                        'parameters' => [
                            ['type' => 'text', 'text' => $code],
                        ],
                    ],
                    [
                        'type' => 'button',
                        'sub_type' => 'url',
                        'index' => '0',
                        'parameters' => [
                            ['type' => 'text', 'text' => $code],
                        ],
                    ],
                ],
            ],
        ];
    }
}
