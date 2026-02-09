import React, { useRef } from 'react';
import { Paperclip } from 'lucide-react';
import { useFiles } from '../../contexts/FilesContext';
import { toast } from '../../utils/toast';

// 文件上传组件
export const FileUpload: React.FC = () => {
  const { addFiles } = useFiles();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: any[] = [];
    const maxSize = 50 * 1024 * 1024; // 50MB限制

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.size > maxSize) {
        toast.error(`文件 ${file.name} 超过50MB限制`);
        continue;
      }

      const fileInfo = {
        uid: crypto.randomUUID(),
        name: file.name,
        fileSize: file.size,
        file,
        url: URL.createObjectURL(file),
        type: file.type
      };

      newFiles.push(fileInfo);
    }

    if (newFiles.length > 0) {
      addFiles(newFiles);
      toast.success(`成功添加 ${newFiles.length} 个文件`);
    }

    // 清空input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative">
      {/* 文件选择按钮 */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
        title="上传文件"
      >
        <Paperclip className="w-4 h-4" />
      </button>

      {/* 文件输入框 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,application/*,.pdf,.doc,.docx,.txt,.md"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}; 