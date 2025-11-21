#!/bin/bash

# Fix Memory Issues - Complete Reset Script
# This script clears all caches and rebuilds the project

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔧 Fixing Memory Issues and Rebuilding Project...${NC}"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

# 1. Stop any running Node processes
echo -e "${YELLOW}1. Stopping running Node processes...${NC}"
pkill -f node || true
sleep 2
echo -e "${GREEN} ✓ Processes stopped${NC}"

# 2. Clear node_modules
echo -e "${YELLOW}2. Clearing node_modules...${NC}"
if [ -d "node_modules" ]; then
rm -rf node_modules
echo -e "${GREEN} ✓ node_modules deleted${NC}"
else
echo -e "${GRAY} - node_modules not found (already clean)${NC}"
fi

# 3. Clear dist folder
echo -e "${YELLOW}3. Clearing dist folder...${NC}"
if [ -d "dist" ]; then
rm -rf dist
echo -e "${GREEN} ✓ dist deleted${NC}"
else
echo -e "${GRAY} - dist not found (already clean)${NC}"
fi

# 4. Clear npm cache
echo -e "${YELLOW}4. Clearing npm cache...${NC}"
npm cache clean --force
echo -e "${GREEN} ✓ npm cache cleared${NC}"

# 5. Clear TypeScript cache
echo -e "${YELLOW}5. Clearing TypeScript cache...${NC}"
if [ -f "tsconfig.tsbuildinfo" ]; then
rm tsconfig.tsbuildinfo
echo -e "${GREEN} ✓ TypeScript cache cleared${NC}"
else
echo -e "${GRAY} - No TypeScript cache found${NC}"
fi

# 6. Reinstall dependencies
echo -e "${YELLOW}6. Installing dependencies...${NC}"
npm install
echo -e "${GREEN} ✓ Dependencies installed${NC}"

# 7. Generate Prisma Client
echo -e "${YELLOW}7. Generating Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN} ✓ Prisma Client generated${NC}"

# 8. Build the project
echo -e "${YELLOW}8. Building project...${NC}"
npm run build
echo -e "${GREEN} ✓ Project built${NC}"

echo ""
echo -e "${GREEN}✅ All done! Project is clean and rebuilt.${NC}"
echo ""
echo -e "${CYAN}📊 Memory Configuration:${NC}"
echo -e "${GRAY} - Development: 4GB heap (NODE_OPTIONS in .env)${NC}"
echo -e "${GRAY} - Production: 8GB heap${NC}"
echo ""
echo -e "${CYAN}🚀 To start the server:${NC}"
echo -e "${YELLOW} npm run start:dev${NC}"
echo ""
echo -e "${CYAN}🔍 To monitor memory:${NC}"
echo -e "${YELLOW} curl http://localhost:3001/api/health${NC}"
echo ""
echo -e "${YELLOW}⚠️ If you still get memory errors:${NC}"
echo -e "${GRAY} 1. Increase NODE_OPTIONS in .env to --max-old-space-size=6144${NC}"
echo -e "${GRAY} 2. Check MEMORY-OPTIMIZATION.md for more solutions${NC}"
echo -e "${GRAY} 3. Restart your computer to free up system memory${NC}"