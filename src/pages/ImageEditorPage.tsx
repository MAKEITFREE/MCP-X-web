import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Video, Loader2, X, Clock, Maximize2, Play } from 'lucide-react';
import { Toolbar } from '../components/image-editor/Toolbar';
import { PromptBar } from '../components/image-editor/PromptBar';
import { Loader } from '../components/image-editor/Loader';
import { CanvasSettings } from '../components/image-editor/CanvasSettings';
import { LayerPanel } from '../components/image-editor/LayerPanel';
import { BoardPanel } from '../components/image-editor/BoardPanel';
import { QuickPrompts } from '../components/image-editor/QuickPrompts';
import type { Tool, Point, Element, ImageElement, PathElement, ShapeElement, TextElement, ArrowElement, UserEffect, LineElement, WheelAction, GroupElement, Board, VideoElement } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { editImage, generateImageFromText, fetchImageAsBase64 } from '../services/imageApi';
import { modelApi, ModelInfo } from '../services/modelApi';
import { chatApi } from '../services/chatApi';
import { generateVideo } from '../services/videogenService';
import { fileToDataUrl } from '../utils/fileUtils';
import { translations } from '../i18n/translations';
import { toast } from '../utils/toast';

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getElementBounds = (element: Element, allElements: Element[] = []): { x: number; y: number; width: number; height: number } => {
  if (element.type === 'group') {
    const children = allElements.filter(el => el.parentId === element.id);
    if (children.length === 0) {
      return { x: element.x, y: element.y, width: element.width, height: element.height };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    children.forEach(child => {
      const bounds = getElementBounds(child, allElements);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (element.type === 'image' || element.type === 'video' || element.type === 'shape' || element.type === 'text') {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  if (element.type === 'arrow' || element.type === 'line') {
    const { points } = element;
    const minX = Math.min(points[0].x, points[1].x);
    const maxX = Math.max(points[0].x, points[1].x);
    const minY = Math.min(points[0].y, points[1].y);
    const maxY = Math.max(points[0].y, points[1].y);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  // path element
  if (element.type === 'path') {
    const { points } = element;
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

// 测量文字尺寸
const measureTextSize = (text: string, fontSize: number, fontFamily: string, fontWeight: string): { width: number; height: number } => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { width: 200, height: fontSize * 1.2 };
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text || ' ');
  return {
    width: Math.max(metrics.width + 20, 50), // 最小宽度50，加20像素padding
    height: fontSize * 1.5 // 行高1.5倍
  };
};

// 检查点是否在任何图片或视频元素上
const isPointOnImage = (point: Point, elements: Element[]): ImageElement | VideoElement | null => {
  const imageAndVideoElements = elements.filter(el => el.type === 'image' || el.type === 'video') as (ImageElement | VideoElement)[];
  return imageAndVideoElements.reverse().find(el => {
    return point.x >= el.x && point.x <= el.x + el.width &&
      point.y >= el.y && point.y <= el.y + el.height;
  }) || null;
};

type Rect = { x: number; y: number; width: number; height: number };
type Guide = { type: 'v' | 'h'; position: number; start: number; end: number };
const SNAP_THRESHOLD = 5; // pixels in screen space

// Ray-casting algorithm to check if a point is inside a polygon
const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
};

const rasterizeElement = (element: Exclude<Element, ImageElement>): Promise<{ href: string; mimeType: 'image/png' }> => {
  return new Promise((resolve, reject) => {
    const bounds = getElementBounds(element);
    if (bounds.width <= 0 || bounds.height <= 0) {
      return reject(new Error('Cannot rasterize an element with zero or negative dimensions.'));
    }

    const padding = 10;
    const svgWidth = bounds.width + padding * 2;
    const svgHeight = bounds.height + padding * 2;

    const offsetX = -bounds.x + padding;
    const offsetY = -bounds.y + padding;

    let elementSvgString = '';

    switch (element.type) {
      case 'path': {
        const pointsWithOffset = element.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
        const pathData = pointsWithOffset.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        elementSvgString = `<path d="${pathData}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${element.strokeOpacity || 1}" />`;
        break;
      }
      case 'shape': {
        const shapeProps = `transform="translate(${element.x + offsetX}, ${element.y + offsetY})" fill="${element.fillColor}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth}"`;
        if (element.shapeType === 'rectangle') elementSvgString = `<rect width="${element.width}" height="${element.height}" rx="${element.borderRadius || 0}" ry="${element.borderRadius || 0}" ${shapeProps} />`;
        else if (element.shapeType === 'ellipse') elementSvgString = `<ellipse cx="${element.width / 2}" cy="${element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" ${shapeProps} />`;
        else if (element.shapeType === 'triangle') elementSvgString = `<polygon points="${element.width / 2},0 ${element.width}, ${element.height} 0,${element.height}" ${shapeProps} />`;
        break;
      }
      case 'text': {
        elementSvgString = `<text x="${element.x + offsetX}" y="${element.y + offsetY + element.fontSize}" fill="${element.fillColor}" font-family="${element.fontFamily}" font-size="${element.fontSize}" font-weight="${element.fontWeight}" text-anchor="start">${element.text}</text>`;
        break;
      }
      case 'arrow': {
        const { points } = element;
        const start = points[0], end = points[1];
        const dx = end.x - start.x, dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);
        const headLength = Math.min(20, length / 3);
        const headWidth = headLength * 0.5;

        // Calculate arrowhead points
        const headX = start.x + offsetX + Math.cos(angle) * (length - headLength);
        const headY = start.y + offsetY + Math.sin(angle) * (length - headLength);
        const leftX = headX + Math.cos(angle - Math.PI / 6) * headLength;
        const leftY = headY + Math.sin(angle - Math.PI / 6) * headLength;
        const rightX = headX + Math.cos(angle + Math.PI / 6) * headLength;
        const rightY = headY + Math.sin(angle + Math.PI / 6) * headLength;

        elementSvgString = `<line x1="${start.x + offsetX}" y1="${start.y + offsetY}" x2="${headX}" y2="${headY}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth}" marker-end="url(#arrowhead)" />`;
        elementSvgString += `<polygon points="${headX},${headY} ${leftX},${leftY} ${rightX},${rightY}" fill="${element.strokeColor}" />`;
        break;
      }
      case 'line': {
        const { points } = element;
        const start = points[0], end = points[1];
        elementSvgString = `<line x1="${start.x + offsetX}" y1="${start.y + offsetY}" x2="${end.x + offsetX}" y2="${end.y + offsetY}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth}" />`;
        break;
      }
    }

    const svgString = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">${elementSvgString}</svg>`;

    const canvas = document.createElement('canvas');
    canvas.width = svgWidth;
    canvas.height = svgHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Failed to get canvas context'));

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Failed to create blob'));
        const reader = new FileReader();
        reader.onload = () => resolve({ href: reader.result as string, mimeType: 'image/png' });
        reader.readAsDataURL(blob);
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load SVG image'));
    img.src = `data:image/svg+xml;base64,${btoa(svgString)}`;
  });
};

const drawElement = (ctx: CanvasRenderingContext2D, element: Element, offsetX: number = 0, offsetY: number = 0) => {
  if (!element.visible) return;

  ctx.save();
  ctx.translate(-offsetX, -offsetY);

  switch (element.type) {
    case 'image': {
      if (element.image) {
        const borderRadius = (element as any).borderRadius || 0;
        if (borderRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(element.x, element.y, element.width, element.height, borderRadius);
          ctx.clip();
        }
        ctx.drawImage(element.image, element.x, element.y, element.width, element.height);
      }
      break;
    }
    case 'video': {
      // 绘制视频元素
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      
      // 检查 video 是否是真正的 HTMLVideoElement
      const isValidVideoElement = element.video && 
        typeof (element.video as HTMLVideoElement).play === 'function';
      
      if (isValidVideoElement && element.videoUrl) {
        const videoObj = element.video as HTMLVideoElement;
        // 如果有视频对象，绘制视频当前帧
        try {
          ctx.drawImage(videoObj, element.x, element.y, element.width, element.height);
        } catch (e) {
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(element.x, element.y, element.width, element.height);
        }
        
        // 绘制边框
        ctx.strokeStyle = element.isPlaying ? '#10b981' : '#6b7280';
        ctx.lineWidth = 2;
        ctx.strokeRect(element.x, element.y, element.width, element.height);
        
        // 左上角视频标识
        ctx.fillStyle = element.isPlaying ? '#10b981' : '#6b7280';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('▶ 视频', element.x + 8, element.y + 18);
        
      } else if (element.videoUrl) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(element.x, element.y, element.width, element.height);
        ctx.fillStyle = '#10b981';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('点击播放按钮加载', centerX, centerY);
        ctx.textAlign = 'left';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(element.x, element.y, element.width, element.height);
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(element.x, element.y, element.width, element.height);
        
        const radius = Math.min(element.width, element.height) * 0.1;
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 1.5);
        ctx.stroke();
        
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.strokeRect(element.x, element.y, element.width, element.height);
        
        ctx.fillStyle = '#6366f1';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('视频生成中...', centerX, centerY + radius + 25);
        ctx.textAlign = 'left';
      }
      
      break;
    }
    case 'path': {
      ctx.strokeStyle = element.strokeColor;
      ctx.lineWidth = element.strokeWidth;
      ctx.globalAlpha = element.strokeOpacity || 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (element.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) {
          ctx.lineTo(element.points[i].x, element.points[i].y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'shape': {
      ctx.fillStyle = element.fillColor;
      ctx.strokeStyle = element.strokeColor;
      ctx.lineWidth = element.strokeWidth;

      if (element.shapeType === 'rectangle') {
        ctx.beginPath();
        ctx.roundRect(element.x, element.y, element.width, element.height, element.borderRadius || 0);
        if (element.fillColor !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
      } else if (element.shapeType === 'ellipse') {
        const rx = Math.abs(element.width / 2);
        const ry = Math.abs(element.height / 2);
        if (rx > 0 && ry > 0) {
          ctx.beginPath();
          ctx.ellipse(
            element.x + element.width / 2,
            element.y + element.height / 2,
            rx, ry, 0, 0, Math.PI * 2
          );
          if (element.fillColor !== 'transparent') {
            ctx.fill();
          }
          ctx.stroke();
        }
      } else if (element.shapeType === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(element.x + element.width / 2, element.y);
        ctx.lineTo(element.x + element.width, element.y + element.height);
        ctx.lineTo(element.x, element.y + element.height);
        ctx.closePath();
        if (element.fillColor !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
      }
      break;
    }
    case 'text': {
      ctx.fillStyle = (element as any).fillColor || '#000000';
      ctx.font = `${(element as any).fontWeight || 'normal'} ${(element as any).fontSize}px ${(element as any).fontFamily || 'Arial'}`;
      ctx.fillText((element as any).text, element.x, element.y + (element as any).fontSize);
      break;
    }
    case 'arrow': {
      const { points } = element;
      const start = points[0], end = points[1];
      const dx = end.x - start.x, dy = end.y - start.y;
      const angle = Math.atan2(dy, dx);
      const length = Math.sqrt(dx * dx + dy * dy);
      const headLength = Math.min(20, length / 3);

      ctx.strokeStyle = element.strokeColor;
      ctx.fillStyle = element.strokeColor;
      ctx.lineWidth = element.strokeWidth;

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x - Math.cos(angle) * headLength, end.y - Math.sin(angle) * headLength);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle - Math.PI / 6),
        end.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        end.x - headLength * Math.cos(angle + Math.PI / 6),
        end.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'line': {
      const { points } = element;
      ctx.strokeStyle = element.strokeColor;
      ctx.lineWidth = element.strokeWidth;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
};

const ImageEditorPage: React.FC = () => {
  const { currentLanguage, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // 支持嵌套键的翻译函数，如 'toolbar.undo'
  // 注意：LanguageContext使用'zh'，但translations.ts使用'zho'
  const t = (key: string): any => {
    // 将'zh'映射到'zho'
    const langMap: Record<string, string> = { 'zh': 'zho', 'en': 'en' };
    const lang = (langMap[currentLanguage] || currentLanguage) as keyof typeof translations;
    const keys = key.split('.');
    let value: any = translations[lang];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // 找不到翻译，返回原始key
      }
    }

    return value !== undefined ? value : key;
  };

  const [boards, setBoards] = useState<Board[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string>('');
  const [elements, setElements] = useState<Element[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  // localStorage 缓存 key
  const BOARDS_CACHE_KEY = 'imageEditor_boards_cache';
  const CURRENT_BOARD_KEY = 'imageEditor_currentBoardId';

  // 保存 boards 到 localStorage（排除 image 对象，只保存 href）
  const saveBoardsToCache = useCallback((boardsToSave: Board[]) => {
    try {
      const serializedBoards = boardsToSave.map(board => ({
        ...board,
        elements: board.elements.map(el => ({
          ...el,
          image: undefined // 排除 Image 对象，无法序列化
        }))
      }));
      localStorage.setItem(BOARDS_CACHE_KEY, JSON.stringify(serializedBoards));
      console.log('Boards 已缓存到 localStorage');
    } catch (error) {
      console.error('保存 boards 缓存失败:', error);
    }
  }, []);

  // 从 localStorage 加载 boards 缓存
  const loadBoardsFromCache = useCallback((): Board[] | null => {
    try {
      const cached = localStorage.getItem(BOARDS_CACHE_KEY);
      if (cached) {
        const parsedBoards = JSON.parse(cached) as Board[];
        console.log('从 localStorage 加载了', parsedBoards.length, '个画板缓存');
        return parsedBoards;
      }
    } catch (error) {
      console.error('加载 boards 缓存失败:', error);
    }
    return null;
  }, []);

  // 保存当前 boardId 到 localStorage
  const saveCurrentBoardIdToCache = useCallback((boardId: string) => {
    try {
      localStorage.setItem(CURRENT_BOARD_KEY, boardId);
    } catch (error) {
      console.error('保存 currentBoardId 缓存失败:', error);
    }
  }, []);

  // 从 localStorage 加载当前 boardId
  const loadCurrentBoardIdFromCache = useCallback((): string | null => {
    try {
      return localStorage.getItem(CURRENT_BOARD_KEY);
    } catch (error) {
      console.error('加载 currentBoardId 缓存失败:', error);
    }
    return null;
  }, []);

  // 从聊天记录中解析图片元素（只解析 AI 返回的图片）
  const parseImagesFromMessages = useCallback(async (messages: any[]): Promise<ImageElement[]> => {
    const imageElements: ImageElement[] = [];
    let positionOffset = 0;

    for (const msg of messages) {
      // 只处理 AI 返回的消息
      if (msg.role === 'assistant' && msg.content) {
        const content = msg.content;
        const imageUrls: string[] = [];

        // 1. 解析 <images> 标签中的图片URL
        const imagesTagMatches = content.matchAll(/<images>(.*?)<\/images>/gs);
        for (const match of imagesTagMatches) {
          const url = match[1]?.trim();
          if (url && (url.startsWith('http') || url.startsWith('data:'))) {
            imageUrls.push(url);
          }
        }

        // 2. 解析直接的图片 URL（http/https 开头，以常见图片扩展名结尾）
        const urlMatches = content.matchAll(/(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|bmp))/gi);
        for (const match of urlMatches) {
          const url = match[1];
          if (url && !imageUrls.includes(url)) {
            imageUrls.push(url);
          }
        }

        // 3. 解析 base64 图片
        const base64Matches = content.matchAll(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/g);
        for (const match of base64Matches) {
          const url = match[1];
          if (url && !imageUrls.includes(url)) {
            imageUrls.push(url);
          }
        }

        // 加载所有找到的图片
        for (const imageUrl of imageUrls) {
          try {
            // 加载图片获取尺寸（直接使用 Image 对象，避免 CORS 问题）
            const img = new Image();
            // 对于外部 URL，不设置 crossOrigin 以避免 CORS 错误
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('图片加载失败'));
              img.src = imageUrl;
            });

            // 限制图片显示尺寸，避免过大
            const maxDisplaySize = 800;
            let displayWidth = img.width;
            let displayHeight = img.height;
            
            if (img.width > maxDisplaySize || img.height > maxDisplaySize) {
              const scale = Math.min(maxDisplaySize / img.width, maxDisplaySize / img.height);
              displayWidth = img.width * scale;
              displayHeight = img.height * scale;
            }

            // 计算图片位置，避免重叠 - 横向排布5张图片
            const columnsPerRow = 5;
            const row = Math.floor(positionOffset / columnsPerRow);
            const col = positionOffset % columnsPerRow;
            const spacing = 100; // 图片之间的间距
            const x = 200 + col * (displayWidth + spacing);
            const y = 200 + row * (displayHeight + spacing);

            imageElements.push({
              id: generateId(),
              type: 'image',
              x: x,
              y: y,
              width: displayWidth,
              height: displayHeight,
              href: imageUrl, // 保存原始 URL
              mimeType: 'image/png',
              image: img,
              visible: true,
              locked: false
            });

            positionOffset++;
          } catch (error) {
            console.error('加载图片失败:', imageUrl, error);
          }
        }
      }
    }

    return imageElements;
  }, []);

  // 加载 session 的聊天记录并解析图片
  const loadSessionImages = useCallback(async (sessionId: string): Promise<ImageElement[]> => {
    const userId = localStorage.getItem('userId');
    if (!userId) return [];

    try {
      const response = await chatApi.getChatList({ sessionId, userId });
      if (response.code === 200 && response.rows) {
        console.log('加载session聊天记录成功, 消息数:', response.rows.length);
        return await parseImagesFromMessages(response.rows);
      }
    } catch (error) {
      console.error('加载session聊天记录失败:', error);
    }
    return [];
  }, [parseImagesFromMessages]);

  // 为 Board 创建 session
  const createSessionForBoard = useCallback(async (boardId: string, boardName: string): Promise<string | undefined> => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.error('用户未登录，无法创建session');
      return undefined;
    }

    try {
      const response = await chatApi.createSession({
        userId: userId,
        sessionContent: `Image Studio - ${boardName}`,
        sessionTitle: boardName,
        remark: 'imagestudio',
        appId: 'mcpx-text2image'
      });

      if (response.code === 200 && response.data) {
        const sessionId = response.data.id || response.data;
        console.log('创建session成功:', sessionId);
        return sessionId;
      }
    } catch (error) {
      console.error('创建session失败:', error);
    }
    return undefined;
  }, []);

  // 切换Board时，保存当前Board的elements并加载新Board的elements
  const switchBoard = useCallback(async (newBoardId: string) => {
    // 先保存当前Board的elements
    setBoards(prev => {
      const updated = prev.map(b =>
        b.id === currentBoardId ? { ...b, elements: elements } : b
      );
      // 保存到缓存
      saveBoardsToCache(updated);
      return updated;
    });
    // 切换到新Board
    setCurrentBoardId(newBoardId);
    saveCurrentBoardIdToCache(newBoardId);
    // 加载新Board的elements
    const newBoard = boards.find(b => b.id === newBoardId);
    setElements(newBoard ? [...newBoard.elements] : []);
    // 清除选中状态
    setSelectedElementIds([]);

    // 设置当前 sessionId
    if (newBoard?.sessionId) {
      setCurrentSessionId(newBoard.sessionId);
    } else {
      // 如果没有 sessionId，创建一个
      const sessionId = await createSessionForBoard(newBoardId, newBoard?.name || 'Board');
      if (sessionId) {
        setCurrentSessionId(sessionId);
        setBoards(prev => {
          const updated = prev.map(b =>
            b.id === newBoardId ? { ...b, sessionId } : b
          );
          saveBoardsToCache(updated);
          return updated;
        });
      }
    }
  }, [currentBoardId, elements, boards, createSessionForBoard, saveBoardsToCache, saveCurrentBoardIdToCache]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [drawingOptions, setDrawingOptions] = useState({ strokeColor: '#000000', strokeWidth: 20 });
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [showBoardPanel, setShowBoardPanel] = useState(false);
  const [showPromptBar, setShowPromptBar] = useState(false);
  const [userEffects, setUserEffects] = useState<UserEffect[]>(() => {
    // 从 localStorage 加载用户保存的效果
    const saved = localStorage.getItem('imageEditor_userEffects');
    return saved ? JSON.parse(saved) : [];
  });
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [zoom, setZoom] = useState(0.25);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [croppingState, setCroppingState] = useState<{ elementId: string; originalElement: ImageElement; cropBox: Rect } | null>(null);
  const [isCropDragging, setIsCropDragging] = useState(false);
  const [cropDragHandle, setCropDragHandle] = useState<string | null>(null);
  const [cropDragStart, setCropDragStart] = useState<Point>({ x: 0, y: 0 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#111827');
  const [uiTheme, setUiTheme] = useState({ color: '#1f2937', opacity: 0.85 });
  const [buttonTheme, setButtonTheme] = useState({ color: '#374151', opacity: 0.8 });
  const [wheelAction, setWheelAction] = useState<WheelAction>('zoom');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<Point>({ x: 0, y: 0 });
  const [dragElement, setDragElement] = useState<Element | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartPos, setPanStartPos] = useState<Point>({ x: 0, y: 0 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textInputValue, setTextInputValue] = useState<string>('');
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [lastClickElementId, setLastClickElementId] = useState<string | null>(null);
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [shapeStartPos, setShapeStartPos] = useState<Point>({ x: 0, y: 0 });
  const [currentShapeType, setCurrentShapeType] = useState<'rectangle' | 'ellipse' | 'triangle'>('rectangle');
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [lassoPath, setLassoPath] = useState<Point[]>([]);
  const lassoPathRef = useRef<Point[]>([]); // 用于在事件处理中获取最新的套索路径
  const [lassoElementId, setLassoElementId] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [selectedImageSize, setSelectedImageSize] = useState<{ width: number; height: number }>({ width: 1024, height: 1024 });
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [showVipModal, setShowVipModal] = useState(false);

  // 图生视频相关状态
  const [showInlineVideoControls, setShowInlineVideoControls] = useState(false);
  const [videoModels, setVideoModels] = useState<ModelInfo[]>([]);
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>('');
  const [videoResolution, setVideoResolution] = useState<'480P' | '720P' | '1080P'>('720P');
  const [videoRatio, setVideoRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState<{ message: string; current?: number; total?: number } | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const [selectedStartImage, setSelectedStartImage] = useState<ImageElement | null>(null);
  const [selectedEndImage, setSelectedEndImage] = useState<ImageElement | null>(null);

  // 调整大小相关状态
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState<Point>({ x: 0, y: 0 });
  const [resizeStartBounds, setResizeStartBounds] = useState<Rect | null>(null);

  // 新创建的文字元素信息（用于在状态更新前显示输入框）
  const pendingTextElementRef = useRef<TextElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);

  // 监听窗口大小变化，更新画布大小
  useEffect(() => {
    const updateCanvasSize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // 键盘快捷键支持（删除选中元素等）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查焦点是否在输入元素中，如果是则不执行删除操作
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]');

      // Delete  键删除选中元素（仅当不在输入元素中时）
      if ((e.key === 'Delete') && selectedElementIds.length > 0 && !isInputElement) {
        e.preventDefault();
        // 删除所有选中的元素
        setElements(prev => {
          const newElements = prev.filter(el => !selectedElementIds.includes(el.id));
          setTimeout(() => saveToHistory(newElements), 0);
          return newElements;
        });
        setSelectedElementIds([]);
        return;
      }

      // Ctrl+A 全选（只选择图片元素，不在输入元素中时有效）
      if (e.ctrlKey && e.key === 'a' && !isInputElement) {
        e.preventDefault();
        const imageIds = elements
          .filter(el => el.type === 'image')
          .map(el => el.id);
        setSelectedElementIds(imageIds);
        return;
      }

      // Escape 键取消选择（不在输入元素中时有效）
      if (e.key === 'Escape' && !isInputElement) {
        setSelectedElementIds([]);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, elements]);

  // 点击外部关闭模型下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModelDropdown]);

  // 当图片取消选中时，关闭图生视频弹框
  useEffect(() => {
    if (showInlineVideoControls && selectedStartImage) {
      // 检查起始图片是否还在选中列表中
      const isStillSelected = selectedElementIds.includes(selectedStartImage.id);
      if (!isStillSelected) {
        // 图片已取消选中，先保存当前的 videoPrompt 到图片元素
        if (videoPrompt) {
          setElements(prev => prev.map(el => 
            el.id === selectedStartImage.id && el.type === 'image'
              ? { ...el, videoPrompt: videoPrompt } as ImageElement
              : el
          ));
        }
        // 关闭弹框
        setShowInlineVideoControls(false);
        setSelectedStartImage(null);
        setSelectedEndImage(null);
        setVideoProgress(null);
        // 不清空 videoPrompt，因为已经保存到图片元素了
      }
    }
  }, [selectedElementIds, showInlineVideoControls, selectedStartImage, videoPrompt]);

  const currentBoard = boards.find(b => b.id === currentBoardId);
  // 使用 elements 状态作为当前元素，而不是从 boards 中获取
  // 这样可以确保拖动等操作使用的是最新的元素状态
  const currentElements = elements;

  // 获取当前选中的模型信息
  const selectedModelInfo = models.find(m => m.id === selectedModel);

  // Add zoom and pan state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: canvasSize.width, height: canvasSize.height });

  // History for undo/redo - 使用 ref 来避免不必要的重渲染
  const [history, setHistory] = useState<Element[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoAction = useRef(false);
  const lastSavedElements = useRef<string>('[]');

  // 保存历史记录的函数
  const saveToHistory = useCallback((newElements: Element[]) => {
    const serialized = JSON.stringify(newElements.map(el => ({ ...el, image: undefined })));
    // 如果内容没有变化，不保存
    if (serialized === lastSavedElements.current) return;
    lastSavedElements.current = serialized;

    setHistory(prev => {
      // 如果当前不在历史末尾，删除后面的历史
      const newHistory = prev.slice(0, historyIndex + 1);
      // 添加新状态，限制历史记录最多50条
      const updatedHistory = [...newHistory, JSON.parse(JSON.stringify(newElements.map(el => ({ ...el, image: undefined }))))];
      if (updatedHistory.length > 50) {
        updatedHistory.shift();
        return updatedHistory;
      }
      return updatedHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // 获取模型列表
  const loadModels = useCallback(async () => {
    try {
      const response = await modelApi.getModelList();
      if (response.code === 200 && response.data) {
        const imageModels = response.data.filter((model: ModelInfo) =>
          model.category === 'text2image'
        );
        setModels(imageModels);
        if (imageModels.length > 0 && !selectedModel) {
          setSelectedModel(imageModels[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }, [selectedModel]);

  // 获取视频模型列表
  const loadVideoModels = useCallback(async () => {
    try {
      const response = await modelApi.getModelList();
      if (response.code === 200 && response.data) {
        const vidModels = response.data.filter((model: ModelInfo) =>
          model.category === 'text2video'
        );
        setVideoModels(vidModels);
        if (vidModels.length > 0 && !selectedVideoModel) {
          setSelectedVideoModel(vidModels[0].modelName);
        }
      }
    } catch (error) {
      console.error('Failed to load video models:', error);
    }
  }, [selectedVideoModel]);

  // 用户效果管理
  const handleAddUserEffect = useCallback((effect: UserEffect) => {
    setUserEffects(prev => {
      const newEffects = [...prev, effect];
      localStorage.setItem('imageEditor_userEffects', JSON.stringify(newEffects));
      return newEffects;
    });
    toast.success('效果已保存');
  }, []);

  const handleDeleteUserEffect = useCallback((id: string) => {
    setUserEffects(prev => {
      const newEffects = prev.filter(e => e.id !== id);
      localStorage.setItem('imageEditor_userEffects', JSON.stringify(newEffects));
      return newEffects;
    });
  }, []);

  // 升级VIP点击处理 - 跳转到定价页面
  const handleRechargeClick = useCallback(() => {
    navigate('/pricing');
  }, [navigate]);

  // 检查用户是否有权限去掉水印
  const canRemoveWatermark = useCallback(() => {
    const userPlan = localStorage.getItem('userPlan');
    return userPlan && userPlan.toLowerCase() !== 'free';
  }, []);

  // 水印切换处理
  const handleWatermarkToggle = useCallback(() => {
    const canRemove = canRemoveWatermark();
    if (!canRemove && watermarkEnabled) {
      // 如果用户是免费用户且水印当前开启，则提示升级
      toast.error('免费用户无法关闭水印，请升级VIP套餐');
      navigate('/pricing');
      return;
    }
    setWatermarkEnabled(!watermarkEnabled);
  }, [canRemoveWatermark, watermarkEnabled, navigate]);

  // Add effect to sync elements with history (removed auto-sync to boards to prevent overwriting)
  // Board syncing is now handled explicitly in switchBoard function

  // 当 elements 变化时，更新当前 board 的缓存（防抖处理）
  useEffect(() => {
    if (!isInitialized || !currentBoardId) return;

    // 使用防抖，避免频繁写入 localStorage
    const timeoutId = setTimeout(() => {
      setBoards(prev => {
        const updated = prev.map(b =>
          b.id === currentBoardId ? { ...b, elements: elements } : b
        );
        saveBoardsToCache(updated);
        return updated;
      });
    }, 1000); // 1秒防抖

    return () => clearTimeout(timeoutId);
  }, [elements, currentBoardId, isInitialized, saveBoardsToCache]);

  // Handle wheel for zooming
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.01, Math.min(5, prev * delta)));
  };

  // Add wheel event listener for zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  // 加载模型列表
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // 加载视频模型列表
  useEffect(() => {
    loadVideoModels();
  }, [loadVideoModels]);

  // 自动提交功能 - 从 CreatorHubPage 跳转过来时自动生成图片
  useEffect(() => {
    const state = location.state as any;
    if (state?.autoSubmit && isInitialized && models.length > 0) {
      // 清除 autoSubmit 标记，避免重复触发
      navigate(location.pathname, { replace: true, state: { ...state, autoSubmit: false } });

      // 处理上传的图片
      if (state.uploadedImages && state.uploadedImages.length > 0) {
        // 加载上传的图片到画布
        const loadImages = async () => {
          for (const file of state.uploadedImages) {
            await handleFileUpload(file);
          }
          
          // 如果有提示词且有选中的图片，执行图片编辑
          if (state.initialPrompt?.trim() && selectedElementIds.length > 0) {
            setTimeout(() => {
              handleEditImage(state.initialPrompt);
            }, 500);
          }
        };
        loadImages();
      } else if (state.initialPrompt?.trim()) {
        // 只有提示词，执行文生图
        setTimeout(() => {
          handleGenerateImage(state.initialPrompt);
        }, 300);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, isInitialized, models.length]);

  // 检查用户登录状态并初始化 Boards（优先从缓存加载，否则从后端加载 sessions）
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    if (!userId || !token) {
      toast.error('请先登录后再使用图片编辑功能');
      // 延迟跳转到登录页面
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }

    // 恢复图片元素的 Image 对象
    const restoreBoardImages = async (boardsData: Board[]): Promise<Board[]> => {
      const restoredBoards: Board[] = [];
      for (const board of boardsData) {
        const restoredElements = await Promise.all(board.elements.map(async (el) => {
          if (el.type === 'image' && el.href && !el.image) {
            return new Promise<Element>((resolve) => {
              const img = new Image();
              img.onload = () => resolve({ ...el, image: img });
              img.onerror = () => resolve(el);
              img.src = el.href || '';
            });
          }
          return el;
        }));
        restoredBoards.push({ ...board, elements: restoredElements });
      }
      return restoredBoards;
    };

    // 初始化 Boards
    const initBoards = async () => {
      // 1. 优先从 localStorage 缓存加载并立即显示
      const cachedBoards = loadBoardsFromCache();
      const cachedCurrentBoardId = loadCurrentBoardIdFromCache();

      if (cachedBoards && cachedBoards.length > 0) {
        console.log('✅ 使用 localStorage 缓存的画板数据，立即显示');
        // 恢复图片元素的 Image 对象
        const restoredBoards = await restoreBoardImages(cachedBoards);
        setBoards(restoredBoards);

        // 恢复当前选中的 board
        const targetBoardId = cachedCurrentBoardId && restoredBoards.find(b => b.id === cachedCurrentBoardId)
          ? cachedCurrentBoardId
          : restoredBoards[0].id;

        setCurrentBoardId(targetBoardId);
        const targetBoard = restoredBoards.find(b => b.id === targetBoardId);
        setCurrentSessionId(targetBoard?.sessionId);
        setElements(targetBoard ? [...targetBoard.elements] : []);
        setIsInitialized(true);
        
        // 后台静默同步服务端数据（不阻塞UI）
        syncFromServer(restoredBoards);
        return;
      }

      // 2. 缓存不存在，从后端加载 sessions
      console.log('缓存不存在，从后端加载画板数据');
      await loadFromServer();
      setIsInitialized(true);
    };

    // 后台静默同步服务端数据
    const syncFromServer = async (currentBoards: Board[]) => {
      try {
        console.log('🌐 后台同步服务端数据...');
        const response = await chatApi.getSessionList(userId, 'mcpx-text2image');

        if (response.code === 200 && response.rows && response.rows.length > 0) {
          // 检查是否有新的 session 需要添加
          const existingSessionIds = new Set(currentBoards.map(b => b.sessionId).filter(Boolean));
          let hasNewBoards = false;
          
          for (const session of response.rows) {
            const sessionId = session.id?.toString() || session.id;
            if (!existingSessionIds.has(sessionId)) {
              hasNewBoards = true;
              break;
            }
          }
          
          // 只有在有新数据时才更新
          if (hasNewBoards) {
            console.log('📥 发现新的服务端数据，更新画板列表');
            const loadedBoards: Board[] = [];

            for (const session of response.rows) {
              const sessionId = session.id?.toString() || session.id;
              const boardName = session.sessionTitle || `Board ${loadedBoards.length + 1}`;
              
              // 检查本地是否已有该 board
              const existingBoard = currentBoards.find(b => b.sessionId === sessionId);
              if (existingBoard) {
                loadedBoards.push(existingBoard);
              } else {
                // 新的 board，加载图片
                const imageElements = await loadSessionImages(sessionId);
                loadedBoards.push({
                  id: sessionId,
                  name: boardName,
                  elements: imageElements,
                  sessionId: sessionId
                });
              }
            }

            if (loadedBoards.length > 0) {
              setBoards(loadedBoards);
              saveBoardsToCache(loadedBoards);
              console.log('✅ 服务端数据同步完成');
            }
          } else {
            console.log('✅ 本地数据已是最新');
          }
        }
      } catch (error) {
        console.warn('后台同步服务端数据失败，保持本地数据:', error);
        // 失败时不影响已显示的本地数据
      }
    };

    // 从服务端加载数据（无缓存时使用）
    const loadFromServer = async () => {
      try {
        // 根据 appId 查询 sessionList
        const response = await chatApi.getSessionList(userId, 'mcpx-text2image');

        if (response.code === 200 && response.rows && response.rows.length > 0) {
          // 将 sessions 转换为 boards
          const loadedBoards: Board[] = [];

          for (const session of response.rows) {
            const sessionId = session.id?.toString() || session.id;
            const boardName = session.sessionTitle || `Board ${loadedBoards.length + 1}`;

            // 加载该 session 的图片
            const imageElements = await loadSessionImages(sessionId);

            loadedBoards.push({
              id: sessionId, // 使用 sessionId 作为 boardId
              name: boardName,
              elements: imageElements,
              sessionId: sessionId
            });
          }

          if (loadedBoards.length > 0) {
            setBoards(loadedBoards);
            setCurrentBoardId(loadedBoards[0].id);
            setCurrentSessionId(loadedBoards[0].sessionId);
            setElements([...loadedBoards[0].elements]);
            // 保存到缓存
            saveBoardsToCache(loadedBoards);
            saveCurrentBoardIdToCache(loadedBoards[0].id);
            console.log('从后端加载了', loadedBoards.length, '个画板，并已缓存');
          } else {
            // 没有找到任何 session，创建默认的 Main Board
            await createDefaultBoard();
          }
        } else {
          // 没有找到任何 session，创建默认的 Main Board
          await createDefaultBoard();
        }
      } catch (error) {
        console.error('加载sessions失败:', error);
        // 出错时创建默认的 Main Board
        await createDefaultBoard();
      }
    };

    // 创建默认的 Main Board
    const createDefaultBoard = async () => {
      const sessionId = await createSessionForBoard('main', 'Main Board');
      const newBoard: Board = {
        id: sessionId || 'main',
        name: 'Main Board',
        elements: [],
        sessionId: sessionId
      };
      setBoards([newBoard]);
      setCurrentBoardId(newBoard.id);
      setCurrentSessionId(sessionId);
      setElements([]);
      // 保存到缓存
      saveBoardsToCache([newBoard]);
      saveCurrentBoardIdToCache(newBoard.id);
    };

    initBoards();
  }, [createSessionForBoard, loadSessionImages, loadBoardsFromCache, loadCurrentBoardIdFromCache, saveBoardsToCache, saveCurrentBoardIdToCache]);

  // 生成画板缩略图
  const generateBoardThumbnail = useCallback((elements: Element[]): string => {
    // 创建一个小的缩略图画布
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = 120;
    thumbnailCanvas.height = 80;
    const ctx = thumbnailCanvas.getContext('2d');

    if (!ctx) return '';

    // 设置背景
    ctx.fillStyle = 'var(--ui-bg-color, #111827)';
    ctx.fillRect(0, 0, 120, 80);

    // 简单的缩略图：画一些元素的基本形状
    if (elements.length > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;

      elements.slice(0, 5).forEach((element, index) => {
        ctx.save();
        const scale = 120 / canvasSize.width;
        const x = element.x * scale;
        const y = element.y * scale;
        const w = element.width * scale;
        const h = element.height * scale;

        if (element.type === 'image' || element.type === 'shape') {
          ctx.strokeRect(x, y, Math.min(w, 30), Math.min(h, 20));
        } else if (element.type === 'path' || element.type === 'line') {
          ctx.beginPath();
          if (element.points && element.points.length > 0) {
            ctx.moveTo(element.points[0].x * scale, element.points[0].y * scale);
            element.points.slice(1).forEach(point => {
              ctx.lineTo(point.x * scale, point.y * scale);
            });
          }
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    return thumbnailCanvas.toDataURL('image/png');
  }, [canvasSize]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // 恢复图片元素的image对象
  const restoreImageElements = useCallback(async (elements: Element[]): Promise<Element[]> => {
    const restored = await Promise.all(elements.map(async (el) => {
      if (el.type === 'image' && el.href && !el.image) {
        return new Promise<Element>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve({ ...el, image: img });
          img.onerror = () => resolve(el);
          img.src = el.href || '';
        });
      }
      return el;
    }));
    return restored;
  }, []);

  const undo = useCallback(async () => {
    if (canUndo) {
      isUndoRedoAction.current = true;
      const prevElements = history[historyIndex - 1];
      const restored = await restoreImageElements(prevElements);
      setElements(restored);
      setHistoryIndex(prev => prev - 1);
      lastSavedElements.current = JSON.stringify(prevElements);
      setTimeout(() => { isUndoRedoAction.current = false; }, 100);
    }
  }, [canUndo, history, historyIndex, restoreImageElements]);

  const redo = useCallback(async () => {
    if (canRedo) {
      isUndoRedoAction.current = true;
      const nextElements = history[historyIndex + 1];
      const restored = await restoreImageElements(nextElements);
      setElements(restored);
      setHistoryIndex(prev => prev + 1);
      lastSavedElements.current = JSON.stringify(nextElements);
      setTimeout(() => { isUndoRedoAction.current = false; }, 100);
    }
  }, [canRedo, history, historyIndex, restoreImageElements]);

  // Helper function to get mouse position relative to canvas
  const getMousePos = (e: React.MouseEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    // 获取容器的位置
    const container = containerRef.current || canvasRef.current.parentElement;
    if (!container) return { x: 0, y: 0 };
    const containerRect = container.getBoundingClientRect();

    // 鼠标相对于容器的位置
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    // 考虑平移和缩放，计算鼠标在canvas坐标系中的位置
    const canvasX = (mouseX - pan.x) / zoom;
    const canvasY = (mouseY - pan.y) / zoom;

    return { x: canvasX, y: canvasY };
  };

  // Handle mouse down for drawing
  const handleMouseDown = (e: React.MouseEvent) => {
    // 如果正在编辑文字，先保存文字内容
    if (editingTextId) {
      if (textInputValue.trim()) {
        const editingEl = elements.find(el => el.id === editingTextId);
        if (editingEl && editingEl.type === 'text') {
          const size = measureTextSize(textInputValue, editingEl.fontSize, editingEl.fontFamily || 'Arial', editingEl.fontWeight || 'normal');
          setElements(prev => {
            const newElements = prev.map(el =>
              el.id === editingTextId ? { ...el, text: textInputValue, width: size.width, height: size.height } : el
            );
            setTimeout(() => saveToHistory(newElements), 0);
            return newElements;
          });
        }
      } else {
        // 空文字，删除元素
        setElements(prev => {
          const newElements = prev.filter(el => el.id !== editingTextId);
          setTimeout(() => saveToHistory(newElements), 0);
          return newElements;
        });
      }
      setEditingTextId(null);
      setTextInputValue('');
      // 处理完文字编辑后返回，避免状态更新冲突
      return;
    }

    if (activeTool === 'pan') {
      // 使用屏幕坐标进行pan操作
      setIsPanning(true);
      setPanStartPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (activeTool === 'select') {
      const mousePos = getMousePos(e);
      const clickedElement = [...currentElements].reverse().find(el => {
        if (el.locked) return false;
        const bounds = getElementBounds(el, currentElements);
        return mousePos.x >= bounds.x && mousePos.x <= bounds.x + bounds.width &&
          mousePos.y >= bounds.y && mousePos.y <= bounds.y + bounds.height;
      });

      const currentTime = Date.now();

      if (clickedElement) {
        // 视频元素：允许正常选中和拖动，播放通过独立按钮控制
        if (clickedElement.type === 'video') {
          const videoEl = clickedElement as VideoElement;
          // 如果视频还在生成中，提示用户
          if (!videoEl.videoUrl) {
            toast.info('视频正在生成中，请稍候...');
            // 仍然允许选中
          }
          // 如果有URL但没有video对象，尝试加载
          if (videoEl.videoUrl && !videoEl.video) {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.src = videoEl.videoUrl;
            video.preload = 'auto';
            video.muted = false; // 允许播放声音
            
            video.onloadeddata = () => {
              video.currentTime = 0.1; // 跳到第一帧
            };
            
            video.onseeked = () => {
              setElements(prev => prev.map(el => 
                el.id === videoEl.id ? { ...el, video: video, isPlaying: false } as VideoElement : el
              ));
            };
            
            video.onended = () => {
              setElements(prev => prev.map(el => 
                el.id === videoEl.id ? { ...el, isPlaying: false } as VideoElement : el
              ));
            };
            
            video.onerror = () => {
              console.error('视频加载失败');
            };
          }
          // 视频元素可以被选中和拖动，继续执行下面的选中逻辑
        }
        
        // 检查是否是双击文字元素
        if (clickedElement.type === 'text' &&
          clickedElement.id === lastClickElementId &&
          currentTime - lastClickTime < 300) {
          // 双击文字元素，开始编辑
          setEditingTextId(clickedElement.id);
          setTextInputValue(clickedElement.text);
          setLastClickElementId(null);
          setLastClickTime(0);
          return;
        }

        // 支持多选：按住Ctrl键时添加/移除选择，否则替换选择
        const isCtrlPressed = e.ctrlKey || e.metaKey; // 支持Mac的Cmd键
        if (isCtrlPressed) {
          // 多选模式
          setSelectedElementIds(prev => {
            if (prev.includes(clickedElement.id)) {
              // 如果已经选中，移除选择
              return prev.filter(id => id !== clickedElement.id);
            } else {
              // 如果未选中，添加选择
              return [...prev, clickedElement.id];
            }
          });
        } else {
          // 单选模式
          setSelectedElementIds([clickedElement.id]);
        }

        setIsDragging(true);
        setDragStartPos(mousePos);
        setDragElement(clickedElement);
        setLastClickElementId(clickedElement.id);
        setLastClickTime(currentTime);
      } else {
        // 点击空白位置，进入画布拖动模式
        setSelectedElementIds([]);
        setIsDragging(false);
        setDragElement(null);
        setLastClickElementId(null);
        setLastClickTime(0);
        // 开始拖动画布
        setIsPanning(true);
        setPanStartPos({ x: e.clientX, y: e.clientY });
      }
      return;
    }

    if (activeTool === 'crop') {
      // 剪裁工具：如果已经在剪裁状态，处理剪裁框的调整
      if (croppingState) {
        // 点击剪裁框外部取消剪裁
        const mousePos = getMousePos(e);
        const { cropBox } = croppingState;
        if (mousePos.x < cropBox.x || mousePos.x > cropBox.x + cropBox.width ||
          mousePos.y < cropBox.y || mousePos.y > cropBox.y + cropBox.height) {
          // 点击在剪裁框外，不做任何操作
        }
      }
      return;
    }

    if (activeTool === 'text') {
      const mousePos = getMousePos(e);

      // 检查是否点击了已有的文字元素
      const clickedTextElement = [...currentElements].reverse().find(el => {
        if (el.type !== 'text') return false;
        const bounds = getElementBounds(el, currentElements);
        return mousePos.x >= bounds.x && mousePos.x <= bounds.x + bounds.width &&
          mousePos.y >= bounds.y && mousePos.y <= bounds.y + bounds.height;
      });

      if (clickedTextElement && clickedTextElement.type === 'text') {
        // 点击已有文字，进入编辑模式
        pendingTextElementRef.current = null;
        setEditingTextId(clickedTextElement.id);
        setTextInputValue(clickedTextElement.text);
        setSelectedElementIds([clickedTextElement.id]);
        return;
      }

      // 点击空白处，创建新文字元素并立即进入编辑模式
      const newElement: TextElement = {
        id: generateId(),
        type: 'text',
        x: mousePos.x,
        y: mousePos.y,
        width: 200,
        height: 50,
        text: '',
        fillColor: drawingOptions.strokeColor,
        fontSize: 24,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        visible: true,
        locked: false
      };

      // 保存到 ref，以便在状态更新前显示输入框
      pendingTextElementRef.current = newElement;

      setElements(prev => [...prev, newElement]);
      setSelectedElementIds([newElement.id]);
      setEditingTextId(newElement.id);
      setTextInputValue('');
      return;
    }

    // 画笔工具：draw, highlighter
    if (activeTool === 'draw' || activeTool === 'highlighter') {
      const mousePos = getMousePos(e);
      // 检查是否在图片上
      if (!isPointOnImage(mousePos, currentElements)) return;

      const newElement: PathElement = {
        id: generateId(),
        type: 'path',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        points: [mousePos],
        strokeColor: drawingOptions.strokeColor,
        strokeWidth: activeTool === 'highlighter' ? drawingOptions.strokeWidth * 3 : drawingOptions.strokeWidth,
        strokeOpacity: activeTool === 'highlighter' ? 0.4 : 1,
        visible: true,
        locked: true, // 标注不可选中和移动
        name: 'annotation' // 标记为标注
      };
      setElements(prev => [...prev, newElement]);
      setSelectedElementIds([newElement.id]); // 绘制过程中需要选中以记录路径
      return;
    }

    // 直线和箭头工具
    if (activeTool === 'line' || activeTool === 'arrow') {
      const mousePos = getMousePos(e);
      // 检查是否在图片上
      if (!isPointOnImage(mousePos, currentElements)) return;

      if (activeTool === 'line') {
        // 直线工具：创建一个两点的线段
        const newElement: PathElement = {
          id: generateId(),
          type: 'line',
          x: mousePos.x,
          y: mousePos.y,
          width: 0,
          height: 0,
          points: [mousePos, mousePos],
          strokeColor: drawingOptions.strokeColor,
          strokeWidth: drawingOptions.strokeWidth,
          strokeOpacity: 1,
          visible: true,
          locked: true, // 标注不可选中和移动
          name: 'annotation' // 标记为标注
        };
        setElements(prev => [...prev, newElement]);
        setSelectedElementIds([newElement.id]); // 绘制过程中需要选中以更新
        setIsDrawingLine(true);
      } else if (activeTool === 'arrow') {
        // 箭头工具：创建一个带箭头的线段
        const newElement: ArrowElement = {
          id: generateId(),
          type: 'arrow',
          x: mousePos.x,
          y: mousePos.y,
          width: 0,
          height: 0,
          points: [mousePos, mousePos],
          strokeColor: drawingOptions.strokeColor,
          strokeWidth: drawingOptions.strokeWidth,
          visible: true,
          locked: true, // 标注不可选中和移动
          name: 'annotation' // 标记为标注
        };
        setElements(prev => [...prev, newElement]);
        setSelectedElementIds([newElement.id]); // 绘制过程中需要选中以更新
        setIsDrawingLine(true);
      }
      return;
    }

    // 形状工具：rectangle, circle, triangle
    if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'triangle') {
      const mousePos = getMousePos(e);
      // 检查是否在图片上
      if (!isPointOnImage(mousePos, currentElements)) return;

      setIsDrawingShape(true);
      setShapeStartPos(mousePos);
      setCurrentShapeType(activeTool === 'circle' ? 'ellipse' : activeTool as 'rectangle' | 'triangle');

      const newElement: ShapeElement = {
        id: generateId(),
        type: 'shape',
        shapeType: activeTool === 'circle' ? 'ellipse' : activeTool as 'rectangle' | 'ellipse' | 'triangle',
        x: mousePos.x,
        y: mousePos.y,
        width: 0,
        height: 0,
        fillColor: 'transparent',
        strokeColor: drawingOptions.strokeColor,
        strokeWidth: drawingOptions.strokeWidth,
        borderRadius: 0,
        visible: true,
        locked: true, // 标注不可选中和移动
        name: 'annotation' // 标记为标注
      };
      setElements(prev => [...prev, newElement]);
      setSelectedElementIds([newElement.id]); // 绘制过程中需要选中以更新
      return;
    }

    // 橡皮擦工具 (改为标记擦除区域)
    if (activeTool === 'erase') {
      const mousePos = getMousePos(e);
      // 检查是否在图片上
      if (!isPointOnImage(mousePos, currentElements)) return;

      const newElement: PathElement = {
        id: generateId(),
        type: 'path',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        points: [mousePos],
        strokeColor: '#ff4d4f', // 使用亮红色标记，更符合“擦除标记”的直觉
        strokeWidth: 40, // 橡皮擦固定宽度40
        strokeOpacity: 0.4, // 半透明，可以看到下方内容
        name: 'eraser_path', // 标记为橡皮擦路径
        visible: true,
        locked: true, // 标注不可选中和移动
      };
      setElements(prev => [...prev, newElement]);
      setSelectedElementIds([]); // 橡皮擦标记不需要选中
      return;
    }

    // 套索工具
    if (activeTool === 'lasso') {
      const mousePos = getMousePos(e);
      setIsDrawingLasso(true);
      setLassoPath([mousePos]);
      lassoPathRef.current = [mousePos]; // 同步更新 ref
      setLassoElementId(null);
      return;
    }
  };

  // Handle mouse move for drawing
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      // 使用屏幕坐标计算pan偏移
      const deltaX = e.clientX - panStartPos.x;
      const deltaY = e.clientY - panStartPos.y;

      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setPanStartPos({ x: e.clientX, y: e.clientY });
      return;
    }

    // 调整元素大小
    if (isResizing && resizeHandle && resizeStartBounds && selectedElementIds.length > 0) {
      const mousePos = getMousePos(e);
      const dx = mousePos.x - resizeStartPos.x;
      const dy = mousePos.y - resizeStartPos.y;
      const startBounds = resizeStartBounds;

      let newX = startBounds.x;
      let newY = startBounds.y;
      let newWidth = startBounds.width;
      let newHeight = startBounds.height;

      // 根据拖动的控制点计算新的尺寸
      switch (resizeHandle) {
        case 'tl':
          newX = startBounds.x + dx;
          newY = startBounds.y + dy;
          newWidth = Math.max(20, startBounds.width - dx);
          newHeight = Math.max(20, startBounds.height - dy);
          break;
        case 'tm':
          newY = startBounds.y + dy;
          newHeight = Math.max(20, startBounds.height - dy);
          break;
        case 'tr':
          newY = startBounds.y + dy;
          newWidth = Math.max(20, startBounds.width + dx);
          newHeight = Math.max(20, startBounds.height - dy);
          break;
        case 'ml':
          newX = startBounds.x + dx;
          newWidth = Math.max(20, startBounds.width - dx);
          break;
        case 'mr':
          newWidth = Math.max(20, startBounds.width + dx);
          break;
        case 'bl':
          newX = startBounds.x + dx;
          newWidth = Math.max(20, startBounds.width - dx);
          newHeight = Math.max(20, startBounds.height + dy);
          break;
        case 'bm':
          newHeight = Math.max(20, startBounds.height + dy);
          break;
        case 'br':
          newWidth = Math.max(20, startBounds.width + dx);
          newHeight = Math.max(20, startBounds.height + dy);
          break;
      }

      setElements(prev => prev.map(el => {
        if (selectedElementIds.includes(el.id)) {
          return { ...el, x: newX, y: newY, width: newWidth, height: newHeight };
        }
        return el;
      }));
      return;
    }

    if (isDragging && dragElement) {
      const mousePos = getMousePos(e);
      const deltaX = mousePos.x - dragStartPos.x;
      const deltaY = mousePos.y - dragStartPos.y;

      setElements(prev => prev.map(el =>
        el.id === dragElement.id
          ? { ...el, x: dragElement.x + deltaX, y: dragElement.y + deltaY }
          : el
      ));
      return;
    }

    if (isCropDragging && croppingState && cropDragHandle) {
      const mousePos = getMousePos(e);
      const { cropBox, originalElement } = croppingState;
      const dx = mousePos.x - cropDragStart.x;
      const dy = mousePos.y - cropDragStart.y;

      let newCropBox = { ...cropBox };

      // 根据拖动的控制点更新剪裁框
      switch (cropDragHandle) {
        case 'tl':
          newCropBox.x = Math.max(originalElement.x, Math.min(cropBox.x + cropBox.width - 20, cropBox.x + dx));
          newCropBox.y = Math.max(originalElement.y, Math.min(cropBox.y + cropBox.height - 20, cropBox.y + dy));
          newCropBox.width = cropBox.width - (newCropBox.x - cropBox.x);
          newCropBox.height = cropBox.height - (newCropBox.y - cropBox.y);
          break;
        case 'tr':
          newCropBox.width = Math.max(20, Math.min(originalElement.x + originalElement.width - cropBox.x, cropBox.width + dx));
          newCropBox.y = Math.max(originalElement.y, Math.min(cropBox.y + cropBox.height - 20, cropBox.y + dy));
          newCropBox.height = cropBox.height - (newCropBox.y - cropBox.y);
          break;
        case 'bl':
          newCropBox.x = Math.max(originalElement.x, Math.min(cropBox.x + cropBox.width - 20, cropBox.x + dx));
          newCropBox.width = cropBox.width - (newCropBox.x - cropBox.x);
          newCropBox.height = Math.max(20, Math.min(originalElement.y + originalElement.height - cropBox.y, cropBox.height + dy));
          break;
        case 'br':
          newCropBox.width = Math.max(20, Math.min(originalElement.x + originalElement.width - cropBox.x, cropBox.width + dx));
          newCropBox.height = Math.max(20, Math.min(originalElement.y + originalElement.height - cropBox.y, cropBox.height + dy));
          break;
        case 'tm':
          newCropBox.y = Math.max(originalElement.y, Math.min(cropBox.y + cropBox.height - 20, cropBox.y + dy));
          newCropBox.height = cropBox.height - (newCropBox.y - cropBox.y);
          break;
        case 'bm':
          newCropBox.height = Math.max(20, Math.min(originalElement.y + originalElement.height - cropBox.y, cropBox.height + dy));
          break;
        case 'ml':
          newCropBox.x = Math.max(originalElement.x, Math.min(cropBox.x + cropBox.width - 20, cropBox.x + dx));
          newCropBox.width = cropBox.width - (newCropBox.x - cropBox.x);
          break;
        case 'mr':
          newCropBox.width = Math.max(20, Math.min(originalElement.x + originalElement.width - cropBox.x, cropBox.width + dx));
          break;
        case 'move':
          // 移动整个剪裁框
          newCropBox.x = Math.max(originalElement.x, Math.min(originalElement.x + originalElement.width - cropBox.width, cropBox.x + dx));
          newCropBox.y = Math.max(originalElement.y, Math.min(originalElement.y + originalElement.height - cropBox.height, cropBox.y + dy));
          break;
      }

      setCroppingState(prev => prev ? { ...prev, cropBox: newCropBox } : null);
      setCropDragStart(mousePos);
    }

    // 画笔、荧光笔、橡皮擦绘制
    if ((activeTool === 'draw' || activeTool === 'highlighter' || activeTool === 'erase') && selectedElementIds.length > 0) {
      const mousePos = getMousePos(e);
      setElements(prev => prev.map(el => {
        if (el.id === selectedElementIds[0] && el.type === 'path') {
          const lastPoint = el.points[el.points.length - 1];
          if (Math.abs(mousePos.x - lastPoint.x) > 2 || Math.abs(mousePos.y - lastPoint.y) > 2) {
            return { ...el, points: [...el.points, mousePos] };
          }
        }
        return el;
      }));
      return;
    }

    // 套索工具绘制
    if (activeTool === 'lasso' && isDrawingLasso) {
      const mousePos = getMousePos(e);
      const currentPath = lassoPathRef.current; // 使用 ref 获取最新路径
      const lastPoint = currentPath[currentPath.length - 1];
      if (lastPoint && (Math.abs(mousePos.x - lastPoint.x) > 2 || Math.abs(mousePos.y - lastPoint.y) > 2)) {
        const newPath = [...currentPath, mousePos];
        setLassoPath(newPath);
        lassoPathRef.current = newPath; // 同步更新 ref
      }
      return;
    }

    // 直线和箭头绘制时更新终点
    if (isDrawingLine && selectedElementIds.length > 0) {
      const mousePos = getMousePos(e);
      setElements(prev => prev.map(el => {
        if (el.id === selectedElementIds[0] && (el.type === 'line' || el.type === 'arrow')) {
          return {
            ...el,
            points: [el.points[0], mousePos],
            width: Math.abs(mousePos.x - el.points[0].x),
            height: Math.abs(mousePos.y - el.points[0].y)
          };
        }
        return el;
      }));
      return;
    }

    // 形状绘制时更新尺寸
    if (isDrawingShape && selectedElementIds.length > 0) {
      const mousePos = getMousePos(e);
      setElements(prev => prev.map(el => {
        if (el.id === selectedElementIds[0] && el.type === 'shape') {
          const width = mousePos.x - shapeStartPos.x;
          const height = mousePos.y - shapeStartPos.y;
          return {
            ...el,
            x: width >= 0 ? shapeStartPos.x : mousePos.x,
            y: height >= 0 ? shapeStartPos.y : mousePos.y,
            width: Math.abs(width),
            height: Math.abs(height)
          };
        }
        return el;
      }));
      return;
    }
  };

  // Handle mouse up for drawing
  const handleMouseUp = (e: React.MouseEvent) => {
    let shouldSaveHistory = false;
    const mousePos = getMousePos(e);

    if (isPanning) {
      setIsPanning(false);
    }
    if (isResizing) {
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStartBounds(null);
      shouldSaveHistory = true; // 调整大小完成后保存历史
    }
    if (isDragging && dragElement) {
      // 计算拖动距离，判断是否是点击还是拖动
      const dragDistance = Math.sqrt(
        Math.pow(mousePos.x - dragStartPos.x, 2) + 
        Math.pow(mousePos.y - dragStartPos.y, 2)
      );
      const isClick = dragDistance < 5; // 小于5像素认为是点击
      
      // 视频播放通过独立按钮控制，这里不处理
      
      setIsDragging(false);
      setDragElement(null);
      if (!isClick) {
        shouldSaveHistory = true; // 只有真正拖动后才保存历史
      }
    }
    if (isCropDragging) {
      setIsCropDragging(false);
      setCropDragHandle(null);
    }
    if (isDrawingShape) {
      setIsDrawingShape(false);
      // 如果形状太小，删除它
      const currentElement = elements.find(el => el.id === selectedElementIds[0]);
      if (currentElement && currentElement.type === 'shape' &&
        (currentElement.width < 5 || currentElement.height < 5)) {
        setElements(prev => prev.filter(el => el.id !== selectedElementIds[0]));
        setSelectedElementIds([]);
      } else {
        shouldSaveHistory = true; // 形状绘制完成后保存历史
      }
    }
    if (isDrawingLine) {
      setIsDrawingLine(false);
      shouldSaveHistory = true; // 线条绘制完成后保存历史
    }
    // 画笔、荧光笔、橡皮擦工具结束绘制
    if ((activeTool === 'draw' || activeTool === 'highlighter' || activeTool === 'erase') && selectedElementIds.length > 0) {
      // 检查是否是标注，如果是，取消选中
      const lastElement = currentElements.find(el => el.id === selectedElementIds[0]);
      if (lastElement && (lastElement.locked || lastElement.name === 'annotation' || lastElement.name === 'eraser_path')) {
        setSelectedElementIds([]);
      }
      shouldSaveHistory = true; // 画笔绘制完成后保存历史
    }
    // 套索工具结束绘制 - 选择套索区域内的元素
    if (activeTool === 'lasso' && isDrawingLasso) {
      const currentLassoPath = lassoPathRef.current; // 使用 ref 获取最新路径

      if (currentLassoPath.length > 2) {
        // 闭合套索路径
        const closedPath = [...currentLassoPath, currentLassoPath[0]];

        // 查找所有在套索区域内的元素
        const selectedIds: string[] = [];
        currentElements.forEach(el => {
          const bounds = getElementBounds(el, currentElements);
          // 检查元素中心点是否在套索区域内
          const centerX = bounds.x + bounds.width / 2;
          const centerY = bounds.y + bounds.height / 2;

          if (isPointInPolygon({ x: centerX, y: centerY }, closedPath)) {
            selectedIds.push(el.id);
          }
        });

        setSelectedElementIds(selectedIds);
      }

      setIsDrawingLasso(false);
      setLassoPath([]);
      lassoPathRef.current = [];
    }

    // 保存历史记录
    if (shouldSaveHistory && !isUndoRedoAction.current) {
      setTimeout(() => saveToHistory(elements), 0);
    }
  };


  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      const { dataUrl, mimeType } = await fileToDataUrl(file);
      const img = new Image();

      // 创建Promise来等待图片加载完成
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(undefined);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      });

      // 计算图片在canvas中的合适大小和位置
      const maxWidth = canvasSize.width - 200; // 留出边距
      const maxHeight = canvasSize.height - 200; // 留出边距

      let displayWidth = img.width;
      let displayHeight = img.height;
      let displayX = 100;
      let displayY = 100;

      // 如果图片太大，缩放以适应canvas
      if (img.width > maxWidth || img.height > maxHeight) {
        const scaleX = maxWidth / img.width;
        const scaleY = maxHeight / img.height;
        const scale = Math.min(scaleX, scaleY);

        displayWidth = img.width * scale;
        displayHeight = img.height * scale;
      }

      // 居中显示
      displayX = (canvasSize.width - displayWidth) / 2;
      displayY = (canvasSize.height - displayHeight) / 2;

      const newElement: ImageElement = {
        id: generateId(),
        type: 'image',
        x: displayX,
        y: displayY,
        width: displayWidth,
        height: displayHeight,
        href: dataUrl,
        mimeType: mimeType,
        image: img, // 保存加载完成的图片对象
        visible: true,
        locked: false
      };
      setElements(prev => {
        const newElements = [...prev, newElement];
        // 保存历史记录
        setTimeout(() => saveToHistory(newElements), 0);
        return newElements;
      });
      setSelectedElementIds([newElement.id]);
    } catch (error) {
      console.error('Failed to load image:', error);
      toast.error('Failed to load image');
    }
  };

  // Handle text-to-image generation
  const handleGenerateImage = async (prompt: string) => {
    if (!prompt.trim()) {
      toast.error('请输入提示词');
      return;
    }

    // 检查登录状态
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    if (!userId || !token) {
      toast.error('请先登录后再使用图片生成功能');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
      return;
    }

    setIsGenerating(true);
    try {
      const selectedModelInfo = models.find(model => model.id === selectedModel);
      const modelName = selectedModelInfo?.modelName;
      const result = await generateImageFromText(prompt, modelName, currentSessionId, selectedImageSize);

      // 解析图片URL - 处理特殊格式 data:<images>url</images>data:data:
      const extractImageUrl = (src: string | null | undefined): string | null => {
        if (!src) return null;

        // 检查是否是特殊格式 data:<images>url</images>data:data:
        const imagesMatch = src.match(/<images>(.*?)<\/images>/);
        if (imagesMatch && imagesMatch[1]) {
          return imagesMatch[1].trim();
        }

        // 如果是普通URL或base64，直接返回
        if (src.startsWith('http') || src.startsWith('data:image/')) {
          return src;
        }

        return src;
      };

      // 优先使用imageUrl，其次使用base64
      let imageSrc = extractImageUrl(result.imageUrl) ||
        extractImageUrl(result.textResponse) ||
        (result.newImageBase64 ? `data:${result.newImageMimeType};base64,${result.newImageBase64}` : null);

      if (imageSrc) {
        // 辅助函数：创建图片元素
        const createImageElement = (img: HTMLImageElement, href: string) => {
          // 计算当前屏幕中心在画布坐标系中的位置
          const viewportCenterX = (canvasSize.width / 2 - pan.x) / zoom;
          const viewportCenterY = (canvasSize.height / 2 - pan.y) / zoom;
          
          // 将图片放置在屏幕中心
          const newElement: ImageElement = {
            id: generateId(),
            type: 'image',
            x: viewportCenterX - (img.width || 512) / 2,
            y: viewportCenterY - (img.height || 512) / 2,
            width: img.width || 512,
            height: img.height || 512,
            href: href,
            mimeType: 'image/png',
            image: img,
            visible: true,
            locked: false
          };
          setElements(prev => {
            const newElements = [...prev, newElement];
            setTimeout(() => saveToHistory(newElements), 0);
            return newElements;
          });
          setSelectedElementIds([newElement.id]);
          toast.success('图片生成成功');
        };

        // 图片加载错误处理函数
        const handleImageLoadError = () => {
          console.error('Image load failed');
          // 检查是否是余额不足错误
          if (result.textResponse && result.textResponse.includes('余额不足')) {
            toast.error(result.textResponse);
          } else {
            toast.error('操作失败，可能账户余额不足');
          }
        };

        // 如果是外部URL，使用 crossOrigin 尝试加载
        if (!imageSrc.startsWith('data:')) {
          const img = new Image();
          img.crossOrigin = 'anonymous'; // 尝试请求 CORS，以便后续可以导出 canvas
          img.onload = () => {
            createImageElement(img, imageSrc!);
          };
          img.onerror = handleImageLoadError;
          img.src = imageSrc;
        } else {
          // base64图片直接加载
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            createImageElement(img, imageSrc!);
          };
          img.onerror = handleImageLoadError;
          img.src = imageSrc;
        }
      } else {
        // 检查是否是余额不足错误
        if (result.textResponse && result.textResponse.includes('余额不足')) {
          toast.error(result.textResponse);
        } else {
          toast.error(result.textResponse || '图片生成失败');
        }
      }
    } catch (error: any) {
      console.error('Image generation failed:', error);
      if (error.message === '用户未登录') {
        toast.error('登录已过期，请重新登录');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        toast.error(error.message || '图片生成失败');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle image editing
  const handleEditImage = async (prompt: string) => {
    const selectedImages = currentElements.filter(el =>
      selectedElementIds.includes(el.id) && el.type === 'image'
    ) as ImageElement[];

    if (selectedImages.length === 0) {
      toast.error('请选择要编辑的图片');
      return;
    }

    if (!prompt.trim()) {
      toast.error('请输入编辑提示词');
      return;
    }

    // 检查登录状态
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    if (!userId || !token) {
      toast.error('请先登录后再使用图片编辑功能');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
      return;
    }

    setIsGenerating(true);
    try {
      // 准备图片数据 - 检查是否有标注需要合并
      const imagesData = await Promise.all(selectedImages.map(async (img) => {
        // 检查是否有属于该图片的标注
        const annotations = currentElements.filter(el => 
          el.id !== img.id && 
          (el.locked || el.name === 'annotation' || el.name === 'eraser_path')
        );

        const hasAnnotations = annotations.some(anno => {
          const bounds = getElementBounds(anno, currentElements);
          const intersects = !(bounds.x > img.x + img.width || 
                               bounds.x + bounds.width < img.x || 
                               bounds.y > img.y + img.height || 
                               bounds.y + img.height < img.y);
          return intersects;
        });

        // 如果没有标注，直接使用原图 URL
        if (!hasAnnotations) {
          return { href: img.href || '', mimeType: img.mimeType || 'image/png' };
        }

        // 如果有标注，尝试合并（仅对 base64 图片）
        if (img.href && img.href.startsWith('data:')) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return { href: img.href || '', mimeType: 'image/png' };

            // 绘制原图
            if (img.image) {
              ctx.drawImage(img.image, 0, 0, img.width, img.height);
            }

            // 绘制标注
            annotations.forEach(anno => {
              const bounds = getElementBounds(anno, currentElements);
              const intersects = !(bounds.x > img.x + img.width || 
                                   bounds.x + bounds.width < img.x || 
                                   bounds.y > img.y + img.height || 
                                   bounds.y + bounds.height < img.y);
              
              if (intersects) {
                drawElement(ctx, anno, img.x, img.y);
              }
            });

            return {
              href: canvas.toDataURL('image/png'),
              mimeType: 'image/png'
            };
          } catch (error) {
            console.warn('无法合并标注，使用原图:', error);
            return { href: img.href || '', mimeType: img.mimeType || 'image/png' };
          }
        }

        // 外部 URL 图片，直接使用原图（无法合并标注）
        console.warn('外部 URL 图片无法合并标注，将使用原图');
        return { href: img.href || '', mimeType: img.mimeType || 'image/png' };
      }));

      const selectedModelInfo = models.find(model => model.id === selectedModel);
      const modelName = selectedModelInfo?.modelName;
      const result = await editImage(imagesData, prompt, undefined, modelName, currentSessionId, selectedImageSize);

      // 解析图片URL - 处理特殊格式 data:<images>url</images>data:data:
      const extractImageUrl = (src: string | null | undefined): string | null => {
        if (!src) return null;

        // 检查是否是特殊格式 data:<images>url</images>data:data:
        const imagesMatch = src.match(/<images>(.*?)<\/images>/);
        if (imagesMatch && imagesMatch[1]) {
          return imagesMatch[1].trim();
        }

        // 如果是普通URL或base64，直接返回
        if (src.startsWith('http') || src.startsWith('data:image/')) {
          return src;
        }

        return src;
      };

      // 优先使用imageUrl，其次使用base64
      let imageSrc = extractImageUrl(result.imageUrl) ||
        extractImageUrl(result.textResponse) ||
        (result.newImageBase64 ? `data:${result.newImageMimeType};base64,${result.newImageBase64}` : null);

      if (imageSrc) {
        // 辅助函数：创建图片元素
        const createImageElement = (img: HTMLImageElement, href: string) => {
          // 计算当前屏幕中心在画布坐标系中的位置
          const viewportCenterX = (canvasSize.width / 2 - pan.x) / zoom;
          const viewportCenterY = (canvasSize.height / 2 - pan.y) / zoom;
          
          // 将图片放置在屏幕中心
          const newElement: ImageElement = {
            id: generateId(),
            type: 'image',
            x: viewportCenterX - (img.width || 512) / 2,
            y: viewportCenterY - (img.height || 512) / 2,
            width: img.width || 512,
            height: img.height || 512,
            href: href,
            mimeType: 'image/png',
            image: img,
            visible: true,
            locked: false
          };
          setElements(prev => {
            const newElements = [...prev, newElement];
            setTimeout(() => saveToHistory(newElements), 0);
            return newElements;
          });
          setSelectedElementIds([newElement.id]);
          toast.success('图片编辑成功');
        };

        // 图片加载错误处理函数
        const handleImageLoadError = () => {
          console.error('Image load failed');
          // 检查是否是余额不足错误
          if (result.textResponse && result.textResponse.includes('余额不足')) {
            toast.error(result.textResponse);
          } else {
            toast.error('图片加载失败');
          }
        };

        // 如果是外部URL，使用 crossOrigin 尝试加载
        if (!imageSrc.startsWith('data:')) {
          const img = new Image();
          img.crossOrigin = 'anonymous'; // 尝试请求 CORS，以便后续可以导出 canvas
          img.onload = () => {
            createImageElement(img, imageSrc!);
          };
          img.onerror = handleImageLoadError;
          img.src = imageSrc;
        } else {
          // base64图片直接加载
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            createImageElement(img, imageSrc!);
          };
          img.onerror = handleImageLoadError;
          img.src = imageSrc;
        }
      } else {
        // 检查是否是余额不足错误
        if (result.textResponse && result.textResponse.includes('余额不足')) {
          toast.error(result.textResponse);
        } else {
          toast.error(result.textResponse || '图片编辑失败');
        }
      }
    } catch (error: any) {
      console.error('Image editing failed:', error);
      if (error.message === '用户未登录') {
        toast.error('登录已过期，请重新登录');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        toast.error(error.message || '图片编辑失败');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 打开图生视频面板
  const handleOpenVideoPanel = useCallback(() => {
    const selectedImages = currentElements.filter(el =>
      selectedElementIds.includes(el.id) && el.type === 'image'
    ) as ImageElement[];

    if (selectedImages.length === 0) {
      toast.error('请先选择一张图片作为起始帧');
      return;
    }

    // 设置起始帧为第一张选中的图片
    const startImage = selectedImages[0];
    setSelectedStartImage(startImage);
    
    // 如果选中了两张图片，第二张作为结束帧
    if (selectedImages.length >= 2) {
      setSelectedEndImage(selectedImages[1]);
    } else {
      setSelectedEndImage(null);
    }
    
    // 从图片元素中恢复之前保存的 videoPrompt
    setVideoPrompt(startImage.videoPrompt || '');
    
    setGeneratedVideoUrl(null);
    setVideoProgress(null);
    setShowInlineVideoControls(true);
  }, [currentElements, selectedElementIds]);

  // 关闭图生视频面板
  const handleCloseVideoPanel = useCallback(() => {
    // 关闭前保存当前的 videoPrompt 到图片元素
    if (selectedStartImage && videoPrompt) {
      setElements(prev => prev.map(el => 
        el.id === selectedStartImage.id && el.type === 'image'
          ? { ...el, videoPrompt: videoPrompt } as ImageElement
          : el
      ));
    }
    
    setShowInlineVideoControls(false);
    setSelectedStartImage(null);
    setSelectedEndImage(null);
    setGeneratedVideoUrl(null);
    setVideoProgress(null);
    // 不清空 videoPrompt，因为已经保存到图片元素了
  }, [selectedStartImage, videoPrompt]);

  // 生成视频
  const handleGenerateVideo = useCallback(async () => {
    if (!selectedStartImage) {
      toast.error('请选择起始帧图片');
      return;
    }

    // 检查登录状态
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    if (!userId || !token) {
      toast.error('请先登录后再使用视频生成功能');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
      return;
    }

    // 立即在画布上创建视频占位元素
    const videoElementId = generateId();
    const videoElement: VideoElement = {
      id: videoElementId,
      type: 'video',
      x: selectedStartImage.x + selectedStartImage.width + 50, // 放在起始图片右侧
      y: selectedStartImage.y,
      width: selectedStartImage.width,
      height: selectedStartImage.height,
      videoUrl: undefined, // 先不设置URL，显示占位符
      href: undefined,
      visible: true,
      locked: false
    };
    
    setElements(prev => {
      const newElements = [...prev, videoElement];
      setTimeout(() => saveToHistory(newElements), 0);
      return newElements;
    });

    setIsGeneratingVideo(true);
    setVideoProgress({ message: '正在初始化视频生成...' });
    setGeneratedVideoUrl(null);

    try {
      const startImageUrl = selectedStartImage.href || '';
      const endImageUrl = selectedEndImage?.href || undefined;

      const result = await generateVideo(
        videoPrompt || '生成流畅的视频动画',
        startImageUrl,
        endImageUrl,
        selectedVideoModel || undefined,
        videoResolution,
        videoRatio,
        videoDuration,
        currentSessionId,
        (message: string, current?: number, total?: number) => {
          setVideoProgress({ message, current, total });
        },
        true // audio: 默认生成同步音频
      );

      if (result.videoUrl) {
        setGeneratedVideoUrl(result.videoUrl);
        toast.success('视频生成成功！');
        
        // 加载视频对象并获取第一帧
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        video.loop = false;
        video.muted = false; // 允许播放声音
        video.playsInline = true;
        
        // 视频播放结束时的处理
        video.onended = () => {
          setElements(prev => prev.map(el => 
            el.id === videoElementId && el.type === 'video'
              ? { ...el, isPlaying: false } as VideoElement
              : el
          ));
        };
        
        video.onloadeddata = () => {
          console.log('视频数据加载完成，准备显示第一帧');
          // 视频数据加载完成后，跳转到第一帧
          video.currentTime = 0.01;
        };
        
        video.onseeked = () => {
          console.log('视频seek完成，更新画布元素');
          // 视频seek完成后，更新画布上的视频元素
          setElements(prev => {
            const newElements = prev.map(el => 
              el.id === videoElementId 
                ? { 
                    ...el, 
                    videoUrl: result.videoUrl, 
                    href: result.videoUrl,
                    video: video,
                    isPlaying: false
                  } as VideoElement
                : el
            );
            setTimeout(() => saveToHistory(newElements), 0);
            return newElements;
          });
        };
        
        video.onerror = (e) => {
          console.error('视频加载失败:', e, video.error);
          toast.error('视频加载失败');
        };
        
        // 设置 src 开始加载
        video.src = result.videoUrl;
        video.load();
        
        // 关闭控件
        setShowInlineVideoControls(false);
      } else {
        toast.error('视频生成失败，未返回视频URL');
      }
    } catch (error: any) {
      console.error('Video generation failed:', error);
      if (error.message === '用户未登录' || error.message?.includes('认证失败')) {
        toast.error('登录已过期，请重新登录');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        toast.error(error.message || '视频生成失败');
      }
    } finally {
      setIsGeneratingVideo(false);
      setVideoProgress(null);
    }
  }, [selectedStartImage, selectedEndImage, videoPrompt, selectedVideoModel, videoResolution, videoRatio, videoDuration, currentSessionId]);

  // Handle start crop - 开始剪裁选中的图片
  const handleStartCrop = (element: ImageElement) => {
    setCroppingState({
      elementId: element.id,
      originalElement: { ...element },
      cropBox: { x: element.x, y: element.y, width: element.width, height: element.height },
    });
  };

  // Handle confirm crop
  const handleConfirmCrop = () => {
    if (!croppingState) return;

    const { elementId, cropBox } = croppingState;
    const elementToCrop = elements.find(el => el.id === elementId) as ImageElement;

    if (!elementToCrop) {
      handleCancelCrop();
      return;
    }

    // 使用原始图片进行剪裁
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropBox.width;
      canvas.height = cropBox.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error('Failed to create canvas context for cropping.');
        handleCancelCrop();
        return;
      }

      // 计算剪裁区域相对于原图的位置
      const sx = (cropBox.x - elementToCrop.x) / elementToCrop.width * img.width;
      const sy = (cropBox.y - elementToCrop.y) / elementToCrop.height * img.height;
      const sw = cropBox.width / elementToCrop.width * img.width;
      const sh = cropBox.height / elementToCrop.height * img.height;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cropBox.width, cropBox.height);
      const newHref = canvas.toDataURL(elementToCrop.mimeType || 'image/png');

      // 创建新的Image对象用于渲染
      const newImg = new Image();
      newImg.onload = () => {
        setElements(prev => {
          const newElements = prev.map(el => {
            if (el.id === elementId && el.type === 'image') {
              return {
                ...el,
                href: newHref,
                image: newImg,
                x: cropBox.x,
                y: cropBox.y,
                width: cropBox.width,
                height: cropBox.height
              };
            }
            return el;
          });
          // 保存历史记录
          setTimeout(() => saveToHistory(newElements), 0);
          return newElements;
        });
        handleCancelCrop();
      };
      newImg.src = newHref;
    };
    img.onerror = () => {
      toast.error('Failed to load image for cropping.');
      handleCancelCrop();
    };
    img.src = elementToCrop.href || '';
  };

  // Handle cancel crop
  const handleCancelCrop = () => {
    setCroppingState(null);
  };

  // 跟踪已经开始加载的视频 ID，避免重复加载
  const loadingVideoIds = useRef<Set<string>>(new Set());

  // 自动加载视频元素的首帧 - 当视频元素有 videoUrl 但没有有效的 video 对象时自动加载
  useEffect(() => {
    const videoElements = elements.filter(el => el.type === 'video') as VideoElement[];
    
    videoElements.forEach(videoEl => {
      if (!videoEl.videoUrl) return; // 没有 URL，跳过
      
      // 检查是否已有有效的 video 对象
      const isValidVideoElement = videoEl.video && 
        typeof (videoEl.video as HTMLVideoElement).play === 'function';
      
      if (isValidVideoElement) return; // 已有有效的 video 对象，跳过
      
      // 检查是否已经在加载中
      const loadKey = `${videoEl.id}-${videoEl.videoUrl}`;
      if (loadingVideoIds.current.has(loadKey)) return;
      
      // 标记为加载中
      loadingVideoIds.current.add(loadKey);
      
      // 需要加载视频
      console.log('自动加载视频:', videoEl.id, videoEl.videoUrl);
      
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.muted = false; // 允许播放声音
      video.playsInline = true;
      
      video.onloadeddata = () => {
        console.log('视频数据加载完成，跳转到第一帧:', videoEl.id);
        video.currentTime = 0.01;
      };
      
      video.onseeked = () => {
        console.log('视频seek完成，更新元素:', videoEl.id);
        setElements(prev => prev.map(item => 
          item.id === videoEl.id 
            ? { ...item, video: video, isPlaying: false } as VideoElement 
            : item
        ));
      };
      
      video.onended = () => {
        setElements(prev => prev.map(item => 
          item.id === videoEl.id ? { ...item, isPlaying: false } as VideoElement : item
        ));
      };
      
      video.onerror = (e) => {
        console.error('视频加载失败:', videoEl.id, e);
        // 加载失败，从加载中列表移除，允许重试
        loadingVideoIds.current.delete(loadKey);
      };
      
      video.src = videoEl.videoUrl;
      video.load();
    });
  }, [elements]);

  // Render canvas - 动态渲染，不使用固定大画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 使用视口大小的画布
    const viewportWidth = canvasSize.width;
    const viewportHeight = canvasSize.height;

    if (canvas.width !== viewportWidth || canvas.height !== viewportHeight) {
      canvas.width = viewportWidth;
      canvas.height = viewportHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 应用平移和缩放变换
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw elements
    currentElements.forEach(element => {
      if (!element.visible) return;

      ctx.save();

      switch (element.type) {
        case 'image': {
          // 使用已加载的图片对象直接绘制
          if (element.image) {
            // 如果有圆角，使用clip裁剪
            const borderRadius = (element as any).borderRadius || 0;
            if (borderRadius > 0) {
              ctx.beginPath();
              ctx.roundRect(element.x, element.y, element.width, element.height, borderRadius);
              ctx.clip();
            }
            ctx.drawImage(element.image, element.x, element.y, element.width, element.height);
          }
          break;
        }
        case 'path': {
          ctx.strokeStyle = element.strokeColor;
          ctx.lineWidth = element.strokeWidth;
          ctx.globalAlpha = element.strokeOpacity || 1;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (element.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(element.points[0].x, element.points[0].y);
            for (let i = 1; i < element.points.length; i++) {
              ctx.lineTo(element.points[i].x, element.points[i].y);
            }
            ctx.stroke();
          }
          break;
        }
        case 'shape': {
          ctx.fillStyle = element.fillColor;
          ctx.strokeStyle = element.strokeColor;
          ctx.lineWidth = element.strokeWidth;

          if (element.shapeType === 'rectangle') {
            ctx.beginPath();
            ctx.roundRect(element.x, element.y, element.width, element.height, element.borderRadius || 0);
            if (element.fillColor !== 'transparent') {
              ctx.fill();
            }
            ctx.stroke();
          } else if (element.shapeType === 'ellipse') {
            const rx = Math.abs(element.width / 2);
            const ry = Math.abs(element.height / 2);
            if (rx > 0 && ry > 0) {
              ctx.beginPath();
              ctx.ellipse(
                element.x + element.width / 2,
                element.y + element.height / 2,
                rx,
                ry,
                0, 0, Math.PI * 2
              );
              if (element.fillColor !== 'transparent') {
                ctx.fill();
              }
              ctx.stroke();
            }
          } else if (element.shapeType === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(element.x + element.width / 2, element.y);
            ctx.lineTo(element.x + element.width, element.y + element.height);
            ctx.lineTo(element.x, element.y + element.height);
            ctx.closePath();
            if (element.fillColor !== 'transparent') {
              ctx.fill();
            }
            ctx.stroke();
          }
          break;
        }
        case 'text': {
          // 如果文字正在编辑，不在canvas上显示
          if (element.id !== editingTextId) {
            ctx.fillStyle = element.fillColor || '#000000';
            ctx.font = `${element.fontWeight || 'normal'} ${element.fontSize}px ${element.fontFamily || 'Arial'}`;
            ctx.fillText(element.text, element.x, element.y + element.fontSize);
          }
          break;
        }
        case 'line': {
          ctx.strokeStyle = element.strokeColor;
          ctx.lineWidth = element.strokeWidth;
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          ctx.lineTo(element.points[1].x, element.points[1].y);
          ctx.stroke();
          break;
        }
        case 'arrow': {
          const start = element.points[0];
          const end = element.points[1];
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const angle = Math.atan2(dy, dx);
          const length = Math.sqrt(dx * dx + dy * dy);
          const headLength = Math.min(15, length / 3);

          ctx.strokeStyle = element.strokeColor;
          ctx.fillStyle = element.strokeColor;
          ctx.lineWidth = element.strokeWidth;

          // 画线段（到箭头起点）
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x - Math.cos(angle) * headLength, end.y - Math.sin(angle) * headLength);
          ctx.stroke();

          // 画箭头
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - headLength * Math.cos(angle - Math.PI / 6),
            end.y - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            end.x - headLength * Math.cos(angle + Math.PI / 6),
            end.y - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'video': {
          // 绘制视频元素
          const centerX = element.x + element.width / 2;
          const centerY = element.y + element.height / 2;
          
          // 检查 video 是否是真正的 HTMLVideoElement
          const isValidVideoElement = element.video && 
            typeof (element.video as HTMLVideoElement).play === 'function';
          
          if (isValidVideoElement && element.videoUrl) {
            const videoObj = element.video as HTMLVideoElement;
            // 如果有视频对象，绘制视频当前帧（包括第一帧）
            try {
              // 绘制视频帧
              ctx.drawImage(videoObj, element.x, element.y, element.width, element.height);
            } catch (e) {
              // 如果视频还没加载好，显示黑色背景
              ctx.fillStyle = '#1a1a1a';
              ctx.fillRect(element.x, element.y, element.width, element.height);
            }
            
            // 绘制边框
            ctx.strokeStyle = element.isPlaying ? '#10b981' : '#6b7280';
            ctx.lineWidth = 2;
            ctx.strokeRect(element.x, element.y, element.width, element.height);
            
            // 左上角视频标识
            ctx.fillStyle = element.isPlaying ? '#10b981' : '#6b7280';
            ctx.font = 'bold 12px Arial';
            ctx.fillText('▶ 视频', element.x + 8, element.y + 18);
            
            // 播放进度条（播放时显示）
            if (element.isPlaying && videoObj.duration && !isNaN(videoObj.duration)) {
              const progress = videoObj.currentTime / videoObj.duration;
              const progressBarHeight = 4;
              const progressBarY = element.y + element.height - progressBarHeight - 5;
              
              // 背景条
              ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
              ctx.fillRect(element.x + 5, progressBarY, element.width - 10, progressBarHeight);
              
              // 进度条
              ctx.fillStyle = '#10b981';
              ctx.fillRect(element.x + 5, progressBarY, (element.width - 10) * progress, progressBarHeight);
            }
            
            // 注意：播放按钮通过 HTML 覆盖层渲染，不在 canvas 上绘制
            
          } else if (element.videoUrl) {
            // 有URL但video对象还没加载或无效
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(element.x, element.y, element.width, element.height);
            
            // 绘制加载提示
            ctx.fillStyle = '#10b981';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('加载视频中...', centerX, centerY);
            ctx.textAlign = 'left';
            
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.strokeRect(element.x, element.y, element.width, element.height);
          } else {
            // 没有URL，显示加载中状态（视频正在生成）
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(element.x, element.y, element.width, element.height);
            
            // 绘制加载动画（旋转圆圈）
            const radius = Math.min(element.width, element.height) * 0.1;
            const time = Date.now() / 1000;
            const startAngle = time * 2;
            
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.8;
            
            // 绘制旋转的圆弧
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + Math.PI * 1.5);
            ctx.stroke();
            
            // 绘制边框（蓝色表示生成中）
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.strokeRect(element.x, element.y, element.width, element.height);
            
            // 绘制"生成中..."标签
            ctx.fillStyle = '#6366f1';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('视频生成中...', centerX, centerY + radius + 25);
            ctx.textAlign = 'left';
          }
          break;
        }
      }

      ctx.restore();
    });

    // Draw crop area overlay
    if (croppingState) {
      const { cropBox, originalElement } = croppingState;

      // 绘制半透明遮罩（剪裁框外部区域）
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      // 上方
      ctx.fillRect(originalElement.x, originalElement.y, originalElement.width, cropBox.y - originalElement.y);
      // 下方
      ctx.fillRect(originalElement.x, cropBox.y + cropBox.height, originalElement.width, originalElement.y + originalElement.height - cropBox.y - cropBox.height);
      // 左侧
      ctx.fillRect(originalElement.x, cropBox.y, cropBox.x - originalElement.x, cropBox.height);
      // 右侧
      ctx.fillRect(cropBox.x + cropBox.width, cropBox.y, originalElement.x + originalElement.width - cropBox.x - cropBox.width, cropBox.height);

      // 绘制剪裁框边框
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);

      // 绘制网格线（三分法）
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      // 垂直线
      ctx.beginPath();
      ctx.moveTo(cropBox.x + cropBox.width / 3, cropBox.y);
      ctx.lineTo(cropBox.x + cropBox.width / 3, cropBox.y + cropBox.height);
      ctx.moveTo(cropBox.x + cropBox.width * 2 / 3, cropBox.y);
      ctx.lineTo(cropBox.x + cropBox.width * 2 / 3, cropBox.y + cropBox.height);
      // 水平线
      ctx.moveTo(cropBox.x, cropBox.y + cropBox.height / 3);
      ctx.lineTo(cropBox.x + cropBox.width, cropBox.y + cropBox.height / 3);
      ctx.moveTo(cropBox.x, cropBox.y + cropBox.height * 2 / 3);
      ctx.lineTo(cropBox.x + cropBox.width, cropBox.y + cropBox.height * 2 / 3);
      ctx.stroke();
    }

    // 恢复画布偏移
    ctx.restore();
    
    // 如果有视频正在生成（没有videoUrl的video元素）或正在播放，持续重绘
    const hasGeneratingVideo = currentElements.some(el => el.type === 'video' && !el.videoUrl);
    const hasPlayingVideo = currentElements.some(el => el.type === 'video' && (el as VideoElement).isPlaying);
    
    if (hasGeneratingVideo || hasPlayingVideo) {
      let animationId: number;
      let isAnimating = true;
      
      const animate = () => {
        if (!isAnimating) return;
        
        // 直接重绘画布
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // 清除并重绘
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);
        
        // 重绘所有元素 - 使用 currentElements（来自 useEffect 依赖）
        currentElements.forEach(element => {
          if (!element.visible) return;
          
          // 对于视频元素，特殊处理绘制
          if (element.type === 'video') {
            const videoEl = element as VideoElement;
            const centerX = videoEl.x + videoEl.width / 2;
            const centerY = videoEl.y + videoEl.height / 2;
            
            // 检查 video 是否是真正的 HTMLVideoElement
            const isValidVideoElement = videoEl.video && 
              typeof (videoEl.video as HTMLVideoElement).play === 'function';
            
            if (isValidVideoElement && videoEl.videoUrl) {
              const videoObj = videoEl.video as HTMLVideoElement;
              try {
                ctx.drawImage(videoObj, videoEl.x, videoEl.y, videoEl.width, videoEl.height);
              } catch (e) {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(videoEl.x, videoEl.y, videoEl.width, videoEl.height);
              }
              
              ctx.strokeStyle = videoEl.isPlaying ? '#10b981' : '#6b7280';
              ctx.lineWidth = 2;
              ctx.strokeRect(videoEl.x, videoEl.y, videoEl.width, videoEl.height);
              
              ctx.fillStyle = videoEl.isPlaying ? '#10b981' : '#6b7280';
              ctx.font = 'bold 12px Arial';
              ctx.fillText('▶ 视频', videoEl.x + 8, videoEl.y + 18);
              
              if (videoEl.isPlaying && videoObj.duration && !isNaN(videoObj.duration)) {
                const progress = videoObj.currentTime / videoObj.duration;
                const progressBarHeight = 4;
                const progressBarY = videoEl.y + videoEl.height - progressBarHeight - 5;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(videoEl.x + 5, progressBarY, videoEl.width - 10, progressBarHeight);
                ctx.fillStyle = '#10b981';
                ctx.fillRect(videoEl.x + 5, progressBarY, (videoEl.width - 10) * progress, progressBarHeight);
              }
            } else if (videoEl.videoUrl) {
              ctx.fillStyle = '#1a1a1a';
              ctx.fillRect(videoEl.x, videoEl.y, videoEl.width, videoEl.height);
              ctx.fillStyle = '#10b981';
              ctx.font = '14px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('点击播放按钮加载', centerX, centerY);
              ctx.textAlign = 'left';
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 2;
              ctx.strokeRect(videoEl.x, videoEl.y, videoEl.width, videoEl.height);
            } else {
              ctx.fillStyle = '#1a1a1a';
              ctx.fillRect(videoEl.x, videoEl.y, videoEl.width, videoEl.height);
              const radius = Math.min(videoEl.width, videoEl.height) * 0.1;
              const time = Date.now() / 1000;
              const startAngle = time * 2;
              ctx.strokeStyle = '#6366f1';
              ctx.lineWidth = 4;
              ctx.lineCap = 'round';
              ctx.globalAlpha = 0.8;
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, startAngle, startAngle + Math.PI * 1.5);
              ctx.stroke();
              ctx.globalAlpha = 1;
              ctx.strokeStyle = '#6366f1';
              ctx.lineWidth = 2;
              ctx.strokeRect(videoEl.x, videoEl.y, videoEl.width, videoEl.height);
              ctx.fillStyle = '#6366f1';
              ctx.font = '14px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('视频生成中...', centerX, centerY + radius + 25);
              ctx.textAlign = 'left';
            }
          } else {
            drawElement(ctx, element);
          }
        });
        
        ctx.restore();
        
        // 继续动画
        animationId = requestAnimationFrame(animate);
      };
      
      animationId = requestAnimationFrame(animate);
      return () => {
        isAnimating = false;
        cancelAnimationFrame(animationId);
      };
    }
  }, [currentElements, canvasSize, pan, zoom, croppingState, editingTextId]);

  return (
    <div className="h-screen bg-gray-900 text-white relative overflow-hidden" style={{ backgroundColor: 'var(--ui-bg-color)' }}>
      {/* Top Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-20 h-16 border-b border-white/10 px-4 flex items-center" style={{ backgroundColor: 'var(--ui-bg-color)' }}>
        {/* 返回按钮 - 左侧固定宽度 */}
        <div className="flex-shrink-0 w-24">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
            title="返回创作者中心"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">返回首页</span>
          </button>
        </div>

        {/* 工具栏 - 居中 */}
        <div className="flex-1 flex justify-center">
          <Toolbar
            t={t}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            drawingOptions={drawingOptions}
            setDrawingOptions={setDrawingOptions}
            onUpload={handleFileUpload}
            isCropping={!!croppingState}
            onConfirmCrop={handleConfirmCrop}
            onCancelCrop={handleCancelCrop}
            onSettingsClick={() => setShowCanvasSettings(true)}
            onLayersClick={() => setShowLayerPanel(true)}
            onBoardsClick={() => setShowBoardPanel(true)}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            selectedImageSize={selectedImageSize}
            onImageSizeChange={setSelectedImageSize}
          />
        </div>

        {/* 右侧按钮 - 水印和升级VIP */}
        <div className="flex-shrink-0 flex items-center gap-3">
          {/* 水印开关 */}
          <button
            onClick={handleWatermarkToggle}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${watermarkEnabled ? 'bg-blue-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            title={watermarkEnabled ? '禁用水印' : '启用水印'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            水印
          </button>

          {/* 升级VIP按钮 */}
          <button
            onClick={handleRechargeClick}
            className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black rounded-lg text-sm font-medium transition-all transform hover:scale-105 shadow-lg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            升级VIP
          </button>
        </div>
      </div>

      {/* Main Canvas Area - Full Screen Grid Background */}
      <div className="absolute inset-0">
        <svg
          className="w-full h-full"
          style={{ backgroundColor: 'var(--ui-bg-color)' }}
        >
          <defs>
            <pattern id="fullGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#6b7280" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#fullGrid)" />
        </svg>

        {/* Canvas Container - 占满整个屏幕 */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            // mouseLeave 时只清理拖动状态，不触发视频播放
            if (isPanning) setIsPanning(false);
            if (isDragging) {
              setIsDragging(false);
              setDragElement(null);
            }
            if (isResizing) {
              setIsResizing(false);
              setResizeHandle(null);
              setResizeStartBounds(null);
            }
            if (isCropDragging) {
              setIsCropDragging(false);
              setCropDragHandle(null);
            }
          }}
          style={{
            cursor: isPanning ? 'grabbing' :
              activeTool === 'pan' ? 'grab' :
                activeTool === 'select' ? 'default' :
                  activeTool === 'text' ? 'text' :
                    activeTool === 'erase' ? 'crosshair' :
                      'crosshair'
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{
              background: 'transparent',
              width: '100%',
              height: '100%'
            }}
          />

          {/* Selection Overlay - 选中效果和控制点 */}
          <svg
            className="absolute inset-0"
            style={{
              pointerEvents: 'none',
              overflow: 'visible'
            }}
          >
            {/* 应用平移和缩放变换 */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* 剪裁模式下显示剪裁框控制点 */}
              {croppingState && (() => {
                const { cropBox } = croppingState;
                const handleSize = 10 / zoom;

                // 剪裁框控制点位置和光标样式
                const cropHandles = [
                  { name: 'tl', x: cropBox.x, y: cropBox.y, cursor: 'nwse-resize' },
                  { name: 'tm', x: cropBox.x + cropBox.width / 2, y: cropBox.y, cursor: 'ns-resize' },
                  { name: 'tr', x: cropBox.x + cropBox.width, y: cropBox.y, cursor: 'nesw-resize' },
                  { name: 'ml', x: cropBox.x, y: cropBox.y + cropBox.height / 2, cursor: 'ew-resize' },
                  { name: 'mr', x: cropBox.x + cropBox.width, y: cropBox.y + cropBox.height / 2, cursor: 'ew-resize' },
                  { name: 'bl', x: cropBox.x, y: cropBox.y + cropBox.height, cursor: 'nesw-resize' },
                  { name: 'bm', x: cropBox.x + cropBox.width / 2, y: cropBox.y + cropBox.height, cursor: 'ns-resize' },
                  { name: 'br', x: cropBox.x + cropBox.width, y: cropBox.y + cropBox.height, cursor: 'nwse-resize' },
                ];

                const handleCropHandleMouseDown = (handleName: string, e: React.MouseEvent) => {
                  e.stopPropagation();
                  const mousePos = getMousePos(e as any);
                  setIsCropDragging(true);
                  setCropDragHandle(handleName);
                  setCropDragStart(mousePos);
                };

                return (
                  <g>
                    {/* 剪裁框中心区域 - 用于移动整个剪裁框 */}
                    <rect
                      x={cropBox.x}
                      y={cropBox.y}
                      width={cropBox.width}
                      height={cropBox.height}
                      fill="transparent"
                      style={{ pointerEvents: 'auto', cursor: 'move' }}
                      onMouseDown={(e) => handleCropHandleMouseDown('move', e)}
                    />
                    {/* 剪裁框控制点 */}
                    {cropHandles.map(h => (
                      <rect
                        key={h.name}
                        x={h.x - handleSize / 2}
                        y={h.y - handleSize / 2}
                        width={handleSize}
                        height={handleSize}
                        fill="white"
                        stroke="rgb(59, 130, 246)"
                        strokeWidth={2 / zoom}
                        style={{ pointerEvents: 'auto', cursor: h.cursor }}
                        onMouseDown={(e) => handleCropHandleMouseDown(h.name, e)}
                      />
                    ))}
                  </g>
                );
              })()}

              {/* 非剪裁模式下显示选中元素的控制点 */}
              {!croppingState && selectedElementIds.map(id => {
                const element = currentElements.find(el => el.id === id);
                if (!element) return null;
                const bounds = getElementBounds(element, currentElements);
                const handleSize = 8 / zoom;

                // 控制点位置
                const handles = [
                  { name: 'tl', x: bounds.x, y: bounds.y, cursor: 'nwse-resize' },
                  { name: 'tm', x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'ns-resize' },
                  { name: 'tr', x: bounds.x + bounds.width, y: bounds.y, cursor: 'nesw-resize' },
                  { name: 'ml', x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'ew-resize' },
                  { name: 'mr', x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'ew-resize' },
                  { name: 'bl', x: bounds.x, y: bounds.y + bounds.height, cursor: 'nesw-resize' },
                  { name: 'bm', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 'ns-resize' },
                  { name: 'br', x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'nwse-resize' },
                ];

                const handleResizeStart = (handleName: string, e: React.MouseEvent) => {
                  e.stopPropagation();
                  const mousePos = getMousePos(e as any);
                  setIsResizing(true);
                  setResizeHandle(handleName);
                  setResizeStartPos(mousePos);
                  setResizeStartBounds({ ...bounds });
                };

                return (
                  <g key={id}>
                    {/* 选中边框 */}
                    <rect
                      x={bounds.x}
                      y={bounds.y}
                      width={bounds.width}
                      height={bounds.height}
                      fill="none"
                      stroke="rgb(59, 130, 246)"
                      strokeWidth={2 / zoom}
                    />
                    {/* 控制点 - 可拖动调整大小 */}
                    {handles.map(h => (
                      <rect
                        key={h.name}
                        x={h.x - handleSize / 2}
                        y={h.y - handleSize / 2}
                        width={handleSize}
                        height={handleSize}
                        fill="white"
                        stroke="rgb(59, 130, 246)"
                        strokeWidth={1 / zoom}
                        style={{ cursor: h.cursor, pointerEvents: 'auto' }}
                        onMouseDown={(e) => handleResizeStart(h.name, e)}
                      />
                    ))}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Crop Toolbar - 剪裁模式的工具栏 */}
        {croppingState && (() => {
          const { cropBox } = croppingState;

          // 计算工具栏在屏幕上的位置
          const toolbarX = pan.x + (cropBox.x + cropBox.width / 2) * zoom;
          const toolbarY = pan.y + cropBox.y * zoom - 60;

          return (
            <div
              className="absolute z-40 pointer-events-auto"
              style={{
                left: toolbarX,
                top: Math.max(70, toolbarY),
                transform: 'translateX(-50%)'
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="p-1.5 bg-white rounded-lg shadow-lg flex items-center space-x-2 border border-gray-200">
                {/* 确认剪裁 */}
                <button
                  title="确认剪裁"
                  onClick={handleConfirmCrop}
                  className="px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium flex items-center gap-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  确认
                </button>

                {/* 取消剪裁 */}
                <button
                  title="取消剪裁"
                  onClick={handleCancelCrop}
                  className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium flex items-center gap-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  取消
                </button>
              </div>
            </div>
          );
        })()}

        {/* Selection Toolbar - 选中元素的工具栏 */}
        {selectedElementIds.length > 0 && !editingTextId && !croppingState && (() => {
          const selectedElement = currentElements.find(el => el.id === selectedElementIds[0]);
          if (!selectedElement) return null;

          const bounds = getElementBounds(selectedElement, currentElements);

          // 计算工具栏在屏幕上的位置
          const toolbarX = pan.x + (bounds.x + bounds.width / 2) * zoom;
          const toolbarY = pan.y + bounds.y * zoom - 60;

          return (
            <div
              className="absolute z-40 pointer-events-auto"
              style={{
                left: toolbarX,
                top: Math.max(70, toolbarY),
                transform: 'translateX(-50%)'
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="p-1.5 bg-white rounded-lg shadow-lg flex items-center space-x-1 border border-gray-200">
                {/* 复制按钮 - 不显示给视频元素 */}
                {selectedElement.type !== 'video' && (
                <button
                  title={t('contextMenu.copy')}
                  onClick={() => {
                    // 复制元素
                    const newElement = { ...selectedElement, id: generateId(), x: selectedElement.x + 20, y: selectedElement.y + 20 };
                    setElements(prev => {
                      const newElements = [...prev, newElement];
                      setTimeout(() => saveToHistory(newElements), 0);
                      return newElements;
                    });
                    setSelectedElementIds([newElement.id]);
                  }}
                  className="p-2 rounded hover:bg-gray-100 text-gray-700"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                )}

                {/* 下载按钮 - 仅图片 */}
                {selectedElement.type === 'image' && (
                  <button
                    title={t('contextMenu.download')}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = 'image.png';
                      link.href = selectedElement.href || '';
                      link.click();
                    }}
                    className="p-2 rounded hover:bg-gray-100 text-gray-700"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </button>
                )}

                {/* 裁剪按钮 - 仅图片 */}
                {selectedElement.type === 'image' && !croppingState && (
                  <button
                    title={t('contextMenu.crop')}
                    onClick={() => handleStartCrop(selectedElement as ImageElement)}
                    className="p-2 rounded hover:bg-gray-100 text-gray-700"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>
                      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>
                    </svg>
                  </button>
                )}

                {/* 图生视频按钮 - 仅图片 */}
                {selectedElement.type === 'image' && (
                  <button
                    title="图生视频"
                    onClick={handleOpenVideoPanel}
                    className="p-2 rounded hover:bg-indigo-100 hover:text-indigo-600 text-gray-700"
                  >
                    <Video className="w-[18px] h-[18px]" />
                  </button>
                )}

                {/* 圆角滑块 - 仅图片 */}
                {selectedElement.type === 'image' && (
                  <>
                    <div className="h-6 w-px bg-gray-200 mx-1"></div>
                    <div className="flex items-center space-x-1 px-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                        <path d="M10 3H5a2 2 0 0 0-2 2v5" />
                      </svg>
                      <input
                        type="range"
                        min="0"
                        max={Math.min(selectedElement.width, selectedElement.height) / 2}
                        value={(selectedElement as any).borderRadius || 0}
                        onChange={(e) => {
                          setElements(prev => prev.map(el =>
                            el.id === selectedElement.id ? { ...el, borderRadius: parseInt(e.target.value) } : el
                          ));
                        }}
                        className="w-16"
                      />
                      <span className="text-xs text-gray-600 w-6">{(selectedElement as any).borderRadius || 0}</span>
                    </div>
                  </>
                )}

                <div className="h-6 w-px bg-gray-200 mx-1"></div>

                {/* 删除按钮 */}
                <button
                  title={t('contextMenu.delete')}
                  onClick={() => {
                    setElements(prev => {
                      const newElements = prev.filter(el => el.id !== selectedElement.id);
                      // 保存历史记录
                      setTimeout(() => saveToHistory(newElements), 0);
                      return newElements;
                    });
                    setSelectedElementIds([]);
                  }}
                  className="p-2 rounded hover:bg-red-100 hover:text-red-600 text-gray-700"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Zoom Controls */}
        <div className="absolute top-20 right-4 flex flex-row gap-2 z-30">
          <button
            onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}
            className="w-8 h-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg shadow-lg text-white hover:bg-white/20 flex items-center justify-center transition-all"
          >
            +
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.01, prev - 0.1))}
            className="w-8 h-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg shadow-lg text-white hover:bg-white/20 flex items-center justify-center transition-all"
          >
            -
          </button>
          <span className="text-xs text-white bg-white/10 backdrop-blur-xl border border-white/20 px-2 py-1 rounded-lg shadow-lg">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Video Play Buttons - 为每个视频元素渲染独立的播放/暂停按钮 */}
        {elements.filter(el => el.type === 'video' && (el as VideoElement).videoUrl).map(el => {
          const videoEl = el as VideoElement;
          // 计算按钮在屏幕上的位置（视频中心）- 使用 elements 以实时跟随拖动
          const buttonSize = 36;
          // 位置计算：视频中心
          const screenX = pan.x + (videoEl.x + videoEl.width / 2 - buttonSize / zoom / 2) * zoom;
          const screenY = pan.y + (videoEl.y + videoEl.height / 2 - buttonSize / zoom / 2) * zoom;
          
          // 计算视频区域在屏幕上的位置（用于悬停检测）
          const videoScreenX = pan.x + videoEl.x * zoom;
          const videoScreenY = pan.y + videoEl.y * zoom;
          const videoScreenWidth = videoEl.width * zoom;
          const videoScreenHeight = videoEl.height * zoom;
          
          // 播放/暂停处理函数
          const handlePlayPause = (e: React.MouseEvent) => {
            e.stopPropagation();
            
            // 从最新的 elements 状态中获取视频元素
            const currentVideoEl = elements.find(item => item.id === videoEl.id) as VideoElement | undefined;
            if (!currentVideoEl || !currentVideoEl.videoUrl) return;
            
            console.log('点击播放按钮, video对象:', currentVideoEl.video, 'videoUrl:', currentVideoEl.videoUrl);
            
            // 检查 video 是否是真正的 HTMLVideoElement
            const isValidVideoElement = currentVideoEl.video && 
              typeof currentVideoEl.video.play === 'function' &&
              typeof currentVideoEl.video.pause === 'function';
            
            if (isValidVideoElement) {
              const videoObj = currentVideoEl.video as HTMLVideoElement;
              if (currentVideoEl.isPlaying) {
                // 暂停视频
                console.log('暂停视频');
                videoObj.pause();
                setElements(prev => prev.map(item => 
                  item.id === videoEl.id ? { ...item, isPlaying: false } as VideoElement : item
                ));
              } else {
                // 播放视频
                console.log('播放视频');
                videoObj.play().then(() => {
                  console.log('播放成功');
                  setElements(prev => prev.map(item => 
                    item.id === videoEl.id ? { ...item, isPlaying: true } as VideoElement : item
                  ));
                }).catch(err => {
                  console.error('视频播放失败:', err);
                  toast.error('视频播放失败: ' + err.message);
                });
              }
            } else {
              // 视频对象不存在或无效，需要重新加载
              console.log('开始加载视频:', currentVideoEl.videoUrl);
              toast.info('正在加载视频...');
              
              const video = document.createElement('video');
              video.crossOrigin = 'anonymous';
              video.preload = 'auto';
              video.muted = false; // 允许播放声音
              video.playsInline = true;
              
              video.oncanplay = () => {
                console.log('视频可以播放了');
              };
              
              video.onloadeddata = () => {
                console.log('视频数据加载完成，跳转到第一帧');
                video.currentTime = 0.01; // 跳到第一帧
              };
              
              video.onseeked = () => {
                console.log('视频seek完成，更新元素');
                setElements(prev => prev.map(item => 
                  item.id === videoEl.id 
                    ? { ...item, video: video, isPlaying: false } as VideoElement 
                    : item
                ));
                toast.success('视频加载完成，再次点击播放');
              };
              
              video.onended = () => {
                console.log('视频播放结束');
                setElements(prev => prev.map(item => 
                  item.id === videoEl.id ? { ...item, isPlaying: false } as VideoElement : item
                ));
              };
              
              video.onerror = (e) => {
                console.error('视频加载失败:', e, video.error);
                toast.error('视频加载失败');
              };
              
              // 设置 src 开始加载
              video.src = currentVideoEl.videoUrl;
              video.load();
            }
          };
          
          // 判断是否显示按钮：未播放时始终显示，播放时只有悬停才显示
          const shouldShowButton = !videoEl.isPlaying || hoveredVideoId === videoEl.id;
          
          return (
            <div key={`video-container-${videoEl.id}`}>
              {/* 悬停检测区域 - 覆盖整个视频，用于显示播放按钮 */}
              <div
                className="absolute"
                style={{
                  left: videoScreenX,
                  top: videoScreenY,
                  width: videoScreenWidth,
                  height: videoScreenHeight,
                  zIndex: 5,
                  pointerEvents: 'none', // 不阻止鼠标事件，让事件传递到下层canvas
                }}
                onMouseEnter={() => setHoveredVideoId(videoEl.id)}
                onMouseLeave={() => setHoveredVideoId(null)}
              />
              
              {/* 播放/暂停按钮 - 只在需要时显示，不阻止视频选中 */}
              {shouldShowButton && (
                <button
                  className="absolute flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow-lg hover:scale-110"
                  style={{
                    left: screenX,
                    top: screenY,
                    width: Math.max(buttonSize, 28),
                    height: Math.max(buttonSize, 28),
                    zIndex: 6,
                    transition: 'transform 0.15s, background-color 0.15s, opacity 0.2s',
                    opacity: videoEl.isPlaying ? 0.9 : 1,
                    pointerEvents: 'auto', // 只有按钮本身可以接收事件
                  }}
                  onMouseDown={(e) => {
                    // 只阻止冒泡，不阻止默认行为
                    e.stopPropagation();
                  }}
                  onMouseEnter={() => setHoveredVideoId(videoEl.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayPause(e);
                  }}
                  title={videoEl.isPlaying ? '暂停' : '播放'}
                >
                  {videoEl.isPlaying ? (
                    // 暂停图标
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-800">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    // 播放图标
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-800 ml-0.5">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          );
        })}

        {/* Text Editing Input */}
        {editingTextId && (() => {
          // 优先使用 pendingTextElementRef（新创建的元素），否则从 elements 中查找
          let editingElement = pendingTextElementRef.current && pendingTextElementRef.current.id === editingTextId
            ? pendingTextElementRef.current
            : elements.find(el => el.id === editingTextId);

          if (!editingElement || editingElement.type !== 'text') return null;

          // 计算文字元素在屏幕上的位置（画布从左上角开始）
          const screenX = pan.x + editingElement.x * zoom;
          const screenY = pan.y + editingElement.y * zoom;

          return (
            <input
              ref={(input) => {
                // 使用 ref callback 来确保输入框获得焦点
                if (input) {
                  setTimeout(() => input.focus(), 0);
                }
              }}
              type="text"
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onBlur={() => {
                // 清除 pending ref
                pendingTextElementRef.current = null;

                // 保存文字内容，如果为空则删除元素
                if (textInputValue.trim()) {
                  const editingEl = elements.find(el => el.id === editingTextId);
                  if (editingEl && editingEl.type === 'text') {
                    const size = measureTextSize(textInputValue, editingEl.fontSize, editingEl.fontFamily || 'Arial', editingEl.fontWeight || 'normal');
                    setElements(prev => {
                      const newElements = prev.map(el =>
                        el.id === editingTextId ? { ...el, text: textInputValue, width: size.width, height: size.height } : el
                      );
                      setTimeout(() => saveToHistory(newElements), 0);
                      return newElements;
                    });
                  }
                } else {
                  // 空文字，删除元素
                  setElements(prev => {
                    const newElements = prev.filter(el => el.id !== editingTextId);
                    setTimeout(() => saveToHistory(newElements), 0);
                    return newElements;
                  });
                }
                setEditingTextId(null);
                setTextInputValue('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // 清除 pending ref
                  pendingTextElementRef.current = null;

                  if (textInputValue.trim()) {
                    const editingEl = elements.find(el => el.id === editingTextId);
                    if (editingEl && editingEl.type === 'text') {
                      const size = measureTextSize(textInputValue, editingEl.fontSize, editingEl.fontFamily || 'Arial', editingEl.fontWeight || 'normal');
                      setElements(prev => {
                        const newElements = prev.map(el =>
                          el.id === editingTextId ? { ...el, text: textInputValue, width: size.width, height: size.height } : el
                        );
                        setTimeout(() => saveToHistory(newElements), 0);
                        return newElements;
                      });
                    }
                  } else {
                    setElements(prev => {
                      const newElements = prev.filter(el => el.id !== editingTextId);
                      setTimeout(() => saveToHistory(newElements), 0);
                      return newElements;
                    });
                  }
                  setEditingTextId(null);
                  setTextInputValue('');
                } else if (e.key === 'Escape') {
                  // 清除 pending ref
                  pendingTextElementRef.current = null;

                  // 取消编辑，如果是新建的空文字则删除
                  const element = elements.find(el => el.id === editingTextId);
                  if (element && element.type === 'text' && !element.text) {
                    setElements(prev => prev.filter(el => el.id !== editingTextId));
                  }
                  setEditingTextId(null);
                  setTextInputValue('');
                }
              }}
              style={{
                position: 'absolute',
                left: screenX,
                top: screenY,
                fontSize: editingElement.fontSize * zoom,
                fontFamily: editingElement.fontFamily,
                fontWeight: editingElement.fontWeight,
                color: editingElement.fillColor,
                background: 'rgba(255, 255, 255, 0.9)',
                border: '2px solid #007bff',
                outline: 'none',
                padding: '4px 8px',
                minWidth: '150px',
                zIndex: 100,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            />
          );
        })()}

        {/* Floating AI Input Bar */}
        <div className="absolute bottom-6 left-6 right-6 z-30 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            {/* 模型选择器 - 自定义下拉菜单 */}
            <div className="flex justify-end mb-3">
              <div className="relative" ref={modelDropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 hover:bg-black/40 transition-colors"
                >
                  <svg className="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  <span className="text-white/90 text-sm max-w-[160px] truncate">
                    {selectedModelInfo?.modelDescribe || selectedModelInfo?.modelName || '选择模型'}
                  </span>
                  <svg
                    className={`w-4 h-4 text-white/60 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {/* 下拉菜单 */}
                {showModelDropdown && (
                  <div className="absolute bottom-full right-0 mb-2 w-80 bg-gray-900/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="p-2 border-b border-white/10">
                      <span className="text-xs text-white/50 px-2">选择生成模型</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto py-1">
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setShowModelDropdown(false);
                          }}
                          className={`w-full px-3 py-2.5 flex items-start gap-3 hover:bg-white/10 transition-colors ${selectedModel === model.id ? 'bg-blue-500/20' : ''
                            }`}
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${selectedModel === model.id ? 'bg-blue-500' : 'bg-white/20'}`} />
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white/90 font-medium truncate">
                                  {model.modelDescribe || model.modelName}
                                </div>
                                {model.remark && (
                                  <div className="text-xs text-white/50 mt-0.5 line-clamp-2">
                                    {model.remark}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ml-2 ${model.modelPrice === 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                                  }`}
                              >
                                {model.modelPrice === 0 ? '免费' : '收费'}
                              </span>
                            </div>
                          </div>
                          {selectedModel === model.id && (
                            <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 主输入框 */}
            <div className="bg-black/20 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              {/* 显示选中的图片数量提示 */}
              {selectedElementIds.length > 0 && currentElements.filter(el => selectedElementIds.includes(el.id) && el.type === 'image').length > 0 && (
                <div className="px-4 pt-3 pb-1">
                  <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full">
                    已选中 {currentElements.filter(el => selectedElementIds.includes(el.id) && el.type === 'image').length} 张图片 - 将进行图片编辑
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 p-3">
                {/* QuickPrompts 快捷效果选择器 */}
                <QuickPrompts
                  t={t}
                  setPrompt={setPrompt}
                  disabled={isGenerating}
                  userEffects={userEffects}
                  onDeleteUserEffect={handleDeleteUserEffect}
                />

                {/* 输入框 */}
                <div className="flex-1">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        // 检查是否选中了图片
                        const selectedImages = currentElements.filter(el => selectedElementIds.includes(el.id) && el.type === 'image');
                        if (selectedImages.length > 0) {
                          handleEditImage(prompt);
                        } else {
                          handleGenerateImage(prompt);
                        }
                      }
                    }}
                    placeholder={
                      currentElements.filter(el => selectedElementIds.includes(el.id) && el.type === 'image').length > 0
                        ? "描述您想要如何编辑选中的图片..."
                        : "描述您想要生成的图像..."
                    }
                    className="w-full bg-transparent border-none text-white placeholder-white/40 resize-none focus:outline-none text-base leading-relaxed px-2 py-2 transition-all duration-200"
                    rows={isInputFocused ? 5 : 2}
                    style={{ 
                      minHeight: isInputFocused ? '100px' : '44px', 
                      maxHeight: isInputFocused ? '200px' : '120px' 
                    }}
                  />
                </div>

                {/* 保存我的prompt按钮 - 仅当有输入内容时显示 */}
                {prompt.trim() && !isGenerating && (
                  <button
                    onClick={() => {
                      const name = window.prompt(t('myEffects.saveEffectPrompt') || '请输入效果名称', t('myEffects.defaultName') || '我的效果');
                      if (name && prompt.trim()) {
                        handleAddUserEffect({ id: `user_${Date.now()}`, name, value: prompt });
                      }
                    }}
                    title={t('myEffects.saveEffectTooltip') || '保存为我的效果'}
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-white/70 rounded-full hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                    </svg>
                  </button>
                )}

                {/* 生成/编辑按钮 */}
                <button
                  onClick={() => {
                    // 检查是否选中了图片
                    const selectedImages = currentElements.filter(el => selectedElementIds.includes(el.id) && el.type === 'image');
                    if (selectedImages.length > 0) {
                      handleEditImage(prompt);
                    } else {
                      handleGenerateImage(prompt);
                    }
                  }}
                  disabled={isGenerating || !prompt.trim()}
                  className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>生成中</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      <span>{currentElements.filter(el => selectedElementIds.includes(el.id) && el.type === 'image').length > 0 ? '编辑' : '生成'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lasso Selection Overlay */}
        {isDrawingLasso && lassoPath.length > 1 && (
          <svg
            className="absolute inset-0 pointer-events-none z-40"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0'
            }}
          >
            <path
              d={lassoPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth={2 / zoom}
              strokeDasharray={`${4 / zoom} ${4 / zoom}`}
            />
          </svg>
        )}
      </div>

      {/* Prompt Bar */}
      {showPromptBar && (
        <PromptBar
          t={t}
          onGenerateImage={handleGenerateImage}
          onEditImage={handleEditImage}
          onClose={() => setShowPromptBar(false)}
          selectedImagesCount={currentElements.filter(el =>
            selectedElementIds.includes(el.id) && el.type === 'image'
          ).length}
          isGenerating={isGenerating}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && <Loader />}

      {/* Canvas Settings Panel */}
      {showCanvasSettings && (
        <CanvasSettings
          isOpen={showCanvasSettings}
          onClose={() => setShowCanvasSettings(false)}
          canvasBackgroundColor={canvasBackgroundColor}
          onCanvasBackgroundColorChange={setCanvasBackgroundColor}
          language={currentLanguage === 'en' ? 'en' : 'zho'}
          setLanguage={(selectedLang) => setLanguage(selectedLang === 'en' ? 'en' : 'zh')}
          uiTheme={uiTheme}
          setUiTheme={setUiTheme}
          buttonTheme={buttonTheme}
          setButtonTheme={setButtonTheme}
          wheelAction={wheelAction}
          setWheelAction={setWheelAction}
          t={t}
        />
      )}

      {/* Layer Panel */}
      {showLayerPanel && (
        <LayerPanel
          isOpen={showLayerPanel}
          onClose={() => setShowLayerPanel(false)}
          elements={currentElements}
          selectedElementIds={selectedElementIds}
          onSelectElement={(id) => setSelectedElementIds(id ? [id] : [])}
          onToggleVisibility={(id) => {
            setElements(prev => prev.map(el =>
              el.id === id ? { ...el, visible: !el.visible } : el
            ));
          }}
          onToggleLock={(id) => {
            setElements(prev => prev.map(el =>
              el.id === id ? { ...el, locked: !el.locked } : el
            ));
          }}
          onRenameElement={(id, name) => {
            setElements(prev => prev.map(el =>
              el.id === id ? { ...el, name } : el
            ));
          }}
          onReorder={(draggedId, targetId, position) => {
            // Implement reordering logic
          }}
        />
      )}

      {/* Board Panel */}
      {showBoardPanel && (
        <BoardPanel
          isOpen={showBoardPanel}
          onClose={() => setShowBoardPanel(false)}
          boards={boards}
          activeBoardId={currentBoardId}
          onSwitchBoard={switchBoard}
          onAddBoard={async () => {
            // 先保存当前Board的elements
            setBoards(prev => prev.map(b =>
              b.id === currentBoardId ? { ...b, elements: elements } : b
            ));
            const newBoardName = `Board ${boards.length + 1}`;

            // 先创建 session，使用 sessionId 作为 boardId
            const sessionId = await createSessionForBoard('temp', newBoardName);
            if (sessionId) {
              const newBoard: Board = {
                id: sessionId, // 使用 sessionId 作为 boardId
                name: newBoardName,
                elements: [],
                sessionId: sessionId
              };
              setBoards(prev => [...prev, newBoard]);
              setCurrentBoardId(newBoard.id);
              setCurrentSessionId(sessionId);
              // 新Board是空白的
              setElements([]);
              setSelectedElementIds([]);
            } else {
              toast.error('创建画板失败');
            }
          }}
          onDuplicateBoard={async (id) => {
            // 先保存当前Board的elements
            setBoards(prev => prev.map(b =>
              b.id === currentBoardId ? { ...b, elements: elements } : b
            ));
            const boardToDuplicate = id === currentBoardId
              ? { ...boards.find(b => b.id === id)!, elements: elements }
              : boards.find(b => b.id === id);
            if (boardToDuplicate) {
              const newBoardName = `${boardToDuplicate.name} (Copy)`;

              // 先创建 session，使用 sessionId 作为 boardId
              const sessionId = await createSessionForBoard('temp', newBoardName);
              if (sessionId) {
                const newBoard: Board = {
                  id: sessionId, // 使用 sessionId 作为 boardId
                  name: newBoardName,
                  elements: JSON.parse(JSON.stringify(boardToDuplicate.elements)),
                  sessionId: sessionId
                };
                setBoards(prev => [...prev, newBoard]);
                setCurrentBoardId(newBoard.id);
                setCurrentSessionId(sessionId);
                setElements([...newBoard.elements]);
                setSelectedElementIds([]);
              } else {
                toast.error('复制画板失败');
              }
            }
          }}
          onDeleteBoard={async (id) => {
            if (boards.length > 1) {
              // 找到要删除的board
              const boardToDelete = boards.find(b => b.id === id);

              // 如果board有关联的sessionId，调用后端删除session
              if (boardToDelete?.sessionId) {
                try {
                  const response = await chatApi.deleteSession(boardToDelete.sessionId);
                  if (response.code === 200) {
                    toast.success('画板删除成功');
                  } else {
                    toast.error(response.msg || '删除画板失败');
                    return; // 如果后端删除失败，不继续删除前端状态
                  }
                } catch (error) {
                  console.error('删除session失败:', error);
                  toast.error('删除画板失败');
                  return; // 如果后端删除失败，不继续删除前端状态
                }
              }

              // 后端删除成功后，更新前端状态
              const newBoards = boards.filter(b => b.id !== id);
              setBoards(newBoards);
              if (currentBoardId === id) {
                const newCurrentBoard = newBoards[0];
                setCurrentBoardId(newCurrentBoard.id);
                setCurrentSessionId(newCurrentBoard.sessionId);
                setElements([...newCurrentBoard.elements]);
                setSelectedElementIds([]);
              }
            } else {
              toast.error('至少需要保留一个画板');
            }
          }}
          onRenameBoard={(id, name) => {
            setBoards(prev => prev.map(b => b.id === id ? { ...b, name } : b));
          }}
          generateBoardThumbnail={generateBoardThumbnail}
        />
      )}


      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileUpload(file);
          }
        }}
      />

      {/* 图生视频内联控件 */}
      {showInlineVideoControls && selectedStartImage && (() => {
        // 动态计算控件位置：基于选中图片的当前位置（实时跟随）
        // 从 elements 中找到最新的图片位置
        const currentImage = elements.find(el => el.id === selectedStartImage.id) as ImageElement | undefined;
        const imageToUse = currentImage || selectedStartImage;
        
        // 计算控件在屏幕上的位置：图片中心下方
        const screenX = pan.x + (imageToUse.x + imageToUse.width / 2) * zoom;
        const screenY = pan.y + (imageToUse.y + imageToUse.height + 20) * zoom; // 图片下方20px
        
        return (
          <div
            className="absolute z-50 pointer-events-auto"
            style={{
              left: screenX,
              top: screenY,
              transform: 'translateX(-50%)',
              minWidth: '500px'
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-2xl p-3 space-y-2">
              {/* 输入框 */}
              <input
                type="text"
                value={videoPrompt}
                onChange={(e) => {
                  const newPrompt = e.target.value;
                  setVideoPrompt(newPrompt);
                  // 实时保存到图片元素
                  if (selectedStartImage) {
                    setElements(prev => prev.map(el => 
                      el.id === selectedStartImage.id && el.type === 'image'
                        ? { ...el, videoPrompt: newPrompt } as ImageElement
                        : el
                    ));
                  }
                }}
                placeholder="描述视频效果（可选）..."
                className="w-full bg-black/50 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGeneratingVideo) {
                    handleGenerateVideo();
                  }
                }}
              />

              {/* 按钮行 */}
              <div className="flex items-center gap-2">
                {/* 模型选择 */}
                <select
                  value={selectedVideoModel}
                  onChange={(e) => setSelectedVideoModel(e.target.value)}
                  className="flex-1 bg-black/50 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 hover:bg-black/70 transition-colors"
                  title="选择视频模型"
                >
                  {videoModels.length === 0 ? (
                    <option value="">加载模型...</option>
                  ) : (
                    videoModels.map((model) => (
                      <option key={model.id} value={model.modelName}>
                        {model.modelDescribe || model.modelName}
                      </option>
                    ))
                  )}
                </select>

                {/* 分辨率 */}
                <select
                  value={videoResolution}
                  onChange={(e) => setVideoResolution(e.target.value as '480P' | '720P' | '1080P')}
                  className="bg-black/50 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 hover:bg-black/70 transition-colors"
                  title="分辨率"
                >
                  <option value="480P">480P</option>
                  <option value="720P">720P</option>
                  <option value="1080P">1080P</option>
                </select>

                {/* 比例 */}
                <select
                  value={videoRatio}
                  onChange={(e) => setVideoRatio(e.target.value as '16:9' | '9:16' | '1:1')}
                  className="bg-black/50 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 hover:bg-black/70 transition-colors"
                  title="视频比例"
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                </select>

                {/* 时长 */}
                <select
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                  className="bg-black/50 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 hover:bg-black/70 transition-colors"
                  title="视频时长"
                >
                  {[3, 5, 8, 10, 15].map(duration => (
                    <option key={duration} value={duration}>{duration}秒</option>
                  ))}
                </select>

                {/* 生成按钮 */}
                <button
                  onClick={handleGenerateVideo}
                  disabled={!selectedStartImage || isGeneratingVideo}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
                  title="生成视频"
                >
                  {isGeneratingVideo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      生成中
                    </>
                  ) : (
                    <>
                      <Video className="w-3.5 h-3.5" />
                      生成
                    </>
                  )}
                </button>

                {/* 关闭按钮 */}
                <button
                  onClick={handleCloseVideoPanel}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  title="关闭"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              {/* 生成进度（如果有） */}
              {videoProgress && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-md p-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{videoProgress.message}</p>
                      {videoProgress.current !== undefined && videoProgress.total !== undefined && (
                        <div className="mt-1">
                          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 transition-all duration-300"
                              style={{ width: `${(videoProgress.current / videoProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ImageEditorPage;