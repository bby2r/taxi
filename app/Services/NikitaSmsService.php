<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class NikitaSmsService
{
    public function __construct(
        private readonly string $login,
        private readonly string $password,
        private readonly string $sender,
        private readonly bool $enabled,
    ) {}

    /**
     * Send an SMS message to the given phone number.
     */
    public function send(string $phone, string $message): bool
    {
        if (! $this->enabled) {
            Log::info('Nikita SMS disabled, skipping send.', [
                'phone' => $phone,
                'message' => $message,
            ]);

            return true;
        }

        $xml = $this->buildXml($phone, $message);

        try {
            $response = Http::withBody($xml, 'application/xml')
                ->post('https://smspro.nikita.kg/api/message');

            if ($response->successful()) {
                Log::info('Nikita SMS sent successfully.', ['phone' => $phone]);

                return true;
            }

            Log::error('Nikita SMS failed.', [
                'phone' => $phone,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        } catch (\Throwable $e) {
            Log::error('Nikita SMS exception.', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Build the XML payload for the Nikita SMS API.
     */
    private function buildXml(string $phone, string $message): string
    {
        $login = htmlspecialchars($this->login, ENT_XML1, 'UTF-8');
        $password = htmlspecialchars($this->password, ENT_XML1, 'UTF-8');
        $sender = htmlspecialchars($this->sender, ENT_XML1, 'UTF-8');
        $phone = htmlspecialchars($phone, ENT_XML1, 'UTF-8');
        $message = htmlspecialchars($message, ENT_XML1, 'UTF-8');
        $id = Str::random(8);
        $test = app()->environment('production') ? '' : '<test>1</test>';

        return '<?xml version="1.0" encoding="UTF-8"?>'.
            '<message>'.
                "<login>$login</login>".
                "<pwd>$password</pwd>".
                "<id>$id</id>".
                "<sender>$sender</sender>".
                "<text>$message</text>".
                '<phones>'.
                    "<phone>$phone</phone>".
                '</phones>'.
                $test.
            '</message>';
    }
}
