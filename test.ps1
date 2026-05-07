# Career Course Compass - API Testing Suite

Write-Host "Testing Career Course Compass API" -ForegroundColor Yellow
Write-Host ""

$BASE_URL = "http://localhost:3000"
$TEST_EMAIL = "test$(Get-Random)@example.com"
$TEST_PASSWORD = "TestPass123"

# Test 1: Signup
Write-Host "Test 1: User Signup" -ForegroundColor Yellow
$body = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
    confirmPassword = $TEST_PASSWORD
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/api/signup" -Method POST -ContentType "application/json" -Body $body

if ($response.success) {
    Write-Host "PASS: Signup successful" -ForegroundColor Green
} else {
    Write-Host "FAIL: Signup failed" -ForegroundColor Red
}
Write-Host ""

# Test 2: Login
Write-Host "Test 2: User Login" -ForegroundColor Yellow
$body = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/api/login" -Method POST -ContentType "application/json" -Body $body

if ($response.success) {
    Write-Host "PASS: Login successful" -ForegroundColor Green
} else {
    Write-Host "FAIL: Login failed" -ForegroundColor Red
}
Write-Host ""

# Test 3: Get All Courses
Write-Host "Test 3: Get All Courses" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$BASE_URL/api/courses" -Method GET

if ($response.success) {
    $count = @($response.courses).Count
    Write-Host "PASS: Retrieved $count courses" -ForegroundColor Green
} else {
    Write-Host "FAIL: Could not retrieve courses" -ForegroundColor Red
}
Write-Host ""

# Test 4: Science Stream
Write-Host "Test 4: Recommendations - Science Stream (85)" -ForegroundColor Yellow
$body = @{
    stream = "Science"
    percentage = 85
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/api/recommend-courses" -Method POST -ContentType "application/json" -Body $body

if ($response.success) {
    Write-Host "PASS: Found $($response.total_courses) courses" -ForegroundColor Green
} else {
    Write-Host "FAIL: Recommendation failed" -ForegroundColor Red
}
Write-Host ""

# Test 5: Commerce Stream
Write-Host "Test 5: Recommendations - Commerce Stream (70)" -ForegroundColor Yellow
$body = @{
    stream = "Commerce"
    percentage = 70
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/api/recommend-courses" -Method POST -ContentType "application/json" -Body $body

if ($response.success) {
    Write-Host "PASS: Found $($response.total_courses) courses" -ForegroundColor Green
} else {
    Write-Host "FAIL: Recommendation failed" -ForegroundColor Red
}
Write-Host ""

# Test 6: Humanities Stream
Write-Host "Test 6: Recommendations - Humanities Stream (55)" -ForegroundColor Yellow
$body = @{
    stream = "Humanities"
    percentage = 55
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$BASE_URL/api/recommend-courses" -Method POST -ContentType "application/json" -Body $body

if ($response.success) {
    Write-Host "PASS: Found $($response.total_courses) courses" -ForegroundColor Green
} else {
    Write-Host "FAIL: Recommendation failed" -ForegroundColor Red
}
Write-Host ""

Write-Host "================================" -ForegroundColor Green
Write-Host "All Tests Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Open http://localhost:3000/login.html in browser" -ForegroundColor Yellow

