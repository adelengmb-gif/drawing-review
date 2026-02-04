import React from 'react';
import CanvasEditor from './CanvasEditor';
import { ProjectFile, ToolMode, MaskRect } from '../types';

interface MainViewerProps {
  file: ProjectFile | null;
  mode: ToolMode;
  masks: MaskRect[];
  setMasks: React.Dispatch<React.SetStateAction<MaskRect[]>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  exportTrigger: number;
  onExportComplete: () => void;
}

const MainViewer: React.FC<MainViewerProps> = (props) => {
  const { file } = props;

  if (!file) {
    return (
        <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center text-slate-600">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="text-lg font-medium">请从左侧选择文件</p>
        </div>
    );
  }

  // --- 3D Viewer ---
  if (file.type === '3d') {
    return (
        <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
            <div className="absolute top-4 left-4 z-10 bg-purple-900/80 px-3 py-1 rounded text-purple-200 text-xs font-mono">
                3D PREVIEW MODE
            </div>
            {/* @ts-ignore */}
            <model-viewer
                src={file.url}
                camera-controls
                auto-rotate
                shadow-intensity="1"
                style={{ width: '100%', height: '100%' }}
            >
                <div slot="progress-bar"></div>
            {/* @ts-ignore */}
            </model-viewer>
            <div className="p-4 bg-slate-900 border-t border-slate-700 text-center text-slate-500 text-sm">
                注意：3D 模型目前仅支持预览，暂不支持在线遮罩脱敏。请确认源文件安全性。
            </div>
        </div>
    );
  }

  // --- Table Viewer ---
  if (file.type === 'table' && file.parsedTableData) {
      return (
          <div className="flex-1 bg-slate-950 overflow-auto p-8">
              <div className="max-w-6xl mx-auto bg-slate-900 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
                  <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-green-400 font-bold flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        零件清单 / BOM
                    </h2>
                    <span className="text-xs text-slate-500">仅供预览</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-800 text-slate-200 uppercase font-medium">
                            <tr>
                                {file.parsedTableData[0]?.map((header: any, i: number) => (
                                    <th key={i} className="px-6 py-3 border-b border-slate-700 whitespace-nowrap">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {file.parsedTableData.slice(1).map((row, i) => (
                                <tr key={i} className="hover:bg-slate-800/50">
                                    {row.map((cell: any, j: number) => (
                                        <td key={j} className="px-6 py-3 whitespace-nowrap">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              </div>
          </div>
      );
  }

  // --- Image/PDF Viewer (Standard CanvasEditor) ---
  return (
    <CanvasEditor 
        imageSrc={file.url}
        mode={props.mode}
        masks={props.masks}
        setMasks={props.setMasks}
        zoom={props.zoom}
        setZoom={props.setZoom}
        exportTrigger={props.exportTrigger}
        onExportComplete={props.onExportComplete}
    />
  );
};

export default MainViewer;