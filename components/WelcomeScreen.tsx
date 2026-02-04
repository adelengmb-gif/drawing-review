import React, { useState } from 'react';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';

// Initialize PDF.js worker
// Handle different module export structures (ESM vs CJS interop)
// In some ESM builds, the library is on the 'default' property.
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

if (pdfjs && pdfjs.GlobalWorkerOptions) {
  // Use cdnjs for the worker file to ensure a clean script meant for importScripts, avoiding esm.sh wrapper issues
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
} else {
    console.warn("PDF.js GlobalWorkerOptions not found, PDF processing might fail.");
}

interface WelcomeScreenProps {
  onProjectStart: (description: string, files: any[]) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onProjectStart }) => {
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const getFileType = (filename: string): 'image' | '3d' | 'table' | 'pdf' | 'unknown' => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return 'image';
    if (['glb', 'gltf'].includes(ext || '')) return '3d';
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) return 'table';
    if (ext === 'pdf') return 'pdf';
    return 'unknown';
  };

  const processFile = async (file: File): Promise<any[]> => {
    const type = getFileType(file.name);
    
    if (type === 'image') {
        return [{
            id: `img-${Date.now()}-${Math.random()}`,
            name: file.name,
            blob: file,
            type: 'image',
            url: URL.createObjectURL(file),
            masks: [],
            status: 'pending'
        }];
    }

    if (type === '3d') {
        return [{
            id: `3d-${Date.now()}-${Math.random()}`,
            name: file.name,
            blob: file,
            type: '3d',
            url: URL.createObjectURL(file),
            masks: [],
            status: 'pending'
        }];
    }

    if (type === 'table') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        return [{
            id: `table-${Date.now()}-${Math.random()}`,
            name: file.name,
            blob: file,
            type: 'table',
            url: '', // No URL needed for table, we store data
            parsedTableData: jsonData,
            masks: [],
            status: 'pending'
        }];
    }

    if (type === 'pdf') {
        setLoadingStatus(`正在转换 PDF: ${file.name}...`);
        const arrayBuffer = await file.arrayBuffer();
        
        if (!pdfjs.getDocument) {
            throw new Error("PDF.js library not loaded correctly.");
        }

        try {
            const loadingTask = pdfjs.getDocument(arrayBuffer);
            const pdf = await loadingTask.promise;
            const pageFiles = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                setLoadingStatus(`处理 PDF 页面: ${i}/${pdf.numPages}`);
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 }); // High quality scale
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context!, viewport: viewport }).promise;
                
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    const pageFile = new File([blob], `${file.name}_Page_${i}.png`, { type: 'image/png' });
                    pageFiles.push({
                        id: `pdf-page-${i}-${Date.now()}`,
                        name: `${file.name} [P${i}]`,
                        blob: pageFile,
                        type: 'image', // Treat converted PDF pages as standard images
                        url: URL.createObjectURL(pageFile),
                        masks: [],
                        status: 'pending'
                    });
                }
            }
            return pageFiles;
        } catch (err: any) {
            console.error("PDF Processing Error:", err);
            // If worker fails, it might throw here.
            throw new Error(`PDF 解析失败: ${err.message || 'Unknown error'}`);
        }
    }

    return [];
  };

  const handleFileEntry = async (file: File) => {
    setIsProcessing(true);
    setLoadingStatus('正在解析文件...');
    
    try {
        let processedFiles: any[] = [];

        if (file.name.endsWith('.zip')) {
            const zip = await JSZip.loadAsync(file);
            const entries = Object.keys(zip.files).filter(name => !zip.files[name].dir && !name.startsWith('__MACOSX'));
            
            for (const name of entries) {
                setLoadingStatus(`解压: ${name}`);
                const blob = await zip.files[name].async('blob');
                const extractedFile = new File([blob], name);
                const results = await processFile(extractedFile);
                processedFiles = [...processedFiles, ...results];
            }
        } else {
            processedFiles = await processFile(file);
        }

        if (processedFiles.length === 0) {
            alert("未找到支持的文件格式 (JPG, PNG, PDF, GLB, Excel)");
        } else {
            onProjectStart(description, processedFiles);
        }

    } catch (e: any) {
        console.error(e);
        alert(`文件处理失败: ${e.message}`);
    } finally {
        setIsProcessing(false);
        setLoadingStatus('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileEntry(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-slate-900 p-8">
      <div className="max-w-2xl w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 flex flex-col gap-6">
        
        <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">图纸哨兵工作台 Pro</h1>
            <p className="text-slate-400">支持 2D 图纸 / PDF / 3D 模型 / BOM 清单的全能脱敏平台</p>
        </div>

        <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-300">需求描述 (可选)</label>
            <textarea 
                className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:border-blue-500 focus:outline-none resize-none placeholder-slate-600 text-sm"
                placeholder="在此输入处理要求..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />
        </div>

        <div 
            className={`relative border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center transition-all cursor-pointer ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-500'}`}
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDrop={handleDrop}
        >
            <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".zip,.jpg,.png,.jpeg,.webp,.pdf,.glb,.gltf,.xlsx,.csv"
                onChange={(e) => e.target.files && handleFileEntry(e.target.files[0])}
            />
            
            {isProcessing ? (
                <div className="flex flex-col items-center animate-pulse">
                    <svg className="w-10 h-10 text-blue-400 mb-2 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-slate-300 font-medium">{loadingStatus}</span>
                </div>
            ) : (
                <>
                    <div className="flex gap-4 mb-2">
                        <span className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded text-xs">PDF / Images</span>
                        <span className="bg-purple-900/50 text-purple-200 px-2 py-1 rounded text-xs">3D (GLB)</span>
                        <span className="bg-green-900/50 text-green-200 px-2 py-1 rounded text-xs">Excel / CSV</span>
                    </div>
                    <p className="text-slate-300 font-medium text-lg">拖拽文件或 ZIP 包到此处</p>
                </>
            )}
        </div>

      </div>
    </div>
  );
};

export default WelcomeScreen;