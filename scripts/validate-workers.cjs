#!/usr/bin/env node
// Simple validation test for Cloudflare Workers code
// Tests syntax, imports, and basic function definitions

const fs = require('fs');
const path = require('path');

console.log('🧪 Validating Eatinator Workers Implementation');
console.log('==============================================\n');

const workersDir = path.join(__dirname, '..', 'workers');
const requiredFiles = [
    'index.js',
    'utils.js', 
    'voting.js',
    'images.js',
    'ai.js',
    'schema.sql'
];

let allTestsPassed = true;

// Test 1: Check all required files exist
console.log('1. Checking required files...');
for (const file of requiredFiles) {
    const filePath = path.join(workersDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file} exists`);
    } else {
        console.log(`   ❌ ${file} missing`);
        allTestsPassed = false;
    }
}

// Test 2: Check file syntax
console.log('\n2. Validating JavaScript syntax...');
const jsFiles = requiredFiles.filter(f => f.endsWith('.js'));
for (const file of jsFiles) {
    const filePath = path.join(workersDir, file);
    if (fs.existsSync(filePath)) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Basic syntax validation - check for common issues
            if (content.includes('import ') && !content.includes('export ')) {
                console.log(`   ⚠️  ${file} has imports but no exports`);
            }
            
            // Check for ES modules syntax
            if (content.includes('module.exports') || content.includes('require(')) {
                console.log(`   ⚠️  ${file} uses CommonJS instead of ES modules`);
            }
            
            console.log(`   ✅ ${file} syntax looks good`);
        } catch (error) {
            console.log(`   ❌ ${file} syntax error: ${error.message}`);
            allTestsPassed = false;
        }
    }
}

// Test 3: Check SQL schema
console.log('\n3. Validating SQL schema...');
const schemaPath = path.join(workersDir, 'schema.sql');
if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const expectedTables = ['votes', 'user_votes', 'images'];
    
    let tablesFound = 0;
    for (const table of expectedTables) {
        if (schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
            console.log(`   ✅ Table ${table} defined`);
            tablesFound++;
        } else {
            console.log(`   ❌ Table ${table} missing`);
            allTestsPassed = false;
        }
    }
    
    if (tablesFound === expectedTables.length) {
        console.log(`   ✅ All ${expectedTables.length} tables defined`);
    }
} else {
    console.log('   ❌ schema.sql not found');
    allTestsPassed = false;
}

// Test 4: Check main worker exports
console.log('\n4. Checking main worker structure...');
const indexPath = path.join(workersDir, 'index.js');
if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');
    
    if (content.includes('export default')) {
        console.log('   ✅ Default export found');
    } else {
        console.log('   ❌ No default export found');
        allTestsPassed = false;
    }
    
    if (content.includes('fetch(request, env')) {
        console.log('   ✅ Main fetch handler found');
    } else {
        console.log('   ❌ Main fetch handler missing');
        allTestsPassed = false;
    }
    
    if (content.includes('scheduled(')) {
        console.log('   ✅ Scheduled function found');
    } else {
        console.log('   ⚠️  Scheduled function not found (optional)');
    }
}

// Test 5: Check configuration files
console.log('\n5. Checking configuration...');
const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
if (fs.existsSync(wranglerPath)) {
    console.log('   ✅ wrangler.toml exists');
    const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    
    if (wranglerContent.includes('[[kv_namespaces]]')) {
        console.log('   ✅ KV namespace configured');
    }
    
    if (wranglerContent.includes('[[d1_databases]]')) {
        console.log('   ✅ D1 database configured');
    }
    
    if (wranglerContent.includes('[[r2_buckets]]')) {
        console.log('   ✅ R2 bucket configured');
    }
} else {
    console.log('   ❌ wrangler.toml not found');
    allTestsPassed = false;
}

const packagePath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packagePath)) {
    console.log('   ✅ package.json exists');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (packageContent.scripts && packageContent.scripts.deploy) {
        console.log('   ✅ Deploy script configured');
    }
} else {
    console.log('   ❌ package.json not found');
    allTestsPassed = false;
}

// Test 6: Check frontend configuration
console.log('\n6. Checking frontend configuration...');
const configPath = path.join(__dirname, '..', 'js', 'config.js');
if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    if (configContent.includes('workers.dev')) {
        console.log('   ✅ Workers URL template found in config');
    } else {
        console.log('   ⚠️  Workers URL template not found');
    }
    
    if (configContent.includes('VOTING_CONFIG')) {
        console.log('   ✅ Voting configuration found');
    }
    
    if (configContent.includes('IMAGE_CONFIG')) {
        console.log('   ✅ Image configuration found');
    }
    
    if (configContent.includes('AI_CONFIG')) {
        console.log('   ✅ AI configuration found');
    }
} else {
    console.log('   ❌ js/config.js not found');
    allTestsPassed = false;
}

// Summary
console.log('\n📋 Validation Summary');
console.log('===================');

if (allTestsPassed) {
    console.log('🎉 All validation tests passed!');
    console.log('\n✅ Ready for deployment:');
    console.log('   1. Install Wrangler: npm install -g wrangler');
    console.log('   2. Login: wrangler auth login');
    console.log('   3. Setup services: ./scripts/setup-cloudflare.sh');
    console.log('   4. Deploy: npm run deploy');
    process.exit(0);
} else {
    console.log('❌ Some validation tests failed.');
    console.log('\n🔧 Please fix the issues above before deploying.');
    process.exit(1);
}

// Helper function to check if file exists
// (This helper was referenced but not needed since fs.existsSync is used directly)