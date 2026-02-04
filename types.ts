export interface MaskRect {
  id: string;
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  w: number; // Normalized 0-1
  h: number; // Normalized 0-1
  type: 'manual' | 'ai';
  label?: string;
}

export type FileType = 'image' | '3d' | 'table';

export interface ProjectFile {
  id: string;
  name: string;
  blob: Blob; // The raw file blob
  url: string; // The object URL for display
  type: FileType;
  masks: MaskRect[]; // Masks specific to this file (only applies to images)
  auditResult?: string | null; // Audit result
  status: 'pending' | 'processed';
  // Optional extra data for specific types
  parsedTableData?: any[][]; // For Excel/CSV
}

export interface ImageSize {
  width: number;
  height: number;
}

export enum ToolMode {
  PAN = 'PAN',
  DRAW = 'DRAW',
}

export enum AppMode {
  WELCOME = 'WELCOME',
  DESENSITIZE = 'DESENSITIZE',
  AUDIT = 'AUDIT',
}

export interface AiDetectionResult {
  box_2d: [number, number, number, number]; 
  label: string;
}