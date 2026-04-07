<?php

namespace Tests\Feature\Console;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MakeAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function test_make_admin_creates_admin_user(): void
    {
        $this->artisan('make:admin')
            ->expectsQuestion('Admin name', 'Test Admin')
            ->expectsQuestion('Admin phone (e.g. +996700000000)', '+996700000000')
            ->expectsQuestion('Admin password', 'password123')
            ->expectsOutput('Admin user created: Test Admin (+996700000000)')
            ->assertExitCode(0);

        $this->assertDatabaseHas('users', [
            'phone' => '+996700000000',
            'role' => 'admin',
        ]);
    }

    #[Test]
    public function test_make_admin_fails_for_duplicate_phone(): void
    {
        User::factory()->create(['phone' => '+996700000000']);

        $this->artisan('make:admin')
            ->expectsQuestion('Admin name', 'Test Admin')
            ->expectsQuestion('Admin phone (e.g. +996700000000)', '+996700000000')
            ->expectsQuestion('Admin password', 'password123')
            ->assertExitCode(1);
    }

    #[Test]
    public function test_make_admin_sets_correct_role(): void
    {
        $this->artisan('make:admin')
            ->expectsQuestion('Admin name', 'Role Admin')
            ->expectsQuestion('Admin phone (e.g. +996700000000)', '+996700111111')
            ->expectsQuestion('Admin password', 'password123')
            ->assertExitCode(0);

        $this->assertDatabaseHas('users', [
            'phone' => '+996700111111',
            'role' => 'admin',
        ]);
    }

    #[Test]
    public function test_make_admin_hashes_password(): void
    {
        $this->artisan('make:admin')
            ->expectsQuestion('Admin name', 'Hash Admin')
            ->expectsQuestion('Admin phone (e.g. +996700000000)', '+996700222222')
            ->expectsQuestion('Admin password', 'secret123')
            ->assertExitCode(0);

        $user = User::where('phone', '+996700222222')->first();

        $this->assertNotNull($user);
        $this->assertNotEquals('secret123', $user->password);
        $this->assertTrue(Hash::check('secret123', $user->password));
    }
}
