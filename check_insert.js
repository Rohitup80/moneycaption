const supabaseUrl = 'https://hmysjhbfzhldqmbbaauk.supabase.co';
const supabaseKey = 'sb_publishable_07S9srH0eEWZYZPMO1uuRQ_Ov3m4HYb';

async function check() {
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const payload = {
    user_id: '060d4b85-055d-45db-9076-a05ff7944062', // Rohit's user_id
    creator_name: 'Test Creator',
    niche: 'fitness',
    city: 'Mumbai',
    city_tier: 'tier_1',
    verification_tier: 'self_reported',
    platforms: ['instagram'],
    followers_instagram: 1000,
    results_json: [{ platform: 'instagram', deliverables: [] }]
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`=== TESTING INSERT (Attempt ${attempt}) ===`);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

      const res = await fetch(`${supabaseUrl}/rest/v1/rate_calculations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(id);

      const result = await res.json();
      console.log("Status:", res.status);
      console.log("Result:", JSON.stringify(result, null, 2));
      return;
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message || err);
    }
  }
}

check();
