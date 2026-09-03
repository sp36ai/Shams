/**
 * Production Test Case Generator: Apple vs. Samsung Patent Verdict
 *
 * August 24, 2012, 15:30 PDT (22:30 UTC) in San Jose, California
 * Query: "Will we win the patent lawsuit and receive damages?"
 * Historical Outcome: $1.049 billion damages awarded in Apple's favor
 *
 * This test validates:
 * - 6th house (Litigation) → 11th house (Victory) without 12th/5th veto
 * - 2nd/8th axis (Damages) supporting financial windfall
 * - Floating-point precision on Node calculations
 */

import fs from 'fs';
import path from 'path';

// Import the chart builder to calculate real ephemeris
import { buildChart } from '../src/astrology/primitives/chartBuilder';

async function generateAppleVsSamsungCase() {
  console.log('🔍 Generating Production Test Case: Apple vs. Samsung\n');
  console.log('Query Timestamp: August 24, 2012, 15:30 PDT (22:30 UTC)');
  console.log('Location: San Jose, California (37.3382° N, 121.8863° W)');
  console.log('Query: "Will we win the patent lawsuit and receive damages?"\n');

  // Build the real chart using the chartBuilder
  const isoTimestamp = '2012-08-24T22:30:00Z'; // 15:30 PDT = 22:30 UTC
  const latitude = 37.3382; // North
  const longitude = -121.8863; // West (negative)

  console.log('⚙️  Building ephemeris chart...');
  const chart = buildChart(isoTimestamp, latitude, longitude);

  console.log('✅ Chart built successfully\n');

  // Extract key planetary data
  console.log('📍 Planetary Positions (Sidereal Lahiri):');
  const planets = chart.planets;
  Object.entries(planets).forEach(([name, data]: any) => {
    const retrograde = data.isRetrograde ? ' (R)' : '';
    console.log(`  ${name}: ${data.siderealLongitude.toFixed(2)}°${retrograde}`);
  });

  console.log('\n🏠 House Cusps (Placidus):');
  chart.cusps.forEach((cusp: any, idx: number) => {
    console.log(`  House ${idx + 1}: ${cusp.siderealLongitude.toFixed(2)}° (${cusp.sign})`);
  });

  console.log('\n🌑 Nodes:');
  console.log(`  Rahu: ${planets.Rahu.siderealLongitude.toFixed(2)}°`);
  console.log(`  Ketu: ${planets.Ketu.siderealLongitude.toFixed(2)}°`);

  // Create the test case JSON
  const testCase = {
    test_id: 'LIT_PROD_001',
    category: 'LITIGATION',
    description:
      'Apple vs. Samsung Patent Litigation: $1.049B damages verdict. Query: "Will we win and receive damages?" Timestamp: Aug 24, 2012, 15:30 PDT.',
    scenario:
      'High-stakes patent litigation with documented financial outcome. 6th CSL must support 11th house victory without Sub-Lord veto to 12th/5th. 2nd/8th axis should trigger windfall alongside victory verdict.',
    input_state: {
      query_metadata: {
        event_type: 'LITIGATION_VICTORY',
        query_intent: 'FORWARD',
        timestamp: Math.floor(new Date(isoTimestamp).getTime() / 1000),
        query_text: 'Will we win the patent lawsuit and receive damages?',
      },
      chart_data: {
        // Real chart from ephemeris
        location: { lat: latitude, lon: longitude, city: 'San Jose, CA' },
        timestamp_utc: isoTimestamp,
        cusps: chart.cusps.reduce((acc: any, cusp: any, idx: number) => {
          acc[idx + 1] = cusp.siderealLongitude;
          return acc;
        }, {}),
        planets: Object.fromEntries(
          Object.entries(planets).map(([name, data]: any) => [
            name,
            {
              siderealLongitude: data.siderealLongitude,
              siderealLatitude: data.siderealLatitude,
              isRetrograde: data.isRetrograde,
              sign: data.sign,
              nakshatra: data.nakshatra,
              nakshatraLord: data.nakshatraLord,
              subLord: data.subLord,
            },
          ]),
        ),
        nodes: {
          rahu: {
            siderealLongitude: planets.Rahu.siderealLongitude,
            siderealLatitude: planets.Rahu.siderealLatitude,
            sign: planets.Rahu.sign,
            nakshatra: planets.Rahu.nakshatra,
            nakshatraLord: planets.Rahu.nakshatraLord,
          },
          ketu: {
            siderealLongitude: planets.Ketu.siderealLongitude,
            siderealLatitude: planets.Ketu.siderealLatitude,
            sign: planets.Ketu.sign,
            nakshatra: planets.Ketu.nakshatra,
            nakshatraLord: planets.Ketu.nakshatraLord,
          },
        },
        retrograde_planets: Object.entries(planets)
          .filter(([_, data]: any) => data.isRetrograde)
          .map(([name]) => name),
      },
      event_vectors: {
        primary: 6, // Litigation CSL
        secondary: [1, 10, 11], // Self, career, gains
        negating: [12, 5], // Loss, creativity/children
      },
    },
    expected_output: {
      status: 'PROMISED_AND_TIMED',
      confidence_minimum: 0.85,
      verdict_reasoning:
        'Victory promised by 11th house signification; Sub-Lord confirms without veto to 12th',
      damages_expected: true,
      factors: [
        'Real ephemeris data from August 24, 2012, 22:30 UTC',
        'San Jose, California (37.3382° N, 121.8863° W)',
        '6th CSL supports Litigation victory',
        '11th house signification: Victory promised',
        '2nd/8th axis: Damages windfall',
        'Sub-Lord does not veto (no 12th/5th signification)',
        'Historical outcome: $1.049 billion awarded in Apple favor',
      ],
    },
    pass_criteria: {
      status_match: true,
      confidence_above_threshold: 0.85,
      verdict_reasoning_included: true,
      damages_axis_triggered: true,
      execution_time_ms_max: 500,
    },
  };

  // Write the test case
  const outputPath = path.join(
    '/home/user/Shams/tests/cases',
    'LIT_PROD_001_apple_vs_samsung.json',
  );
  fs.writeFileSync(outputPath, JSON.stringify(testCase, null, 2));

  console.log(`\n📝 Test case written to: ${outputPath}\n`);

  return testCase;
}

// Execute
generateAppleVsSamsungCase().catch(err => {
  console.error('❌ Error generating test case:', err);
  process.exit(1);
});
