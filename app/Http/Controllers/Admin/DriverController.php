<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ExpoPushService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DriverController extends Controller
{
    /**
     * Display a listing of drivers.
     */
    public function index(): View
    {
        $drivers = User::drivers()
            ->with('driverProfile')
            ->leftJoinSub(
                DB::table('orders')
                    ->select('driver_id')
                    ->selectRaw('round(avg(rating)::numeric, 1) as rating_avg')
                    ->selectRaw('count(*) as rating_count')
                    ->whereNotNull('rating')
                    ->groupBy('driver_id'),
                'r',
                'r.driver_id',
                '=',
                'users.id'
            )
            ->select('users.*', 'r.rating_avg', 'r.rating_count')
            ->latest('users.created_at')
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
            'passport_front' => 'nullable|image|max:5120',
            'passport_back' => 'nullable|image|max:5120',
            'license' => 'nullable|image|max:5120',
            'driver_photo' => 'nullable|image|max:5120',
            'car_photo' => 'nullable|image|max:5120',
            'insurance' => 'nullable|image|max:5120',
        ]);

        $acceptsIntercity = $request->boolean('accepts_intercity');

        DB::transaction(function () use ($driver, $validated, $request, $acceptsIntercity) {
            $userData = [
                'name' => $validated['name'],
                'phone' => $validated['phone'],
            ];

            if (! empty($validated['password'])) {
                $userData['password'] = $validated['password'];
            }

            $driver->update($userData);

            // Store new doc uploads on the local (private) disk, organised
            // by driver id. Old file for the same slot is deleted so we
            // don't accumulate orphans every time the admin replaces a
            // scan with a clearer one.
            $profileData = [
                'car_model' => $validated['car_model'],
                'car_number' => $validated['car_number'],
                'accepts_intercity' => $acceptsIntercity,
            ];

            $docMap = [
                'passport_front' => 'passport_front_path',
                'passport_back' => 'passport_back_path',
                'license' => 'license_path',
                'driver_photo' => 'driver_photo_path',
                'car_photo' => 'car_photo_path',
                'insurance' => 'insurance_path',
            ];

            foreach ($docMap as $field => $column) {
                if ($request->hasFile($field)) {
                    $oldPath = $driver->driverProfile?->$column;
                    if ($oldPath && Storage::disk('local')->exists($oldPath)) {
                        Storage::disk('local')->delete($oldPath);
                    }
                    $profileData[$column] = $request->file($field)->store(
                        'driver-docs/'.$driver->id,
                        'local',
                    );
                }
            }

            $driver->driverProfile()->updateOrCreate(
                ['user_id' => $driver->id],
                $profileData,
            );
        });

        return redirect()->route('admin.drivers.index')
            ->with('success', 'Driver updated successfully.');
    }

    /**
     * Stream a driver KYC document. Lives behind admin auth so the
     * scans never leak via a guessable URL — the storage path itself
     * is the only thing exposed (driver-docs/{id}/{filename}), the
     * file content stays out of public/ entirely.
     */
    public function showDocument(User $driver, string $type): StreamedResponse|Response
    {
        abort_unless($driver->isDriver(), 404);

        $column = [
            'passport_front' => 'passport_front_path',
            'passport_back' => 'passport_back_path',
            'license' => 'license_path',
            'driver_photo' => 'driver_photo_path',
            'car_photo' => 'car_photo_path',
            'insurance' => 'insurance_path',
        ][$type] ?? abort(404);

        $path = $driver->driverProfile?->$column;
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path);
    }

    /**
     * Remove the specified driver from storage.
     */
    /**
     * Clear a temporary block on the driver (e.g. after 5+ shift declines).
     * Resets the decline counter and lifts `blocked_until` so the driver
     * can immediately call /go-online again.
     */
    public function unblock(User $driver): RedirectResponse
    {
        abort_unless($driver->isDriver(), 404);

        $profile = $driver->driverProfile;
        if (! $profile) {
            return back()->with('error', 'У водителя нет профиля.');
        }

        $profile->update([
            'blocked_until' => null,
            'shift_declines_count' => 0,
        ]);

        return back()->with('success', "Блокировка снята. {$driver->name} может выйти на линию.");
    }

    /**
     * Fire a one-off heads-up push to the driver via the same path used by
     * order offers. Lets the operator confirm end-to-end whether
     * Expo / FCM is reaching the device.
     */
    public function sendTestPush(User $driver, ExpoPushService $push): RedirectResponse
    {
        abort_unless($driver->isDriver(), 404);

        if (! $driver->expo_push_token) {
            return back()->with('error', 'У водителя нет push-токена. Попроси его открыть приложение и разрешить уведомления.');
        }

        $sent = $push->sendToUser(
            $driver,
            'Тестовое уведомление',
            'Если вы видите это сообщение — push работает.',
            ['type' => 'admin_test'],
            [
                'sound' => 'default',
                'priority' => 'high',
                'channelId' => 'driver_offers',
                'ttl' => 30,
            ],
        );

        return $sent
            ? back()->with('success', 'Тестовый push отправлен. Должно прийти на устройство в течение 5–10 секунд.')
            : back()->with('error', 'Не удалось отправить push. Проверь логи Render — Expo вернул ошибку (токен мог устареть).');
    }

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
