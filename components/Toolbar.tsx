import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolMode, AppMode, ProjectFile } from '../types';

interface ToolbarProps {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  currentMode: ToolMode;
  setMode: (mode: ToolMode) => void;
  onClear: () => void;
  onBatchExport: () => void;
  onAutoDetect: () => void;
  onAudit: () => void; // Single file audit
  onBatchAudit: () => void; // All files audit
  isProcessing: boolean;
  
  files: ProjectFile[];
  currentFileIndex: number;
  onFileSelect: (index: number) => void;
  projectDescription: string;
  setProjectDescription: (desc: string) => void;
  onApplyMasksToAll: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  appMode,
  setAppMode,
  currentMode, 
  setMode, 
  onClear, 
  onBatchExport, 
  onAutoDetect,
  onAudit,
  onBatchAudit,
  isProcessing,
  files,
  currentFileIndex,
  onFileSelect,
  projectDescription,
  setProjectDescription,
  onApplyMasksToAll
}) => {
  const currentFile = files[currentFileIndex];
  const auditResult = currentFile?.auditResult;
  const maskCount = currentFile?.masks.length || 0;
  const isImageMode = currentFile?.type === 'image';
  const hasMultipleImages = files.filter(f => f.type === 'image').length > 1;
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyAuditResult = () => {
    if (auditResult) {
      navigator.clipboard.writeText(auditResult).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      });
    }
  };

  // Helper for file icons
  const getFileIcon = (type: string) => {
      switch(type) {
          case '3d': return (
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          );
          case 'table': return (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          );
          default: return (
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          );
      }
  };

  return (
    <div className="w-[30%] min-w-[320px] bg-slate-900 border-r border-slate-700 flex flex-col h-full shrink-0 z-10 shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-850">
        <h1 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          图纸哨兵
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button 
          onClick={() => setAppMode(AppMode.DESENSITIZE)}
          className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-1 ${
            appMode === AppMode.DESENSITIZE 
              ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-400' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          1. 脱敏
        </button>
        <button 
          onClick={() => setAppMode(AppMode.AUDIT)}
          className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-1 ${
            appMode === AppMode.AUDIT 
              ? 'bg-slate-800 text-purple-400 border-b-2 border-purple-400' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          2. 预审
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* File List */}
        <div className="bg-slate-900 border-b border-slate-700 max-h-48 overflow-y-auto">
            <div className="px-4 py-2 bg-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider sticky top-0 flex justify-between">
                <span>文件列表 ({files.length})</span>
            </div>
            <ul className="divide-y divide-slate-800/50">
                {files.map((file, idx) => (
                    <li 
                        key={file.id} 
                        onClick={() => onFileSelect(idx)}
                        className={`px-4 py-2 text-sm cursor-pointer truncate flex items-center justify-between group ${idx === currentFileIndex ? 'bg-blue-900/30 text-blue-300 border-l-2 border-blue-500' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                        <div className="flex items-center gap-2 truncate flex-1">
                            {getFileIcon(file.type)}
                            <span className="truncate" title={file.name}>{file.name}</span>
                        </div>
                        {file.auditResult ? (
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                           file.masks.length > 0 && <span className="text-[10px] bg-slate-700 px-1 rounded text-slate-300 ml-2">{file.masks.length}</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>

        <div className="p-4 flex flex-col gap-6 overflow-y-auto flex-1">
            
            {/* Project Demand (Editable) */}
            <div className="bg-slate-800/50 p-3 rounded border border-slate-700 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-500 block">
                        项目需求 
                        <span className="text-blue-500 ml-1">(可编辑)</span>
                    </label>
                    <span className="text-[10px] text-slate-500">AI 将基于最新需求审核</span>
                </div>
                <textarea 
                    className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:border-blue-500 focus:outline-none resize-none placeholder-slate-600 leading-relaxed"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="在此输入或粘贴项目需求..."
                />
            </div>

            {/* --- DESENSITIZE MODE UI --- */}
            {appMode === AppMode.DESENSITIZE && (
            <>
                {isImageMode ? (
                <>
                    <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">手动工具</label>
                    <div className="flex gap-2">
                        <button
                        onClick={() => setMode(ToolMode.PAN)}
                        className={`flex-1 p-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${currentMode === ToolMode.PAN ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        title="平移画布 (快捷键: 空格)"
                        >
                        平移
                        </button>
                        <button
                        onClick={() => setMode(ToolMode.DRAW)}
                        className={`flex-1 p-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${currentMode === ToolMode.DRAW ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                        遮罩
                        </button>
                    </div>
                    </div>

                    <div className="flex flex-col gap-2">
                    <button
                            onClick={onApplyMasksToAll}
                            className="w-full py-2 px-3 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs flex items-center justify-center gap-2 transition-colors border border-slate-600"
                            title="将当前页面的遮罩复制到所有文件"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        应用遮罩至所有图纸
                    </button>
                    </div>

                    <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI 辅助</label>
                    </div>
                    <button
                        onClick={onAutoDetect}
                        disabled={isProcessing}
                        className="w-full p-2.5 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-blue-100 flex items-center justify-center gap-2 transition-all text-sm"
                    >
                        {isProcessing ? '处理中...' : '自动识别敏感信息'}
                    </button>
                    </div>
                </>
                ) : (
                    <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded text-yellow-200 text-xs">
                        当前文件类型 ({currentFile?.type}) 暂不支持脱敏操作。仅支持预览。
                    </div>
                )}

                <div className="mt-auto pt-6 border-t border-slate-700">
                    {isImageMode && (
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm text-slate-400">当前页遮罩: <span className="text-white font-mono font-bold">{maskCount}</span></span>
                            <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300 underline">清除</button>
                        </div>
                    )}
                    
                    {/* Primary CTA: Go to Audit */}
                    <button
                        onClick={() => setAppMode(AppMode.AUDIT)}
                        className="w-full p-3 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 mb-3"
                    >
                        <span>下一步：智能预审</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>

                    {/* Secondary Link: Direct Export */}
                    <div className="flex justify-center">
                        <button
                            onClick={onBatchExport}
                            disabled={files.length === 0}
                            className="text-xs text-slate-500 hover:text-slate-300 underline decoration-slate-600 hover:decoration-slate-400 transition-all flex items-center gap-1"
                        >
                            <span>跳过预审，直接导出 ZIP</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                    </div>
                </div>
            </>
            )}

            {/* --- AUDIT MODE UI --- */}
            {appMode === AppMode.AUDIT && (
            <div className="flex flex-col h-full">
                
                {/* Batch Audit Button (New) */}
                {hasMultipleImages && (
                    <div className="mb-4 pb-4 border-b border-slate-700">
                         <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">批量操作</label>
                         <button
                            onClick={onBatchAudit}
                            disabled={isProcessing}
                            className="w-full p-2.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                            {isProcessing ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>正在自动预审...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                    <span>一键预审所有图纸</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Single Audit Button */}
                {isImageMode ? (
                <div className="mb-4">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">当前图纸操作</label>
                <button
                    onClick={onAudit}
                    disabled={isProcessing}
                    className="w-full p-3 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20"
                >
                    {isProcessing ? 'AI 审核中...' : '重新审核当前图纸'}
                </button>
                </div>
                ) : (
                    <div className="mb-4 p-3 bg-slate-800 text-slate-400 text-xs rounded">
                        该文件格式暂不支持 AI 预审
                    </div>
                )}

                {/* Audit Result Display */}
                {auditResult ? (
                <div className="flex-1 overflow-y-auto bg-slate-800/50 rounded-lg border border-slate-700 p-3 text-sm markdown-body flex flex-col">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700/50">
                        <div className="flex items-center gap-2">
                            <span className="text-green-400 font-bold text-xs">AI 审核完成</span>
                            <span className="text-slate-500 text-[10px]">基于项目需求核对</span>
                        </div>
                        <button 
                          onClick={handleCopyAuditResult}
                          className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${copySuccess ? 'bg-green-900/50 border-green-500 text-green-300' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                        >
                           {copySuccess ? (
                             <>
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                               已复制
                             </>
                           ) : (
                             <>
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                               复制结果
                             </>
                           )}
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {auditResult}
                        </ReactMarkdown>
                    </div>
                </div>
                ) : (
                    !isProcessing && isImageMode && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-700 rounded-lg">
                            <p className="text-xs text-center px-4">
                                {hasMultipleImages 
                                    ? "点击上方「一键预审」可批量分析，或点击按钮单独审核。" 
                                    : "请点击按钮开始智能审核"}
                            </p>
                        </div>
                    )
                )}
            </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default Toolbar;