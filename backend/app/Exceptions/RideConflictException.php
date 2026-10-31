<?php

namespace App\Exceptions;

use Exception;

class RideConflictException extends Exception
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }

    public static function invalidTransition(): self
    {
        return new self('invalid_transition', 'The ride cannot make that transition.');
    }

    public static function driverUnavailable(): self
    {
        return new self('driver_unavailable', 'The driver is not available.');
    }

    public static function categoryMismatch(): self
    {
        return new self('category_mismatch', 'The driver category does not match this ride.');
    }

    public static function lockTimeout(): self
    {
        return new self('lock_timeout', 'Timed out waiting for the ride lock.');
    }
}
