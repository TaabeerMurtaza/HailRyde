<?php

namespace App\Exceptions;

use Exception;

class RouteUnavailableException extends Exception
{
    public function __construct()
    {
        parent::__construct('Road routing is unavailable.');
    }
}
