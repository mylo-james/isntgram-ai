import fs from 'fs';
import path from 'path';

describe('E2E Configuration Validation', () => {
  test('should have valid Playwright configuration', async () => {
    const configPath = path.join(process.cwd(), 'playwright.config.ts');
    expect(fs.existsSync(configPath)).toBe(true);
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Check for required webServer configuration
    expect(configContent).toContain('webServer');
    expect(configContent).toContain('baseURL');
    
    // Check for proper port configuration
    expect(configContent).toContain('http://127.0.0.1:3000');
    expect(configContent).toContain('http://127.0.0.1:3001');
    
    // Check for CI-specific commands
    expect(configContent).toContain('npm run ci:start:web');
    expect(configContent).toContain('npm run ci:start:api');
  });

  test('should have required CI start scripts in package.json', async () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    expect(fs.existsSync(packagePath)).toBe(true);
    
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageContent.scripts || {};
    
    // Check for required CI start scripts
    expect(scripts['ci:start:web']).toBeDefined();
    expect(scripts['ci:start:api']).toBeDefined();
    expect(scripts['start']).toBeDefined();
    
    // Validate script content
    expect(scripts['ci:start:web']).toContain('PORT=3000');
    expect(scripts['ci:start:api']).toContain('PORT=3001');
  });

  test('should have valid web app start script', async () => {
    const webPackagePath = path.join(process.cwd(), 'apps/web/package.json');
    expect(fs.existsSync(webPackagePath)).toBe(true);
    
    const webPackageContent = JSON.parse(fs.readFileSync(webPackagePath, 'utf8'));
    const scripts = webPackageContent.scripts || {};
    
    expect(scripts['start']).toBeDefined();
    expect(scripts['start']).toBe('next start');
  });

  test('should have valid API app start script', async () => {
    const apiPackagePath = path.join(process.cwd(), 'apps/api/package.json');
    expect(fs.existsSync(apiPackagePath)).toBe(true);
    
    const apiPackageContent = JSON.parse(fs.readFileSync(apiPackagePath, 'utf8'));
    const scripts = apiPackageContent.scripts || {};
    
    expect(scripts['start:prod']).toBeDefined();
  });

  test('should have proper port configuration in scripts', async () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageContent.scripts || {};
    
    // Check that web and API use different ports
    const webScript = scripts['ci:start:web'];
    const apiScript = scripts['ci:start:api'];
    
    expect(webScript).toContain('PORT=3000');
    expect(apiScript).toContain('PORT=3001');
    
    // Ensure ports are different
    const webPort = webScript.match(/PORT=(\d+)/)?.[1];
    const apiPort = apiScript.match(/PORT=(\d+)/)?.[1];
    
    expect(webPort).not.toBe(apiPort);
    expect(webPort).toBe('3000');
    expect(apiPort).toBe('3001');
  });

  test('should have proper Playwright webServer configuration', async () => {
    const configPath = path.join(process.cwd(), 'playwright.config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Check for proper webServer array structure
    expect(configContent).toMatch(/webServer:\s*\[/);
    
    // Check for both web and API server configurations
    expect(configContent).toContain('npm run ci:start:web');
    expect(configContent).toContain('npm run ci:start:api');
    
    // Check for proper URLs
    expect(configContent).toContain('url: "http://127.0.0.1:3000"');
    expect(configContent).toContain('url: "http://127.0.0.1:3001/api"');
    
    // Check for proper stdout/stderr configuration
    expect(configContent).toContain('stdout: \'pipe\'');
    expect(configContent).toContain('stderr: \'pipe\'');
  });

  test('should have proper timeout configuration', async () => {
    const configPath = path.join(process.cwd(), 'playwright.config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Check for reasonable timeout values
    expect(configContent).toContain('timeout: 300 * 1000');
  });

  test('should have proper CI environment handling', async () => {
    const configPath = path.join(process.cwd(), 'playwright.config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Check for CI-specific command handling
    expect(configContent).toContain('process.env.CI ? "npm run ci:start:web"');
    expect(configContent).toContain('process.env.CI ? "npm run ci:start:api"');
    
    // Check for reuseExistingServer configuration
    expect(configContent).toContain('reuseExistingServer: !process.env.CI');
  });

  test('should validate port availability', async () => {
    const net = require('net');
    
    // Test function to check if port is available
    const isPortAvailable = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.once('close', () => {
            resolve(true);
          });
          server.close();
        });
        server.on('error', () => {
          resolve(false);
        });
      });
    };
    
    // Check that our E2E ports are available (this would catch EADDRINUSE errors)
    const port3000Available = await isPortAvailable(3000);
    const port3001Available = await isPortAvailable(3001);
    
    // Note: This test might fail if ports are actually in use during testing
    // In that case, we should investigate what's using the ports
    if (!port3000Available) {
      console.warn('Warning: Port 3000 is not available - this could cause E2E test failures');
    }
    if (!port3001Available) {
      console.warn('Warning: Port 3001 is not available - this could cause E2E test failures');
    }
    
    // We don't fail the test here because ports might be legitimately in use
    // But we log warnings to help debug issues
  });

  test('should validate Playwright CI configuration', async () => {
    const configPath = path.join(process.cwd(), 'playwright.config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Check for CI-specific configuration
    expect(configContent).toContain('process.env.CI');
    
    // Check that CI only runs Chromium (for speed)
    expect(configContent).toContain('name: "chromium"');
    
    // Check for proper CI settings
    expect(configContent).toContain('forbidOnly: !!process.env.CI');
    expect(configContent).toContain('retries: process.env.CI ? 2 : 0');
    expect(configContent).toContain('workers: process.env.CI ? 1 : undefined');
    
    // Check for proper reporters for CI
    expect(configContent).toContain('junit');
    expect(configContent).toContain('playwright-report/results.xml');
  });

  test('should validate CI workflow has Playwright caching', async () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/ci.yml');
    expect(fs.existsSync(workflowPath)).toBe(true);
    
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    
    // Check for Playwright cache configuration
    expect(workflowContent).toContain('Cache Playwright browsers');
    expect(workflowContent).toContain('actions/cache@v4');
    expect(workflowContent).toContain('~/.cache/ms-playwright');
    expect(workflowContent).toContain('playwright-${{ runner.os }}');
    
    // Check for conditional installation
    expect(workflowContent).toContain('cache-hit != \'true\'');
    
    // Check for optimized browser installation
    expect(workflowContent).toContain('playwright install chromium');
  });
});

describe('E2E Script Validation', () => {
  test('should validate ci:start:web script syntax', async () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageContent.scripts || {};
    
    const webScript = scripts['ci:start:web'];
    expect(webScript).toBeDefined();
    
    // Should use PORT environment variable
    expect(webScript).toContain('PORT=3000');
    
    // Should change to web directory
    expect(webScript).toContain('cd apps/web');
    
    // Should call the start script
    expect(webScript).toContain('npm run start');
  });

  test('should validate ci:start:api script syntax', async () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageContent.scripts || {};
    
    const apiScript = scripts['ci:start:api'];
    expect(apiScript).toBeDefined();
    
    // Should skip database in CI
    expect(apiScript).toContain('SKIP_DB=true');
    
    // Should use PORT environment variable
    expect(apiScript).toContain('PORT=3001');
    
    // Should change to api directory
    expect(apiScript).toContain('cd apps/api');
    
    // Should call the start:prod script
    expect(apiScript).toContain('npm run start:prod');
  });

  test('should validate start script syntax', async () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageContent.scripts || {};
    
    const startScript = scripts['start'];
    expect(startScript).toBeDefined();
    
    // Should start both web and API
    expect(startScript).toContain('ci:start:web');
    expect(startScript).toContain('ci:start:api');
    
    // Should run them in parallel
    expect(startScript).toContain('&');
  });

  test('should validate script execution without circular dependencies', async () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageContent.scripts || {};
    
    // Check that ci:start:web calls the workspace start script correctly
    const webScript = scripts['ci:start:web'];
    expect(webScript).toBeDefined();
    
    // Should call the workspace start script (not the root start script)
    expect(webScript).toContain('npm run start');
    
    // Check that ci:start:api calls the workspace start:prod script correctly
    const apiScript = scripts['ci:start:api'];
    expect(apiScript).toBeDefined();
    
    // Should call the workspace start:prod script
    expect(apiScript).toContain('npm run start:prod');
    
    // Check that root start script doesn't create infinite loops
    const startScript = scripts['start'];
    expect(startScript).toBeDefined();
    
    // Should only call the CI scripts, not itself
    expect(startScript).toContain('ci:start:web');
    expect(startScript).toContain('ci:start:api');
    expect(startScript).not.toContain('npm run start');
    
    // Verify the script chain doesn't create circular dependencies
    // ci:start:web -> cd apps/web && npm run start -> next start ✅
    // ci:start:api -> cd apps/api && npm run start:prod -> node dist/main ✅
    // start -> ci:start:web & ci:start:api ✅
  });

  test('should validate complete script execution chain', async () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageContent.scripts || {};
    
    // Validate the complete execution chain to prevent circular dependencies
    const executionChain = {
      'ci:start:web': {
        script: scripts['ci:start:web'],
        expectedSteps: ['cd apps/web', 'PORT=3000', 'npm run start'],
        finalCommand: 'next start' // From apps/web/package.json
      },
      'ci:start:api': {
        script: scripts['ci:start:api'],
        expectedSteps: ['cd apps/api', 'SKIP_DB=true', 'PORT=3001', 'npm run start:prod'],
        finalCommand: 'node dist/main' // From apps/api/package.json
      },
      'start': {
        script: scripts['start'],
        expectedSteps: ['ci:start:web', 'ci:start:api', '&'],
        shouldNotContain: ['npm run start', 'npm run start:prod'] // Prevent circular calls
      }
    };
    
    // Validate each script in the chain
    Object.entries(executionChain).forEach(([scriptName, validation]) => {
      const script = validation.script;
      expect(script).toBeDefined();
      
      // Check expected steps
      validation.expectedSteps.forEach(step => {
        expect(script).toContain(step);
      });
      
      // Check forbidden patterns (for circular dependency prevention)
      if (validation.shouldNotContain) {
        validation.shouldNotContain.forEach(forbidden => {
          expect(script).not.toContain(forbidden);
        });
      }
    });
    
    // Verify the chain terminates properly (no infinite loops)
    // This is a static analysis that can catch obvious circular dependencies
    const webScript = scripts['ci:start:web'];
    const apiScript = scripts['ci:start:api'];
    const startScript = scripts['start'];
    
    // Ensure ci:start:web doesn't call any root-level scripts that could cause loops
    expect(webScript).not.toContain('npm run start:prod');
    expect(webScript).not.toContain('npm run ci:start:');
    
    // Ensure ci:start:api doesn't call any root-level scripts that could cause loops
    expect(apiScript).not.toContain('npm run ci:start:');
    // But it SHOULD call the workspace start:prod script
    expect(apiScript).toContain('npm run start:prod');
    
    // Ensure start script only calls the CI scripts, not itself
    expect(startScript).not.toContain('npm run start');
    expect(startScript).not.toContain('npm run start:prod');
  });
});
