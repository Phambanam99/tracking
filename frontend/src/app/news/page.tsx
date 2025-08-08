"use client";

import { useState } from "react";
import Header from "@/components/Header";
import ProtectedRoute from "@/components/ProtectedRoute";

interface NewsArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  author: string;
  publishedAt: string;
  tags: string[];
  status: "draft" | "published";
}

export default function NewsPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data for demonstration
  const [articles] = useState<NewsArticle[]>([
    {
      id: 1,
      title: "Hệ thống theo dõi máy bay mới được triển khai",
      content:
        "Hệ thống theo dõi và giám sát máy bay hiện đại đã được triển khai thành công...",
      category: "technology",
      author: "Nguyễn Văn A",
      publishedAt: "2024-08-07T10:00:00Z",
      tags: ["máy bay", "công nghệ", "theo dõi"],
      status: "published",
    },
    {
      id: 2,
      title: "Cải tiến hệ thống AIS cho tàu thuyền",
      content:
        "Việc nâng cấp hệ thống AIS giúp theo dõi tàu thuyền chính xác hơn...",
      category: "marine",
      author: "Trần Thị B",
      publishedAt: "2024-08-06T14:30:00Z",
      tags: ["tàu thuyền", "AIS", "nâng cấp"],
      status: "published",
    },
    {
      id: 3,
      title: "Báo cáo an toàn hàng không tháng 7",
      content:
        "Tổng hợp các sự cố và biện pháp an toàn hàng không trong tháng qua...",
      category: "safety",
      author: "Lê Văn C",
      publishedAt: "2024-08-05T09:15:00Z",
      tags: ["an toàn", "hàng không", "báo cáo"],
      status: "draft",
    },
  ]);

  const categories = [
    { value: "all", label: "Tất cả", icon: "📰" },
    { value: "technology", label: "Công nghệ", icon: "💻" },
    { value: "marine", label: "Hàng hải", icon: "🚢" },
    { value: "aviation", label: "Hàng không", icon: "✈️" },
    { value: "safety", label: "An toàn", icon: "🛡️" },
  ];

  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesCategory =
      selectedCategory === "all" || article.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "published":
        return "Đã xuất bản";
      case "draft":
        return "Bản nháp";
      default:
        return "Không xác định";
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                Theo dõi báo chí
              </h1>
              <p className="mt-2 text-gray-600">
                Quản lý tin tức và bài viết liên quan đến hệ thống
              </p>
            </div>

            {/* Filters */}
            <div className="bg-white shadow rounded-lg mb-6">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo tiêu đề, nội dung hoặc thẻ..."
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {categories.map((category) => (
                      <button
                        key={category.value}
                        onClick={() => setSelectedCategory(category.value)}
                        className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                          selectedCategory === category.value
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                        }`}
                      >
                        <span className="mr-1">{category.icon}</span>
                        {category.label}
                      </button>
                    ))}
                  </div>
                  <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    📝 Tạo bài viết
                  </button>
                </div>
              </div>
            </div>

            {/* Articles Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {filteredArticles.map((article) => (
                <div
                  key={article.id}
                  className="bg-white overflow-hidden shadow rounded-lg"
                >
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          article.status
                        )}`}
                      >
                        {getStatusText(article.status)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(article.publishedAt).toLocaleDateString(
                          "vi-VN"
                        )}
                      </span>
                    </div>

                    <h3 className="text-lg font-medium text-gray-900 mb-2 line-clamp-2">
                      {article.title}
                    </h3>

                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {article.content}
                    </p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {article.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-6 w-6 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {article.author.charAt(0)}
                          </span>
                        </div>
                        <span className="ml-2 text-sm text-gray-500">
                          {article.author}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                          Xem
                        </button>
                        <button className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                          Sửa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredArticles.length === 0 && (
                <div className="col-span-full">
                  <div className="text-center py-12">
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      Không có bài viết
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Không tìm thấy bài viết nào phù hợp với tiêu chí tìm kiếm.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
