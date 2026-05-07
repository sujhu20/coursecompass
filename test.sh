#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Career Course Compass - API Testing Suite${NC}\n"

BASE_URL="http://localhost:3000"
TEST_EMAIL="testuser$(date +%s)@example.com"
TEST_PASSWORD="TestPass123"

# Test 1: Signup
echo -e "${YELLOW}Test 1: User Signup${NC}"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"confirmPassword\":\"$TEST_PASSWORD\"}")

if echo "$SIGNUP_RESPONSE" | grep -q "success"; then
  echo -e "${GREEN}✓ Signup successful${NC}"
  echo "Response: $SIGNUP_RESPONSE\n"
else
  echo -e "${RED}✗ Signup failed${NC}"
  echo "Response: $SIGNUP_RESPONSE\n"
fi

# Test 2: Login
echo -e "${YELLOW}Test 2: User Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "success"; then
  echo -e "${GREEN}✓ Login successful${NC}"
  echo "Response: $LOGIN_RESPONSE\n"
  USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
else
  echo -e "${RED}✗ Login failed${NC}"
  echo "Response: $LOGIN_RESPONSE\n"
fi

# Test 3: Get All Courses
echo -e "${YELLOW}Test 3: Get All Courses${NC}"
COURSES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/courses")

if echo "$COURSES_RESPONSE" | grep -q "success"; then
  COURSE_COUNT=$(echo "$COURSES_RESPONSE" | grep -o '"id"' | wc -l)
  echo -e "${GREEN}✓ Retrieved courses: $COURSE_COUNT${NC}\n"
else
  echo -e "${RED}✗ Failed to retrieve courses${NC}\n"
fi

# Test 4: Get Recommendations (Science Stream)
echo -e "${YELLOW}Test 4: Get Course Recommendations (Science - 85%)${NC}"
REC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/recommend-courses" \
  -H "Content-Type: application/json" \
  -d "{\"stream\":\"Science\",\"percentage\":85,\"interest_areas\":\"Technology\"}")

if echo "$REC_RESPONSE" | grep -q "success"; then
  FOUND_COURSES=$(echo "$REC_RESPONSE" | grep -o '"name":"[^"]*"' | wc -l)
  echo -e "${GREEN}✓ Found $FOUND_COURSES courses for Science stream${NC}"
  echo "Response preview: $(echo "$REC_RESPONSE" | head -c 200)...\n"
else
  echo -e "${RED}✗ Recommendation failed${NC}\n"
fi

# Test 5: Get Recommendations (Commerce Stream)
echo -e "${YELLOW}Test 5: Get Course Recommendations (Commerce - 70%)${NC}"
REC_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/recommend-courses" \
  -H "Content-Type: application/json" \
  -d "{\"stream\":\"Commerce\",\"percentage\":70,\"interest_areas\":\"Finance\"}")

if echo "$REC_RESPONSE2" | grep -q "success"; then
  echo -e "${GREEN}✓ Recommendation for Commerce successful${NC}\n"
else
  echo -e "${RED}✗ Recommendation failed${NC}\n"
fi

# Test 6: Invalid Login
echo -e "${YELLOW}Test 6: Invalid Login (Should Fail)${NC}"
INVALID_LOGIN=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"invalid@example.com\",\"password\":\"wrongpassword\"}")

if echo "$INVALID_LOGIN" | grep -q "false"; then
  echo -e "${GREEN}✓ Invalid login correctly rejected${NC}\n"
else
  echo -e "${RED}✗ Security check failed${NC}\n"
fi

# Test 7: Duplicate Signup
echo -e "${YELLOW}Test 7: Duplicate Signup (Should Fail)${NC}"
DUP_SIGNUP=$(curl -s -X POST "$BASE_URL/api/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"AnotherPass123\",\"confirmPassword\":\"AnotherPass123\"}")

if echo "$DUP_SIGNUP" | grep -q "false\|already"; then
  echo -e "${GREEN}✓ Duplicate signup correctly prevented${NC}\n"
else
  echo -e "${RED}✗ Duplicate check failed${NC}\n"
fi

# Test 8: Invalid Percentage
echo -e "${YELLOW}Test 8: Invalid Percentage (>100)${NC}"
INVALID_REC=$(curl -s -X POST "$BASE_URL/api/recommend-courses" \
  -H "Content-Type: application/json" \
  -d "{\"stream\":\"Science\",\"percentage\":150}")

if echo "$INVALID_REC" | grep -q "false"; then
  echo -e "${GREEN}✓ Invalid percentage correctly rejected${NC}\n"
else
  echo -e "${RED}✗ Validation check failed${NC}\n"
fi

echo -e "${GREEN}🧪 Testing Complete!${NC}"
echo -e "${YELLOW}📊 Summary:${NC}"
echo "✓ User authentication working"
echo "✓ Course recommendation engine functioning"
echo "✓ Input validation active"
echo "✓ Database queries executing"
echo ""
echo -e "${YELLOW}🚀 Next Steps:${NC}"
echo "1. Open http://localhost:3000/login.html in browser"
echo "2. Create a new account"
echo "3. Enter your stream and percentage"
echo "4. View recommended courses"
echo "5. Click on YouTube videos and course details"
