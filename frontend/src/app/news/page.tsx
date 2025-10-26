'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useNewsStore } from '@/stores/newsStore';

export default function NewsPage() {
  const {
    articles,
    total,
    page,
    pageSize,
    loading,
    error,
    searchQuery,
    filter,
    setPage,
    setSearchQuery,
    setFilter,
    fetchNews,
    toggleBookmark,
    toggleRead,
    deleteNews,
  } = useNewsStore();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [vietnameseMode, setVietnameseMode] = useState<Record<number, boolean>>({});

  // Fetch news on component mount and when filters change
  useEffect(() => {
    fetchNews();
  }, [page, filter.IsRead, filter.IsBookmarked, fetchNews]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchTerm);
      if (page !== 1) {
        setPage(1);
      } else {
        fetchNews();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localSearchTerm]);

  const filterOptions = [
    { value: 'all', label: 'Tất cả', icon: '📰', filterKey: null },
    { value: 'unread', label: 'Chưa đọc', icon: '📭', filterKey: 'IsRead', filterValue: 0 },
    { value: 'read', label: 'Đã đọc', icon: '📬', filterKey: 'IsRead', filterValue: 1 },
    { value: 'bookmarked', label: 'Đã lưu', icon: '⭐', filterKey: 'IsBookmarked', filterValue: 1 },
  ];

  const handleFilterChange = (filterKey: string | null, filterValue?: number) => {
    if (!filterKey) {
      setFilter({ IsRead: -1, IsBookmarked: -1 });
      setSelectedCategory('all');
    } else if (filterKey === 'IsRead') {
      setFilter({ IsRead: filterValue ?? -1, IsBookmarked: -1 });
      setSelectedCategory(filterValue === 0 ? 'unread' : 'read');
    } else if (filterKey === 'IsBookmarked') {
      setFilter({ IsBookmarked: filterValue ?? -1, IsRead: -1 });
      setSelectedCategory('bookmarked');
    }
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleToggleBookmark = async (id: number) => {
    await toggleBookmark(id);
  };

  const handleToggleRead = async (id: number) => {
    await toggleRead(id);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa tin tức này?')) {
      await deleteNews(id);
    }
  };

  // View state
  const [viewing, setViewing] = useState<typeof articles[0] | null>(null);
  const [viewingInVietnamese, setViewingInVietnamese] = useState(false);

  const startView = (article: typeof articles[0]) => {
    setViewing(article);
    setViewingInVietnamese(false);
    if (!article.IsRead) {
      handleToggleRead(article.NewsId);
    }
  };

  const toggleVietnameseInCard = (newsId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setVietnameseMode((prev) => ({
      ...prev,
      [newsId]: !prev[newsId],
    }));
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <Header />

        <main className="section">
          <div className="">
            <div className="mb-8">
              <h1 className="page-title">Theo dõi báo chí</h1>
              <p className="page-subtitle">Quản lý tin tức và bài viết liên quan đến hệ thống</p>
            </div>

            {/* Filters */}
            <div className="card mb-6">
              <div className="card-body">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo tiêu đề, nội dung..."
                      className="input"
                      value={localSearchTerm}
                      onChange={(e) => setLocalSearchTerm(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleFilterChange(option.filterKey, option.filterValue)}
                        disabled={loading}
                        className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                          selectedCategory === option.value
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        <span className="mr-1">{option.icon}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Stats */}
                <div className="mt-3 text-sm text-gray-600">
                  Hiển thị {articles.length} trong tổng số {total} tin tức
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">⚠️ {error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-gray-600">Đang tải tin tức...</p>
              </div>
            )}

            {/* Articles Grid */}
            {!loading && (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {articles.map((article) => (
                    <div
                      key={article.NewsId}
                      className="card overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      {article.Image && (
                        <div className="h-48 overflow-hidden">
                          <img
                            src={article.Image}
                            alt={article.Title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="card-body">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {!article.IsRead && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Mới
                              </span>
                            )}
                            {article.IsInday && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Hôm nay
                              </span>
                            )}
                            {article.LinkName && (
                              <span className="text-xs text-gray-500">
                                {article.LinkName}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(article.PostDate).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        <h3 className="text-lg font-medium text-gray-900 mb-2 line-clamp-2">
                          {vietnameseMode[article.NewsId] && article.Vi_Title
                            ? article.Vi_Title
                            : article.DisplayTitle || article.Title}
                        </h3>

                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                          {vietnameseMode[article.NewsId] && article.Vi_Summary
                            ? article.Vi_Summary
                            : article.DisplaySubContent || article.Content}
                        </p>

                        {article.Tags && article.Tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-4">
                            {article.Tags.slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleBookmark(article.NewsId)}
                              className={`text-sm ${
                                article.IsBookmark
                                  ? 'text-yellow-600'
                                  : 'text-gray-400 hover:text-yellow-600'
                              }`}
                              title={article.IsBookmark ? 'Bỏ lưu' : 'Lưu tin'}
                            >
                              ⭐
                            </button>
                            <button
                              onClick={() => handleToggleRead(article.NewsId)}
                              className={`text-sm ${
                                article.IsRead
                                  ? 'text-green-600'
                                  : 'text-gray-400 hover:text-green-600'
                              }`}
                              title={article.IsRead ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                            >
                              {article.IsRead ? '📬' : '📭'}
                            </button>
                          </div>

                          <div className="flex items-center space-x-2">
                            {(article.Vi_Title || article.Vi_Content) && (
                              <button
                                onClick={(e) => toggleVietnameseInCard(article.NewsId, e)}
                                className={`text-sm font-medium ${
                                  vietnameseMode[article.NewsId]
                                    ? 'text-green-600 hover:text-green-900'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                                title={vietnameseMode[article.NewsId] ? 'Xem bản gốc' : 'Dịch tiếng Việt'}
                              >
                                {vietnameseMode[article.NewsId] ? '🇻🇳 VI' : '🌐 EN'}
                              </button>
                            )}
                            <button
                              onClick={() => startView(article)}
                              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                            >
                              Xem
                            </button>
                            {article.Url && (
                              <a
                                href={article.Url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                              >
                                Nguồn ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {articles.length === 0 && !loading && (
                <div className="col-span-full">
                  <div className="text-center py-12">
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                          Không có tin tức
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                          Không tìm thấy tin tức nào phù hợp với tiêu chí tìm kiếm.
                    </p>
                  </div>
                </div>
              )}
            </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1 || loading}
                      className="px-3 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      ← Trước
                    </button>
                    <span className="text-sm text-gray-600">
                      Trang {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === totalPages || loading}
                      className="px-3 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Sau →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* View modal */}
        {viewing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Chi tiết tin tức
                  {viewingInVietnamese && <span className="ml-2 text-sm text-green-600">(Tiếng Việt)</span>}
                </h3>
                <div className="flex items-center gap-3">
                  {(viewing.Vi_Title || viewing.Vi_Content) && (
                    <button
                      onClick={() => setViewingInVietnamese(!viewingInVietnamese)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        viewingInVietnamese
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                      title={viewingInVietnamese ? 'Xem bản gốc' : 'Dịch sang tiếng Việt'}
                    >
                      {viewingInVietnamese ? '🇻🇳 Tiếng Việt' : '🌐 Dịch sang TV'}
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleBookmark(viewing.NewsId)}
                    className={`text-lg ${
                      viewing.IsBookmark ? 'text-yellow-600' : 'text-gray-400'
                    }`}
                    title={viewing.IsBookmark ? 'Bỏ lưu' : 'Lưu tin'}
                  >
                    ⭐
                  </button>
                  {viewing.Url && (
                    <a
                      href={viewing.Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-900"
                    >
                      Xem nguồn ↗
                    </a>
                  )}
                  <button
                    onClick={() => setViewing(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto">
                {viewing.Image && (
                  <div className="mb-4">
                    <img
                      src={viewing.Image}
                      alt={viewing.Title}
                      className="w-full max-h-96 object-contain rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="mb-3 flex items-center justify-between text-sm text-gray-500 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    {viewing.LinkName && <span>{viewing.LinkName}</span>}
                    {viewing.Author && <span>• {viewing.Author}</span>}
                  </div>
                  <span>
                    {new Date(viewing.PostDate).toLocaleString('vi-VN')}
                  </span>
                </div>
                <h2 className="text-3xl font-bold mb-4 text-gray-900">
                  {viewingInVietnamese && viewing.Vi_Title
                    ? viewing.Vi_Title
                    : viewing.DisplayTitle || viewing.Title}
                </h2>
                {viewingInVietnamese && viewing.Vi_Summary ? (
                  <p className="text-lg text-gray-700 mb-4 font-medium">
                    {viewing.Vi_Summary}
                  </p>
                ) : (
                  viewing.DisplaySubContent && (
                    <p className="text-lg text-gray-700 mb-4 font-medium">
                      {viewing.DisplaySubContent}
                    </p>
                  )
                )}
                {viewingInVietnamese && viewing.Vi_Content ? (
                  <div className="prose max-w-none text-gray-800 whitespace-pre-wrap">
                    {viewing.Vi_Content}
                  </div>
                ) : (
                  <div
                    className="prose max-w-none text-gray-800"
                    dangerouslySetInnerHTML={{ __html: viewing.Display || viewing.Content }}
                  />
                )}
                {viewing.Tags && viewing.Tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t">
                    {viewing.Tags.map((t, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
