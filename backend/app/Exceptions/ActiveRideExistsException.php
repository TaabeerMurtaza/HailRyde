<?php

namespace App\Exceptions;

use Exception;

class ActiveRideExistsException extends Exception
{
    public function __construct(public readonly int $rideId)
    {
        parent::__construct('An active ride already exists.');
    }
}
