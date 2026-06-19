<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DriverPhotoController extends Controller
{
    /**
     * Stream driver's profile photo через signed-url. Клиент получает
     * temporarySignedRoute из OrderResource (24ч) — не требует
     * auth-токена, нельзя подобрать без подписи. Storage остаётся private.
     */
    public function show(Request $request, User $user): StreamedResponse|JsonResponse
    {
        if (! $user->isDriver()) {
            return response()->json(['message' => 'Not found.'], 404);
        }
        $path = $user->driverProfile?->driver_photo_path;
        if (! $path || ! Storage::disk('local')->exists($path)) {
            return response()->json(['message' => 'Photo not uploaded.'], 404);
        }

        return Storage::disk('local')->response($path, headers: [
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * Driver uploads / replaces their profile photo. Auth-only.
     */
    public function upload(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user || ! $user->isDriver()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $request->validate([
            'photo' => ['required', 'image', 'max:8192'],
        ]);

        $profile = $user->driverProfile;
        if (! $profile) {
            return response()->json(['message' => 'Driver profile not initialised.'], 422);
        }

        $oldPath = $profile->driver_photo_path;
        if ($oldPath && Storage::disk('local')->exists($oldPath)) {
            Storage::disk('local')->delete($oldPath);
        }

        $path = $request->file('photo')->store('driver-docs/'.$user->id, 'local');
        $profile->update(['driver_photo_path' => $path]);

        return response()->json([
            'message' => 'Photo uploaded.',
            'has_photo' => true,
        ]);
    }
}
