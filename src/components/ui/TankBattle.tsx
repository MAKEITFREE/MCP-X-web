import React, { useEffect, useRef } from 'react';

type BulletOwner = 'player' | 'enemy';

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: BulletOwner;
  ttl: number; // 帧寿命
}

interface Tank {
  x: number;
  y: number;
  angle: number; // 朝向（弧度）
  width: number;
  height: number;
  speed: number;
  turnSpeed: number;
  hp?: number; // 敌人使用
  lives?: number; // 玩家使用
  shootCooldown: number; // 当前冷却帧数
  // 敌人随机行为状态
  moveDirection?: number; // 当前移动方向（0=上 1=右 2=下 3=左）
  moveTimer?: number; // 剩余移动时间（帧）
  idleTimer?: number; // 剩余停止时间（帧）
}

interface Explosion {
  x: number;
  y: number;
  ttl: number;
}

const degToRad = (deg: number) => (deg * Math.PI) / 180;

export const TankBattle: React.FC<{ className?: string }>= ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // 游戏状态引用
  const playerRef = useRef<Tank | null>(null);
  const enemiesRef = useRef<Tank[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const scoreRef = useRef<number>(0);
  const gameOverRef = useRef<boolean>(false);
  const runningRef = useRef<boolean>(true);
  type Obstacle = { x: number; y: number; width: number; height: number };
  const obstaclesRef = useRef<Obstacle[]>([]);
  // 关卡与老巢
  const levelRef = useRef<number>(1);
  const enemiesToSpawnRef = useRef<number>(0);
  const enemiesRemainingRef = useRef<number>(0);
  const spawnCooldownRef = useRef<number>(0);
  const baseRef = useRef<{ x: number; y: number; width: number; height: number; destroyed: boolean; hp: number; maxHp: number } | null>(null);
  const nextSpawnIdxRef = useRef<number>(0);

  // 输入状态
  const inputRef = useRef({ up: false, down: false, left: false, right: false, fire: false });

  // 配置
  const WORLD = { width: 800, height: 420 };
  const COLORS = {
    bg: '#f8fafc',
    ground: '#e2e8f0',
    player: '#0ea5e9',
    playerTurret: '#0369a1',
    enemy: '#ef4444',
    enemyTurret: '#991b1b',
    bullet: '#0f172a',
    text: '#334155',
  };

  const LEVELS = {
    totalLevels: 10,
    enemiesPerLevel: 10,
    maxOnField: 3,
    spawnCooldownFrames: 50, // ~0.8s 在60fps
  } as const;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const resetGame = (canvas: HTMLCanvasElement) => {
    const startX = Math.floor(canvas.width / 2 - 40); // 老巢附近
    const startY = canvas.height - 80;
    playerRef.current = {
      x: startX,
      y: startY,
      angle: -Math.PI / 2, // 朝上
      width: 34,
      height: 22,
      speed: 2.2,
      turnSpeed: degToRad(3.2),
      lives: 3,
      shootCooldown: 0,
    };
    enemiesRef.current = [];
    bulletsRef.current = [];
    explosionsRef.current = [];
    scoreRef.current = 0;
    gameOverRef.current = false;
    runningRef.current = true;
    levelRef.current = 1;
    startLevel(canvas);
  };

  const getSpawnPoints = (canvas: HTMLCanvasElement) => {
    const marginX = 60;
    const y = 40; // 顶部固定刷怪线
    return [
      { x: marginX, y },
      { x: Math.floor(canvas.width / 2), y },
      { x: canvas.width - marginX, y },
    ];
  };

  const startLevel = (canvas: HTMLCanvasElement) => {
    enemiesRef.current = [];
    bulletsRef.current = [];
    explosionsRef.current = [];
    enemiesToSpawnRef.current = LEVELS.enemiesPerLevel;
    enemiesRemainingRef.current = LEVELS.enemiesPerLevel;
    spawnCooldownRef.current = 30;
    // 随机障碍物（在中间区域随机生成）
    const w = canvas.width;
    const h = canvas.height;
    const blockW = 40;
    const blockH = 40;
    const minSpacing = 80; // 最小间隔
    const obstacles: Obstacle[] = [];
    
    // 可生成区域：避开顶部敌人刷新区、底部老巢区
    const safeZone = {
      minX: 60,
      maxX: w - 60,
      minY: 100, // 顶部留空给敌人刷新
      maxY: h - 120, // 底部留空给老巢和玩家
    };
    
    // 随机生成3-8个障碍物
    const obstacleCount = 3 + Math.floor(Math.random() * 10);
    let attempts = 0;
    const maxAttempts = 50;
    
    while (obstacles.length < obstacleCount && attempts < maxAttempts) {
      attempts++;
      const x = safeZone.minX + Math.random() * (safeZone.maxX - safeZone.minX - blockW);
      const y = safeZone.minY + Math.random() * (safeZone.maxY - safeZone.minY - blockH);
      
      // 检查与现有障碍物的间隔
      const tooClose = obstacles.some(existing => {
        const dx = Math.abs(x - existing.x);
        const dy = Math.abs(y - existing.y);
        return dx < minSpacing && dy < minSpacing;
      });
      
      if (!tooClose) {
        obstacles.push({ x, y, width: blockW, height: blockH });
      }
    }
    
    obstaclesRef.current = obstacles;
    // 老巢放在底部中央
    const baseW = 32;
    const baseH = 24;
    baseRef.current = {
      x: Math.floor(canvas.width / 2 - baseW / 2),
      y: canvas.height - 40,
      width: baseW,
      height: baseH,
      destroyed: false,
      hp: 3,
      maxHp: 3,
    };
    // 玩家在老巢附近出生并朝上
    if (playerRef.current) {
      playerRef.current.x = Math.floor(canvas.width / 2 - 40); // 老巢左侧一点
      playerRef.current.y = canvas.height - 80;
      playerRef.current.angle = -Math.PI / 2;
      playerRef.current.lives = 3;
    }
  };

  const spawnEnemy = (canvas: HTMLCanvasElement) => {
    if (enemiesToSpawnRef.current <= 0) return;
    const points = getSpawnPoints(canvas);
    const idx = nextSpawnIdxRef.current % points.length;
    nextSpawnIdxRef.current += 1;
    const p = points[idx];
    const enemy: Tank = {
      x: p.x,
      y: p.y,
      angle: Math.PI / 2, // 初始朝下
      width: 32,
      height: 20,
      speed: 1.1, // 敌人移动更慢
      turnSpeed: degToRad(2.4),
      hp: 2,
      shootCooldown: Math.floor(90 + Math.random() * 90), // 1.5-3秒发一炮（60fps）
      moveDirection: Math.floor(Math.random() * 4),
      moveTimer: Math.floor(60 + Math.random() * 120), // 1-3秒移动
      idleTimer: 0,
    };
    enemiesRef.current.push(enemy);
    enemiesToSpawnRef.current -= 1;
    spawnCooldownRef.current = LEVELS.spawnCooldownFrames;
  };

  const fireBullet = (tank: Tank, owner: BulletOwner) => {
    const muzzleOffset = { x: Math.cos(tank.angle) * (tank.width / 2 + 6), y: Math.sin(tank.angle) * (tank.width / 2 + 6) };
    const speed = owner === 'player' ? 5.6 : 4.4;
    const bullet: Bullet = {
      x: tank.x + muzzleOffset.x,
      y: tank.y + muzzleOffset.y,
      vx: Math.cos(tank.angle) * speed,
      vy: Math.sin(tank.angle) * speed,
      owner,
      ttl: 240,
    };
    bulletsRef.current.push(bullet);
  };

  const drawTank = (ctx: CanvasRenderingContext2D, tank: Tank, colorBody: string, colorTurret: string) => {
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle);
    // 车体
    ctx.fillStyle = colorBody;
    ctx.fillRect(-tank.width / 2, -tank.height / 2, tank.width, tank.height);
    // 轮迹
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-tank.width / 2, -tank.height / 2, tank.width, 4);
    ctx.fillRect(-tank.width / 2, tank.height / 2 - 4, tank.width, 4);
    // 炮塔
    ctx.fillStyle = colorTurret;
    ctx.fillRect(0, -3, tank.width / 2 + 6, 6);
    // 车顶
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  };

  const drawExplosion = (ctx: CanvasRenderingContext2D, e: Explosion) => {
    const p = (60 - e.ttl) / 60;
    const r = 8 + p * 22;
    ctx.save();
    const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.4, 'rgba(253,186,116,0.9)');
    grd.addColorStop(1, 'rgba(239,68,68,0.0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const rectsIntersect = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => {
    return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
  };

  const loop = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    let lastTime = 0;
    const targetFPS = 30; // 降低帧率提高性能
    const frameInterval = 1000 / targetFPS;
    
    const step = (currentTime: number) => {
      if (currentTime - lastTime < frameInterval) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      lastTime = currentTime;
      
      const player = playerRef.current!;
      // 更新逻辑
      if (runningRef.current && !gameOverRef.current) {
        // 经典四方向控制：按键即朝向并沿该方向移动（不使用旋转+前进）
        const moveSpeed = player.speed;
        let targetX = player.x;
        let targetY = player.y;
        if (inputRef.current.up) {
          player.angle = -Math.PI / 2; // 上
          targetY -= moveSpeed;
        } else if (inputRef.current.down) {
          player.angle = Math.PI / 2; // 下
          targetY += moveSpeed;
        } else if (inputRef.current.left) {
          player.angle = Math.PI; // 左
          targetX -= moveSpeed;
        } else if (inputRef.current.right) {
          player.angle = 0; // 右
          targetX += moveSpeed;
        }
        // 碰撞检测（玩家 vs 障碍物 + 老巢 + 敌方坦克），尝试逐轴移动
        const collides = (nx: number, ny: number) => {
          // 障碍物碰撞
          const hitObstacle = obstaclesRef.current.some(o => rectsIntersect(nx, ny, player.width, player.height, o.x + o.width / 2, o.y + o.height / 2, o.width, o.height));
          // 老巢碰撞
          const hitBase = baseRef.current && !baseRef.current.destroyed && 
            rectsIntersect(nx, ny, player.width, player.height, baseRef.current.x + baseRef.current.width / 2, baseRef.current.y + baseRef.current.height / 2, baseRef.current.width, baseRef.current.height);
          // 敌方坦克碰撞
          const hitEnemy = enemiesRef.current.some(e => rectsIntersect(nx, ny, player.width, player.height, e.x, e.y, e.width, e.height));
          return hitObstacle || hitBase || hitEnemy;
        };
        let newX = clamp(targetX, 20, canvas.width - 20);
        let newY = clamp(targetY, 20, canvas.height - 20);
        if (!collides(newX, newY)) {
          player.x = newX; player.y = newY;
        } else if (!collides(newX, player.y)) {
          player.x = newX;
        } else if (!collides(player.x, newY)) {
          player.y = newY;
        }

        // 玩家射击（简单冷却）
        if (player.shootCooldown > 0) player.shootCooldown -= 1;
        if (inputRef.current.fire && player.shootCooldown <= 0) {
          fireBullet(player, 'player');
          player.shootCooldown = 16; // 约 ~ 4 发/秒（假定 60fps）
        }

        // 敌人生成：固定刷点 + 同屏上限
        if (spawnCooldownRef.current > 0) spawnCooldownRef.current -= 1;
        const onField = enemiesRef.current.length;
        if (spawnCooldownRef.current <= 0 && onField < LEVELS.maxOnField && enemiesToSpawnRef.current > 0) {
          spawnEnemy(canvas);
        }

        // 敌人 AI：随机移动 + 低频射击
        enemiesRef.current.forEach((e) => {
          // 移动逻辑：随机方向 + 停顿
          if (e.idleTimer && e.idleTimer > 0) {
            // 停顿中
            e.idleTimer -= 1;
          } else if (e.moveTimer && e.moveTimer > 0) {
            // 移动中
            e.moveTimer -= 1;
            const directions = [
              { angle: -Math.PI / 2, dx: 0, dy: -1 }, // 上
              { angle: 0, dx: 1, dy: 0 },             // 右
              { angle: Math.PI / 2, dx: 0, dy: 1 },   // 下
              { angle: Math.PI, dx: -1, dy: 0 },      // 左
            ];
            const dir = directions[e.moveDirection || 0];
            e.angle = dir.angle;
            
            let ex = e.x + dir.dx * e.speed;
            let ey = e.y + dir.dy * e.speed;
            const collideE = (nx: number, ny: number) => {
              // 障碍物碰撞
              const hitObstacle = obstaclesRef.current.some(o => rectsIntersect(nx, ny, e.width, e.height, o.x + o.width / 2, o.y + o.height / 2, o.width, o.height));
              // 老巢碰撞
              const hitBase = baseRef.current && !baseRef.current.destroyed && 
                rectsIntersect(nx, ny, e.width, e.height, baseRef.current.x + baseRef.current.width / 2, baseRef.current.y + baseRef.current.height / 2, baseRef.current.width, baseRef.current.height);
              // 玩家坦克碰撞
              const hitPlayer = playerRef.current && rectsIntersect(nx, ny, e.width, e.height, playerRef.current.x, playerRef.current.y, playerRef.current.width, playerRef.current.height);
              // 其他敌方坦克碰撞
              const hitOtherEnemy = enemiesRef.current.some(other => other !== e && rectsIntersect(nx, ny, e.width, e.height, other.x, other.y, other.width, other.height));
              return hitObstacle || hitBase || hitPlayer || hitOtherEnemy;
            };
            ex = clamp(ex, 16, canvas.width - 16);
            ey = clamp(ey, 16, canvas.height - 16);
            
            // 碰撞或到边界时换方向
            if (collideE(ex, ey) || ex <= 16 || ey <= 16 || ex >= canvas.width - 16 || ey >= canvas.height - 16) {
              e.moveDirection = Math.floor(Math.random() * 4);
              e.moveTimer = Math.floor(60 + Math.random() * 120);
            } else {
              e.x = ex; e.y = ey;
            }
          } else {
            // 切换状态：要么继续移动，要么停顿
            if (Math.random() < 0.7) {
              // 继续移动
              e.moveDirection = Math.floor(Math.random() * 4);
              e.moveTimer = Math.floor(60 + Math.random() * 120); // 1-3秒
            } else {
              // 停顿
              e.idleTimer = Math.floor(30 + Math.random() * 90); // 0.5-2.5秒
            }
          }

          // 射击：适中频率（不瞄准玩家）
          if (e.shootCooldown > 0) e.shootCooldown -= 1;
          if (e.shootCooldown <= 0) {
            // 随机射击（不必瞄准）
            if (Math.random() < 0.6) { // 60% 概率开火
              fireBullet(e, 'enemy');
            }
            e.shootCooldown = Math.floor(90 + Math.random() * 120); // 1.5-3.5秒
          }
        });

        // 子弹更新
        bulletsRef.current.forEach((b) => {
          b.x += b.vx;
          b.y += b.vy;
          b.ttl -= 1;
          // 子弹与障碍物碰撞
          const hitObs = obstaclesRef.current.find(o => rectsIntersect(o.x + o.width / 2, o.y + o.height / 2, o.width, o.height, b.x, b.y, 6, 6));
          if (hitObs) { b.ttl = 0; explosionsRef.current.push({ x: b.x, y: b.y, ttl: 40 }); }
        });
        // 移除越界或过期子弹
        bulletsRef.current = bulletsRef.current.filter((b) => b.ttl > 0 && b.x >= -10 && b.y >= -10 && b.x <= canvas.width + 10 && b.y <= canvas.height + 10);

        // 碰撞检测：子弹 vs 敌人/玩家/老巢
        const nextEnemies: Tank[] = [];
        for (const e of enemiesRef.current) {
          let alive = true;
          for (const b of bulletsRef.current) {
            if (b.owner !== 'player') continue;
            if (rectsIntersect(e.x, e.y, e.width, e.height, b.x, b.y, 6, 6)) {
              // 命中
              e.hp = (e.hp || 1) - 1;
              b.ttl = 0;
              explosionsRef.current.push({ x: b.x, y: b.y, ttl: 60 });
              if (e.hp <= 0) {
                alive = false;
                scoreRef.current += 100;
                explosionsRef.current.push({ x: e.x, y: e.y, ttl: 60 });
                enemiesRemainingRef.current = Math.max(0, enemiesRemainingRef.current - 1);
                break;
              }
            }
          }
          if (alive) nextEnemies.push(e);
        }
        enemiesRef.current = nextEnemies;

        const playerHit = bulletsRef.current.some((b) => b.owner === 'enemy' && rectsIntersect(player.x, player.y, player.width, player.height, b.x, b.y, 6, 6));
        if (playerHit) {
          // 清理打中玩家的子弹
          bulletsRef.current = bulletsRef.current.filter((b) => !(b.owner === 'enemy' && rectsIntersect(player.x, player.y, player.width, player.height, b.x, b.y, 6, 6)));
          explosionsRef.current.push({ x: player.x, y: player.y, ttl: 60 });
          if ((player.lives || 1) > 1) {
            if (player.lives) player.lives -= 1;
            // 在老巢附近重生（面向上）
            player.x = Math.floor(canvas.width / 2 - 40);
            player.y = canvas.height - 80;
            player.angle = -Math.PI / 2;
          } else {
            gameOverRef.current = true;
            runningRef.current = false;
          }
        }

        // 子弹命中老巢（需要3次击中才摧毁，摧毁即失败）
        if (baseRef.current && !baseRef.current.destroyed) {
          const bx = baseRef.current.x + baseRef.current.width / 2;
          const by = baseRef.current.y + baseRef.current.height / 2;
          const hitByEnemy = bulletsRef.current.some((b) => b.owner === 'enemy' && rectsIntersect(bx, by, baseRef.current!.width, baseRef.current!.height, b.x, b.y, 6, 6));
          const hitByPlayer = bulletsRef.current.some((b) => b.owner === 'player' && rectsIntersect(bx, by, baseRef.current!.width, baseRef.current!.height, b.x, b.y, 6, 6));
          
          if (hitByEnemy || hitByPlayer) {
            // 清理击中的子弹
            bulletsRef.current = bulletsRef.current.filter((b) => !rectsIntersect(bx, by, baseRef.current!.width, baseRef.current!.height, b.x, b.y, 6, 6));
            baseRef.current.hp -= 1;
            explosionsRef.current.push({ x: bx, y: by, ttl: 40 });
            
            // 检查是否摧毁
            if (baseRef.current.hp <= 0) {
              baseRef.current.destroyed = true;
              explosionsRef.current.push({ x: bx, y: by, ttl: 80 }); // 更大的爆炸
              gameOverRef.current = true;
              runningRef.current = false;
            }
          }
        }

        // 胜利判断：当前关卡所有敌人被清空（已生成完且场上无敌）
        if (enemiesToSpawnRef.current === 0 && enemiesRef.current.length === 0 && !gameOverRef.current) {
          // 下一关
          if (levelRef.current < LEVELS.totalLevels) {
            levelRef.current += 1;
            startLevel(canvas);
          } else {
            // 全部通关，简单复位到第1关
            levelRef.current = 1;
            startLevel(canvas);
          }
        }

        // 爆炸效果更新
        explosionsRef.current.forEach((e) => (e.ttl -= 1));
        explosionsRef.current = explosionsRef.current.filter((e) => e.ttl > 0);

        // 分数微增（存活奖励）
        // scoreRef.current += 1;
      }

      // 绘制
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 简化地面网格（减少绘制次数）
      ctx.strokeStyle = COLORS.ground;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 80) { // 网格间距加大
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
      }
      for (let y = 0; y < canvas.height; y += 80) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      // 敌人
      enemiesRef.current.forEach((e) => drawTank(ctx, e, COLORS.enemy, COLORS.enemyTurret));

      // 玩家
      if (playerRef.current) drawTank(ctx, playerRef.current, COLORS.player, COLORS.playerTurret);

      // 障碍物
      ctx.fillStyle = '#64748b';
      obstaclesRef.current.forEach(o => {
        ctx.fillRect(o.x, o.y, o.width, o.height);
      });

      // 老巢（鹰巢样式）
      if (baseRef.current) {
        const base = baseRef.current;
        const bx = base.x;
        const by = base.y;
        const bw = base.width;
        const bh = base.height;
        
        if (base.destroyed) {
          // 被摧毁：废墟样式
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = '#450a0a';
          ctx.fillRect(bx + 4, by + 4, bw - 8, bh - 8);
        } else {
          // 完整老巢：外墙 + 内部 + 鹰标志，根据生命值显示损伤
          const damageLevel = (base.maxHp - base.hp) / base.maxHp;
          const wallColor = damageLevel < 0.33 ? '#374151' : damageLevel < 0.66 ? '#4b5563' : '#6b7280';
          const innerColor = damageLevel < 0.33 ? '#1f2937' : damageLevel < 0.66 ? '#374151' : '#4b5563';
          
          ctx.fillStyle = wallColor; // 外墙
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = innerColor; // 内墙
          ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
          
          // 鹰标志（简化）
          ctx.fillStyle = '#fbbf24';
          const cx = bx + bw / 2;
          const cy = by + bh / 2;
          // 鹰身
          ctx.fillRect(cx - 4, cy - 2, 8, 6);
          // 鹰翼
          ctx.fillRect(cx - 6, cy - 1, 3, 4);
          ctx.fillRect(cx + 3, cy - 1, 3, 4);
          // 鹰头
          ctx.fillRect(cx - 2, cy - 4, 4, 3);
        }
      }

      // 子弹
      ctx.fillStyle = COLORS.bullet;
      bulletsRef.current.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // 爆炸
      explosionsRef.current.forEach((e) => drawExplosion(ctx, e));

      // UI
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 14px ui-sans-serif, system-ui';
      ctx.fillText(`分数: ${scoreRef.current}`, 14, 22);
      if (playerRef.current?.lives !== undefined) {
        ctx.fillText(`生命: ${playerRef.current.lives}`, 14, 40);
      }
      ctx.fillText(`关卡: ${levelRef.current}`, 14, 58);
      ctx.fillText(`剩余敌人: ${enemiesRemainingRef.current}`, 14, 76);
        if (baseRef.current && !baseRef.current.destroyed) {
        ctx.fillText(`老巢生命: ${baseRef.current.hp}/${baseRef.current.maxHp}`, 14, 94);
      }
      if (!gameOverRef.current) {
        ctx.fillText('上/左/下/右移动；空格射击', 14, canvas.height - 14);
      }

      if (gameOverRef.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px ui-sans-serif, system-ui';
        ctx.fillText('游戏结束', canvas.width / 2 - 56, canvas.height / 2 - 8);
        ctx.font = 'bold 14px ui-sans-serif, system-ui';
        ctx.fillText('按 R 键或点击画布重新开始', canvas.width / 2 - 120, canvas.height / 2 + 18);
      }

      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 初始尺寸（响应父容器宽度）
    const parent = canvas.parentElement;
    const width = Math.min(WORLD.width, Math.max(520, (parent?.clientWidth || 640) - 32));
    canvas.width = width;
    canvas.height = WORLD.height;

    resetGame(canvas);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') inputRef.current.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') inputRef.current.down = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = true;
      if (e.code === 'Space') { e.preventDefault(); inputRef.current.fire = true; }
      if (e.code === 'KeyR') {
        if (gameOverRef.current) resetGame(canvas);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') inputRef.current.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') inputRef.current.down = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = false;
      if (e.code === 'Space') inputRef.current.fire = false;
    };
    const onClick = () => { if (gameOverRef.current) resetGame(canvas); else inputRef.current.fire = true; };
    const onRelease = () => { inputRef.current.fire = false; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onClick);
    canvas.addEventListener('mouseup', onRelease);
    canvas.addEventListener('mouseleave', onRelease);
    canvas.addEventListener('touchstart', onClick, { passive: true });
    canvas.addEventListener('touchend', onRelease);

    loop(canvas, ctx);

    const onResize = () => {
      const p = canvas.parentElement;
      const w = Math.min(WORLD.width, Math.max(520, (p?.clientWidth || 640) - 32));
      canvas.width = w;
      // 高度保持 WORLD.height
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousedown', onClick);
      canvas.removeEventListener('mouseup', onRelease);
      canvas.removeEventListener('mouseleave', onRelease);
      canvas.removeEventListener('touchstart', onClick);
      canvas.removeEventListener('touchend', onRelease);
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

export default TankBattle;


