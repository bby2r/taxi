<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OtpCode;
use Illuminate\Http\Request;
use Illuminate\View\View;

class OtpController extends Controller
{
    public function index(Request $request): View
    {
        $phone = trim((string) $request->input('phone'));

        $otps = OtpCode::query()
            ->where('created_at', '>=', now()->subDay())
            ->when($phone !== '', fn ($q) => $q->where('phone', 'like', "%{$phone}%"))
            ->latest()
            ->paginate(25)
            ->withQueryString();

        return view('admin.otps.index', [
            'otps' => $otps,
            'phone' => $phone,
        ]);
    }
}
