<?php

namespace App\Rides;

final class MapPoint
{
    private function __construct(public readonly string $lat, public readonly string $lng) {}

    public static function fromNumbers(float $lat, float $lng): self
    {
        return new self(
            number_format(round($lat, 6), 6, '.', ''),
            number_format(round($lng, 6), 6, '.', ''),
        );
    }

    public function placeId(): string
    {
        return $this->lat.','.$this->lng;
    }

    public function name(): string
    {
        return $this->lat.', '.$this->lng;
    }

    public function sameAs(self $other): bool
    {
        return $this->lat === $other->lat && $this->lng === $other->lng;
    }
}
