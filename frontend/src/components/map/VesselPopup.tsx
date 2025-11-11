'use client';
import {
  formatTimeSince,
  getConfidenceLabel,
  getConfidenceColor,
  isVesselPredicted,
} from '@/utils/vesselUtils';

interface VesselPopupProps {
  vessel: {
    id?: number;
    mmsi: string;
    vesselName?: string;
    vesselType?: string;
    flag?: string;
    speed?: number;
    course?: number;
    heading?: number;
    status?: string;
    predicted?: boolean;
    confidence?: number;
    timeSinceLastMeasurement?: number;
  };
  onClose?: () => void;
}

export default function VesselPopup({ vessel, onClose }: VesselPopupProps) {
  const isPredicted = isVesselPredicted(vessel);
  const confidence = vessel.confidence ?? 1.0;
  const timeSince = vessel.timeSinceLastMeasurement ?? 0;

  const handleViewDetails = () => {
    if (vessel.id) {
      window.open(`/vessels/${vessel.id}`, '_blank');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 min-w-[280px] max-w-[320px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900">
            {vessel.vesselName || 'Unknown Vessel'}
          </h3>
          <p className="text-sm text-gray-500">MMSI: {vessel.mmsi}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPredicted && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full whitespace-nowrap">
              👻 Predicted
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Status Alert for Predicted */}
      {isPredicted && (
        <div className="mb-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-yellow-600 text-lg flex-shrink-0">⚠️</span>
            <div className="text-xs flex-1">
              <p className="font-semibold text-yellow-900 mb-1">Signal Lost</p>
              <p className="text-yellow-800 leading-relaxed">
                Position predicted using last known course and speed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="space-y-2 text-sm">
        {vessel.vesselType && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Type:</span>
            <span className="font-medium text-gray-900">{vessel.vesselType}</span>
          </div>
        )}

        {vessel.flag && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Flag:</span>
            <span className="font-medium text-gray-900">{vessel.flag}</span>
          </div>
        )}

        {vessel.speed !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Speed:</span>
            <span className="font-medium text-gray-900">
              {vessel.speed.toFixed(1)} kn
            </span>
          </div>
        )}

        {vessel.course !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Course:</span>
            <span className="font-medium text-gray-900">
              {vessel.course.toFixed(0)}°
            </span>
          </div>
        )}

        {vessel.heading !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Heading:</span>
            <span className="font-medium text-gray-900">
              {vessel.heading.toFixed(0)}°
            </span>
          </div>
        )}

        {vessel.status && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Status:</span>
            <span className="font-medium text-gray-900">{vessel.status}</span>
          </div>
        )}

        {/* Time Since Last Update */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <span className="text-gray-600">Last Update:</span>
          <span
            className={`font-medium ${isPredicted ? 'text-yellow-600' : 'text-gray-900'}`}
          >
            {formatTimeSince(timeSince)}
          </span>
        </div>

        {/* Confidence (for predicted) */}
        {isPredicted && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Confidence:</span>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${getConfidenceColor(confidence)}`}>
                {getConfidenceLabel(confidence)}
              </span>
              <span className="text-gray-500 text-xs">
                ({(confidence * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
        {vessel.id && (
          <button
            onClick={handleViewDetails}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Details
          </button>
        )}
        {isPredicted && (
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            title="Refresh to get latest position"
          >
            🔄
          </button>
        )}
      </div>
    </div>
  );
}


