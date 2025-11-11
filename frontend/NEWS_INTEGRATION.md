# News Integration Documentation

## Overview

The news feature integrates with an external news API to fetch, display, and manage news articles related to the tracking system.

## API Endpoint

**Base URL:** `http://123.24.132.241:8000`

**Endpoint:** `/api/news/GetAllByFilter`

**Method:** `POST`

## API Request Structure

```json
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

## Filter Parameters

### Basic Filters
- `IsRead`: `-1` (all), `0` (unread), `1` (read)
- `IsBookmarked`: `-1` (all), `0` (not bookmarked), `1` (bookmarked)
- `IsDelete`: `0` (not deleted), `1` (deleted)

### Search
- `TextSearch`: Search string for title and content
- `AllTitle`: `1` to search in titles
- `AllContent`: `1` to search in content

### Pagination
- `Page`: Current page number (starts from 1)
- `PageSize`: Number of items per page

## API Response Structure

```json
{
  "Data": [
    {
      "Id": 1,
      "Title": "News title",
      "Content": "HTML content",
      "Description": "Short description",
      "SourceName": "Source name",
      "Author": "Author name",
      "PublishedDate": "2024-01-01T00:00:00Z",
      "CreatedDate": "2024-01-01T00:00:00Z",
      "Url": "https://...",
      "ImageUrl": "https://...",
      "GroupNewsId": 1,
      "LinkId": 1,
      "FolderId": 0,
      "IsRead": false,
      "IsBookmarked": false,
      "IsDelete": false,
      "Tags": ["tag1", "tag2"],
      "CategoryName": "Category",
      "LanguageId": 1
    }
  ],
  "TotalCount": 100,
  "Page": 1,
  "PageSize": 20
}
```

## Implementation

### Store (`frontend/src/stores/newsStore.ts`)

The news store manages the state and API interactions:

- **State:**
  - `articles`: Array of news articles
  - `total`: Total number of articles
  - `page`: Current page number
  - `pageSize`: Items per page
  - `loading`: Loading state
  - `error`: Error message
  - `filter`: Filter object
  - `searchQuery`: Search text
  - `viewType`: Display type (grid/table/list)

- **Actions:**
  - `fetchNews()`: Fetch news from API
  - `toggleBookmark(id)`: Toggle bookmark status
  - `toggleRead(id)`: Toggle read status
  - `deleteNews(id)`: Delete news article
  - `setFilter()`: Update filter
  - `setSearchQuery()`: Update search query
  - `setPage()`: Change page

### Page Component (`frontend/src/app/news/page.tsx`)

The news page displays articles in a grid layout with:

- Search functionality (debounced)
- Filter buttons (All, Unread, Read, Bookmarked)
- Article cards with:
  - Image (if available)
  - Title and description
  - Source and publish date
  - Read/bookmark status
  - View and external link buttons
- Detail modal for viewing full article
- Pagination controls

## Features

### 1. Search
- Debounced search input (500ms delay)
- Searches in title and content
- Automatically resets to page 1

### 2. Filtering
- **All**: Show all articles
- **Unread**: Show only unread articles
- **Read**: Show only read articles
- **Bookmarked**: Show only bookmarked articles

### 3. Article Management
- **View**: Opens detail modal, marks as read
- **Bookmark**: Toggle bookmark status (⭐)
- **Read Status**: Toggle read/unread (📬/📭)
- **External Link**: Opens original article in new tab

### 4. Pagination
- Page navigation (Previous/Next)
- Display current page and total pages
- Shows items count

## Configuration

Add to your `.env.local` file:

```bash
NEXT_PUBLIC_NEWS_API_URL=http://123.24.132.241:8000
```

## Future Enhancements

### Planned Features
1. **Backend Integration**
   - Proxy news API through backend
   - Add authentication/authorization
   - Implement bookmark/read status persistence

2. **Advanced Filtering**
   - Date range filter
   - Category/tag filtering
   - Multiple filter combinations

3. **Additional Features**
   - Create/edit news articles
   - Share articles
   - Comment system
   - Export functionality

### API Endpoints to Implement
- `POST /api/news/ToggleBookmark` - Update bookmark status
- `POST /api/news/ToggleRead` - Update read status
- `DELETE /api/news/Delete` - Delete article
- `POST /api/news/Create` - Create new article
- `PUT /api/news/Update` - Update existing article

## Troubleshooting

### CORS Issues
If you encounter CORS errors, you may need to:
1. Configure the news API server to allow CORS
2. Proxy requests through your backend
3. Use Next.js API routes as a proxy

### Performance
For better performance:
1. Adjust `PageSize` based on your needs (default: 20)
2. Implement infinite scroll instead of pagination
3. Cache frequently accessed articles

## Notes

- The external API URL is currently hardcoded but can be configured via environment variable
- UserId is currently set to 1 - should be integrated with auth system
- Bookmark and read status changes are currently optimistic (UI updates immediately, but API calls are TODO)
- HTML content in articles is rendered using `dangerouslySetInnerHTML` - ensure content is sanitized

