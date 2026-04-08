<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\DriverChangeRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\RequestDriverChangesRequest;
use App\Http\Resources\V1\DriverChangeRequestResource;
use App\Models\DriverChangeRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DriverProfileController extends Controller
{
    /**
     * The changeable fields and their source model.
     *
     * @var array<string, string>
     */
    private const FIELD_SOURCES = [
        'name' => 'user',
        'car_model' => 'driverProfile',
        'car_number' => 'driverProfile',
    ];

    /**
     * Submit change requests for driver profile fields.
     */
    public function requestChanges(RequestDriverChangesRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->load('driverProfile');
        $validated = $request->validated();

        $createdRequests = collect();

        foreach ($validated as $field => $newValue) {
            $oldValue = self::FIELD_SOURCES[$field] === 'user'
                ? $user->{$field}
                : $user->driverProfile?->{$field};

            $createdRequests->push(DriverChangeRequest::create([
                'user_id' => $user->id,
                'field' => $field,
                'old_value' => $oldValue,
                'new_value' => $newValue,
                'status' => DriverChangeRequestStatus::Pending,
            ]));
        }

        return DriverChangeRequestResource::collection($createdRequests)
            ->response()
            ->setStatusCode(201);
    }

    /**
     * List the authenticated driver's change requests.
     */
    public function changeRequests(Request $request): AnonymousResourceCollection
    {
        $changeRequests = $request->user()
            ->changeRequests()
            ->latest()
            ->paginate(15);

        return DriverChangeRequestResource::collection($changeRequests);
    }
}
