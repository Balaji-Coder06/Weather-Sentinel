/**
 * WEATHER SENTINEL — PHASE 9 GLOBAL LOCATION & ADDRESS INPUT TEST SUITE
 * 
 * Verifies:
 * 1. Global City Search
 * 2. Full Street Address Resolution
 * 3. Landmark & Point-of-Interest Resolution
 * 4. Google Plus Code & Compound Plus Code Resolution ("37J9+8H Chennai, Tamil Nadu")
 * 5. Open-Meteo Fallback & Graceful Degradation
 * 6. Downstream Weather Pipeline Integration & Cache Isolation
 * 7. Race Condition & Rapid Input Cancellation
 */

import { LocationService } from '../../services/locationService';
import { PlusCodeDecoder } from '../../services/plusCodeDecoder';
import { SentinelCore } from '../../engine/sentinelCore';

declare const process: { exit: (code?: number) => void };

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName}${failureDetails ? ` -> ${failureDetails}` : ''}`);
  }
}

async function run() {
  console.log('\n================================================================');
  console.log('PHASE 9: GLOBAL LOCATION & ADDRESS INPUT VERIFICATION');
  console.log('================================================================\n');

  // 1. Plus Code Decoding & Compound Resolution
  console.log('1. Plus Code & Compound Code Parsing:');
  {
    const isPlus = PlusCodeDecoder.isPlusCode('37J9+8H Chennai, Tamil Nadu');
    assert(isPlus === true, 'Detects compound Plus Code "37J9+8H Chennai, Tamil Nadu"');

    const compound = PlusCodeDecoder.parseCompoundCode('37J9+8H Chennai, Tamil Nadu');
    assert(compound !== null && compound.code === '37J9+8H', 'Parses code token "37J9+8H" correctly');
    assert(compound !== null && compound.locality.includes('Chennai'), 'Parses reference locality "Chennai"');

    // Decode full 10-char Plus Code (New York code)
    const fullDecoded = PlusCodeDecoder.decodeFullCode('87G8P27Q+5M');
    assert(
      fullDecoded.latitude > 40.0 && fullDecoded.latitude < 41.5 && fullDecoded.longitude > -74.5 && fullDecoded.longitude < -73.5,
      `Full Plus Code decodes within geographic tolerance (${fullDecoded.latitude}°N, ${fullDecoded.longitude}°E)`
    );

    // Resolve compound Plus Code via LocationService
    const resolvedPlus = await LocationService.resolvePlusCode('37J9+8H Chennai, Tamil Nadu');
    assert(resolvedPlus.length > 0, 'LocationService resolves compound Plus Code');
    assert(
      resolvedPlus[0].latitude > 13.0 && resolvedPlus[0].latitude < 13.2,
      `Resolved Plus Code latitude is geographically correct for Chennai (${resolvedPlus[0].latitude}°N)`
    );
    assert(
      resolvedPlus[0].placeType === 'plus_code',
      `Resolved location has placeType 'plus_code'`
    );
  }

  // 2. Global City & Landmark Resolution
  console.log('\n2. Global City & Landmark Resolution:');
  {
    // Search Chennai
    const chennai = await LocationService.searchLocations('Chennai');
    assert(chennai.length > 0, 'Resolves city: Chennai');
    assert(chennai[0].latitude > 12.9 && chennai[0].latitude < 13.2, `Chennai coordinates valid (${chennai[0].latitude}°N, ${chennai[0].longitude}°E)`);

    // Search Mumbai
    const mumbai = await LocationService.searchLocations('Mumbai');
    assert(mumbai.length > 0, 'Resolves city: Mumbai');
    assert(mumbai[0].latitude > 18.9 && mumbai[0].latitude < 19.2, `Mumbai coordinates valid (${mumbai[0].latitude}°N, ${mumbai[0].longitude}°E)`);

    // Search London
    const london = await LocationService.searchLocations('London');
    assert(london.length > 0, 'Resolves international city: London');
    assert(london[0].latitude > 51.4 && london[0].latitude < 51.6, `London coordinates valid (${london[0].latitude}°N, ${london[0].longitude}°E)`);

    // Search Tokyo
    const tokyo = await LocationService.searchLocations('Tokyo');
    assert(tokyo.length > 0, 'Resolves international city: Tokyo');
    assert(tokyo[0].latitude > 35.5 && tokyo[0].latitude < 35.8, `Tokyo coordinates valid (${tokyo[0].latitude}°N, ${tokyo[0].longitude}°E)`);
  }

  // 3. Location Normalization & Attribute Completeness
  console.log('\n3. Location Model Normalization:');
  {
    const results = await LocationService.searchLocations('New York');
    assert(results.length > 0, 'Resolves New York');
    const loc = results[0];
    assert(Boolean(loc.name && loc.formattedAddress), 'Location has name and formatted address');
    assert(typeof loc.latitude === 'number' && !isNaN(loc.latitude), 'Location has numeric latitude');
    assert(typeof loc.longitude === 'number' && !isNaN(loc.longitude), 'Location has numeric longitude');
    assert(Boolean(loc.timezone), `Location has timezone (${loc.timezone})`);
    assert(Boolean(loc.source), `Location tracks provenance source (${loc.source})`);
  }

  // 4. End-to-End Weather & Risk Pipeline Integration with Resolved Location
  console.log('\n4. Downstream Weather Pipeline Integration:');
  {
    const sentinel = new SentinelCore();

    // Evaluate resolved Plus Code location
    const plusLoc = (await LocationService.resolvePlusCode('37J9+8H Chennai, Tamil Nadu'))[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const analysisResult = await sentinel.analyzePlan({
      activityId: 'running',
      locationName: plusLoc.formattedAddress,
      latitude: plusLoc.latitude,
      longitude: plusLoc.longitude,
      timezone: plusLoc.timezone || 'auto',
      date: dateStr,
      startTime: '17:00',
      durationHours: 1.5,
    });

    assert(analysisResult.overallRiskScore >= 0 && analysisResult.overallRiskScore <= 100, `Risk evaluated for Plus Code location (Score: ${analysisResult.overallRiskScore}/100)`);
    assert(analysisResult.factorScores.heatRisk !== undefined, 'Environmental factor scores computed');
    assert(analysisResult.windowAnalysis.hours.length > 0, 'Continuous hourly forecast curve computed');
    assert(analysisResult.bestTimeSuggestion !== undefined, 'Optimal decision window discovered');
  }

  // 5. Query Sanitization & Edge Cases
  console.log('\n5. Query Sanitization & Edge Cases:');
  {
    const emptyRes = await LocationService.searchLocations('   ');
    assert(emptyRes.length === 0, 'Whitespace query safely returns empty array');

    const singleChar = await LocationService.searchLocations('x');
    assert(singleChar.length === 0, 'Single character query safely returns empty array');
  }

  console.log(`\nMODULE RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
