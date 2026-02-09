import React, { useEffect, useRef } from 'react';

// 一个简易的 Chrome 离线恐龙跳障碍小游戏实现
// 特点：
// - 键盘 Space/ArrowUp/W 或点击/触摸进行跳跃
// - 障碍物随机间隔生成并向左移动
// - 碰撞检测失败后可按 Space 或点击重新开始
// - 使用 canvas 绘制，requestAnimationFrame 驱动

export const DinoGame: React.FC<{ className?: string }>= ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef<boolean>(false); // 初始不运行，等待按键开始
  const crashedRef = useRef<boolean>(false);
  const scoreRef = useRef<number>(0);

  // 角色和场景参数（groundY 在渲染时按画布高度动态计算）
  const dino = useRef({ x: 40, y: 0, width: 28, height: 32, vy: 0 });
  const obstaclesRef = useRef<Array<{ x: number; width: number; height: number }>>([]);
  const spawnCooldownRef = useRef<number>(0); // 生成冷却（帧）

  // 配置参数
  const GRAVITY = 0.7;
  const JUMP_VELOCITY = 12;
  const BASE_SPEED = 4; // 场景滚动速度

  const resetGame = (canvas: HTMLCanvasElement) => {
    dino.current = { x: Math.floor(canvas.width / 3), y: 0, width: 28, height: 32, vy: 0 };
    obstaclesRef.current = [];
    scoreRef.current = 0;
    crashedRef.current = false;
    runningRef.current = false; // 重置后等待开始
    // 初始放置一个障碍，避免长时间无障碍
    const initialX = canvas.width + 100;
    obstaclesRef.current.push({ x: initialX, width: 18, height: 26 });
  };

  const spawnObstacleIfNeeded = (canvas: HTMLCanvasElement) => {
    if (spawnCooldownRef.current > 0) return;
    const obstacles = obstaclesRef.current;
    // 屏内（可见）障碍数量
    const onScreen = obstacles.filter(o => o.x < canvas.width && o.x + o.width > 0);
    const onScreenCount = onScreen.length;

    // 控制同屏 1-2 个
    const MAX_ONSCREEN = 2;
    const MIN_ONSCREEN = 1;

    // 右侧最靠右的障碍 x
    const rightmostX = obstacles.length > 0 ? Math.max(...obstacles.map(o => o.x)) : -Infinity;

    // 生成函数
    const pushRandomObstacle = (nearSpawn: boolean) => {
      const gapAheadMin = nearSpawn ? 80 : 140;
      const gapAheadMax = nearSpawn ? 180 : 260;
      const desiredX = canvas.width + (gapAheadMin + Math.random() * (gapAheadMax - gapAheadMin));
      // 至少保持相邻障碍间距 >= 1/3 屏幕宽度
      const minSpacing = Math.floor(canvas.width / 3);
      const baseX = rightmostX !== -Infinity ? rightmostX + minSpacing : desiredX;
      const x = Math.max(desiredX, baseX);
      const h = 18 + Math.floor(Math.random() * 26);
      const w = 12 + Math.floor(Math.random() * 18);
      obstacles.push({ x, width: w, height: h });
      // 设置冷却，避免一帧内连续生成
      spawnCooldownRef.current = Math.floor(30 + Math.random() * 40); // ~0.5-1.2 秒（在 60fps）
    };

    if (onScreenCount < MIN_ONSCREEN) {
      // 屏内没有：尽快补一个，离屏边较近
      pushRandomObstacle(true);
      return;
    }

    if (onScreenCount < MAX_ONSCREEN) {
      // 屏内只有 1 个：当最右侧障碍离右边缘有一定距离时，补第二个
      const minGapToEdge = 120; // 与右边缘的最小间隔
      if (rightmostX < canvas.width - minGapToEdge) {
        pushRandomObstacle(false);
      }
    }
  };

  const doJump = () => {
    if (!runningRef.current) return;
    if (crashedRef.current) return; // 崩溃后等待重开
    if (dino.current.y <= 0) {
      dino.current.vy = JUMP_VELOCITY;
    }
  };

  const startOrJump = (canvas: HTMLCanvasElement) => {
    if (crashedRef.current) {
      resetGame(canvas);
      runningRef.current = true; // 死亡后一次按键即可重开并开始
      return;
    }
    if (!runningRef.current) {
      runningRef.current = true; // 首次启动
      doJump();
      return;
    }
    doJump();
  };

  const handleKeyDown = (e: KeyboardEvent, canvas: HTMLCanvasElement) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      startOrJump(canvas);
    }
  };

  const handlePointer = (canvas: HTMLCanvasElement) => {
    startOrJump(canvas);
  };

  const loop = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    let lastTime = 0;
    const targetFPS = 30; // 降低帧率提高性能
    const frameInterval = 1000 / targetFPS;
    
    const render = (currentTime: number) => {
      if (currentTime - lastTime < frameInterval) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      lastTime = currentTime;
      const groundY = Math.floor(canvas.height * 0.8);
      // 更新
      if (runningRef.current && !crashedRef.current) {
        // 恐龙竖直运动
        dino.current.vy -= GRAVITY;
        dino.current.y += dino.current.vy;
        if (dino.current.y < 0) {
          dino.current.y = 0;
          dino.current.vy = 0;
        }
        // const speed = BASE_SPEED + Math.min(8, Math.floor(scoreRef.current / 300));
        // 障碍左移
        const speed = BASE_SPEED;
        obstaclesRef.current.forEach(o => (o.x -= speed));
        // 移除离开屏幕的障碍
        obstaclesRef.current = obstaclesRef.current.filter(o => o.x + o.width > -10);
        // 冷却递减
        if (spawnCooldownRef.current > 0) spawnCooldownRef.current -= 1;
        // 可能生成新的障碍（同屏保持 1-2 个）
        spawnObstacleIfNeeded(canvas);

        // 碰撞检测（使用收缩后的碰撞框，减少误判）
        const dinoBottom = groundY - dino.current.y; // 底部随跳跃上移
        const dinoTop = groundY - dino.current.height - dino.current.y;
        const dinoLeft = dino.current.x;
        const dinoRight = dino.current.x + dino.current.width;
        const inset = 3; // 收缩像素
        const dinoL = dinoLeft + inset;
        const dinoR = dinoRight - inset;
        const dinoT = dinoTop + inset;
        const dinoB = dinoBottom - 1; // 脚部留一点容错
        for (const o of obstaclesRef.current) {
          const oLeft = o.x + 1;
          const oRight = o.x + o.width - 1;
          const oTop = groundY - o.height + 2;
          const oBottom = groundY;
          const intersect = !(dinoR < oLeft || dinoL > oRight || dinoB < oTop || dinoT > oBottom);
          if (intersect) {
            crashedRef.current = true;
            runningRef.current = false;
            break;
          }
        }

        // 计分
        if (!crashedRef.current) {
          scoreRef.current += 1;
        }
      }

      // 绘制
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 天空背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 地面（简化绘制）
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, groundY + 1, canvas.width, 2);

      // 恐龙（最初的方块样式 + 眼睛）
      const dX = dino.current.x;
      const dY = groundY - dino.current.height - dino.current.y;
      const W = dino.current.width;
      const H = dino.current.height;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(dX, dY, W, H);
      // 眼睛
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dX + W - 10, dY + 6, 4, 4);

      // 障碍
      ctx.fillStyle = '#334155';
      obstaclesRef.current.forEach(o => {
        ctx.fillRect(o.x, groundY - o.height, o.width, o.height);
      });

      // 分数
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \'Liberation Mono\', \'Courier New\', monospace';
      ctx.fillText(`分数: ${scoreRef.current}`, canvas.width - 100, 20);

      if (!runningRef.current && !crashedRef.current) {
        // 初始等待开始提示
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.fillText('按空格或点击开始', canvas.width / 2 - 90, canvas.height / 2);
      } else if (crashedRef.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.fillText('撞到了！按空格或点击重试', canvas.width / 2 - 120, canvas.height / 2);
      } else if (scoreRef.current < 30) {
        // 新手提示
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 14px ui-sans-serif, system-ui';
        ctx.fillText('按空格或点击跳跃', 16, 24);
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置初始尺寸（响应式：根据容器宽度）
    const parent = canvas.parentElement;
    const width = Math.min(720, Math.max(480, (parent?.clientWidth || 600) - 32));
    canvas.width = width;
    canvas.height = 250;

    resetGame(canvas);

    const keydown = (e: KeyboardEvent) => handleKeyDown(e, canvas);
    const click = () => handlePointer(canvas);
    const touch = () => handlePointer(canvas);

    window.addEventListener('keydown', keydown);
    canvas.addEventListener('click', click);
    canvas.addEventListener('touchstart', touch, { passive: true });

    loop(canvas, ctx);

    // 处理窗口尺寸变化
    const onResize = () => {
      const p = canvas.parentElement;
      const sideR = Math.min(720, Math.max(480, (p?.clientWidth || 600) - 32));
      canvas.width = sideR;
      canvas.height = sideR; // 正方形
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('click', click);
      canvas.removeEventListener('touchstart', touch);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className={className}>
      <div className="flex flex-col items-center">
        <canvas ref={canvasRef} className="rounded-lg border border-slate-200 bg-white shadow-sm select-none touch-none" />
      </div>
    </div>
  );
};

export default DinoGame;


