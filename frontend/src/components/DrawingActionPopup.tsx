import React from "react";

interface DrawingActionPopupProps {
  isVisible: boolean;
  geometry: object | null;
  position: { x: number; y: number };
  onCreateAlert: (alertName: string) => void;
  onSearchInRegion: () => void;
  onCancel: () => void;
}

const DrawingActionPopup: React.FC<DrawingActionPopupProps> = ({
  isVisible,
  geometry,
  position,
  onCreateAlert,
  onSearchInRegion,
  onCancel,
}) => {
  const handleCreateAlert = () => {
    const alertName = `Vùng cảnh báo ${Date.now()}`;
    onCreateAlert(alertName);
  };
  if (!isVisible || !geometry) return null;

  const geometryType = (geometry as { type?: string })?.type;

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-64"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Bạn muốn làm gì với vùng vừa vẽ?
        </h3>
        <p className="text-sm text-gray-600">
          Chọn hành động cho vùng{" "}
          {geometryType === "Polygon" ? "đa giác" : "tròn"} vừa tạo:
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleCreateAlert}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5C3.312 18.167 4.274 19 5.814 19z"
            />
          </svg>
          <span>Tạo vùng cảnh báo</span>
        </button>

        <button
          onClick={onSearchInRegion}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span>Tìm kiếm tàu thuyền & máy bay</span>
        </button>

        <button
          onClick={onCancel}
          className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
        >
          Hủy bỏ
        </button>
      </div>
    </div>
  );
};

export default DrawingActionPopup;
