import { useState } from 'react';
import { Activity, Axis3D, BarChart3, BookOpen, Calculator, Check, Circle, Dices, Grid2X2, Layers, LineChart, MoveUpRight, Network, Sigma, Table2, Triangle, X } from 'lucide-react';
import DynamicGeometry, { OxyzPanel, TrigPanel } from './MathHubGeometry';
import FunctionPanel, { MatrixPanel, StatisticsPanel } from './MathHubAlgebra';
import { FormulaSymbolsPanel, GraphTheoryPanel, ProbabilityPanel } from './MathHubDiscrete';
import { type MathHubProps } from './mathHubUtils';
import './math-hub.css';

export type MathHubTab = 'home' | 'geometry' | 'functions' | 'trig' | 'oxyz' | 'matrix' | 'stats' | 'probability' | 'graph' | 'symbols';

const NAV: { id: MathHubTab; label: string; icon: typeof Sigma }[] = [
  { id: 'home', label: 'Tổng quan', icon: Grid2X2 },
  { id: 'geometry', label: 'Hình học động', icon: Triangle },
  { id: 'functions', label: 'Đồ thị hàm số', icon: LineChart },
  { id: 'trig', label: 'Lượng giác', icon: Circle },
  { id: 'oxyz', label: 'Không gian Oxyz', icon: Axis3D },
  { id: 'matrix', label: 'Ma trận', icon: Table2 },
  { id: 'stats', label: 'Thống kê', icon: BarChart3 },
  { id: 'probability', label: 'Tổ hợp & xác suất', icon: Dices },
  { id: 'graph', label: 'Lý thuyết đồ thị', icon: Network },
  { id: 'symbols', label: 'Công thức & ký hiệu', icon: BookOpen },
];

export default function MathHub(props: MathHubProps) {
  const [tab, setTab] = useState<MathHubTab>('home');
  const open = (which: 'graph' | 'library' | '3d' | 'calc') => {
    props.onClose();
    ({ graph: props.onOpenGraph, library: props.onOpenLibrary, '3d': props.onOpen3D, calc: props.onOpenCalculator })[which]();
  };
  return <div className="mathhub-backdrop" onMouseDown={e => { if (e.currentTarget === e.target) props.onClose(); }}>
    <section className="mathhub" role="dialog" aria-modal="true" aria-label="Trung tâm Toán học Mực">
      <header className="mathhub-header"><div className="mathhub-brand"><span><Sigma size={24}/></span><div><strong>Trung tâm Toán Σ</strong><small>Công cụ trực quan và tính toán dành cho Toán THPT</small></div></div><div className="mathhub-header-actions"><span className="mathhub-offline"><i/> Xử lý tại máy</span><button className="mathhub-icon-button" onClick={props.onClose} title="Đóng"><X size={20}/></button></div></header>
      <div className="mathhub-layout"><nav className="mathhub-nav">{NAV.map(n => { const Icon = n.icon; return <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => setTab(n.id)}><Icon size={17}/><span>{n.label}</span></button>; })}<div className="mathhub-nav-separator"/><button onClick={() => open('library')}><Layers size={17}/><span>Thư viện 50+ mẫu</span></button><button onClick={() => open('3d')}><Axis3D size={17}/><span>Trình dựng 3D</span></button><button onClick={() => open('calc')}><Calculator size={17}/><span>Máy tính fx</span></button></nav>
        <main className="mathhub-main">
          {tab === 'home' && <HomePanel setTab={setTab} open={open}/>}
          {tab === 'geometry' && <DynamicGeometry onInsert={props.onInsert} openLibrary={() => open('library')} open3D={() => open('3d')}/>}
          {tab === 'functions' && <FunctionPanel onOpenFull={props.onOpenGraph} onInsert={props.onInsert}/>}
          {tab === 'trig' && <TrigPanel/>}
          {tab === 'oxyz' && <OxyzPanel open3D={() => open('3d')} onInsert={props.onInsert}/>}
          {tab === 'matrix' && <MatrixPanel/>}
          {tab === 'stats' && <StatisticsPanel onInsert={props.onInsert}/>}
          {tab === 'probability' && <ProbabilityPanel/>}
          {tab === 'graph' && <GraphTheoryPanel/>}
          {tab === 'symbols' && <FormulaSymbolsPanel onInsert={props.onInsert}/>}
        </main>
      </div>
    </section>
  </div>;
}

function HomePanel({ setTab, open }: { setTab: (t: MathHubTab) => void; open: (v: 'graph' | 'library' | '3d' | 'calc') => void }) {
  const cards: { id: MathHubTab; title: string; description: string; icon: typeof Sigma; tag: string }[] = [
    { id: 'geometry', title: 'Hình học động', description: 'Kéo đỉnh tam giác; trung tuyến, đường cao, quỹ tích và số đo tự cập nhật.', icon: Triangle, tag: 'Kéo để thay đổi' },
    { id: 'functions', title: 'Đồ thị hàm số', description: 'Vẽ nhiều hàm, ngắt tiệm cận, xem giao điểm, nghiệm, cực trị và diện tích.', icon: LineChart, tag: 'Nhiều hàm' },
    { id: 'trig', title: 'Đường tròn lượng giác', description: 'Kéo điểm M để đọc sin, cos, tan, cot và họ nghiệm.', icon: Circle, tag: 'Tương tác' },
    { id: 'oxyz', title: 'Không gian Oxyz', description: 'Tọa độ A, B, C, tích có hướng, mặt phẳng (ABC), đường thẳng và mặt cầu.', icon: Axis3D, tag: 'Tọa độ' },
    { id: 'matrix', title: 'Ma trận & định thức', description: 'Định thức, hạng, dạng bậc thang, nghịch đảo, hệ tuyến tính và tham số m.', icon: Table2, tag: 'Có biến đổi' },
    { id: 'stats', title: 'Thống kê', description: 'Số đặc trưng (σ² và s²), bảng tần số và biểu đồ hộp / cột / histogram.', icon: BarChart3, tag: 'Dữ liệu thật' },
    { id: 'probability', title: 'Tổ hợp & xác suất', description: 'Hoán vị, chỉnh hợp, tổ hợp, phân phối nhị thức, Pascal và mô phỏng.', icon: Dices, tag: 'Thử nghiệm' },
    { id: 'graph', title: 'Lý thuyết đồ thị', description: 'Ma trận kề, thành phần liên thông, Dijkstra và cây khung Prim / Kruskal.', icon: Network, tag: 'Thuật toán' },
    { id: 'symbols', title: 'Công thức & ký hiệu', description: 'Tra cứu công thức Toán THPT, chèn ký hiệu Unicode/LaTeX lên trang.', icon: BookOpen, tag: 'Tra cứu' },
  ];
  return <div className="mh-page"><div className="mh-page-heading"><div><span className="mh-kicker">LỚP HỌC MỰC · TOÁN THPT</span><h1>Công cụ học Toán tương tác</h1><p>Chọn một công cụ để dựng hình, khám phá quy luật, tính toán hoặc tạo minh họa chèn lên trang.</p></div><div className="mh-hero-mark"><Sigma size={44}/></div></div>
    <div className="mh-launch-row"><button onClick={() => open('library')}><Layers size={18}/><span><b>Thư viện hình học</b><small>Hình phẳng, khối 3D, mẫu toán</small></span><MoveUpRight size={16}/></button><button onClick={() => open('3d')}><Axis3D size={18}/><span><b>Trình dựng HHKG</b><small>Xoay, mặt cắt, nét khuất, trải hình</small></span><MoveUpRight size={16}/></button><button onClick={() => open('graph')}><Activity size={18}/><span><b>Đồ thị & nhận diện</b><small>Nhận diện công thức viết tay</small></span><MoveUpRight size={16}/></button><button onClick={() => open('calc')}><Calculator size={18}/><span><b>Máy tính bỏ túi</b><small>Chế độ giả lập có sẵn trong app</small></span><MoveUpRight size={16}/></button></div>
    <div className="mh-card-grid">{cards.map(c => { const Icon = c.icon; return <button key={c.id} className="mh-feature-card" onClick={() => setTab(c.id)}><span className="mh-card-icon"><Icon size={20}/></span><span className="mh-card-tag">{c.tag}</span><b>{c.title}</b><small>{c.description}</small><span className="mh-card-open">Mở công cụ <MoveUpRight size={14}/></span></button>; })}</div>
    <div className="mh-info-line"><Check size={16}/><span>Các mô-đun mới chạy cục bộ. Có thể mở trình dựng, sau đó chèn hình/đồ thị lên trang bài giảng.</span></div>
  </div>;
}
