import React, { useRef, useEffect, useState } from 'react';
import { MaskRect, ImageSize, ToolMode } from '../types';

interface CanvasEditorProps {
  imageSrc: string | null;
  mode: ToolMode;
  masks: MaskRect[];
  setMasks: React.Dispatch<React.SetStateAction<MaskRect[]>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  exportTrigger: number;
  onExportComplete: () => void;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({ 
  imageSrc, 
  mode, 
  masks, 
  setMasks,
  zoom,
  setZoom,
  exportTrigger,
  onExportComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Use a ref for drag state to ensure we always have the latest values without re-rendering
  const dragRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0
  });

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 });
  const [currentRect, setCurrentRect] = useState<Partial<MaskRect> | null>(null);

  // 1. Image Loading
  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        setImage(img);
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
        setZoom(0.7); // Requirement: Default 70%
        setCurrentRect(null);
      };
    }
  }, [imageSrc, setZoom]);

  // 2. Painting (Draw Image + Masks)
  // We use the canvas at full resolution (naturalWidth/Height) but display it scaled via CSS.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    // Set canvas internal resolution to match image
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Image (at 1:1 scale internally)
    ctx.drawImage(image, 0, 0);

    // Draw Masks
    masks.forEach(mask => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(
        mask.x * imageSize.width,
        mask.y * imageSize.height,
        mask.w * imageSize.width,
        mask.h * imageSize.height
      );

      // Border
      ctx.strokeStyle = mask.type === 'ai' ? '#d97706' : '#ef4444';
      // Scale line width so it looks consistent regardless of image size
      ctx.lineWidth = Math.max(2, imageSize.width * 0.002); 
      ctx.strokeRect(
        mask.x * imageSize.width,
        mask.y * imageSize.height,
        mask.w * imageSize.width,
        mask.h * imageSize.height
      );
    });

    // Draw Active Drawing Rect
    if (currentRect && currentRect.w !== undefined) {
      let { x, y, w, h } = currentRect;
      
      // Handle negative dimensions for drawing
      if (w < 0) { x = (x || 0) + w; w = Math.abs(w); }
      if (h < 0) { y = (y || 0) + h; h = Math.abs(h); }

      ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // Blue transparent
      ctx.fillRect(
        x! * imageSize.width,
        y! * imageSize.height,
        w! * imageSize.width,
        h! * imageSize.height
      );
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = Math.max(2, imageSize.width * 0.002);
      ctx.strokeRect(
        x! * imageSize.width,
        y! * imageSize.height,
        w! * imageSize.width,
        h! * imageSize.height
      );
    }
  }, [image, imageSize, masks, currentRect]);

  // 3. Coordinate Helper
  const getNormalizedPos = (e: React.MouseEvent) => {
      // Calculate position relative to the element (e.nativeEvent.offsetX)
      // Since the element is styled with CSS to be (naturalWidth * zoom),
      // offsetX / clientWidth gives us the exact 0-1 normalized coordinate.
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      return { x, y };
  };

  // 4. Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
      if (!image) return;

      dragRef.current.isDown = true;
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;

      if (mode === ToolMode.PAN && containerRef.current) {
          // Record scroll position for "Grab and Drag" scrolling
          dragRef.current.scrollLeft = containerRef.current.scrollLeft;
          dragRef.current.scrollTop = containerRef.current.scrollTop;
      } else if (mode === ToolMode.DRAW) {
          const { x, y } = getNormalizedPos(e);
          setCurrentRect({ x, y, w: 0, h: 0 });
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragRef.current.isDown) return;

      if (mode === ToolMode.PAN && containerRef.current) {
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          // Scroll opposite to drag direction
          containerRef.current.scrollLeft = dragRef.current.scrollLeft - dx;
          containerRef.current.scrollTop = dragRef.current.scrollTop - dy;
      } else if (mode === ToolMode.DRAW) {
          const { x, y } = getNormalizedPos(e);
          setCurrentRect(prev => {
              if (!prev) return null;
              return {
                  ...prev,
                  w: x - prev.x!,
                  h: y - prev.y!
              };
          });
      }
  };

  const handleMouseUp = () => {
      dragRef.current.isDown = false;

      if (mode === ToolMode.DRAW && currentRect) {
          let { x, y, w, h } = currentRect;
          if (x === undefined || y === undefined || w === undefined || h === undefined) return;

          // Normalize negative dims
          if (w < 0) { x += w; w = Math.abs(w); }
          if (h < 0) { y += h; h = Math.abs(h); }

          // Minimum size threshold to prevent accidental clicks
          if (w > 0.005 && h > 0.005) {
              const newMask: MaskRect = {
                  id: Date.now().toString(),
                  x, y, w, h,
                  type: 'manual'
              };
              setMasks(prev => [...prev, newMask]);
          }
          setCurrentRect(null);
      }
  };

  const handleMouseLeave = () => {
      // If mouse leaves the canvas, stop the interaction
      if (dragRef.current.isDown) {
          dragRef.current.isDown = false;
          setCurrentRect(null);
      }
  };

  // 5. Export Logic
  useEffect(() => {
    if (exportTrigger > 0 && image && canvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(image, 0, 0);
            ctx.fillStyle = '#000000';
            masks.forEach(mask => {
                ctx.fillRect(
                    mask.x * image.naturalWidth,
                    mask.y * image.naturalHeight,
                    mask.w * image.naturalWidth,
                    mask.h * image.naturalHeight
                );
            });
            const link = document.createElement('a');
            link.download = `desensitized_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            onExportComplete();
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportTrigger]);

  // Styles
  const displayWidth = imageSize.width * zoom;
  const displayHeight = imageSize.height * zoom;
  
  // Decide cursor
  let cursor = 'cursor-default';
  if (mode === ToolMode.PAN) cursor = 'cursor-grab active:cursor-grabbing';
  if (mode === ToolMode.DRAW) cursor = 'cursor-crosshair';

  return (
    <div className="flex-1 bg-slate-950 relative flex flex-col h-full overflow-hidden">
       {!image && (
         <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 pointer-events-none">
           <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
           <p className="text-lg font-medium">暂无图片</p>
           <p className="text-sm">请从侧边栏上传图纸</p>
         </div>
       )}

      {/* Scrollable Container */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-auto relative w-full h-full ${image ? cursor : ''}`}
      >
        {image && (
            // Wrapper determines the scrollable area size based on zoom
            <div 
                className="relative origin-top-left"
                style={{ width: displayWidth, height: displayHeight, minWidth: '100%', minHeight: '100%' }}
            >
                {/* Canvas scales to fill wrapper */}
                <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    style={{ width: displayWidth, height: displayHeight, display: 'block' }}
                />
            </div>
        )}
      </div>
      
      {/* Zoom Controls Overlay */}
      {image && (
        <div className="absolute bottom-4 right-4 flex gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 backdrop-blur-sm z-10 shadow-xl">
           <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.1))} className="p-2 hover:bg-slate-600 rounded text-white transition-colors" title="缩小 (-)">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
           </button>
           <span className="w-14 text-center text-sm font-mono font-bold leading-9 text-white select-none">{Math.round(zoom * 100)}%</span>
           <button onClick={() => setZoom(z => Math.min(z + 0.1, 5))} className="p-2 hover:bg-slate-600 rounded text-white transition-colors" title="放大 (+)">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
           </button>
        </div>
      )}
      
      {/* Interaction Hint */}
      {image && (
          <div className="absolute top-4 right-4 text-[10px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700 select-none pointer-events-none backdrop-blur-sm">
             {mode === ToolMode.PAN ? "拖拽画布移动 · 切换遮罩模式进行操作" : "拖拽框选遮罩区域 · 可使用缩放按钮调整视野"}
          </div>
      )}
    </div>
  );
};

export default CanvasEditor;