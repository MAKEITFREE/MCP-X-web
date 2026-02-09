import React, { useState } from 'react';

export interface PromptBarProps {
    t: (key: string, ...args: any[]) => string;
    onGenerateImage: (prompt: string) => void;
    onEditImage: (prompt: string) => void;
    onClose: () => void;
    selectedImagesCount: number;
    isGenerating: boolean;
}

export const PromptBar: React.FC<PromptBarProps> = ({
    t,
    onGenerateImage,
    onEditImage,
    onClose,
    selectedImagesCount,
    isGenerating,
}) => {
    const [prompt, setPrompt] = useState('');
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [prompt]);
    
    const isEditMode = selectedImagesCount > 0;
    
    const getPlaceholderText = () => {
        if (isEditMode) {
            return selectedImagesCount === 1 
                ? t('promptBar.placeholderSingle') || '描述如何编辑选中的图片...'
                : t('promptBar.placeholderMultiple') || `描述如何编辑选中的 ${selectedImagesCount} 张图片...`;
        }
        return t('promptBar.placeholderDefault') || '描述你想生成的图片...';
    };
    
    const handleSubmit = () => {
        if (!prompt.trim() || isGenerating) return;
        
        if (isEditMode) {
            onEditImage(prompt);
        } else {
            onGenerateImage(prompt);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    const containerStyle: React.CSSProperties = {
        backgroundColor: `var(--ui-bg-color, rgba(31, 41, 55, 0.95))`,
    };

    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4">
            <div 
                style={containerStyle}
                className="flex flex-col gap-2 p-3 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
            >
                {/* 选中图片提示 */}
                {isEditMode && (
                    <div className="flex items-center gap-2 px-2">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                            已选中 {selectedImagesCount} 张图片 - 将进行图片编辑
                        </span>
                    </div>
                )}
                
                <div className="flex items-center gap-2">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={getPlaceholderText()}
                        className="flex-grow bg-transparent text-white placeholder-neutral-400 focus:outline-none px-3 py-2 resize-none overflow-hidden max-h-32"
                        disabled={isGenerating}
                        autoFocus
                    />
                    
                    {/* 关闭按钮 */}
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-neutral-400 rounded-full hover:bg-neutral-600 hover:text-white transition-colors duration-200"
                        title="关闭"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    
                    {/* 提交按钮 */}
                    <button
                        onClick={handleSubmit}
                        disabled={isGenerating || !prompt.trim()}
                        aria-label={isEditMode ? '编辑' : '生成'}
                        title={isEditMode ? '编辑图片' : '生成图片'}
                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all duration-200"
                        style={{ backgroundColor: isEditMode ? '#3b82f6' : 'var(--button-bg-color, #6366f1)' }}
                    >
                        {isGenerating ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14"/>
                                <path d="m12 5 7 7-7 7"/>
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
