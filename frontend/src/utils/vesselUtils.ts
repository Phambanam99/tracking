/**
 * Vessel utility functions for prediction and display
 */

/**
 * Format time since last measurement
 */
export function formatTimeSince(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * Get confidence label
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

/**
 * Get confidence color class
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Get confidence background color class
 */
export function getConfidenceBgColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800';
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

/**
 * Check if vessel is predicted (signal lost)
 */
export function isVesselPredicted(vessel: { predicted?: boolean }): boolean {
  return vessel.predicted === true;
}

/**
 * Get vessel status color
 */
export function getVesselStatusColor(vessel: {
  predicted?: boolean;
  confidence?: number;
}): string {
  if (vessel.predicted) {
    const conf = vessel.confidence ?? 0;
    if (conf >= 0.8) return 'text-yellow-600';
    if (conf >= 0.5) return 'text-orange-600';
    return 'text-red-600';
  }
  return 'text-green-600';
}

/**
 * Get vessel icon
 */
export function getVesselIcon(vessel: { predicted?: boolean }): string {
  return vessel.predicted ? '👻' : '🚢';
}

/**
 * Calculate opacity for predicted vessel
 */
export function getVesselOpacity(vessel: {
  predicted?: boolean;
  confidence?: number;
}): number {
  if (!vessel.predicted) return 1.0;
  const confidence = vessel.confidence ?? 0.5;
  return Math.max(0.3, confidence * 0.7);
}

