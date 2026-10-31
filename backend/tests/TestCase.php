<?php

namespace Tests;

use App\Rides\FakeRoadRouter;
use App\Rides\RoadRouter;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->instance(RoadRouter::class, new FakeRoadRouter);
    }

    // The guard keeps the previous request's user. Forget it so the next bearer token is read.
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $this->app['auth']->forgetGuards();

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
