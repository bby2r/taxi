<?php

namespace Tests\Unit\Enums;

use App\Enums\OrderStatus;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class OrderStatusTest extends TestCase
{
    #[Test]
    public function it_has_exactly_six_cases(): void
    {
        $this->assertCount(6, OrderStatus::cases());
    }

    #[Test]
    public function all_expected_cases_exist(): void
    {
        $caseNames = array_map(fn (OrderStatus $case) => $case->name, OrderStatus::cases());

        $this->assertContains('Searching', $caseNames);
        $this->assertContains('Accepted', $caseNames);
        $this->assertContains('Arrived', $caseNames);
        $this->assertContains('InProgress', $caseNames);
        $this->assertContains('Completed', $caseNames);
        $this->assertContains('Cancelled', $caseNames);
    }

    #[Test]
    public function case_values_match_expected_strings(): void
    {
        $this->assertSame('searching', OrderStatus::Searching->value);
        $this->assertSame('accepted', OrderStatus::Accepted->value);
        $this->assertSame('arrived', OrderStatus::Arrived->value);
        $this->assertSame('in_progress', OrderStatus::InProgress->value);
        $this->assertSame('completed', OrderStatus::Completed->value);
        $this->assertSame('cancelled', OrderStatus::Cancelled->value);
    }

    #[Test]
    public function from_returns_correct_case(): void
    {
        $this->assertSame(OrderStatus::Searching, OrderStatus::from('searching'));
        $this->assertSame(OrderStatus::Accepted, OrderStatus::from('accepted'));
        $this->assertSame(OrderStatus::Arrived, OrderStatus::from('arrived'));
        $this->assertSame(OrderStatus::InProgress, OrderStatus::from('in_progress'));
        $this->assertSame(OrderStatus::Completed, OrderStatus::from('completed'));
        $this->assertSame(OrderStatus::Cancelled, OrderStatus::from('cancelled'));
    }

    #[Test]
    public function try_from_returns_null_for_invalid_value(): void
    {
        $this->assertNull(OrderStatus::tryFrom('invalid'));
        $this->assertNull(OrderStatus::tryFrom(''));
        $this->assertNull(OrderStatus::tryFrom('pending'));
    }
}
