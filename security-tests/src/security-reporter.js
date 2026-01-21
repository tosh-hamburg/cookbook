/**
 * Custom Jest Reporter für Security-Tests
 * Erzeugt eine übersichtliche Zusammenfassung der Sicherheitstests
 */
class SecurityReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this.findings = {
      critical: [],
      warning: [],
      info: []
    };
  }

  onTestResult(test, testResult) {
    // Sammle Fehler für den Bericht
    testResult.testResults.forEach(result => {
      if (result.status === 'failed') {
        const testName = result.title;
        
        // Kategorisiere nach Schweregrad
        if (testName.includes('SQL') || testName.includes('Token') || testName.includes('Auth')) {
          this.findings.critical.push({
            test: testName,
            message: result.failureMessages.join('\n')
          });
        } else if (testName.includes('XSS') || testName.includes('CORS')) {
          this.findings.warning.push({
            test: testName,
            message: result.failureMessages.join('\n')
          });
        } else {
          this.findings.info.push({
            test: testName,
            message: result.failureMessages.join('\n')
          });
        }
      }
    });
  }

  onRunComplete(contexts, results) {
    const { numPassedTests, numFailedTests, numTotalTests, numPendingTests } = results;
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SECURITY TEST REPORT');
    console.log('═'.repeat(60));
    
    // Statistiken
    console.log('\n📈 Statistiken:');
    console.log(`   ✅ Bestanden:    ${numPassedTests}`);
    console.log(`   ❌ Fehlgeschlagen: ${numFailedTests}`);
    console.log(`   ⏭️  Übersprungen:  ${numPendingTests}`);
    console.log(`   📊 Gesamt:       ${numTotalTests}`);
    
    // Erfolgsrate
    const successRate = numTotalTests > 0 
      ? ((numPassedTests / numTotalTests) * 100).toFixed(1) 
      : 0;
    console.log(`   📈 Erfolgsrate:  ${successRate}%`);
    
    // Findings
    if (this.findings.critical.length > 0) {
      console.log('\n🔴 KRITISCHE PROBLEME:');
      this.findings.critical.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.test}`);
      });
    }
    
    if (this.findings.warning.length > 0) {
      console.log('\n🟠 WARNUNGEN:');
      this.findings.warning.forEach((f, i) => {
        console.log(`   ${i + 1}. ${f.test}`);
      });
    }
    
    // Zusammenfassung
    console.log('\n' + '─'.repeat(60));
    if (numFailedTests === 0) {
      console.log('✅ ERGEBNIS: Keine kritischen Sicherheitsprobleme gefunden!');
    } else {
      console.log(`❌ ERGEBNIS: ${numFailedTests} Sicherheitsproblem(e) gefunden!`);
    }
    
    // Empfehlungen
    console.log('\n📝 Allgemeine Empfehlungen:');
    console.log('   1. Rate-Limiting implementieren (express-rate-limit)');
    console.log('   2. Security-Headers hinzufügen (helmet.js)');
    console.log('   3. CORS restriktiv konfigurieren');
    console.log('   4. JWT_SECRET in Produktion sicher konfigurieren');
    console.log('   5. Regelmäßige Dependency-Updates (npm audit)');
    
    console.log('\n' + '═'.repeat(60) + '\n');
  }
}

module.exports = SecurityReporter;
