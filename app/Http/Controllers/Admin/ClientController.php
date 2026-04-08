<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\View\View;

class ClientController extends Controller
{
    public function index(): View
    {
        $clients = User::clients()
            ->withCount('clientOrders')
            ->latest()
            ->paginate(15);

        return view('admin.clients.index', compact('clients'));
    }
}
