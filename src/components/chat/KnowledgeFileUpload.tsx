import React, { useState, useRef } from 'react';
import { knowledgeApi } from '../../services/knowledgeApi';
import { toast } from '../../utils/toast';

interface KnowledgeFileUploadProps {
  // 注意：这里的 id 对应后端的知识库主键字段
  id: string | number;
  onUploadSuccess?: () => void; // 上传成功回调
  disabled?: boolean;
}

export const KnowledgeFileUpload: React.FC<KnowledgeFileUploadProps> = ({
  id,
  onUploadSuccess,
  disabled = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 支持的文件类型
  const supportedTypes = [
    '.txt', '.md', '.pdf', '.doc', '.docx', 
    '.xls', '.xlsx', '.ppt', '.pptx', '.csv'
  ];

  const handleFileSelect = (files: File[]) => {
    if (files.length === 0) return;

    // 检查文件类型
    const validFiles = files.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return supportedTypes.includes(extension);
    });

    if (validFiles.length === 0) {
      toast.error('请选择支持的文件格式: ' + supportedTypes.join(', '));
      return;
    }

    if (validFiles.length !== files.length) {
      toast.warning('部分文件格式不支持，已过滤');
    }

    uploadFiles(validFiles);
  };

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    try {
      const uploadPromises = files.map(file => 
        knowledgeApi.uploadAttach(file, id)
      );
      
      const results = await Promise.allSettled(uploadPromises);
      
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.code === 200) {
          successCount++;
        } else {
          errorCount++;
          console.error(`文件 ${files[index].name} 上传失败:`, result);
        }
      });

      if (successCount > 0) {
        toast.success(`成功上传 ${successCount} 个文件`);
        onUploadSuccess?.();
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} 个文件上传失败`);
      }
    } catch (error: any) {
      console.error('批量上传失败:', error);
      toast.error('文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFileSelect(files);
    // 清空input值，允许重复选择同一个文件
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (disabled || uploading) return;
    
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="w-full">
      {/* 文件上传区域 */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled || uploading 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-gray-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={supportedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled || uploading}
        />

        <div className="flex flex-col items-center space-y-2">
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600">正在上传文件...</p>
            </>
          ) : (
            <>
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-blue-600">点击上传</span> 或拖拽文件到此区域
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  支持格式: {supportedTypes.join(', ')}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 上传提示 */}
      <div className="mt-3 text-xs text-gray-500">
        <p>• 支持多文件同时上传</p>
        <p>• 文件上传后将自动解析为知识片段</p>
        <p>• 建议单个文件大小不超过10MB</p>
      </div>
    </div>
  );
};
