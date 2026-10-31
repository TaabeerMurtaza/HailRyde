<?php

namespace App\Exceptions;

use Exception;

class NoRouteException extends Exception
{
    public function __construct()
    {
        parent::__construct('Those points are not connected by a road.');
    }
}
