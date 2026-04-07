<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

#[Signature('make:admin {--name= : Admin name} {--phone= : Admin phone} {--password= : Admin password}')]
#[Description('Create an admin user')]
class MakeAdminCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $name = $this->option('name') ?? $this->ask('Admin name');
        $phone = $this->option('phone') ?? $this->ask('Admin phone (e.g. +996700000000)');
        $password = $this->option('password') ?? $this->ask('Admin password');

        if (User::where('phone', $phone)->exists()) {
            $this->info("Admin with phone {$phone} already exists, skipping.");

            return self::SUCCESS;
        }

        $user = User::create([
            'name' => $name,
            'phone' => $phone,
            'password' => Hash::make($password),
            'role' => UserRole::Admin,
            'phone_verified_at' => now(),
        ]);

        $this->info("Admin user created: {$user->name} ({$user->phone})");

        return self::SUCCESS;
    }
}
