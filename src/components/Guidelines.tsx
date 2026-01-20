import type { SnapLine } from '../hooks/useSnapping';
import './Guidelines.css';

interface GuidelinesProps {
  horizontalLines: SnapLine[];
  verticalLines: SnapLine[];
}

/**
 * 对齐辅助线组件
 * 在拖拽时显示元素对齐的参考线
 */
export function Guidelines({ horizontalLines, verticalLines }: GuidelinesProps) {
  return (
    <div className="guidelines-container">
      {/* 垂直线（x 方向对齐） */}
      {verticalLines.map((line, index) => (
        <div
          key={`v-${index}-${line.position}`}
          className="guideline guideline-vertical"
          style={{ left: line.position }}
        />
      ))}
      
      {/* 水平线（y 方向对齐） */}
      {horizontalLines.map((line, index) => (
        <div
          key={`h-${index}-${line.position}`}
          className="guideline guideline-horizontal"
          style={{ top: line.position }}
        />
      ))}
    </div>
  );
}

export default Guidelines;
