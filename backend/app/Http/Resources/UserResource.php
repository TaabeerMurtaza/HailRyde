<?php

namespace App\Http\Resources;

use App\Models\DriverProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role,
            'driver_profile' => $this->driverProfile === null ? null : $this->profile($this->driverProfile),
        ];
    }

    /**
     * @return array{plate: string, category: string, status: string, lat: string, lng: string}
     */
    private function profile(DriverProfile $profile): array
    {
        return [
            'plate' => $profile->plate,
            'category' => $profile->category,
            'status' => $profile->status,
            'lat' => $profile->lat,
            'lng' => $profile->lng,
        ];
    }
}
