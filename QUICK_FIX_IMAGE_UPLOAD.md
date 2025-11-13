# 🚀 Quick Fix Guide - Image Upload Error

## ⚡ 2-Minute Fix

### Problem

```
Error: Failed to add image: [postMultipart] url must be a string, url should not be empty
Endpoint: http://localhost:3001/api/vessels/104911/images/upload
```

### Solution 1: Add Environment Variable (RECOMMENDED)

```bash
# 1. Edit backend/.env file
echo "" >> backend/.env
echo "# Image Upload Base URL" >> backend/.env
echo "PUBLIC_BASE_URL=http://localhost:3001" >> backend/.env

# 2. Restart backend server
cd backend
npm run start:dev
```

### Solution 2: Fix DTO Validation

**Edit:** `backend/src/vessel/dto/vessel.dto.ts`

**Add this new class after `CreateVesselImageDto`:**

```typescript
// New DTO for file uploads (url is optional)
export class UploadVesselImageDto {
  @IsOptional() // Changed from @IsNotEmpty()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  isPrimary?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;
}
```

**Edit:** `backend/src/vessel/vessel.controller.ts`

**Change line 529 from:**

```typescript
@Body() dto: CreateVesselImageDto,
```

**To:**

```typescript
@Body() dto: UploadVesselImageDto,
```

**Then restart backend:**

```bash
cd backend
npm run start:dev
```

---

## 🔍 Debug Mode (If fixes don't work)

### Add Logging

**Frontend (`apiClient.ts` - in `buildUrl` method):**

```typescript
console.log("[DEBUG] API_BASE_URL:", API_BASE_URL);
console.log("[DEBUG] endpoint:", endpoint);
console.log("[DEBUG] fullUrl:", fullUrl);
```

**Frontend (`VesselDetailClient.tsx` - in `addImage` function):**

```typescript
console.log("[DEBUG] vessel.id:", vessel?.id);
console.log("[DEBUG] FormData:", Array.from(formData.entries()));
```

**Backend (`vessel.controller.ts` - in `uploadImage` method):**

```typescript
console.log("[DEBUG] id:", id);
console.log("[DEBUG] file:", file);
console.log("[DEBUG] dto:", dto);
console.log("[DEBUG] PUBLIC_BASE_URL:", process.env.PUBLIC_BASE_URL);
```

### Test Steps

1. Open browser DevTools (F12) → Console tab
2. Navigate to vessel page (e.g., `/vessels/104911`)
3. Try uploading an image
4. Check console logs and terminal logs
5. Note exact error and share in debug session

---

## ✅ Verification

After applying fixes:

```bash
# Test the endpoint directly
curl -X POST http://localhost:3001/api/vessels/104911/images/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-API-Version: 1.0.0" \
  -F "file=@test.jpg" \
  -F "caption=Test Upload"
```

**Expected:** Success response with image data  
**If failed:** Check backend console for validation errors

---

## 📋 Checklist

- [ ] Added `PUBLIC_BASE_URL` to `backend/.env`
- [ ] Restarted backend server
- [ ] Tested image upload in browser
- [ ] Verified image appears in vessel images list
- [ ] Checked `backend/uploads/` directory has file
- [ ] No console errors in browser

---

## 📄 Full Documentation

See: `DEBUGGING_IMAGE_UPLOAD.md` for comprehensive analysis

**Key Sections:**

- Root Cause Analysis (4 hypotheses)
- Diagnostic Steps (3 phases)
- Solutions & Fixes (5 options)
- Testing Checklist (5 test cases)

---

**Quick Help:**

- Frontend files: `frontend/src/services/apiClient.ts`, `frontend/src/app/vessels/[id]/VesselDetailClient.tsx`
- Backend files: `backend/src/vessel/vessel.controller.ts`, `backend/src/vessel/vessel.service.ts`
- Config: `frontend/.env`, `backend/.env`
