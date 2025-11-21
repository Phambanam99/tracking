/**
 * Test direct connection to ADSB External API
 */

async function testExternalAPI() {
  console.log('🔍 Testing ADSB External API Connection...\n');

  const url = 'http://10.75.20.5:6001/api/osint/adsb/stream';
  console.log(`📡 Connecting to: ${url}\n`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏱️  Timeout after 30 seconds');
      controller.abort();
    }, 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ FieldFilter: '', PositionFilter: '' }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`✅ Response status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status}`);
      process.exit(1);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let batchCount = 0;

    console.log('\n⏳ Reading stream (max 10 batches)...\n');

    while (batchCount < 10) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('✓ Stream ended');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const batch = JSON.parse(line);
            if (Array.isArray(batch)) {
              batchCount++;
              console.log(`📦 Batch #${batchCount}: ${batch.length} aircraft`);
              if (batchCount === 1 && batch.length > 0) {
                console.log('   Sample aircraft:', JSON.stringify(batch[0], null, 2));
              }
            }
          } catch (error) {
            console.error(`❌ Parse error: ${error.message}`);
          }
        }
      }
    }

    reader.cancel();
    console.log(`\n✅ Successfully received ${batchCount} batches from external API`);

  } catch (error) {
    console.error(`\n❌ Connection failed: ${error.message}`);
    if (error.name === 'AbortError') {
      console.error('   Connection timeout - API may be slow or unavailable');
    }
    process.exit(1);
  }
}

testExternalAPI();
