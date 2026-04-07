<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DriverController extends Controller
{
    /**
     * Display a listing of drivers.
     */
    public function index(): View
    {
        $drivers = User::drivers()
            ->with('driverProfile')
            ->latest()
            ->paginate(15);

        return view('admin.drivers.index', compact('drivers'));
    }

    /**
     * Show the form for creating a new driver.
     */
    public function create(): View
    {
        return view('admin.drivers.create');
    }

    /**
     * Store a newly created driver in storage.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20|unique:users',
            'password' => 'required|string|min:6',
            'car_model' => 'required|string|max:255',
            'car_number' => 'required|string|max:20',
        ]);

        DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'phone' => $validated['phone'],
                'password' => $validated['password'],
                'role' => UserRole::Driver,
            ]);

            $user->driverProfile()->create([
                'car_model' => $validated['car_model'],
                'car_number' => $validated['car_number'],
            ]);
        });

        return redirect()->route('admin.drivers.index')
            ->with('success', 'Driver created successfully.');
    }

    /**
     * Show the form for editing the specified driver.
     */
    public function edit(User $driver): View
    {
        abort_unless($driver->isDriver(), 404);

        $driver->load('driverProfile');

        return view('admin.drivers.edit', compact('driver'));
    }

    /**
     * Update the specified driver in storage.
     */
    public function update(Request $request, User $driver): RedirectResponse
    {
        abort_unless($driver->isDriver(), 404);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20|unique:users,phone,'.$driver->id,
            'password' => 'nullable|string|min:6',
            'car_model' => 'required|string|max:255',
            'car_number' => 'required|string|max:20',
        ]);

        DB::transaction(function () use ($driver, $validated) {
            $userData = [
                'name' => $validated['name'],
                'phone' => $validated['phone'],
            ];

            if (! empty($validated['password'])) {
                $userData['password'] = $validated['password'];
            }

            $driver->update($userData);

            $driver->driverProfile()->updateOrCreate(
                ['user_id' => $driver->id],
                [
                    'car_model' => $validated['car_model'],
                    'car_number' => $validated['car_number'],
                ]
            );
        });

        return redirect()->route('admin.drivers.index')
            ->with('success', 'Driver updated successfully.');
    }

    /**
     * Remove the specified driver from storage.
     */
    public function destroy(User $driver): RedirectResponse
    {
        abort_unless($driver->isDriver(), 404);

        $hasActiveOrders = $driver->driverOrders()
            ->whereIn('status', [OrderStatus::Accepted, OrderStatus::Arrived])
            ->exists();

        if ($hasActiveOrders) {
            return redirect()->route('admin.drivers.index')
                ->with('error', 'Cannot delete driver with active orders.');
        }

        $driver->delete();

        return redirect()->route('admin.drivers.index')
            ->with('success', 'Driver deleted successfully.');
    }
}
