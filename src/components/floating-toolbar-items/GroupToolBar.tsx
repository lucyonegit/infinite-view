import React from 'react';

export const GroupToolBar: React.FC = () => {
  return (
    <div className="toolbar-group">
      <div className="toolbar-item no-hover">
        <span className="label">已选中多个元素</span>
      </div>
      <div className="divider" />
      <button className="toolbar-item more" title="更多">
        <span className="icon">...</span>
      </button>
    </div>
  );
};
