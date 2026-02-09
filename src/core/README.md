# Infinite View Core Engine 🎨

这是一个高性能、可扩展的无限视口图片/图形编辑器核心库。它基于 `EditorEngine` 纯逻辑引擎，并提供了完整的 React UI 套件。

## 🌟 特性

- **逻辑与 UI 分离**：核心引擎 `EditorEngine` 不依赖 React，可独立运行。
- **高性能选区**：极致流畅的框选和多选体验。
- **无限视口**：支持无限范围的平移和缩放。
- **插槽系统**：业务层可以轻松定制工具栏和 UI 覆盖层。
- **命令式 API**：通过 `apiRef` 完美控制编辑器内部状态。

## 🚀 快速上手

### 安装

确保项目中已安装必要依赖：

```bash
npm install react-infinite-viewer react-moveable react-selecto
```

### 基础用法

```tsx
import { CoreEditor, EditorProvider } from "@/core";

function App() {
  return (
    <EditorProvider>
      <div style={{ width: "100vw", height: "100vh" }}>
        <CoreEditor />
      </div>
    </EditorProvider>
  );
}
```

## 🛠 进阶：业务层控制

通过 `apiRef` 获得对编辑器的完全控制：

```tsx
import { useRef } from "react";
import { CoreEditor, EditorAPI, EditorProvider } from "@/core";

function BusinessPage() {
  const apiRef = useRef<EditorAPI>(null);

  const handleAddImage = () => {
    apiRef.current?.addElement({
      type: "image",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      imageUrl: "https://example.com/photo.jpg",
      style: { borderRadius: 8 },
    });
  };

  return (
    <EditorProvider>
      <div className="layout">
        <aside className="business-sidebar">
          <button onClick={handleAddImage}>添加业务素材</button>
        </aside>
        <main className="editor-container">
          <CoreEditor apiRef={apiRef} />
        </main>
      </div>
    </EditorProvider>
  );
}
```

## 🎨 定制 UI (Slots)

可以使用插槽系统在不修改核心代码的情况下注入业务 UI：

```tsx
<CoreEditor
  slots={{
    toolbarExtra: <button>自定义业务工具</button>,
    floatingToolbarExtra: (element) => (
      <button onClick={() => alert(`选中了: ${element.id}`)}>业务操作</button>
    ),
  }}
/>
```

## 📚 API 参考

### CoreEditor Props

| 属性           | 类型                   | 说明                         |
| -------------- | ---------------------- | ---------------------------- |
| `initialData`  | `EditorDataExport`     | 编辑器初始数据               |
| `apiRef`       | `RefObject<EditorAPI>` | 获取命令式 API 的 Ref        |
| `slots`        | `object`               | UI 插槽配置                  |
| `onDataChange` | `(data) => void`       | 数据变化回调（已做防抖处理） |

### EditorAPI 方法

- `addElement(element)`: 添加新元素。
- `updateElement(id, updates)`: 修改元素属性。
- `deleteSelected()`: 删除选中项。
- `setZoom(zoom)`: 设置缩放比例。
- `centerElement(id)`: 将指定元素滚动到视口中心。
- `exportSelectionAsImage()`: 导出图片。

---

Detailed documentation and extension guide can be found in the source code comments.
