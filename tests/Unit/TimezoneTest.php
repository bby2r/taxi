<?php

namespace Tests\Unit;

use Tests\TestCase;

class TimezoneTest extends TestCase
{
    public function test_timezone_is_asia_bishkek(): void
    {
        $this->assertSame('Asia/Bishkek', config('app.timezone'));
    }
}
