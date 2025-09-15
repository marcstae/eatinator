#!/bin/bash

# Test Cloudflare Pages deployment configuration
# This script validates the Pages setup before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Cloudflare Pages deployment configuration${NC}"
echo "==========================================================="

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Testing $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to check file exists and has content
check_file() {
    local file="$1"
    local description="$2"
    
    echo -n "Checking $description... "
    
    if [ -f "$file" ] && [ -s "$file" ]; then
        echo -e "${GREEN}✅ EXISTS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ MISSING${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to validate JSON
validate_json() {
    local file="$1"
    echo -n "Validating JSON syntax in $file... "
    
    if command -v node > /dev/null 2>&1; then
        if node -e "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" 2>/dev/null; then
            echo -e "${GREEN}✅ VALID${NC}"
            ((TESTS_PASSED++))
            return 0
        else
            echo -e "${RED}❌ INVALID${NC}"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        # Fallback to basic syntax check
        if python3 -m json.tool "$file" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ VALID${NC}"
            ((TESTS_PASSED++))
            return 0
        else
            echo -e "${RED}❌ INVALID${NC}"
            ((TESTS_FAILED++))
            return 1
        fi
    fi
}

echo -e "${BLUE}📋 Testing required files...${NC}"

# Test required files
check_file "index.html" "main HTML file"
check_file "manifest.json" "PWA manifest"
check_file "_redirects" "Pages redirects configuration"
check_file "wrangler.pages.toml" "Pages build configuration"
check_file "js/config.js" "JavaScript configuration"
check_file "package.json" "NPM package configuration"

echo -e "\n${BLUE}🔍 Testing file contents...${NC}"

# Test JSON files
validate_json "manifest.json"
validate_json "package.json"

# Test redirects file syntax
echo -n "Validating _redirects syntax... "
if grep -q "^/api/\*" "_redirects" && grep -q "^\*/\*" "_redirects"; then
    echo -e "${GREEN}✅ VALID${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ INVALID${NC}"
    echo "  Expected API redirect and SPA fallback rules"
    ((TESTS_FAILED++))
fi

# Test HTML files
echo -n "Checking HTML files for basic structure... "
if grep -q "<html" index.html && grep -q "</html>" index.html; then
    echo -e "${GREEN}✅ VALID${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ INVALID${NC}"
    ((TESTS_FAILED++))
fi

# Test JavaScript configuration
echo -n "Checking JavaScript configuration... "
if grep -q "VOTING_CONFIG" js/config.js && grep -q "IMAGE_CONFIG" js/config.js; then
    echo -e "${GREEN}✅ VALID${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ INVALID${NC}"
    ((TESTS_FAILED++))
fi

# Test PWA manifest
echo -n "Checking PWA manifest completeness... "
if grep -q '"name"' manifest.json && grep -q '"icons"' manifest.json && grep -q '"start_url"' manifest.json; then
    echo -e "${GREEN}✅ COMPLETE${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ INCOMPLETE${NC}"
    ((TESTS_FAILED++))
fi

echo -e "\n${BLUE}🔧 Testing deployment tools...${NC}"

# Test Wrangler CLI
run_test "Wrangler CLI installation" "command -v wrangler"

if command -v wrangler > /dev/null 2>&1; then
    run_test "Wrangler authentication" "wrangler whoami"
    run_test "Wrangler configuration" "wrangler pages project list"
fi

echo -e "\n${BLUE}📁 Testing icons directory...${NC}"

# Check icons
echo -n "Checking PWA icons... "
if [ -d "icons" ] && [ -f "icons/favicon.ico" ]; then
    ICON_COUNT=$(find icons -name "*.png" -o -name "*.ico" | wc -l)
    if [ "$ICON_COUNT" -gt 5 ]; then
        echo -e "${GREEN}✅ COMPLETE ($ICON_COUNT icons)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  LIMITED ($ICON_COUNT icons)${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}❌ MISSING${NC}"
    ((TESTS_FAILED++))
fi

echo -e "\n${BLUE}🎯 Testing deployment scripts...${NC}"

# Check deployment scripts
check_file "scripts/setup-pages.sh" "Pages setup script"

if [ -f "scripts/setup-pages.sh" ]; then
    run_test "Setup script executable" "[ -x scripts/setup-pages.sh ]"
fi

# Check GitHub Actions
check_file ".github/workflows/deploy-pages.yml" "GitHub Actions workflow"

echo -e "\n${BLUE}📊 Test Results${NC}"
echo "================================"
echo -e "✅ Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "❌ Tests failed: ${RED}$TESTS_FAILED${NC}"
echo -e "📊 Success rate: $(( TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED) ))%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! Ready for Cloudflare Pages deployment.${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Run: ./scripts/setup-pages.sh"
    echo "2. Or manually: npm run deploy:pages"
    echo "3. Set up GitHub integration for automatic deployments"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please fix the issues before deploying.${NC}"
    echo ""
    echo -e "${BLUE}Common fixes:${NC}"
    echo "- Install Wrangler CLI: npm install -g wrangler"
    echo "- Login to Cloudflare: wrangler auth login"
    echo "- Check file paths and syntax"
    echo "- Ensure all required files are present"
    exit 1
fi