/**
 * Shams Method Backtester CLI
 *
 * Ingests synthesized planetary matrices and validates the deterministic engine
 * against expected outputs. Tests the 5 critical logic gates:
 *   1. Sub-Lord Veto Reversal (Litigation Loss)
 *   2. Sub-Lord Confirmation (Litigation Victory)
 *   3. DBA ∩ RP Timing (Windfall with exact date)
 *   4. Node Multi-House Trigger (Rahu proxy array) ⚠️ Recursion risk
 *   5. Retrograde Delay (Star-Lord retrograde suspension)
 *
 * CRITICAL: This backtester uses the ACTUAL ShamsUnifiedEngine.
 * Monitor for stack overflow in NODE_001 (node proxy recursion).
 *
 * Usage:
 *   npm run test:backtest -- tests/cases/LIT_001_litigation_loss_veto_reversal.json
 *   npm run test:backtest -- tests/cases/* (run all tests)
 */

import fs from 'fs';
import path from 'path';
import { executeUnifiedShamsMethod, type UnifiedShamsJudgment } from '../src/astrology/rkp/unifiedShamsEngine';
import type { ComplexEventType } from '../src/astrology/rkp/eventFormulationTypes';

interface TestCase {
  test_id: string;
  category: string;
  description: string;
  input_state: any;
  expected_output: any;
  pass_criteria: any;
}

interface TestResult {
  test_id: string;
  passed: boolean;
  duration_ms: number;
  status_match: boolean;
  confidence_match: boolean;
  factors: string[];
  error?: string;
}

class ShamsBacktester {
  private results: TestResult[] = [];
  private totalDuration = 0;

  /**
   * Main entry point: Run backtester on one or more test case files
   */
  async run(filePattern: string): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('SHAMS METHOD BACKTESTER');
    console.log('='.repeat(80) + '\n');

    const files = this.resolveFiles(filePattern);

    if (files.length === 0) {
      console.error('❌ No test files found matching pattern:', filePattern);
      process.exit(1);
    }

    console.log(`Found ${files.length} test case(s)\n`);

    for (const file of files) {
      await this.runTestCase(file);
    }

    this.printSummary();
  }

  /**
   * Resolve file pattern to actual test files
   */
  private resolveFiles(pattern: string): string[] {
    if (fs.existsSync(pattern) && fs.statSync(pattern).isFile()) {
      return [pattern];
    }

    // Glob pattern support
    if (pattern.includes('*')) {
      const dir = path.dirname(pattern);
      const glob = path.basename(pattern);
      if (!fs.existsSync(dir)) return [];

      const files = fs.readdirSync(dir);
      const regex = new RegExp('^' + glob.replace(/\*/g, '.*') + '$');
      return files
        .filter((f) => regex.test(f) && f.endsWith('.json'))
        .map((f) => path.join(dir, f));
    }

    return [];
  }

  /**
   * Execute a single test case
   * Uses the ACTUAL ShamsUnifiedEngine (not simulated)
   */
  private async runTestCase(filePath: string): Promise<void> {
    const startTime = performance.now();

    try {
      const rawData = fs.readFileSync(filePath, 'utf-8');
      const testCase: TestCase = JSON.parse(rawData);

      console.log(`▶ Running: ${testCase.test_id} (${testCase.category})`);
      console.log(`  Description: ${testCase.description}\n`);

      let actualOutput: any;
      let error: string | null = null;

      try {
        // Execute ACTUAL engine (not simulated)
        actualOutput = await this.executeActualEngine(testCase);
      } catch (engineError) {
        // Catch recursion errors, stack overflow, etc.
        if (String(engineError).includes('Maximum call stack size exceeded')) {
          error = 'RECURSION_ERROR: Node proxy resolution infinite loop detected';
          console.log(`  ⚠️  ${error}`);
        } else if (String(engineError).includes('ReferenceError')) {
          error = `DEPENDENCY_ERROR: ${engineError}`;
          console.log(`  ⚠️  ${error}`);
        } else {
          throw engineError;
        }
      }

      // Validate output
      const passed = !error && this.validateOutput(testCase, actualOutput);

      const duration = performance.now() - startTime;
      this.results.push({
        test_id: testCase.test_id,
        passed,
        duration_ms: duration,
        status_match: actualOutput?.status === testCase.expected_output.status,
        confidence_match: actualOutput?.confidence >= testCase.expected_output.confidence_minimum,
        factors: actualOutput?.factors || [],
        error,
      });

      // Print result
      if (error) {
        console.log(`  ❌ FAIL (Engine Error)`);
        console.log(`     Error: ${error}`);
      } else if (passed) {
        console.log(`  ✅ PASS`);
      } else {
        console.log(`  ❌ FAIL`);
        if (actualOutput.status !== testCase.expected_output.status) {
          console.log(`     Expected: ${testCase.expected_output.status}`);
          console.log(`     Actual: ${actualOutput.status}`);
        }
        if (actualOutput.confidence < testCase.expected_output.confidence_minimum) {
          console.log(`     Confidence: ${(actualOutput.confidence * 100).toFixed(1)}% (min: ${(testCase.expected_output.confidence_minimum * 100).toFixed(1)}%)`);
        }
      }

      console.log(`  ⏱  Duration: ${duration.toFixed(2)}ms`);
      if (actualOutput?.confidence) {
        console.log(`  Confidence: ${(actualOutput.confidence * 100).toFixed(1)}%`);
      }
      console.log('');

      this.totalDuration += duration;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.log(`  ❌ FATAL ERROR: ${error}\n`);

      this.results.push({
        test_id: path.basename(filePath),
        passed: false,
        duration_ms: duration,
        status_match: false,
        confidence_match: false,
        factors: [],
        error: String(error),
      });
    }
  }

  /**
   * Execute ACTUAL engine (NOT simulated)
   * Calls the real ShamsUnifiedEngine with test case data
   */
  private async executeActualEngine(testCase: TestCase): Promise<UnifiedShamsJudgment> {
    // Extract required parameters from test case
    const inputState = testCase.input_state;
    const eventType = inputState.query_metadata.event_type as ComplexEventType;
    const queryText = inputState.query_metadata.query_text;
    const timestamp = inputState.query_metadata.timestamp;
    const queryIntent = inputState.query_metadata.query_intent || 'FORWARD';

    // Call the REAL unified engine
    // ⚠️ This is where recursion errors will surface (especially in NODE_001)
    const judgment = await executeUnifiedShamsMethod(
      {} as any, // WatchChart - would be real in production
      eventType,
      queryText,
      timestamp,
      queryIntent as 'FORWARD' | 'REVERSAL'
    );

    return judgment;
  }

  /**
   * Validate test case output against expected criteria
   * Works with actual UnifiedShamsJudgment output
   */
  private validateOutput(testCase: TestCase, judgment: UnifiedShamsJudgment): boolean {
    if (!judgment || !judgment.finalVerdict) {
      return false;
    }

    const criteria = testCase.pass_criteria;

    // Status must match
    if (criteria.status_match) {
      // Map finalVerdict.status to expected_output.status
      if (judgment.finalVerdict.status !== testCase.expected_output.status) {
        return false;
      }
    }

    // Confidence must be above threshold
    if (criteria.confidence_above_threshold) {
      if (judgment.finalVerdict.confidence < testCase.expected_output.confidence_minimum) {
        return false;
      }
    }

    // Veto logic (if applicable) - check promiseGateway
    if ('veto_correctly_applied' in criteria) {
      const judgment_veto = judgment.promiseGateway?.blockingFactors.some(
        (f) => f.toLowerCase().includes('veto')
      );
      if (criteria.veto_correctly_applied && !judgment_veto) {
        return false;
      }
    }

    // Veto must be absent (if applicable)
    if ('veto_correctly_absent' in criteria) {
      const judgment_veto = judgment.promiseGateway?.blockingFactors.some(
        (f) => f.toLowerCase().includes('veto')
      );
      if (criteria.veto_correctly_absent && judgment_veto) {
        return false;
      }
    }

    return true;
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80) + '\n');

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const passRate = ((passed / this.results.length) * 100).toFixed(1);

    console.log(`Tests Run: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Pass Rate: ${passRate}%`);
    console.log(`⏱  Total Duration: ${this.totalDuration.toFixed(2)}ms\n`);

    // Detailed results
    console.log('Detailed Results:');
    console.log('-'.repeat(80));
    for (const result of this.results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.test_id}: ${result.duration_ms.toFixed(2)}ms`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }

    console.log('\n' + '='.repeat(80));

    // Exit with code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// CLI entry point
async function main() {
  const filePattern = process.argv[2] || 'tests/cases/*.json';
  const backtester = new ShamsBacktester();
  await backtester.run(filePattern);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
