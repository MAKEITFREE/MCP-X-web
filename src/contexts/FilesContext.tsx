import React, { createContext, useContext, useState, ReactNode } from 'react';

// 文件信息类型
export interface FileInfo {
  uid: string;
  name: string;
  fileSize: number;
  file: File;
  url: string;
  type: string;
}

// 文件上下文类型
interface FilesContextType {
  filesList: FileInfo[];
  setFilesList: (files: FileInfo[]) => void;
  addFiles: (files: FileInfo[]) => void;
  removeFile: (uid: string) => void;
  clearFiles: () => void;
}

// 创建上下文
const FilesContext = createContext<FilesContextType | undefined>(undefined);

// FilesProvider组件
export const FilesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filesList, setFilesList] = useState<FileInfo[]>([]);

  const addFiles = (files: FileInfo[]) => {
    setFilesList(prev => [...prev, ...files]);
  };

  const removeFile = (uid: string) => {
    setFilesList(prev => prev.filter(file => file.uid !== uid));
  };

  const clearFiles = () => {
    setFilesList([]);
  };

  return (
    <FilesContext.Provider value={{
      filesList,
      setFilesList,
      addFiles,
      removeFile,
      clearFiles
    }}>
      {children}
    </FilesContext.Provider>
  );
};

// 使用文件上下文的Hook
export const useFiles = () => {
  const context = useContext(FilesContext);
  if (context === undefined) {
    throw new Error('useFiles must be used within a FilesProvider');
  }
  return context;
}; 