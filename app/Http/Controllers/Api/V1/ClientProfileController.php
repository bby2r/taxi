<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateClientProfileRequest;
use App\Http\Resources\V1\UserResource;

class ClientProfileController extends Controller
{
    /**
     * Update the authenticated client's profile.
     */
    public function update(UpdateClientProfileRequest $request): UserResource
    {
        $request->user()->update($request->validated());

        return new UserResource($request->user());
    }
}
