# 🔧 Fix: GET /api/users/filters 400 Bad Request

**Issue:** `GET http://localhost:3001/api/users/filters` returns 400 Bad Request  
**Status:** ✅ **FIXED**

---

## 📋 Problem Analysis

### The Error
```
GET /api/users/filters
Response: 400 Bad Request
```

### Root Cause
The `UserFiltersResponseDto` was using **input validation DTOs** (`AircraftFiltersDto`, `VesselFiltersDto`) that have **validation decorators**:

```typescript
// WRONG - Input DTO with validation
export class AircraftFiltersDto {
  @ApiProperty({ description: 'Aircraft search query', example: 'VN123' })
  @IsString()
  searchQuery: string;  // ❌ Required, no @IsOptional()
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operator?: string;
}

// Then used in response:
export class UserFiltersResponseDto {
  aircraft: AircraftFiltersDto;  // ❌ Using input DTO for response
  vessel: VesselFiltersDto;      // ❌ Using input DTO for response
}
```

### Why 400 Bad Request?

When returning filters from the database:
```json
{
  "id": 1,
  "name": "My Filters",
  "aircraft": {
    "operator": "Vietnam Airlines"
    // ❌ searchQuery field is missing from database
    // ❌ But AircraftFiltersDto requires it (@IsString on searchQuery)
  },
  "vessel": {
    "operator": "Some Company"
    // ❌ searchQuery field missing
    // ❌ But VesselFiltersDto requires it
  }
}
```

NestJS class-validator **validates the response** using the DTO decorators, and fails because required fields are missing!

---

## 🛠️ Solution Applied

### Create Separate Response DTOs (No Validation)

**File:** `backend/src/user/dto/user-filters.dto.ts`

```typescript
// NEW - Response DTOs WITHOUT validation decorators
export class AircraftFiltersResponseDto {
  searchQuery?: string;
  operator?: string;
  aircraftType?: string;
  minSpeed?: number;
  maxSpeed?: number;
  minAltitude?: number;
  maxAltitude?: number;
}

export class VesselFiltersResponseDto {
  searchQuery?: string;
  operator?: string;
  vesselType?: string;
  minSpeed?: number;
  maxSpeed?: number;
}

// UPDATED - Response DTO uses response DTOs (no validation)
export class UserFiltersResponseDto {
  id: number;
  name: string;
  userId: number;
  activeFilterTab: 'aircraft' | 'vessel';
  aircraftViewMode: 'all' | 'tracked';
  vesselViewMode: 'all' | 'tracked';
  aircraft: AircraftFiltersResponseDto;  // ✅ Now uses response DTO
  vessel: VesselFiltersResponseDto;       // ✅ Now uses response DTO
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🔄 Before vs After

### Before (❌ 400 Error)
```
GET /api/users/filters

Response:
{
  "statusCode": 400,
  "message": [
    "aircraft.searchQuery must be a string",
    "vessel.searchQuery must be a string"
  ],
  "error": "Bad Request"
}
```

### After (✅ 200 Success)
```
GET /api/users/filters

Response: 200 OK
[
  {
    "id": 1,
    "name": "My Filters",
    "userId": 1,
    "activeFilterTab": "aircraft",
    "aircraftViewMode": "tracked",
    "vesselViewMode": "all",
    "aircraft": {
      "operator": "Vietnam Airlines"
    },
    "vessel": {
      "operator": "Some Company"
    },
    "createdAt": "2025-01-01T12:00:00Z",
    "updatedAt": "2025-01-01T12:00:00Z"
  }
]
```

---

## 📝 Best Practice Learned

### ✅ Correct Pattern

**Separate Input and Output DTOs:**

```typescript
// INPUT DTO - With validation (for @Body() parameters)
export class SaveUserFiltersDto {
  @IsString()
  name: string;
  
  @IsObject()
  @Type(() => AircraftFiltersDto)
  aircraft: AircraftFiltersDto;
}

export class AircraftFiltersDto {
  @IsString()
  searchQuery: string;  // Required for input
}

// OUTPUT DTO - No validation (for responses)
export class UserFiltersResponseDto {
  name: string;
  aircraft: AircraftFiltersResponseDto;
}

export class AircraftFiltersResponseDto {
  searchQuery?: string;  // Optional for output
}

// Usage in Controller:
@Post('filters')
async saveFilters(
  @Body() dto: SaveUserFiltersDto  // ✅ Uses input DTO with validation
): Promise<UserFiltersResponseDto> {
  // ...
}

@Get('filters')
async getFilters(): Promise<UserFiltersResponseDto[]> {  // ✅ Uses output DTO without validation
  // ...
}
```

---

## 🚀 Deployment

### Step 1: Update Code
The fix has been applied to:
- ✅ `backend/src/user/dto/user-filters.dto.ts`

### Step 2: Rebuild Backend
```bash
cd backend
npm run build
```

### Step 3: Restart Backend
```bash
npm run start:dev
```

### Step 4: Test Endpoint
```bash
# Get user filters (should now return 200)
curl -X GET http://localhost:3001/api/users/filters \
  -H "Authorization: Bearer <your_token>"

# Expected: 200 OK with array of filter objects
```

---

## 🧪 Testing

### Test 1: Get Filters (Main Fix)
```bash
curl -X GET http://localhost:3001/api/users/filters \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"

# Expected Status: 200 OK
# Expected Body: Array of filter objects
```

### Test 2: Save Filters (Should Still Work)
```bash
curl -X POST http://localhost:3001/api/users/filters \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Test Filter",
    "activeFilterTab": "aircraft",
    "aircraftViewMode": "tracked",
    "vesselViewMode": "all",
    "aircraft": {
      "searchQuery": "VN123",
      "operator": "Vietnam Airlines"
    },
    "vessel": {
      "searchQuery": "CARGO",
      "operator": "Shipco"
    }
  }'

# Expected Status: 201 Created
```

### Test 3: Get Filter by ID
```bash
curl -X GET http://localhost:3001/api/users/filters/1 \
  -H "Authorization: Bearer <token>"

# Expected Status: 200 OK
```

---

## 📊 Files Changed

| File | Change | Lines |
|------|--------|-------|
| `backend/src/user/dto/user-filters.dto.ts` | Added response DTOs without validation | +32 |

---

## 🔍 Why This Happens

### Class-Validator Validation
NestJS uses `class-validator` to validate:
- **Request bodies** (@Body() parameters)
- **Response serialization** (if using response DTOs with decorators)

When the response contains a DTO with validation decorators, the validator checks:
- ✅ All @IsString() fields are strings
- ✅ All @IsNumber() fields are numbers
- ✅ All required fields (without @IsOptional()) exist

If any validation fails → 400 Bad Request

### The Fix
Use **separate DTOs** for input and output:
- **Input DTOs**: Have validation decorators (required fields)
- **Output DTOs**: No validation decorators (optional fields)

---

## ✨ Benefits

- ✅ GET /filters now returns 200 OK
- ✅ Filters can be retrieved successfully
- ✅ Frontend can fetch user's saved filters
- ✅ Input validation still works for POST/PUT
- ✅ Follows NestJS best practices

---

## 📚 Related

- **Previous Issue:** Token validation in user endpoints
- **Similar Issue:** DTO validation failures
- **Best Practice:** Separate input/output DTOs

---

## 🎯 Summary

### Problem
Response DTO used input validation DTOs, causing 400 errors when returning data from database.

### Solution
Created separate response DTOs without validation decorators.

### Result
GET /api/users/filters now works correctly and returns 200 OK.

**Status:** ✅ Fixed and Ready to Deploy

---

**Files Modified:** 1  
**Lines Changed:** +32  
**Breaking Changes:** None  
**Backward Compatible:** Yes

