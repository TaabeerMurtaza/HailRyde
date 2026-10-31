<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rides', function (Blueprint $table) {
            $table->id()->generatedAs();
            $table->foreignId('rider_id')->constrained('users');
            $table->text('pickup_place_id');
            $table->text('pickup_name');
            $table->rawColumn('pickup_lat', 'numeric(9,6)');
            $table->rawColumn('pickup_lng', 'numeric(9,6)');
            $table->text('destination_place_id');
            $table->text('destination_name');
            $table->rawColumn('destination_lat', 'numeric(9,6)');
            $table->rawColumn('destination_lng', 'numeric(9,6)');
            $table->rawColumn('category', "text check (category in ('economy', 'comfort'))");
            $table->rawColumn('status', "text check (status in ('requested', 'accepted', 'completed', 'cancelled'))");
            $table->rawColumn('distance_km', 'numeric(8,2)');
            $table->integer('duration_min');
            $table->integer('pickup_eta_min')->nullable();
            $table->rawColumn('fare_amount', 'numeric(10,2)');
            $table->text('idempotency_key');
            $table->text('request_hash');
            $table->timestampTz('accepted_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();
            $table->unique(['rider_id', 'idempotency_key']);
            $table->index('status');
        });

        DB::statement("create unique index rides_one_active_per_rider on rides (rider_id) where status in ('requested', 'accepted')");

        Schema::create('driver_assignments', function (Blueprint $table) {
            $table->id()->generatedAs();
            $table->foreignId('ride_id')->unique()->constrained('rides');
            $table->foreignId('driver_id')->constrained('users');
            $table->timestampTz('assigned_at');
            $table->index('driver_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_assignments');
        Schema::dropIfExists('rides');
    }
};
