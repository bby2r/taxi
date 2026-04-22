<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingController extends Controller
{
    public function index(): View
    {
        $settings = Setting::all()->keyBy('key');

        return view('admin.settings.index', compact('settings'));
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'day_price' => 'required|integer|min:0',
            'night_price' => 'required|integer|min:0',
            'cancellation_fee' => 'required|integer|min:0',
            'max_search_radius_km' => 'required|numeric|min:0',
            'stale_active_order_hours' => 'required|numeric|min:0',
        ]);

        foreach ($validated as $key => $value) {
            Setting::where('key', $key)->update(['value' => (string) $value]);
        }

        return redirect()->route('admin.settings.index')
            ->with('success', 'Settings updated successfully.');
    }
}
