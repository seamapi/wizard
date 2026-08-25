<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A bookable space (room, suite, cabin…). Spaces are archived rather than
 * deleted so past reservations keep pointing at something real.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spaces', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('kind')->default('room');
            // Maximum party size this space sleeps.
            $table->integer('capacity')->default(2);
            // Nightly rate in cents, or null when no rate has been set.
            $table->integer('rate_cents')->nullable();
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spaces');
    }
};
