# Test Authentication Endpoints

## Register a new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "username": "admin", 
    "password": "password123",
    "firstName": "Admin",
    "lastName": "User",
    "role": "ADMIN"
  }'

## Login with credentials
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'

## Get user profile (use access_token from login response)
curl -X GET http://localhost:3000/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"

## Get all aircraft (no auth required)
curl -X GET http://localhost:3000/aircrafts/initial

## Get all vessels (no auth required)  
curl -X GET http://localhost:3000/vessels/initial

## Create new aircraft (with auth)
curl -X POST http://localhost:3000/aircrafts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "flightId": "TEST001",
    "callSign": "TEST001",
    "aircraftType": "Boeing 737"
  }'

## Create new vessel (with auth)
curl -X POST http://localhost:3000/vessels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "mmsi": "123456789",
    "vesselName": "Test Ship",
    "vesselType": "Cargo"
  }'
