<?php

namespace Tests\Unit\Enums;

use App\Enums\UserRole;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class UserRoleTest extends TestCase
{
    #[Test]
    public function it_has_exactly_three_cases(): void
    {
        $this->assertCount(3, UserRole::cases());
    }

    #[Test]
    public function all_expected_cases_exist(): void
    {
        $caseNames = array_map(fn (UserRole $case) => $case->name, UserRole::cases());

        $this->assertContains('Client', $caseNames);
        $this->assertContains('Driver', $caseNames);
        $this->assertContains('Admin', $caseNames);
    }

    #[Test]
    public function case_values_match_expected_strings(): void
    {
        $this->assertSame('client', UserRole::Client->value);
        $this->assertSame('driver', UserRole::Driver->value);
        $this->assertSame('admin', UserRole::Admin->value);
    }

    #[Test]
    public function from_returns_correct_case(): void
    {
        $this->assertSame(UserRole::Client, UserRole::from('client'));
        $this->assertSame(UserRole::Driver, UserRole::from('driver'));
        $this->assertSame(UserRole::Admin, UserRole::from('admin'));
    }

    #[Test]
    public function try_from_returns_null_for_invalid_value(): void
    {
        $this->assertNull(UserRole::tryFrom('invalid'));
        $this->assertNull(UserRole::tryFrom(''));
    }
}
