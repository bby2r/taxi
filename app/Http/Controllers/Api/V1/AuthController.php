<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePhoneSendOtpRequest;
use App\Http\Requests\Auth\ChangePhoneVerifyRequest;
use App\Http\Requests\Auth\DriverLoginRequest;
use App\Http\Requests\Auth\SendOtpRequest;
use App\Http\Requests\Auth\UpdatePushTokenRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function __construct(
        private readonly OtpService $otpService,
    ) {}

    /**
     * Send an OTP code to the given phone number.
     */
    public function sendOtp(SendOtpRequest $request): JsonResponse
    {
        $this->otpService->sendOtp($request->validated('phone'));

        return response()->json([
            'message' => 'OTP code sent successfully.',
        ]);
    }

    /**
     * Verify an OTP code and return an authentication token.
     */
    public function verifyOtp(VerifyOtpRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $otpCode = $this->otpService->verifyOtp($validated['phone'], $validated['code']);

        if (! $otpCode) {
            return response()->json([
                'message' => 'Invalid or expired OTP code.',
            ], 422);
        }

        $user = User::firstOrCreate(
            ['phone' => $validated['phone']],
            [
                'name' => '',
                'role' => UserRole::Client,
                'phone_verified_at' => now(),
            ],
        );

        // Revoke all existing tokens for this user
        $user->tokens()->delete();

        $token = $user->createToken('mobile', expiresAt: now()->addDays(30));

        return response()->json([
            'message' => 'Authenticated successfully.',
            'token' => $token->plainTextToken,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Authenticate an existing driver user with phone + password.
     */
    public function driverLogin(DriverLoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = User::where('phone', $validated['phone'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid phone number or password.',
            ], 422);
        }

        if ($user->role !== UserRole::Driver) {
            return response()->json([
                'message' => 'This account is not a driver account.',
            ], 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('mobile', expiresAt: now()->addDays(30));

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token->plainTextToken,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'role' => $user->role->value,
            ],
        ]);
    }

    /**
     * Refresh the current authentication token.
     */
    public function refreshToken(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        $token = $request->user()->createToken('mobile', expiresAt: now()->addDays(30));

        return response()->json([
            'message' => 'Token refreshed successfully.',
            'token' => $token->plainTextToken,
        ]);
    }

    /**
     * Revoke the current authentication token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Return the authenticated user's data.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Update the authenticated user's Expo push token.
     */
    public function updatePushToken(UpdatePushTokenRequest $request): JsonResponse
    {
        $request->user()->update([
            'expo_push_token' => $request->validated('expo_push_token'),
        ]);

        return response()->json([
            'message' => 'Push token updated.',
        ]);
    }

    /**
     * Send an OTP code to a new phone number for phone change.
     */
    public function changePhoneSendOtp(ChangePhoneSendOtpRequest $request): JsonResponse
    {
        $this->otpService->sendOtp($request->validated('phone'));

        return response()->json([
            'message' => 'OTP code sent to new phone number.',
        ]);
    }

    /**
     * Verify OTP and update the user's phone number.
     */
    public function changePhoneVerify(ChangePhoneVerifyRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $otpCode = $this->otpService->verifyOtp($validated['phone'], $validated['code']);

        if (! $otpCode) {
            return response()->json([
                'message' => 'Invalid or expired OTP code.',
            ], 422);
        }

        // Race condition guard: ensure phone wasn't taken between validation and now
        if (User::where('phone', $validated['phone'])->where('id', '!=', $request->user()->id)->exists()) {
            return response()->json([
                'message' => 'This phone number was just taken.',
            ], 409);
        }

        $request->user()->update([
            'phone' => $validated['phone'],
            'phone_verified_at' => now(),
        ]);

        return response()->json([
            'message' => 'Phone number updated successfully.',
        ]);
    }
}
