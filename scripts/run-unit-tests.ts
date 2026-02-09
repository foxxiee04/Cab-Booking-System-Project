/**
 * Run Unit Tests with Coverage Report
 * Tests all microservices and generates coverage statistics
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// ANSI colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

interface ServiceCoverage {
  service: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  passed: number;
  failed: number;
  total: number;
}

const services = [
  'auth-service',
  'user-service',
  'driver-service',
  'booking-service',
  'ride-service',
  'payment-service',
  'pricing-service',
  'api-gateway',
];

async function runServiceTests(serviceName: string): Promise<ServiceCoverage | null> {
  const servicePath = path.join(process.cwd(), 'services', serviceName);
  
  // Check if service has package.json and test script
  const packageJsonPath = path.join(servicePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log(`⏭️  ${serviceName}: No package.json found`, 'yellow');
    return null;
  }

  try {
    log(`\n🧪 Testing ${serviceName}...`, 'cyan');
    
    const { stdout, stderr } = await execAsync(
      'npm test -- --coverage --passWithNoTests --silent',
      {
        cwd: servicePath,
        timeout: 120000,
      }
    );

    // Parse coverage from output
    const coverageMatch = stdout.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
    const testMatch = stdout.match(/Tests:\s*(\d+)\s*passed.*?(\d+)\s*total/);

    const coverage: ServiceCoverage = {
      service: serviceName,
      statements: coverageMatch ? parseFloat(coverageMatch[1]) : 0,
      branches: coverageMatch ? parseFloat(coverageMatch[2]) : 0,
      functions: coverageMatch ? parseFloat(coverageMatch[3]) : 0,
      lines: coverageMatch ? parseFloat(coverageMatch[4]) : 0,
      passed: testMatch ? parseInt(testMatch[1]) : 0,
      failed: 0,
      total: testMatch ? parseInt(testMatch[2]) : 0,
    };

    const avgCoverage = (coverage.statements + coverage.branches + coverage.functions + coverage.lines) / 4;
    const icon = avgCoverage >= 80 ? '✅' : avgCoverage >= 60 ? '⚠️' : '❌';
    
    log(`${icon} ${serviceName}: ${coverage.passed}/${coverage.total} tests, ${avgCoverage.toFixed(1)}% coverage`, 
        avgCoverage >= 80 ? 'green' : 'yellow');

    return coverage;
  } catch (error: any) {
    const testFailMatch = error.message.match(/Tests:\s*(\d+)\s*failed,\s*(\d+)\s*passed.*?(\d+)\s*total/);
    
    if (testFailMatch) {
      log(`❌ ${serviceName}: ${testFailMatch[2]} passed, ${testFailMatch[1]} failed`, 'red');
      return {
        service: serviceName,
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
        passed: parseInt(testFailMatch[2]),
        failed: parseInt(testFailMatch[1]),
        total: parseInt(testFailMatch[3]),
      };
    }
    
    log(`❌ ${serviceName}: Test execution failed - ${error.message}`, 'red');
    return null;
  }
}

async function generateReport(results: ServiceCoverage[]) {
  log('\n📊 ========================================', 'cyan');
  log('📊 UNIT TEST COVERAGE REPORT', 'cyan');
  log('📊 ========================================\n', 'cyan');

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalStatements = 0;
  let totalBranches = 0;
  let totalFunctions = 0;
  let totalLines = 0;
  let servicesWithTests = 0;

  console.log('┌─────────────────────────┬────────────┬──────────────────────────────────────────┐');
  console.log('│ Service                 │ Tests      │ Coverage (S/B/F/L)                       │');
  console.log('├─────────────────────────┼────────────┼──────────────────────────────────────────┤');

  for (const result of results) {
    if (!result) continue;

    servicesWithTests++;
    totalTests += result.total;
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalStatements += result.statements;
    totalBranches += result.branches;
    totalFunctions += result.functions;
    totalLines += result.lines;

    const avgCoverage = (result.statements + result.branches + result.functions + result.lines) / 4;
    const testStatus = result.failed > 0 
      ? `❌ ${result.passed}/${result.total}`
      : `✅ ${result.passed}/${result.total}`;
    
    const coverageStr = `${result.statements.toFixed(0)}% / ${result.branches.toFixed(0)}% / ${result.functions.toFixed(0)}% / ${result.lines.toFixed(0)}%`;
    const icon = avgCoverage >= 80 ? '✅' : avgCoverage >= 60 ? '⚠️' : '❌';

    console.log(`│ ${icon} ${result.service.padEnd(20)} │ ${testStatus.padEnd(10)} │ ${coverageStr.padEnd(40)} │`);
  }

  console.log('└─────────────────────────┴────────────┴──────────────────────────────────────────┘\n');

  const avgStatements = totalStatements / servicesWithTests;
  const avgBranches = totalBranches / servicesWithTests;
  const avgFunctions = totalFunctions / servicesWithTests;
  const avgLines = totalLines / servicesWithTests;
  const overallCoverage = (avgStatements + avgBranches + avgFunctions + avgLines) / 4;

  log('📈 Overall Statistics:', 'cyan');
  log(`   Services Tested: ${servicesWithTests}/${services.length}`, 'cyan');
  log(`   Total Tests: ${totalTests}`, 'cyan');
  log(`   ✅ Passed: ${totalPassed}`, 'green');
  log(`   ❌ Failed: ${totalFailed}`, totalFailed > 0 ? 'red' : 'green');
  log(`   Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`, 'cyan');
  
  log('\n📊 Coverage Breakdown:', 'cyan');
  log(`   Statements: ${avgStatements.toFixed(1)}%`, avgStatements >= 80 ? 'green' : 'yellow');
  log(`   Branches:   ${avgBranches.toFixed(1)}%`, avgBranches >= 80 ? 'green' : 'yellow');
  log(`   Functions:  ${avgFunctions.toFixed(1)}%`, avgFunctions >= 80 ? 'green' : 'yellow');
  log(`   Lines:      ${avgLines.toFixed(1)}%`, avgLines >= 80 ? 'green' : 'yellow');
  
  log(`\n🎯 Overall Coverage: ${overallCoverage.toFixed(1)}%`, overallCoverage >= 80 ? 'green' : 'yellow');
  
  if (overallCoverage >= 80) {
    log('✅ Target coverage (>80%) achieved!', 'green');
  } else {
    log(`⚠️  Need ${(80 - overallCoverage).toFixed(1)}% more coverage to reach 80% target`, 'yellow');
  }

  log('\n========================================\n', 'cyan');

  // Save report to file
  const reportPath = path.join(process.cwd(), 'UNIT_TEST_COVERAGE_REPORT.txt');
  const reportContent = `
UNIT TEST COVERAGE REPORT
Generated: ${new Date().toISOString()}
========================================

Services Tested: ${servicesWithTests}/${services.length}
Total Tests: ${totalTests}
Passed: ${totalPassed}
Failed: ${totalFailed}
Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%

Coverage:
- Statements: ${avgStatements.toFixed(1)}%
- Branches:   ${avgBranches.toFixed(1)}%
- Functions:  ${avgFunctions.toFixed(1)}%
- Lines:      ${avgLines.toFixed(1)}%

Overall Coverage: ${overallCoverage.toFixed(1)}%
Target: 80%
Status: ${overallCoverage >= 80 ? 'ACHIEVED ✅' : `NEED ${(80 - overallCoverage).toFixed(1)}% MORE ⚠️`}

========================================

Detailed Results:
${results.map(r => r ? `
${r.service}:
  Tests: ${r.passed}/${r.total} passed${r.failed > 0 ? `, ${r.failed} failed` : ''}
  Coverage: S=${r.statements.toFixed(1)}% B=${r.branches.toFixed(1)}% F=${r.functions.toFixed(1)}% L=${r.lines.toFixed(1)}%
` : '').join('')}
`;

  fs.writeFileSync(reportPath, reportContent);
  log(`📄 Report saved to: ${reportPath}`, 'green');

  return overallCoverage >= 80 ? 0 : 1;
}

async function main() {
  log('\n🧪 ========================================', 'cyan');
  log('🧪 RUNNING UNIT TESTS FOR ALL SERVICES', 'cyan');
  log('🧪 ========================================\n', 'cyan');

  const results: (ServiceCoverage | null)[] = [];

  for (const service of services) {
    const result = await runServiceTests(service);
    results.push(result);
  }

  const exitCode = await generateReport(results.filter(r => r !== null) as ServiceCoverage[]);
  process.exit(exitCode);
}

main().catch((error) => {
  log(`\n❌ Test suite failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
