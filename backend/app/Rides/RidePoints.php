<?php

namespace App\Rides;

use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class RidePoints
{
    /**
     * @return array<string, mixed>
     */
    public static function rules(): array
    {
        $south = config('rides.bounds.south');
        $north = config('rides.bounds.north');
        $west = config('rides.bounds.west');
        $east = config('rides.bounds.east');

        return [
            'pickup_lat' => ['required', 'numeric', "between:{$south},{$north}"],
            'pickup_lng' => ['required', 'numeric', "between:{$west},{$east}"],
            'destination_lat' => ['required', 'numeric', "between:{$south},{$north}"],
            'destination_lng' => ['required', 'numeric', "between:{$west},{$east}"],
            'category' => ['required', 'string', Rule::in(array_keys(config('rides.categories')))],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{pickup: MapPoint, destination: MapPoint}
     */
    public static function fromValidated(array $data): array
    {
        $pickup = MapPoint::fromNumbers((float) $data['pickup_lat'], (float) $data['pickup_lng']);
        $destination = MapPoint::fromNumbers((float) $data['destination_lat'], (float) $data['destination_lng']);

        if ($pickup->sameAs($destination)) {
            throw ValidationException::withMessages([
                'destination_lat' => ['Pickup and destination must differ.'],
            ]);
        }

        return ['pickup' => $pickup, 'destination' => $destination];
    }
}
