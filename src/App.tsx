import { useRef, useState } from "react";
import InfiniteViewer from "react-infinite-viewer";
import SimpleDemoPage from "./SimpleDemoPage";
import InfiniteCanvasEditor from "./components/InfiniteCanvasEditor";
import "./App.css";

interface CanvasElement {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  title: string;
  type: "card" | "circle" | "image";
}

const COLORS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
];

const INITIAL_ELEMENTS: CanvasElement[] = [
  {
    id: 1,
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    color: COLORS[0],
    title: "📝 Note 1",
    type: "card",
  },
  {
    id: 2,
    x: 400,
    y: 150,
    width: 180,
    height: 180,
    color: COLORS[1],
    title: "🎨 Design",
    type: "circle",
  },
  {
    id: 3,
    x: 700,
    y: 80,
    width: 220,
    height: 160,
    color: COLORS[2],
    title: "💡 Ideas",
    type: "card",
  },
  {
    id: 4,
    x: 150,
    y: 350,
    width: 200,
    height: 200,
    color: COLORS[3],
    title: "🚀 Launch",
    type: "circle",
  },
  {
    id: 5,
    x: 450,
    y: 400,
    width: 240,
    height: 180,
    color: COLORS[4],
    title: "📊 Analytics",
    type: "card",
  },
  {
    id: 6,
    x: 750,
    y: 320,
    width: 180,
    height: 180,
    color: COLORS[5],
    title: "⚡ Speed",
    type: "circle",
  },
  {
    id: 7,
    x: 300,
    y: 600,
    width: 200,
    height: 150,
    color: COLORS[6],
    title: "🔧 Tools",
    type: "card",
  },
  {
    id: 8,
    x: 600,
    y: 620,
    width: 220,
    height: 170,
    color: COLORS[7],
    title: "📱 Mobile",
    type: "card",
  },
];

function App() {
  const viewerRef = useRef<InfiniteViewer>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [elements] = useState<CanvasElement[]>(INITIAL_ELEMENTS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showSimpleDemo, setShowSimpleDemo] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // 如果显示编辑器
  if (showEditor) {
    return <InfiniteCanvasEditor onBack={() => setShowEditor(false)} />;
  }

  // 如果显示简单 demo，渲染 SimpleDemoPage
  if (showSimpleDemo) {
    return <SimpleDemoPage onBack={() => setShowSimpleDemo(false)} />;
  }

  const handleScroll = () => {
    if (viewerRef.current) {
      setScrollPos({
        x: Math.round(viewerRef.current.getScrollLeft()),
        y: Math.round(viewerRef.current.getScrollTop()),
      });
    }
  };

  const handleZoom = (delta: number) => {
    const newZoom = Math.min(Math.max(zoom + delta, 0.2), 3);
    setZoom(newZoom);
    viewerRef.current?.setZoom(newZoom);
  };

  const handleReset = () => {
    setZoom(1);
    viewerRef.current?.setZoom(1);
    viewerRef.current?.scrollTo(0, 0);
    setScrollPos({ x: 0, y: 0 });
  };

  const handleScrollCenter = () => {
    viewerRef.current?.scrollCenter();
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="logo">♾️</span>
          <h1 className="title">Infinite Canvas Demo</h1>
        </div>
        <div className="header-center">
          <span className="badge">react-infinite-viewer</span>
        </div>
        <div className="header-right">
          <button
            className="switch-btn editor-btn"
            onClick={() => setShowEditor(true)}
          >
            ✏️ 打开编辑器
          </button>
          <button
            className="switch-btn"
            onClick={() => setShowSimpleDemo(true)}
          >
            🎨 查看自定义实现
          </button>
          <a
            href="https://github.com/daybrush/infinite-viewer"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            ⭐ GitHub
          </a>
        </div>
      </header>

      {/* Control Panel */}
      <div className="control-panel">
        <div className="control-group">
          <span className="control-label">Zoom</span>
          <button className="control-btn" onClick={() => handleZoom(-0.1)}>
            −
          </button>
          <span className="zoom-value">{(zoom * 100).toFixed(0)}%</span>
          <button className="control-btn" onClick={() => handleZoom(0.1)}>
            +
          </button>
        </div>
        <div className="control-divider" />
        <div className="control-group">
          <button className="control-btn secondary" onClick={handleReset}>
            🔄 Reset
          </button>
          <button
            className="control-btn secondary"
            onClick={handleScrollCenter}
          >
            📍 Center
          </button>
        </div>
        <div className="control-divider" />
        <div className="control-group">
          <span className="position-info">
            📍 X: {scrollPos.x} | Y: {scrollPos.y}
          </span>
        </div>
      </div>

      {/* Infinite Viewer */}
      <InfiniteViewer
        ref={viewerRef}
        className="infinite-viewer"
        zoom={zoom}
        useMouseDrag={true}
        useWheelScroll={true}
        useAutoZoom={true}
        usePinch={true}
        pinchThreshold={0}
        zoomRange={[0.2, 3]}
        rangeX={[-2000, 2000]}
        rangeY={[-2000, 2000]}
        onScroll={handleScroll}
        onPinch={(e) => {
          setZoom(e.zoom);
        }}
      >
        <div className="viewport">
          {/* Grid Background */}
          <div className="grid-background" />

          {/* Origin Marker */}
          <div className="origin-marker">
            <div className="origin-cross" />
            <span className="origin-label">Origin (0, 0)</span>
          </div>

          {/* Canvas Elements */}
          {elements.map((el) => (
            <div
              key={el.id}
              className={`canvas-element ${el.type} ${selectedId === el.id ? "selected" : ""}`}
              style={{
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                background: el.color,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(el.id === selectedId ? null : el.id);
              }}
            >
              <div className="element-content">
                <h3 className="element-title">{el.title}</h3>
                <p className="element-coords">
                  ({el.x}, {el.y})
                </p>
              </div>
            </div>
          ))}

          {/* Decorative Lines */}
          <svg
            className="connection-lines"
            width="2000"
            height="2000"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
          >
            <defs>
              <linearGradient
                id="lineGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#667eea" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#764ba2" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <path
              d="M200,175 Q350,200 490,240"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeDasharray="8,4"
            />
            <path
              d="M490,330 Q550,380 550,500"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeDasharray="8,4"
            />
            <path
              d="M810,170 Q900,240 840,410"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeDasharray="8,4"
            />
          </svg>
        </div>
      </InfiniteViewer>

      {/* Instructions */}
      <div className="instructions">
        <div className="instruction-item">
          🖱️ <strong>Drag</strong> to pan
        </div>
        <div className="instruction-item">
          🔍 <strong>Scroll</strong> to zoom
        </div>
        <div className="instruction-item">
          👆 <strong>Pinch</strong> to zoom (touch)
        </div>
        <div className="instruction-item">
          📦 <strong>Click</strong> elements to select
        </div>
      </div>
    </div>
  );
}

export default App;
