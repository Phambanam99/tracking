'use client';

import { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  onColorSelect: (color: string) => void;
  initialColor?: string;
}

export default function ColorPicker({ onColorSelect, initialColor = '#24bf69' }: ColorPickerProps) {
  const [hue, setHue] = useState(147);
  const [saturation, setSaturation] = useState(68);
  const [lightness, setLightness] = useState(45);
  const [hexColor, setHexColor] = useState(initialColor);
  const [isDraggingSV, setIsDraggingSV] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const svPickerRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);

  // Convert HSL to HEX
  const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Update hex color when HSL changes
  useEffect(() => {
    const hex = hslToHex(hue, saturation, lightness);
    setHexColor(hex);
  }, [hue, saturation, lightness]);

  // Parse initial color
  useEffect(() => {
    if (initialColor && initialColor.startsWith('#')) {
      const hex = initialColor.substring(1);
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0,
        s = 0,
        l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
          case g:
            h = ((b - r) / d + 2) / 6;
            break;
          case b:
            h = ((r - g) / d + 4) / 6;
            break;
        }
      }

      setHue(Math.round(h * 360));
      setSaturation(Math.round(s * 100));
      setLightness(Math.round(l * 100));
    }
  }, [initialColor]);

  const handleSVPickerMove = (e: React.MouseEvent | MouseEvent) => {
    if (!svPickerRef.current) return;
    const rect = svPickerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    const newSaturation = Math.round((x / rect.width) * 100);
    const newLightness = Math.round(100 - (y / rect.height) * 100);
    
    setSaturation(newSaturation);
    setLightness(newLightness);
  };

  const handleHueSliderMove = (e: React.MouseEvent | MouseEvent) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newHue = Math.round((x / rect.width) * 360);
    setHue(newHue);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSV) handleSVPickerMove(e);
      if (isDraggingHue) handleHueSliderMove(e);
    };

    const handleMouseUp = () => {
      setIsDraggingSV(false);
      setIsDraggingHue(false);
    };

    if (isDraggingSV || isDraggingHue) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingSV, isDraggingHue]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(hexColor);
  };

  const handleSelect = () => {
    onColorSelect(hexColor);
  };

  return (
    <div className="w-full max-w-sm bg-white rounded-lg shadow-lg p-4 space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Chọn màu sắc</h3>
      </div>

      {/* Color Preview */}
      <div className="flex items-center justify-center">
        <div
          className="w-full h-24 rounded-lg border-2 border-gray-200"
          style={{ backgroundColor: hexColor }}
        />
      </div>

      {/* Saturation/Lightness Picker */}
      <div
        ref={svPickerRef}
        className="relative w-full h-40 rounded-lg cursor-crosshair"
        style={{
          background: `linear-gradient(to bottom, 
            hsl(${hue}, 100%, 100%), 
            hsl(${hue}, 100%, 50%) 50%, 
            hsl(${hue}, 100%, 0%)
          ), linear-gradient(to right, 
            hsl(${hue}, 0%, 50%), 
            hsl(${hue}, 100%, 50%)
          )`,
          backgroundBlendMode: 'multiply',
        }}
        onMouseDown={(e) => {
          setIsDraggingSV(true);
          handleSVPickerMove(e);
        }}
      >
        <div
          className="absolute w-5 h-5 border-2 border-white rounded-full shadow-lg pointer-events-none"
          style={{
            left: `${saturation}%`,
            top: `${100 - lightness}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: hexColor,
          }}
        />
      </div>

      {/* Hue Slider */}
      <div
        ref={hueSliderRef}
        className="relative w-full h-8 rounded-lg cursor-pointer"
        style={{
          background:
            'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
        }}
        onMouseDown={(e) => {
          setIsDraggingHue(true);
          handleHueSliderMove(e);
        }}
      >
        <div
          className="absolute w-5 h-10 border-2 border-white rounded-md shadow-lg pointer-events-none"
          style={{
            left: `${(hue / 360) * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: `hsl(${hue}, 100%, 50%)`,
          }}
        />
      </div>

      {/* Color Values */}
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">HEX</span>
            <span className="font-mono text-sm">{hexColor}</span>
          </div>
          <button
            onClick={copyToClipboard}
            className="text-gray-500 hover:text-gray-700"
            title="Copy to clipboard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
          <span className="text-sm font-medium text-gray-600">HSL</span>
          <span className="font-mono text-sm">
            {hue}, {saturation}, {lightness}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleSelect}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Chọn màu này
      </button>
    </div>
  );
}
