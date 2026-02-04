import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import InfiniteEditor from "./components/InfiniteEditor";
import EngineEditorPage from "./pages/EngineEditorPage";
import "./App.css";

const HomePage = () => (
  <div style={{ padding: '40px', textAlign: 'center' }}>
    <h1>Infinite View Editor</h1>
    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '40px' }}>
      <Link to="/zustand" style={linkStyle}>Zustand Version (Old)</Link>
      <Link to="/engine" style={{ ...linkStyle, background: '#1890ff', color: '#fff' }}>EditorEngine Version (New)</Link>
    </div>
  </div>
);

const linkStyle = {
  padding: '20px 40px',
  borderRadius: '12px',
  border: '1px solid #ddd',
  textDecoration: 'none',
  color: '#262626',
  fontSize: '18px',
  fontWeight: 600,
  transition: 'all 0.2s'
};

function App() {
  return (
    <BrowserRouter>
      <div className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/zustand" element={<InfiniteEditor onBack={() => window.location.href = "/"} />} />
          <Route path="/engine" element={<EngineEditorPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
