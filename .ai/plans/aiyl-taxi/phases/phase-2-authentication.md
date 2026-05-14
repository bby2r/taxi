---
phase: 2
title: "Authentication — Sanctum, OTP with Nikita.kg SMS, Driver Login, Push Token"
status: pending
depends_on: [1]
---

# Phase 2: Authentication — Sanctum, OTP, Driver Login, Push Token

Implement phone-based OTP authentication via Nikita.kg SMS provider, Sanctum token management, driver registration, and Expo push token storage.

**Pre-flight**: Run `search-docs` for "Sanctum API tokens", "Sanctum token abilities", "HTTP client", "artisan commands" before starting.

---

### 2.1 Nikita.kg SMS Service

**Complexity**: medium
**Requires**: Phase 1 complete

**Implementation**:

- **Config**: Add to `.env.example` and `.env`:
  ```
  NIKITA_LOGIN=
  NIKITA_PASSWORD=
  NIKITA_SENDER=
  NIKITA_ENABLED=false
  ```

- **Config file**: Create `config/nikita.php`:
  ```php
  return [
      'login' => env('NIKITA_LOGIN'),
      'password' => env('NIKITA_PASSWORD'),
      'sender' => env('NIKITA_SENDER', 'Taxi'),
      'enabled' => env('NIKITA_ENABLED', false),
  ];
  ```

- **Service `app/Services/NikitaSmsService.php`**: Create with `php artisan make:class --no-interaction Services/NikitaSmsService`
  ```php
  class NikitaSmsService
  {
      public function __construct(
          private readonly string $login,
          private readonly string $password,
          private readonly string $sender,
          private readonly bool $enabled,
      ) {}

      public function send(string $phone, string $message): bool
      {
          if (! $this->enabled) {
              Log::info('SMS (disabled): ' . $phone . ' — ' . $message);
              return true;
          }

          $xml = $this->buildXml($phone, $message);

          $response = Http::withBody($xml, 'application/xml')
              ->post('https://smspro.nikita.kg/api/message');

          if ($response->failed()) {
              Log::error('Nikita SMS failed', [
                  'phone' => $phone,
                  'status' => $response->status(),
                  'body' => $response->body(),
              ]);
              return false;
          }

          Log::info('Nikita SMS sent', ['phone' => $phone]);
          return true;
      }

      private function buildXml(string $phone, string $message): string
      {
          return '<?xml version="1.0" encoding="UTF-8"?>'
              . '<message>'
              . '<login>' . htmlspecialchars($this->login) . '</login>'
              . '<pwd>' . htmlspecialchars($this->password) . '</pwd>'
              . '<sender>' . htmlspecialchars($this->sender) . '</sender>'
              . '<text>' . htmlspecialchars($message) . '</text>'
              . '<phones><phone>' . htmlspecialchars($phone) . '</phone></phones>'
              . '</message>';
      }
  }
  ```

- **Service Provider registration**: In `app/Providers/AppServiceProvider.php`, register in `register()`:
  ```php
  $this->app->singleton(NikitaSmsService::class, function ($app) {
      return new NikitaSmsService(
          login: config('nikita.login', ''),
          password: config('nikita.password', ''),
          sender: config('nikita.sender', 'Taxi'),
          enabled: (bool) config('nikita.enabled', false),
      );
  });
  ```

- **OTP Service `app/Services/OtpService.php`**: Create with `php artisan make:class --no-interaction Services/OtpService`
  ```php
  class OtpService
  {
      public function __construct(
          private readonly NikitaSmsService $sms,
      ) {}

      /**
       * Generate and send OTP to phone number.
       * Invalidates any existing valid OTPs for this phone.
       */
      public function sendOtp(string $phone): OtpCode
      {
          // Invalidate existing valid OTPs
          OtpCode::forPhone($phone)->valid()->update(['expires_at' => now()]);

          $otp = OtpCode::create([
              'phone' => $phone,
              'code' => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
              'expires_at' => now()->addMinutes(5),
          ]);

          $this->sms->send($phone, "Your taxi code: {$otp->code}");

          return $otp;
      }

      /**
       * Verify OTP code for phone. Returns the OtpCode if valid, null otherwise.
       */
      public function verifyOtp(string $phone, string $code): ?OtpCode
      {
          $otp = OtpCode::forPhone($phone)
              ->valid()
              ->where('code', $code)
              ->first();

          if (! $otp) {
              return null;
          }

          $otp->update(['verified_at' => now()]);

          return $otp;
      }
  }
  ```

- **Tests (PHPUnit)**:
  - Unit: `tests/Unit/Services/NikitaSmsServiceTest.php` — `php artisan make:test --phpunit --unit Services/NikitaSmsServiceTest`
    - `testSendLogsMessageWhenDisabled` — create service with `enabled: false`, call `send()`, assert `Log::info` was called (use `Log::fake()`)
    - `testSendReturnsTrueWhenDisabled` — assert `send()` returns `true`
    - `testBuildXmlEscapesSpecialChars` — use reflection to test `buildXml()` with `<script>` in message, assert XML is properly escaped

  - Feature: `tests/Feature/Services/OtpServiceTest.php` — `php artisan make:test --phpunit Services/OtpServiceTest`
    - `testSendOtpCreatesOtpCode` — call `sendOtp('+996700123456')`, assert `OtpCode::count() === 1`, assert code is 4 digits
    - `testSendOtpInvalidatesPreviousOtps` — send 2 OTPs to same phone, assert `OtpCode::valid()->forPhone(phone)->count() === 1`
    - `testVerifyOtpReturnsOtpCodeOnSuccess` — send OTP, verify with correct code, assert returns `OtpCode` instance, assert `verified_at` is not null
    - `testVerifyOtpReturnsNullOnWrongCode` — send OTP, verify with wrong code, assert returns null
    - `testVerifyOtpReturnsNullOnExpiredCode` — create expired OTP manually, verify, assert null
    - `testVerifyOtpReturnsNullOnAlreadyVerifiedCode` — create and verify OTP, try verifying again, assert null
    - `testOtpCodeIsFourDigitsWithLeadingZeros` — send multiple OTPs, assert all codes match `/^\d{4}$/`
    - Mock `NikitaSmsService` in all tests: `$this->mock(NikitaSmsService::class)->shouldReceive('send')->andReturn(true)`

  - Feature: `tests/Feature/Services/NikitaSmsServiceHttpTest.php` — `php artisan make:test --phpunit Services/NikitaSmsServiceHttpTest`
    - `testSendMakesHttpRequestWhenEnabled` — use `Http::fake()`, create service with `enabled: true`, call `send()`, assert `Http::assertSent()` to `smspro.nikita.kg`
    - `testSendReturnsFalseOnHttpFailure` — use `Http::fake()` returning 500, assert `send()` returns false

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: Never log the actual OTP code in production. The `Log::info` in disabled mode is for dev only. Nikita.kg uses XML API, not JSON — use `Http::withBody($xml, 'application/xml')` not `Http::post()` with array.

:white_check_mark: Done when: NikitaSmsService sends XML to Nikita.kg (or logs when disabled), OtpService creates/verifies OTP codes, all tests pass.

---

### 2.2 Auth Controllers — Send OTP & Verify OTP

**Complexity**: complex
**Requires**: 2.1

**Implementation**:

- **Sanctum setup**: Run `php artisan install:api --no-interaction` if not already done. This publishes Sanctum config and adds `api.php` routes file. Verify `config/sanctum.php` exists.

- **Form Request `app/Http/Requests/Auth/SendOtpRequest.php`**: `php artisan make:request --no-interaction Auth/SendOtpRequest`
  ```php
  public function authorize(): bool
  {
      return true;
  }

  public function rules(): array
  {
      return [
          'phone' => ['required', 'string', 'regex:/^\+996[0-9]{9}$/'],
      ];
  }

  public function messages(): array
  {
      return [
          'phone.regex' => 'Phone must be a valid Kyrgyz number starting with +996.',
      ];
  }
  ```

- **Form Request `app/Http/Requests/Auth/VerifyOtpRequest.php`**: `php artisan make:request --no-interaction Auth/VerifyOtpRequest`
  ```php
  public function authorize(): bool
  {
      return true;
  }

  public function rules(): array
  {
      return [
          'phone' => ['required', 'string', 'regex:/^\+996[0-9]{9}$/'],
          'code' => ['required', 'string', 'size:4'],
      ];
  }
  ```

- **Controller `app/Http/Controllers/Api/V1/AuthController.php`**: `php artisan make:controller --no-interaction Api/V1/AuthController`
  ```php
  class AuthController extends Controller
  {
      public function __construct(
          private readonly OtpService $otpService,
      ) {}

      /**
       * POST /api/v1/auth/send-otp
       * Send OTP to phone number. Rate limited to 1 per minute per phone.
       */
      public function sendOtp(SendOtpRequest $request): JsonResponse
      {
          $this->otpService->sendOtp($request->validated('phone'));

          return response()->json([
              'message' => 'OTP sent successfully.',
          ]);
      }

      /**
       * POST /api/v1/auth/verify-otp
       * Verify OTP, create/find user, return Sanctum token.
       */
      public function verifyOtp(VerifyOtpRequest $request): JsonResponse
      {
          $validated = $request->validated();
          $otp = $this->otpService->verifyOtp($validated['phone'], $validated['code']);

          if (! $otp) {
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

          if (! $user->phone_verified_at) {
              $user->update(['phone_verified_at' => now()]);
          }

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
                  'role' => $user->role->value,
              ],
          ]);
      }

      /**
       * POST /api/v1/auth/logout
       * Revoke current token. Requires auth:sanctum.
       */
      public function logout(Request $request): JsonResponse
      {
          $request->user()->currentAccessToken()->delete();

          return response()->json([
              'message' => 'Logged out successfully.',
          ]);
      }

      /**
       * GET /api/v1/auth/me
       * Return the authenticated user. Requires auth:sanctum.
       */
      public function me(Request $request): JsonResponse
      {
          return response()->json([
              'data' => new UserResource($request->user()),
          ]);
      }
  }
  ```

- **Routes** in `routes/api.php`:
  ```php
  use App\Http\Controllers\Api\V1\AuthController;

  Route::prefix('v1')->group(function () {
      Route::prefix('auth')->group(function () {
          Route::post('/send-otp', [AuthController::class, 'sendOtp'])
              ->middleware('throttle:5,1')
              ->name('api.v1.auth.send-otp');

          Route::post('/verify-otp', [AuthController::class, 'verifyOtp'])
              ->middleware('throttle:10,1')
              ->name('api.v1.auth.verify-otp');

          Route::post('/logout', [AuthController::class, 'logout'])
              ->middleware('auth:sanctum')
              ->name('api.v1.auth.logout');

          Route::get('/me', [AuthController::class, 'me'])
              ->middleware('auth:sanctum')
              ->name('api.v1.auth.me');
      });
  });
  ```

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Http/Auth/SendOtpTest.php` — `php artisan make:test --phpunit Http/Auth/SendOtpTest`
    - `testSendOtpWithValidPhone` — POST `/api/v1/auth/send-otp` with `phone: '+996700123456'`, assert 200, assert `OtpCode::count() === 1`. Mock `NikitaSmsService`.
    - `testSendOtpWithInvalidPhone` — POST with `phone: '123'`, assert 422 validation error
    - `testSendOtpWithNonKyrgyzPhone` — POST with `phone: '+1234567890'`, assert 422
    - `testSendOtpWithMissingPhone` — POST with no body, assert 422
    - `testSendOtpRateLimit` — POST 6 times rapidly, assert 6th returns 429

  - Feature: `tests/Feature/Http/Auth/VerifyOtpTest.php` — `php artisan make:test --phpunit Http/Auth/VerifyOtpTest`
    - `testVerifyOtpCreatesNewUser` — send OTP, then verify, assert 200, assert `User::count() === 1`, assert token present in response
    - `testVerifyOtpReturnsExistingUser` — create user with phone, send OTP, verify, assert `User::count() === 1` (no duplicate)
    - `testVerifyOtpWithWrongCode` — send OTP, verify with wrong code, assert 422
    - `testVerifyOtpWithExpiredCode` — create expired OTP, verify, assert 422
    - `testVerifyOtpSetsPhoneVerifiedAt` — verify OTP for new user, assert `phone_verified_at` is not null
    - `testVerifyOtpRevokesExistingTokens` — verify OTP (get token), verify again, assert old token invalid (1 token total)
    - `testVerifyOtpResponseStructure` — assert response has keys: `message`, `token`, `user.id`, `user.name`, `user.phone`, `user.role`

  - Feature: `tests/Feature/Http/Auth/LogoutTest.php` — `php artisan make:test --phpunit Http/Auth/LogoutTest`
    - `testLogoutRevokesToken` — create user, create token, POST `/api/v1/auth/logout` with Bearer token, assert 200, assert token no longer works
    - `testLogoutWithoutTokenReturns401` — POST without token, assert 401

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: Run `php artisan install:api --no-interaction` before adding routes. This creates `routes/api.php` and the Sanctum migration. Ensure `HasApiTokens` trait is on User model (Sanctum requires it). Rate limiting uses Laravel's built-in `throttle` middleware.

:white_check_mark: Done when: Send OTP creates code in DB, Verify OTP returns Sanctum token, Logout revokes token, all validation works, all tests pass.

---

### 2.3 Driver Login

**Complexity**: medium
**Requires**: 2.2

**Implementation**:

Admin creates driver accounts (via make:admin or a future admin panel). Drivers only LOGIN with phone + password — no self-registration.

- **Form Request `app/Http/Requests/Auth/DriverLoginRequest.php`**: `php artisan make:request --no-interaction Auth/DriverLoginRequest`
  ```php
  public function authorize(): bool
  {
      return true;
  }

  public function rules(): array
  {
      return [
          'phone' => ['required', 'string', 'regex:/^\+996[0-9]{9}$/'],
          'password' => ['required', 'string'],
      ];
  }
  ```

- **Add method to `AuthController`**:
  ```php
  /**
   * POST /api/v1/auth/driver-login
   * Authenticate existing driver user with phone + password. Returns Sanctum token.
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
  ```

- **Route** (add to auth group in `routes/api.php`):
  ```php
  Route::post('/driver-login', [AuthController::class, 'driverLogin'])
      ->middleware('throttle:10,1')
      ->name('api.v1.auth.driver-login');
  ```

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Http/Auth/DriverLoginTest.php` — `php artisan make:test --phpunit Http/Auth/DriverLoginTest`
    - `testDriverLoginWithValidCredentials` — create driver user with known password, POST with phone+password, assert 200, assert response has `token` key
    - `testDriverLoginWithWrongPassword` — create driver, POST with wrong password, assert 422
    - `testDriverLoginWithNonExistentPhone` — POST with unknown phone, assert 422
    - `testDriverLoginRejectsNonDriverRole` — create client user with password, POST login, assert 403
    - `testDriverLoginResponseContainsToken` — assert response has `token` key and `user.role` is `driver`
    - `testDriverLoginRevokesExistingTokens` — login twice, assert old token invalid (1 token total)
    - `testDriverLoginWithMissingPhone` — omit `phone`, assert 422 validation
    - `testDriverLoginWithMissingPassword` — omit `password`, assert 422 validation

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: Driver accounts are created by admin only. This endpoint only authenticates existing driver users — it does NOT create new users or profiles.

:white_check_mark: Done when: Driver login authenticates existing driver, rejects non-drivers, returns token, all tests pass.

---

### 2.4 Push Token Endpoint & Make Admin Command

**Complexity**: medium
**Requires**: 2.2

**Implementation**:

- **Form Request `app/Http/Requests/UpdatePushTokenRequest.php`**: `php artisan make:request --no-interaction UpdatePushTokenRequest`
  ```php
  public function authorize(): bool
  {
      return true;
  }

  public function rules(): array
  {
      return [
          'expo_push_token' => ['required', 'string', 'regex:/^ExponentPushToken\[.+\]$/'],
      ];
  }

  public function messages(): array
  {
      return [
          'expo_push_token.regex' => 'Must be a valid Expo push token (ExponentPushToken[...]).',
      ];
  }
  ```

- **Controller method**: Add to `AuthController`:
  ```php
  /**
   * PUT /api/v1/auth/push-token
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
  ```

- **Route** (add to `routes/api.php`, inside v1 auth group, with sanctum middleware):
  ```php
  Route::put('/push-token', [AuthController::class, 'updatePushToken'])
      ->middleware('auth:sanctum')
      ->name('api.v1.auth.push-token');
  ```

- **Artisan Command**: `php artisan make:command --no-interaction MakeAdminCommand`
  File: `app/Console/Commands/MakeAdminCommand.php`
  ```php
  class MakeAdminCommand extends Command
  {
      protected $signature = 'make:admin';
      protected $description = 'Create an admin user';

      public function handle(): int
      {
          $name = $this->ask('Admin name');
          $phone = $this->ask('Admin phone (e.g. +996700000000)');
          $password = $this->ask('Admin password');

          if (User::where('phone', $phone)->exists()) {
              $this->error("User with phone {$phone} already exists.");
              return self::FAILURE;
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
  ```

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Http/Auth/PushTokenTest.php` — `php artisan make:test --phpunit Http/Auth/PushTokenTest`
    - `testUpdatePushTokenForAuthenticatedUser` — create user, authenticate with Sanctum, PUT `/api/v1/auth/push-token` with valid token, assert 200, assert user's `expo_push_token` updated in DB
    - `testUpdatePushTokenRejectsInvalidFormat` — send non-Expo format string, assert 422
    - `testUpdatePushTokenRequiresAuth` — PUT without token, assert 401
    - `testUpdatePushTokenWithValidExpoFormat` — send `ExponentPushToken[abc123]`, assert accepted

  - Feature: `tests/Feature/Console/MakeAdminCommandTest.php` — `php artisan make:test --phpunit Console/MakeAdminCommandTest`
    - `testMakeAdminCreatesAdminUser` — run artisan command with expectations:
      ```php
      $this->artisan('make:admin')
          ->expectsQuestion('Admin name', 'Test Admin')
          ->expectsQuestion('Admin phone (e.g. +996700000000)', '+996700000000')
          ->expectsQuestion('Admin password', 'password123')
          ->expectsOutput('Admin user created: Test Admin (+996700000000)')
          ->assertExitCode(0);
      $this->assertDatabaseHas('users', ['phone' => '+996700000000', 'role' => 'admin']);
      ```
    - `testMakeAdminFailsForDuplicatePhone` — create user with phone, run command with same phone, assert exit code `FAILURE`
    - `testMakeAdminSetsCorrectRole` — run command, assert user in DB has `role => 'admin'`
    - `testMakeAdminHashesPassword` — run command, assert stored password is not plaintext (use `Hash::check()`)

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: The `make:admin` signature conflicts with Laravel's built-in `make:` namespace — but it's an explicit user requirement. The Expo push token regex must match `ExponentPushToken[...]` format exactly. Push token should be in `$hidden` on User model (set in Phase 1.2).

:white_check_mark: Done when: Push token endpoint updates user, make:admin command creates admin user, all tests pass.
