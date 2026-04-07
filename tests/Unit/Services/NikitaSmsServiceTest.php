<?php

namespace Tests\Unit\Services;

use App\Services\NikitaSmsService;
use Illuminate\Support\Facades\Log;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NikitaSmsServiceTest extends TestCase
{
    #[Test]
    public function test_send_logs_message_when_disabled(): void
    {
        Log::spy();

        $service = new NikitaSmsService(
            login: 'test',
            password: 'test',
            sender: 'Taxi',
            enabled: false,
        );

        $service->send('+996700123456', 'Test message');

        Log::shouldHaveReceived('info')
            ->withArgs(fn ($message, $context) => $message === 'Nikita SMS disabled, skipping send.'
                && $context['phone'] === '+996700123456'
                && $context['message'] === 'Test message'
            )
            ->once();
    }

    #[Test]
    public function test_send_returns_true_when_disabled(): void
    {
        Log::spy();

        $service = new NikitaSmsService(
            login: 'test',
            password: 'test',
            sender: 'Taxi',
            enabled: false,
        );

        $result = $service->send('+996700123456', 'Test message');

        $this->assertTrue($result);
    }

    #[Test]
    public function test_build_xml_escapes_special_chars(): void
    {
        $service = new NikitaSmsService(
            login: 'test',
            password: 'test',
            sender: 'Taxi',
            enabled: false,
        );

        $reflection = new \ReflectionMethod($service, 'buildXml');

        $xml = $reflection->invoke($service, '+996700123456', '<script>alert("xss")</script>');

        $this->assertStringNotContainsString('<script>', $xml);
        $this->assertStringContainsString('&lt;script&gt;', $xml);
    }

    #[Test]
    public function test_build_xml_includes_transaction_id(): void
    {
        $service = new NikitaSmsService(
            login: 'test',
            password: 'test',
            sender: 'Taxi',
            enabled: false,
        );

        $reflection = new \ReflectionMethod($service, 'buildXml');

        $xml = $reflection->invoke($service, '+996700123456', 'Hello');

        $this->assertMatchesRegularExpression('/<id>\w+<\/id>/', $xml);
    }

    #[Test]
    public function test_build_xml_includes_test_flag_in_non_production(): void
    {
        $service = new NikitaSmsService(
            login: 'test',
            password: 'test',
            sender: 'Taxi',
            enabled: false,
        );

        $reflection = new \ReflectionMethod($service, 'buildXml');

        $xml = $reflection->invoke($service, '+996700123456', 'Hello');

        $this->assertStringContainsString('<test>1</test>', $xml);
    }
}
