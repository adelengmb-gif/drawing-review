import React, { useState, useEffect } from 'react';
import Toolbar from './components/Toolbar';
import MainViewer from './components/MainViewer';
import WelcomeScreen from './components/WelcomeScreen';
import { ToolMode, MaskRect, AppMode, ProjectFile } from './types';
import { detectSensitiveData, auditBlueprint } from './services/geminiService';
import JSZip from 'jszip';
import saveAs from 'file-saver';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>(AppMode.WELCOME);
  const [currentMode, setCurrentMode] = useState<ToolMode>(ToolMode.PAN);
  
  // Project State
  const [projectDesc, setProjectDesc] = useState('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  // UI State
  const [zoom, setZoom] = useState(1);
  const [exportTrigger, setExportTrigger] = useState(0); // Only used for single image
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleProjectStart = (description: string, loadedFiles: ProjectFile[]) => {
    setProjectDesc(description);
    setFiles(loadedFiles);
    setCurrentFileIndex(0);
    setAppMode(AppMode.DESENSITIZE);
    showNotification(`项目已加载 ${loadedFiles.length} 个文件`, 'success');
  };

  const handleMaskChange = (newMasksOrFn: MaskRect[] | ((prev: MaskRect[]) => MaskRect[])) => {
      setFiles(prev => {
          const updated = [...prev];
          const current = { ...updated[currentFileIndex] };
          
          if (current.type !== 'image') return prev; // Only mask images

          if (typeof newMasksOrFn === 'function') {
              current.masks = newMasksOrFn(current.masks);
          } else {
              current.masks = newMasksOrFn;
          }
          
          updated[currentFileIndex] = current;
          return updated;
      });
  };

  const handleApplyMasksToAll = () => {
      const sourceMasks = files[currentFileIndex].masks;
      if (sourceMasks.length === 0) {
          showNotification("当前页面没有遮罩可复制", 'error');
          return;
      }
      
      const confirm = window.confirm(`确定将遮罩应用到所有图片类型的文件吗？`);
      if (!confirm) return;

      setFiles(prev => prev.map(f => {
          if (f.type === 'image') {
              return { ...f, masks: [...sourceMasks] };
          }
          return f;
      }));
      showNotification("批量遮罩应用成功", 'success');
  };

  // Helper to process an image off-screen for zip export
  const processImageForExport = async (file: ProjectFile): Promise<Blob> => {
      if (file.type !== 'image') return file.blob; // Return original if not image

      return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');
              if (!ctx) { reject("Canvas context error"); return; }
              
              // Draw image
              ctx.drawImage(img, 0, 0);
              
              // Draw masks
              ctx.fillStyle = '#000000';
              file.masks.forEach(mask => {
                  ctx.fillRect(
                      mask.x * img.naturalWidth,
                      mask.y * img.naturalHeight,
                      mask.w * img.naturalWidth,
                      mask.h * img.naturalHeight
                  );
              });
              
              canvas.toBlob((blob) => {
                  if (blob) resolve(blob);
                  else reject("Blob generation failed");
              }, 'image/png');
          };
          img.onerror = () => reject("Image load error");
          img.src = file.url;
      });
  };

  const handleBatchExport = async () => {
      if (files.length === 0) return;

      if (files.length === 1 && files[0].type === 'image') {
          // Single image export optimization
          setExportTrigger(prev => prev + 1);
          return;
      }

      setIsProcessing(true);
      showNotification("正在生成压缩包，请稍候...", 'success');

      try {
          const zip = new JSZip();
          const folder = zip.folder("desensitized_package");
          
          if (projectDesc) {
              folder?.file("requirements.txt", projectDesc);
          }

          const promises = files.map(async (file) => {
             try {
                const processedBlob = await processImageForExport(file);
                
                let fileName = file.name;
                // Normalize image extension if processed
                if (file.type === 'image') {
                    fileName = file.name.replace(/\.[^/.]+$/, "") + ".png";
                }
                
                folder?.file(fileName, processedBlob);
             } catch (err) {
                 console.error(`Failed to process ${file.name}`, err);
             }
          });

          await Promise.all(promises);

          const content = await zip.generateAsync({ type: "blob" });
          saveAs(content, "blueprint_sentinel_export.zip");
          showNotification("批量导出完成", 'success');
      } catch (error) {
          console.error(error);
          showNotification("导出失败", 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  const handleAutoDetect = async () => {
    if (files.length === 0) return;
    const currentFile = files[currentFileIndex];
    if (currentFile.type !== 'image') {
        showNotification("当前文件格式不支持 AI 检测", 'error');
        return;
    }
    
    if (!process.env.API_KEY) {
      showNotification("缺少 API_KEY 环境变量", 'error');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch(currentFile.url);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        try {
            const results = await detectSensitiveData(base64data);
            
            if (results.length === 0) {
                showNotification("未检测到敏感数据", 'success');
            } else {
                const newMasks: MaskRect[] = results.map(r => ({
                id: `ai-${Date.now()}-${Math.random()}`,
                x: r.box_2d[1] > 1 ? r.box_2d[1] / 1000 : r.box_2d[1], 
                y: r.box_2d[0] > 1 ? r.box_2d[0] / 1000 : r.box_2d[0],
                w: (r.box_2d[3] - r.box_2d[1]) > 1 ? (r.box_2d[3] - r.box_2d[1]) / 1000 : (r.box_2d[3] - r.box_2d[1]),
                h: (r.box_2d[2] - r.box_2d[0]) > 1 ? (r.box_2d[2] - r.box_2d[0]) / 1000 : (r.box_2d[2] - r.box_2d[0]),
                type: 'ai',
                label: r.label
                }));
                
                // Add to current file masks
                handleMaskChange(prev => [...prev, ...newMasks]);
                showNotification(`检测到 ${newMasks.length} 个敏感区域`, 'success');
            }
        } catch (e) {
            console.error(e);
            showNotification("AI 检测异常", 'error');
        } finally {
            setIsProcessing(false);
        }
      };
      reader.readAsDataURL(blob);

    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      showNotification("读取文件失败", 'error');
    }
  };

  // Internal helper to perform audit on a specific file index
  const performAuditOnIndex = async (index: number): Promise<void> => {
      const file = files[index];
      if (file.type !== 'image') return;

      const response = await fetch(file.url);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64data = reader.result as string;
              try {
                  const result = await auditBlueprint(base64data, projectDesc); // Pass project context
                  setFiles(prev => {
                      const updated = [...prev];
                      updated[index] = { ...updated[index], auditResult: result };
                      return updated;
                  });
                  resolve();
              } catch (e) {
                  reject(e);
              }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  };

  const handleAudit = async () => {
    if (files.length === 0) return;
    const currentFile = files[currentFileIndex];
    if (currentFile.type !== 'image') {
        showNotification("暂不支持对该格式进行 AI 预审", 'error');
        return;
    }

    if (!process.env.API_KEY) {
      showNotification("缺少 API_KEY", 'error');
      return;
    }

    setIsProcessing(true);
    try {
        await performAuditOnIndex(currentFileIndex);
        showNotification("当前图纸预审完成", 'success');
    } catch (e) {
        console.error(e);
        showNotification("AI 预审失败", 'error');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleBatchAudit = async () => {
    if (!process.env.API_KEY) {
        showNotification("缺少 API_KEY", 'error');
        return;
    }

    const imageFiles = files.map((f, i) => ({ file: f, index: i })).filter(item => item.file.type === 'image');
    if (imageFiles.length === 0) {
        showNotification("没有可审核的图片文件", 'error');
        return;
    }

    setIsProcessing(true);
    showNotification(`开始批量审核 ${imageFiles.length} 张图纸...`, 'success');

    // Process sequentially to ensure UI updates and avoid potential rate limits
    for (const item of imageFiles) {
        // Select the file being processed so the user sees progress
        setCurrentFileIndex(item.index);
        
        // Skip if already audited? No, force re-audit if requested via batch
        try {
            await performAuditOnIndex(item.index);
        } catch (e) {
            console.error(`Failed to audit file ${item.file.name}`, e);
        }
    }

    setIsProcessing(false);
    showNotification("所有图纸审核完成", 'success');
  };

  // Clean up ObjectURLs on unmount
  useEffect(() => {
      return () => {
          files.forEach(f => URL.revokeObjectURL(f.url));
      };
  }, []);

  if (appMode === AppMode.WELCOME) {
      return <WelcomeScreen onProjectStart={handleProjectStart} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Toolbar 
        appMode={appMode}
        setAppMode={setAppMode}
        currentMode={currentMode} 
        setMode={setCurrentMode} 
        onClear={() => handleMaskChange([])}
        onBatchExport={handleBatchExport}
        onAutoDetect={handleAutoDetect}
        onAudit={handleAudit}
        onBatchAudit={handleBatchAudit}
        isProcessing={isProcessing}
        
        files={files}
        currentFileIndex={currentFileIndex}
        onFileSelect={setCurrentFileIndex}
        projectDescription={projectDesc}
        setProjectDescription={setProjectDesc}
        onApplyMasksToAll={handleApplyMasksToAll}
      />
      
      <main className="flex-1 flex flex-col relative transition-all duration-300">
        <MainViewer 
          file={files[currentFileIndex] || null}
          mode={appMode === AppMode.DESENSITIZE ? currentMode : ToolMode.PAN}
          masks={files[currentFileIndex]?.masks || []}
          setMasks={handleMaskChange}
          zoom={zoom}
          setZoom={setZoom}
          exportTrigger={exportTrigger}
          onExportComplete={() => showNotification("图片导出成功", 'success')}
        />

        {/* Notification Toast */}
        {notification && (
          <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl backdrop-blur-md border animate-fade-in-down z-50 ${
            notification.type === 'success' ? 'bg-green-900/80 border-green-500 text-green-100' : 'bg-red-900/80 border-red-500 text-red-100'
          }`}>
             <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
                <span className="font-medium text-sm">{notification.msg}</span>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;