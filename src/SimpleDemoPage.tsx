import { useState } from "react";
import SimpleInfiniteCanvas from "./SimpleInfiniteCanvas";
import "./SimpleDemoPage.css";

/**
 * 简单无限画布演示页面
 *
 * 这个页面展示了自定义实现的 SimpleInfiniteCanvas 组件
 * 用于学习无限画布的核心原理
 */
interface SimpleDemoPageProps {
  onBack?: () => void;
}

export function SimpleDemoPage({ onBack }: SimpleDemoPageProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  return (
    <div className="simple-demo-container">
      {/* 头部 */}
      <header className="simple-demo-header">
        <div className="header-title">
          <span className="header-icon">🎨</span>
          <h1>Simple Infinite Canvas</h1>
          <span className="header-badge">自定义实现</span>
        </div>
        <button className="back-link" onClick={onBack}>
          ← 返回 InfiniteViewer Demo
        </button>
      </header>

      {/* 控制面板 */}
      <div className="simple-demo-controls">
        <div className="control-item">
          <span className="control-label">缩放:</span>
          <span className="control-value">{(zoom * 100).toFixed(0)}%</span>
        </div>
        <div className="control-divider" />
        <div className="control-item">
          <span className="control-label">位置:</span>
          <span className="control-value">
            ({position.x.toFixed(0)}, {position.y.toFixed(0)})
          </span>
        </div>
      </div>

      {/* 无限画布 */}
      <div className="simple-demo-canvas-wrapper">
        <SimpleInfiniteCanvas
          canvasWidth={4000}
          canvasHeight={4000}
          initialZoom={1}
          minZoom={0.1}
          maxZoom={5}
          onZoomChange={setZoom}
          onPositionChange={(x, y) => setPosition({ x, y })}
        >
          {/* 网格背景 */}
          <div className="simple-canvas-grid" />

          {/* 原点标记 */}
          <div className="origin-marker" />

          {/* 示例元素 */}
          <div
            className="canvas-node"
            style={{ left: 100, top: 100, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
          >
            📝 节点 1
          </div>

          <div
            className="canvas-node circle"
            style={{ left: 350, top: 150, background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}
          >
            🎨
          </div>

          <div
            className="canvas-node"
            style={{ left: 200, top: 300, background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}
          >
            💡 Ideas
          </div>

          <div
            className="canvas-node circle"
            style={{ left: 400, top: 320, background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" }}
          >
            🚀
          </div>

          <div
            className="canvas-node"
            style={{ left: 100, top: 480, background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" }}
          >
            📊 Analytics
          </div>

          <div
            className="canvas-node"
            style={{ left: 320, top: 500, background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)" }}
          >
            ⚡ Speed
          </div>
        </SimpleInfiniteCanvas>
      </div>

      {/* 说明面板 */}
      <div className="simple-demo-info">
        <h3>🔑 核心原理</h3>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-icon">📐</div>
            <div className="info-content">
              <strong>坐标变换</strong>
              <p>canvasPos = (viewportPos - offset) / zoom</p>
            </div>
          </div>
          <div className="info-item">
            <div className="info-icon">✋</div>
            <div className="info-content">
              <strong>平移</strong>
              <p>translate(x, y) 移动画布</p>
            </div>
          </div>
          <div className="info-item">
            <div className="info-icon">🔍</div>
            <div className="info-content">
              <strong>缩放</strong>
              <p>scale(zoom) 以鼠标为中心</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimpleDemoPage;
