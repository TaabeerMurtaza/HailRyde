<?php

namespace App\Exceptions;

use Exception;

class ForbiddenException extends Exception
{
    public function __construct()
    {
        parent::__construct('Forbidden.');
    }
}
