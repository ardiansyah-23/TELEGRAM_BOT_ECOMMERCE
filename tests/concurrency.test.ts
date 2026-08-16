/**
 * Concurrency Test for Inventory System
 * Run via: npx ts-node tests/concurrency.test.ts (if local setup matches)
 * This script is purely for demonstrating that we can test 
 * concurrent checkouts in a local environment.
 */
import { supabase } from '../src/database/client';

async function testConcurrency() {
    console.log('--- Starting Concurrency Test ---');
    const telegramId = 123456789; // Mock user
    
    // We simulate 10 concurrent checkout requests for a mock order
    const requests = Array.from({ length: 10 }).map((_, i) => {
        return supabase.rpc('checkout_cart', {
            p_telegram_id: telegramId,
            p_order_number: `TEST-ORD-${Date.now()}-${i}`,
            p_order_note: 'Concurrency test'
        });
    });

    console.log('Sending 10 concurrent checkout requests...');
    const results = await Promise.allSettled(requests);
    
    let successes = 0;
    let failures = 0;

    results.forEach((res, index) => {
        if (res.status === 'fulfilled' && !res.value.error) {
            successes++;
            console.log(`Request ${index}: SUCCESS (Order ID: ${res.value.data})`);
        } else {
            failures++;
            // Suppress the huge stack trace and just print the error message from PG
            const errorMsg = res.status === 'rejected' ? res.reason : res.value.error?.message;
            console.log(`Request ${index}: FAILED (${errorMsg})`);
        }
    });

    console.log(`\nResult: ${successes} Success, ${failures} Failures.`);
    console.log('If stock was limited (e.g. 1 item), we should expect exactly 1 success and 9 failures (or depending on cart quantity).');
}

// export this or run it directly if invoked
if (require.main === module) {
    // testConcurrency(); // uncomment to run when env is set
    console.log('Concurrency test script created. Environment setup required to execute.');
}
