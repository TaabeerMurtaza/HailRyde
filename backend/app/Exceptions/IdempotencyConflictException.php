<?php

namespace App\Exceptions;

use Exception;

class IdempotencyConflictException extends Exception
{
    public function __construct()
    {
        parent::__construct('This idempotency key was already used with a different request.');
    }
}
