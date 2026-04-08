<?php

namespace App\Http\Controllers\Admin;

use App\Enums\DriverChangeRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectDriverTicketRequest;
use App\Models\DriverChangeRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DriverTicketController extends Controller
{
    /**
     * Display a listing of driver change requests with optional status filter.
     */
    public function index(Request $request): View
    {
        $query = DriverChangeRequest::with('user')->latest();

        if ($request->filled('status')) {
            $status = DriverChangeRequestStatus::tryFrom($request->status);

            if ($status) {
                $query->where('status', $status);
            }
        }

        $tickets = $query->paginate(20)->withQueryString();
        $statuses = DriverChangeRequestStatus::cases();

        return view('admin.tickets.index', compact('tickets', 'statuses'));
    }

    /**
     * Display the specified driver change request.
     */
    public function show(DriverChangeRequest $ticket): View
    {
        $ticket->load(['user.driverProfile', 'reviewer']);

        return view('admin.tickets.show', compact('ticket'));
    }

    /**
     * Approve a pending driver change request.
     */
    public function approve(DriverChangeRequest $ticket): RedirectResponse
    {
        abort_unless($ticket->status === DriverChangeRequestStatus::Pending, 409, 'This ticket has already been reviewed.');

        DB::transaction(function () use ($ticket) {
            $user = $ticket->user;

            match ($ticket->field) {
                'name' => $user->update(['name' => $ticket->new_value]),
                'car_model', 'car_number' => $user->driverProfile->update([$ticket->field => $ticket->new_value]),
            };

            $ticket->update([
                'status' => DriverChangeRequestStatus::Approved,
                'reviewed_at' => now(),
                'reviewed_by' => Auth::id(),
            ]);
        });

        return redirect()->route('admin.tickets.show', $ticket)
            ->with('success', 'Ticket approved and change applied successfully.');
    }

    /**
     * Reject a pending driver change request.
     */
    public function reject(RejectDriverTicketRequest $request, DriverChangeRequest $ticket): RedirectResponse
    {
        abort_unless($ticket->status === DriverChangeRequestStatus::Pending, 409, 'This ticket has already been reviewed.');

        $ticket->update([
            'status' => DriverChangeRequestStatus::Rejected,
            'admin_comment' => $request->validated('admin_comment'),
            'reviewed_at' => now(),
            'reviewed_by' => Auth::id(),
        ]);

        return redirect()->route('admin.tickets.show', $ticket)
            ->with('success', 'Ticket has been rejected.');
    }
}
