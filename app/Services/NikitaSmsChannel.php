<?php

namespace App\Services;

use App\Contracts\OtpChannel;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class NikitaSmsChannel implements OtpChannel
{
    public function __construct(
        private readonly string $login,
        private readonly string $password,
        private readonly string $sender,
        private readonly string $messageTemplate,
        private readonly string $apiUrl,
        private readonly bool $enabled,
    ) {}

    public function send(string $phone, string $code): bool
    {
        if (! $this->enabled) {
            Log::info('Nikita SMS channel disabled, skipping send.', [
                'phone' => $phone,
            ]);

            return false;
        }

        $transactionId = Str::random(8);
        $message = str_replace('{code}', $code, $this->messageTemplate);
        $xml = $this->buildXml($phone, $message, $transactionId);

        try {
            $response = Http::withBody($xml, 'application/xml')
                ->timeout(30)
                ->post($this->apiUrl);

            if ($response->successful() && str_contains($response->body(), '<status>0</status>')) {
                Log::info('Nikita SMS sent successfully.', [
                    'phone' => $phone,
                    'transaction_id' => $transactionId,
                ]);

                return true;
            }

            Log::warning('Nikita SMS send failed.', [
                'phone' => $phone,
                'transaction_id' => $transactionId,
                'http_status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        } catch (\Throwable $e) {
            Log::error('Nikita SMS exception.', [
                'phone' => $phone,
                'transaction_id' => $transactionId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function buildXml(string $phone, string $message, string $transactionId): string
    {
        $login = htmlspecialchars($this->login, ENT_XML1, 'UTF-8');
        $password = htmlspecialchars($this->password, ENT_XML1, 'UTF-8');
        $sender = htmlspecialchars($this->sender, ENT_XML1, 'UTF-8');
        $phoneClean = preg_replace('/\D/', '', $phone);
        $messageEscaped = htmlspecialchars($message, ENT_XML1, 'UTF-8');
        $testTag = app()->environment('production') ? '' : '<test>1</test>';

        return '<?xml version="1.0" encoding="UTF-8"?>'.
            '<message>'.
                "<login>{$login}</login>".
                "<pwd>{$password}</pwd>".
                "<id>{$transactionId}</id>".
                "<sender>{$sender}</sender>".
                "<text>{$messageEscaped}</text>".
                '<phones>'.
                    "<phone>{$phoneClean}</phone>".
                '</phones>'.
                $testTag.
            '</message>';
    }
}
