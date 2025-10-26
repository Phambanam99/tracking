# News API Integration - Updated with Actual API Response

## ✅ Updates Applied

The news integration has been updated to match the **actual API response format** from `http://123.24.132.241:8000/api/news/GetAllByFilter`.

## 📊 API Response Structure

### Response Envelope
```typescript
{
  IsSuccess: boolean;
  Result: {
    Page: number;
    PageSize: number;
    TotalRecord: number;
    OrderAsc: boolean;
    Data: NewsArticle[];
  };
}
```

### NewsArticle Interface (Updated)
```typescript
{
  NewsId: number;              // ← Changed from Id
  Title: string;
  DisplayTitle: string;        // ← New field
  Content: string;
  DisplaySubContent: string;   // ← New field (replaces Description)
  Display: string;             // ← New field (HTML formatted content)
  
  Url: string;
  Image: string | null;        // ← Changed from ImageUrl
  Author: string | null;
  PostDate: string;            // ← Changed from PublishedDate
  CreateAt: string;            // ← New field
  
  LinkId: number;
  LinkName: string;            // ← New field (replaces SourceName)
  RootUrl: string;             // ← New field
  
  IsRead: boolean;
  IsBookmark: boolean;         // ← Changed from IsBookmarked
  IsDelete: boolean;
  IsInday: boolean;            // ← New field (today's news indicator)
  IsDateError: boolean;        // ← New field
  IsVideo: boolean;            // ← New field
  
  VideoUrl: string | null;     // ← New field
  Tags: string[] | null;
  
  Vi_Title: string | null;     // ← New field (Vietnamese title)
  Vi_Summary: string;          // ← New field
  Vi_Content: string | null;   // ← New field
  
  UnixTime: number;            // ← New field
  SysUnixTime: number;         // ← New field
  HashValue: number;           // ← New field
  
  IsShared: boolean | null;    // ← New field
  OwnerNewsId: number | null;  // ← New field
  UserId: number;
  
  Comments: any;               // ← New field
  DisplayFullGroupNewsName: string;  // ← New field
}
```

## 🔄 Key Field Mappings

| Old Field Name | New Field Name | Notes |
|---------------|----------------|-------|
| `Id` | `NewsId` | Primary identifier |
| `PublishedDate` | `PostDate` | Publication timestamp |
| `ImageUrl` | `Image` | Image URL (can be null) |
| `Description` | `DisplaySubContent` | Short summary |
| `SourceName` | `LinkName` | News source name |
| `IsBookmarked` | `IsBookmark` | Bookmark status |
| - | `DisplayTitle` | Formatted title (new) |
| - | `Display` | HTML formatted content (new) |
| - | `IsInday` | Today's news flag (new) |
| - | `RootUrl` | Source root URL (new) |

## 🛠️ Files Updated

### 1. `frontend/src/stores/newsStore.ts`
- ✅ Updated `NewsArticle` interface with all actual fields
- ✅ Updated `NewsResponse` to match actual envelope structure
- ✅ Fixed `fetchNews()` to parse `Result.Data` and `Result.TotalRecord`
- ✅ Updated `toggleBookmark`, `toggleRead`, `deleteNews` to use `NewsId`
- ✅ Fixed all linter errors

### 2. `frontend/src/app/news/page.tsx`
- ✅ Changed all `article.Id` to `article.NewsId`
- ✅ Changed `article.IsBookmarked` to `article.IsBookmark`
- ✅ Changed `article.PublishedDate` to `article.PostDate`
- ✅ Changed `article.ImageUrl` to `article.Image`
- ✅ Changed `article.SourceName` to `article.LinkName`
- ✅ Updated to use `DisplayTitle` or fallback to `Title`
- ✅ Updated to use `DisplaySubContent` or fallback to `Content`
- ✅ Added `IsInday` badge (green "Hôm nay" label)
- ✅ Updated modal to use `Display` HTML content or fallback to `Content`

## ✨ New Features from Real API

### 1. **Today's News Indicator**
Articles with `IsInday: true` now show a green "Hôm nay" (Today) badge.

### 2. **Rich HTML Content**
The `Display` field contains fully formatted HTML content with proper styling.

### 3. **Multiple Title/Content Fields**
- `DisplayTitle` - Formatted title for display
- `Title` - Raw title
- `DisplaySubContent` - Short summary for cards
- `Content` - Full text content
- `Display` - HTML formatted content with images

### 4. **Vietnamese Content Support**
- `Vi_Title` - Vietnamese translated title
- `Vi_Summary` - Vietnamese summary
- `Vi_Content` - Vietnamese full content

## 📝 Sample API Request

```javascript
POST http://123.24.132.241:8000/api/news/GetAllByFilter
Content-Type: application/json

{
  "Page": 1,
  "PageSize": 20,
  "TextSearch": null,
  "UserId": 1,
  "ViewType": "grid",
  "Filter": {
    "GroupNewsId": null,
    "LinkId": null,
    "FolderId": 0,
    "IsRead": -1,
    "IsBookmarked": -1,
    "Option": 0,
    "StartDate": null,
    "EndDate": null,
    "IsTag": -1,
    "IsNote": -1,
    "AllTitle": 1,
    "AllContent": -1,
    "IsDelete": 0,
    "TagCategoryId": 0,
    "IsSystemTag": -1,
    "IsFolder": 0,
    "NewsId": 0,
    "TimeOrder": 0,
    "IsNer": false,
    "NerWordsId": 0,
    "NerDateOption": 1,
    "IsShare": null,
    "IsMe": false,
    "LanguageId": 0
  }
}
```

## 🎯 Testing

### Quick Test
1. Create `frontend/.env.local`:
   ```bash
   NEXT_PUBLIC_NEWS_API_URL=http://123.24.132.241:8000
   ```

2. Start the app:
   ```bash
   cd frontend
   npm run dev
   ```

3. Navigate to: `http://localhost:3000/news`

### Expected Behavior
- ✅ Articles load from real API
- ✅ Displays "Hôm nay" badge for today's news
- ✅ Shows source name (LinkName)
- ✅ Displays formatted titles and summaries
- ✅ Modal shows rich HTML content
- ✅ Bookmark/read status toggles work (optimistic UI)
- ✅ Pagination works correctly

## ⚠️ Important Notes

1. **Response Structure**
   - Must check `IsSuccess` field first
   - Data is nested in `Result` object
   - Total count is `Result.TotalRecord` (not `TotalCount`)

2. **Field Names**
   - Use `NewsId` instead of `Id` everywhere
   - Use `IsBookmark` instead of `IsBookmarked`
   - Use `PostDate` instead of `PublishedDate`

3. **Content Display**
   - `Display` field contains full HTML (use `dangerouslySetInnerHTML`)
   - `DisplaySubContent` is good for card previews
   - `DisplayTitle` should be preferred over `Title`

4. **Today's News**
   - `IsInday: true` indicates article was published today
   - Shows green badge in UI

## 🚀 Next Steps

1. **Backend Persistence (TODO)**
   - Implement `POST /api/news/bookmark/:id`
   - Implement `POST /api/news/read/:id`
   - Implement `DELETE /api/news/:id`

2. **Authentication Integration**
   - Get real `UserId` from auth store
   - Add JWT token to requests if required

3. **Advanced Features**
   - Date range filtering
   - Source (LinkId) filtering
   - Tag filtering
   - Video news support

## 📊 Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Response Parsing | `data.Data` | `data.Result.Data` |
| Total Count | `data.TotalCount` | `data.Result.TotalRecord` |
| Article ID | `article.Id` | `article.NewsId` |
| Bookmark | `article.IsBookmarked` | `article.IsBookmark` |
| Date | `article.PublishedDate` | `article.PostDate` |
| Image | `article.ImageUrl` | `article.Image` |
| Source | `article.SourceName` | `article.LinkName` |
| Content | `article.Content` | `article.Display` (HTML) |

## ✅ Status

**Implementation:** Complete  
**Linter Errors:** None  
**API Integration:** Working  
**UI:** Updated  
**Documentation:** Updated  

---

**Last Updated:** January 2025  
**Version:** 1.1.0 (Updated for Real API)

