<?php

namespace Tests\Unit\Enums;

use App\Enums\DriverChangeRequestStatus;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class DriverChangeRequestStatusTest extends TestCase
{
    #[Test]
    public function enum_has_exactly_three_cases(): void
    {
        $this->assertCount(3, DriverChangeRequestStatus::cases());
    }

    #[Test]
    public function pending_value(): void
    {
        $this->assertSame('pending', DriverChangeRequestStatus::Pending->value);
    }

    #[Test]
    public function approved_value(): void
    {
        $this->assertSame('approved', DriverChangeRequestStatus::Approved->value);
    }

    #[Test]
    public function rejected_value(): void
    {
        $this->assertSame('rejected', DriverChangeRequestStatus::Rejected->value);
    }

    #[Test]
    public function can_be_created_from_string(): void
    {
        $this->assertSame(DriverChangeRequestStatus::Pending, DriverChangeRequestStatus::from('pending'));
        $this->assertSame(DriverChangeRequestStatus::Approved, DriverChangeRequestStatus::from('approved'));
        $this->assertSame(DriverChangeRequestStatus::Rejected, DriverChangeRequestStatus::from('rejected'));
    }
}
