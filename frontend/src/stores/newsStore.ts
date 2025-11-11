import { create } from 'zustand';

export interface NewsArticle {
  NewsId: number;
  Url: string;
  PostDate: string;
  Image: string | null;
  Author: string | null;
  LinkId: number;
  IsRead: boolean;
  IsBookmark: boolean;
  Vi_Title: string | null;
  Vi_Summary: string;
  Vi_Content: string | null;
  IsDelete: boolean;
  CreateAt: string;
  IsInday: boolean;
  IsDateError: boolean;
  IsShared: boolean | null;
  OwnerNewsId: number | null;
  UserId: number;
  Display: string;
  DisplaySubContent: string;
  DisplayTitle: string;
  Content: string;
  VideoUrl: string | null;
  UnixTime: number;
  SysUnixTime: number;
  Title: string;
  HashValue: number;
  IsVideo: boolean;
  Comments: any;
  Tags: string[] | null;
  DisplayFullGroupNewsName: string;
  LinkName: string;
  RootUrl: string;
}

export interface NewsFilter {
  GroupNewsId?: number | null;
  LinkId?: number | null;
  FolderId?: number;
  IsRead?: number; // -1: all, 0: unread, 1: read
  IsBookmarked?: number; // -1: all, 0: not bookmarked, 1: bookmarked
  Option?: number;
  StartDate?: string | null;
  EndDate?: string | null;
  IsTag?: number;
  IsNote?: number;
  AllTitle?: number;
  AllContent?: number;
  IsDelete?: number;
  TagCategoryId?: number;
  IsSystemTag?: number;
  IsFolder?: number;
  NewsId?: number;
  TimeOrder?: number;
  IsNer?: boolean;
  NerWordsId?: number;
  NerDateOption?: number;
  IsShare?: boolean | null;
  IsMe?: boolean;
  LanguageId?: number;
}

export interface NewsResponse {
  IsSuccess: boolean;
  Result: {
    Page: number;
    PageSize: number;
    TotalRecord: number;
    OrderAsc: boolean;
    Data: NewsArticle[];
  };
}

interface NewsState {
  articles: NewsArticle[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  filter: NewsFilter;
  searchQuery: string;
  viewType: 'table' | 'grid' | 'list';

  // Actions
  setArticles: (articles: NewsArticle[]) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilter: (filter: Partial<NewsFilter>) => void;
  setSearchQuery: (query: string) => void;
  setViewType: (viewType: 'table' | 'grid' | 'list') => void;
  resetFilter: () => void;

  // API actions
  fetchNews: () => Promise<void>;
  toggleBookmark: (id: number) => Promise<void>;
  toggleRead: (id: number) => Promise<void>;
  deleteNews: (id: number) => Promise<void>;
}

const defaultFilter: NewsFilter = {
  GroupNewsId: null,
  LinkId: null,
  FolderId: 0,
  IsRead: -1,
  IsBookmarked: -1,
  Option: 0,
  StartDate: null,
  EndDate: null,
  IsTag: -1,
  IsNote: -1,
  AllTitle: 1,
  AllContent: -1,
  IsDelete: 0,
  TagCategoryId: 0,
  IsSystemTag: -1,
  IsFolder: 0,
  NewsId: 0,
  TimeOrder: 0,
  IsNer: false,
  NerWordsId: 0,
  NerDateOption: 1,
  IsShare: null,
  IsMe: false,
  LanguageId: 0,
};

export const useNewsStore = create<NewsState>((set, get) => ({
  articles: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
  filter: defaultFilter,
  searchQuery: '',
  viewType: 'grid',

  setArticles: (articles) => set({ articles }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setFilter: (filterUpdate) =>
    set((state) => ({
      filter: { ...state.filter, ...filterUpdate },
    })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setViewType: (viewType) => set({ viewType }),
  resetFilter: () => set({ filter: defaultFilter, searchQuery: '' }),

  fetchNews: async () => {
    const { page, pageSize, filter, searchQuery } = get();
    set({ loading: true, error: null });

    try {
      // External API endpoint
      const API_URL =
        process.env.NEXT_PUBLIC_NEWS_API_URL || 'http://123.24.132.241:8000';
      const userId = 1; // TODO: Get from auth store

      const response = await fetch(`${API_URL}/api/news/GetAllByFilter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Page: page,
          PageSize: pageSize,
          TextSearch: searchQuery || null,
          UserId: userId,
          ViewType: get().viewType,
          Filter: filter,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch news: ${response.statusText}`);
      }

      const data: NewsResponse = await response.json();

      if (!data.IsSuccess || !data.Result) {
        throw new Error('API returned unsuccessful response');
      }

      set({
        articles: data.Result.Data || [],
        total: data.Result.TotalRecord || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching news:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch news',
        loading: false,
      });
    }
  },

  toggleBookmark: async (id: number) => {
    try {
      const article = get().articles.find((a) => a.NewsId === id);
      if (!article) return;

      // Update local state optimistically
      set((state) => ({
        articles: state.articles.map((a) =>
          a.NewsId === id ? { ...a, IsBookmark: !a.IsBookmark } : a,
        ),
      }));

      // TODO: Add API call to update bookmark status on server
      // const API_URL = process.env.NEXT_PUBLIC_NEWS_API_URL || 'http://123.24.132.241:8000';
      // await fetch(`${API_URL}/api/news/ToggleBookmark`, { ... });
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      // Revert on error
      get().fetchNews();
    }
  },

  toggleRead: async (id: number) => {
    try {
      const article = get().articles.find((a) => a.NewsId === id);
      if (!article) return;

      // Update local state optimistically
      set((state) => ({
        articles: state.articles.map((a) =>
          a.NewsId === id ? { ...a, IsRead: !a.IsRead } : a,
        ),
      }));

      // TODO: Add API call to update read status on server
      // const API_URL = process.env.NEXT_PUBLIC_NEWS_API_URL || 'http://123.24.132.241:8000';
      // await fetch(`${API_URL}/api/news/ToggleRead`, { ... });
    } catch (error) {
      console.error('Error toggling read status:', error);
      // Revert on error
      get().fetchNews();
    }
  },

  deleteNews: async (id: number) => {
    try {
      // Update local state optimistically
      set((state) => ({
        articles: state.articles.filter((a) => a.NewsId !== id),
        total: state.total - 1,
      }));

      // TODO: Add API call to delete news on server
      // const API_URL = process.env.NEXT_PUBLIC_NEWS_API_URL || 'http://123.24.132.241:8000';
      // await fetch(`${API_URL}/api/news/Delete`, { ... });
    } catch (error) {
      console.error('Error deleting news:', error);
      // Revert on error
      get().fetchNews();
    }
  },
}));
