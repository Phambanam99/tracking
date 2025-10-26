# 📰 News Feature - Quick Reference

## Overview

The news feature allows users to browse, search, and manage news articles related to the tracking system. It integrates with an external news API to fetch and display articles.

## 🚀 Quick Start

### 1. Configure Environment

Create `frontend/.env.local`:
```bash
NEXT_PUBLIC_NEWS_API_URL=http://123.24.132.241:8000
```

### 2. Test API Connection (Optional)

```bash
node test-news-api.js
```

### 3. Start Development Server

```bash
cd frontend
npm run dev
```

### 4. Access News Page

Navigate to: **http://localhost:3000/news**

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **NEWS_SETUP.md** | Complete setup guide with troubleshooting |
| **NEWS_INTEGRATION.md** | Detailed API documentation and technical specs |
| **NEWS_INTEGRATION_SUMMARY.md** | High-level overview of the integration |
| **README_NEWS.md** | This quick reference guide |

## ✨ Features

### Current Features
- ✅ Browse news articles in responsive grid
- ✅ Search articles by title/content (debounced)
- ✅ Filter by: All, Unread, Read, Bookmarked
- ✅ Pagination with page controls
- ✅ View full article in modal
- ✅ Display article images
- ✅ Link to original source
- ✅ Toggle bookmark status (⭐)
- ✅ Toggle read status (📬/📭)

### Coming Soon
- 🔜 Backend persistence for bookmarks/read status
- 🔜 User authentication integration
- 🔜 Real-time updates
- 🔜 Advanced filtering
- 🔜 Export functionality

## 🗂️ File Structure

```
frontend/
├── src/
│   ├── app/
│   │   └── news/
│   │       └── page.tsx          # News page component
│   └── stores/
│       └── newsStore.ts          # News state management
├── NEWS_SETUP.md                 # Setup guide
├── NEWS_INTEGRATION.md           # API documentation
└── README_NEWS.md                # This file

Root:
├── test-news-api.js             # API test script
└── NEWS_INTEGRATION_SUMMARY.md  # Integration summary
```

## 🎯 Usage Examples

### Search for Articles
```typescript
// In the UI, just type in the search box
// Search is debounced (500ms delay)
```

### Filter Articles
```typescript
// Click filter buttons in the UI
// Or programmatically:
import { useNewsStore } from '@/stores/newsStore';

const { setFilter } = useNewsStore();

// Show only unread
setFilter({ IsRead: 0 });

// Show only bookmarked
setFilter({ IsBookmarked: 1 });
```

### Fetch News Programmatically
```typescript
import { useNewsStore } from '@/stores/newsStore';

const { fetchNews } = useNewsStore();

// Fetch with current filters
await fetchNews();
```

## 🔧 Configuration Options

### Change Page Size

Edit `frontend/src/stores/newsStore.ts`:
```typescript
pageSize: 20,  // Change to 50, 100, etc.
```

### Change Debounce Delay

Edit `frontend/src/app/news/page.tsx`:
```typescript
setTimeout(() => {
  setSearchQuery(localSearchTerm);
}, 500);  // Change delay (milliseconds)
```

### Change Default Filter

Edit `frontend/src/stores/newsStore.ts`:
```typescript
const defaultFilter: NewsFilter = {
  // ... modify default values
  IsRead: 0,  // Default to unread
};
```

## 🐛 Troubleshooting

### Problem: No articles showing

**Solutions:**
1. Check browser console for errors
2. Verify API URL in `.env.local`
3. Run `node test-news-api.js` to test API
4. Check Network tab in DevTools

### Problem: CORS error

**Solutions:**
1. Configure CORS on API server
2. Or use Next.js proxy (see NEWS_SETUP.md)

### Problem: Search not working

**Solutions:**
1. Wait 500ms after typing (debounce)
2. Check browser console
3. Verify `TextSearch` parameter in network request

### Problem: Images not loading

**Solution:**
- Images automatically hide on error
- This is expected behavior for invalid URLs

## 📊 API Quick Reference

### Endpoint
```
POST http://123.24.132.241:8000/api/news/GetAllByFilter
```

### Key Parameters
```typescript
{
  Page: 1,              // Page number
  PageSize: 20,         // Items per page
  TextSearch: null,     // Search query
  UserId: 1,            // User ID (TODO: from auth)
  ViewType: "grid",     // Display type
  Filter: {
    IsRead: -1,         // -1=all, 0=unread, 1=read
    IsBookmarked: -1,   // -1=all, 0=not bookmarked, 1=bookmarked
    IsDelete: 0,        // 0=not deleted, 1=deleted
    // ... more filters
  }
}
```

### Response
```typescript
{
  Data: NewsArticle[],  // Array of articles
  TotalCount: number,   // Total articles
  Page: number,         // Current page
  PageSize: number      // Items per page
}
```

## 🧪 Testing

### Manual Test Checklist
- [ ] Page loads without errors
- [ ] Articles display in grid
- [ ] Search updates results
- [ ] Filters work correctly
- [ ] Pagination navigates pages
- [ ] Article modal opens on click
- [ ] Bookmark toggle works
- [ ] Read status toggle works
- [ ] External link opens source
- [ ] Loading state shows during fetch
- [ ] Error message shows on failure

### API Test
```bash
# Run the test script
node test-news-api.js

# Expected output:
# ✅ Success!
# 📊 Results: Total Articles: XXX
# 📰 Sample Articles: ...
```

## 🚢 Production Deployment

### Environment Variables
Set in your hosting platform:
```bash
NEXT_PUBLIC_NEWS_API_URL=https://your-production-api.com
```

### Checklist
- [ ] Set production API URL
- [ ] Enable HTTPS
- [ ] Configure CORS
- [ ] Add authentication
- [ ] Implement rate limiting
- [ ] Test thoroughly
- [ ] Monitor performance

## 💡 Tips

1. **Search Performance:** Uses 500ms debounce to reduce API calls
2. **Pagination:** Default 20 items per page for optimal performance
3. **Optimistic UI:** Bookmark/read status updates immediately in UI
4. **Image Handling:** Broken images automatically hidden
5. **Error Handling:** Displays user-friendly error messages

## 🔗 Related Components

- **Header:** `frontend/src/components/Header.tsx`
- **ProtectedRoute:** `frontend/src/components/ProtectedRoute.tsx`
- **Auth Store:** `frontend/src/stores/authStore.ts`

## 📝 Notes

- **UserId:** Currently hardcoded to `1`, needs auth integration
- **Persistence:** Bookmark/read changes need backend endpoints
- **Security:** HTML content uses `dangerouslySetInnerHTML`, ensure API sanitizes content
- **Performance:** Consider implementing infinite scroll for better UX

## 🤝 Contributing

To extend the news feature:

1. **Add new filters:** Update `NewsFilter` interface in `newsStore.ts`
2. **Add actions:** Add new methods to `useNewsStore`
3. **Update UI:** Modify `frontend/src/app/news/page.tsx`
4. **Test:** Run manual tests and verify API calls

## 📞 Support

Need help? Check these resources:
1. **Setup Issues:** See `NEWS_SETUP.md`
2. **API Questions:** See `NEWS_INTEGRATION.md`
3. **Overview:** See `NEWS_INTEGRATION_SUMMARY.md`
4. **Test API:** Run `node test-news-api.js`

---

**Status:** ✅ Ready for Use  
**Version:** 1.0.0  
**Last Updated:** January 2025

