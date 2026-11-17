import { ARENA_SUBJECTS } from '../../../shared/arena-core.js';

export { ARENA_SUBJECTS };

export const STARTER_DECKS = [
  {
    id: 'starter-hoa',
    subject: 'Hóa học',
    title: 'Tổng hợp Hóa học THPT (15 câu)',
    questions: [
      { topic: 'Cấu tạo nguyên tử', level: 'Nhận biết', kind: 'mcq', prompt: 'Hạt mang điện tích dương trong hạt nhân nguyên tử là gì?', options: ['Electron', 'Proton', 'Neutron', 'Positron'], answer: 'B', hint: 'Hạt nhân gồm proton (+) và neutron (không mang điện).' },
      { topic: 'Bảng tuần hoàn', level: 'Nhận biết', kind: 'mcq', prompt: 'Nguyên tố nào sau đây là kim loại kiềm (nhóm IA)?', options: ['Canxi (Ca)', 'Natri (Na)', 'Nhôm (Al)', 'Sắt (Fe)'], answer: 'B', hint: 'Kim loại kiềm gồm Li, Na, K, Rb, Cs.' },
      { topic: 'Ester – Lipid', level: 'Nhận biết', kind: 'mcq', prompt: 'Chất nào sau đây thuộc loại ester?', options: ['CH3COOCH3', 'CH3COOH', 'C2H5OH', 'CH3CHO'], answer: 'A', hint: 'Ester có nhóm chức -COO- nối với gốc hydrocarbon.' },
      { topic: 'Carbohydrate', level: 'Nhận biết', kind: 'mcq', prompt: 'Dung dịch chất nào làm quỳ tím chuyển sang màu xanh?', options: ['Glycine', 'Aniline', 'Methylamine', 'Glucose'], answer: 'C', hint: 'Alkylamine mạch hở có tính bazơ mạnh hơn amoniac.' },
      { topic: 'Polymer', level: 'Nhận biết', kind: 'mcq', prompt: 'Polymer nào được điều chế trực tiếp bằng phản ứng trùng hợp?', options: ['Nylon-6,6', 'Poly(ethylene terephthalate)', 'Polyethylene (PE)', 'Nylon-6'], answer: 'C', hint: 'Ethylene có liên kết đôi C=C nên tham gia trùng hợp.' },
      { topic: 'Đại cương kim loại', level: 'Thông hiểu', kind: 'mcq', prompt: 'Kim loại có độ dẫn điện tốt nhất trong điều kiện thường là gì?', options: ['Đồng (Cu)', 'Vàng (Au)', 'Bạc (Ag)', 'Nhôm (Al)'], answer: 'C', hint: 'Thứ tự dẫn điện tốt giảm dần: Ag > Cu > Au > Al > Fe.' },
      { topic: 'Pin điện hóa', level: 'Thông hiểu', kind: 'mcq', prompt: 'Trong pin điện hóa Zn–Cu đang hoạt động, quá trình oxi hóa xảy ra ở đâu?', options: ['Cathode đồng', 'Anode kẽm', 'Dung dịch CuSO4', 'Cầu muối'], answer: 'B', hint: 'Kim loại hoạt động mạnh hơn (Zn) đóng vai trò anode và bị oxi hóa.' },
      { topic: 'Cân bằng hóa học', level: 'Thông hiểu', kind: 'mcq', prompt: 'Với phản ứng thuận nghịch tỏa nhiệt, khi tăng nhiệt độ cân bằng chuyển dịch theo chiều nào?', options: ['Chiều thuận', 'Chiều nghịch', 'Không đổi', 'Tăng áp suất'], answer: 'B', hint: 'Theo nguyên lý Le Chatelier, tăng nhiệt độ đẩy cân bằng về chiều thu nhiệt.' },
      { topic: 'pH dung dịch', level: 'Thông hiểu', kind: 'mcq', prompt: 'Ở 25°C, dung dịch HCl nồng độ 0,01 M có giá trị pH bằng bao nhiêu?', options: ['1', '2', '3', '12'], answer: 'B', hint: 'pH = -lg[H+] = -lg(10^-2).' },
      { topic: 'Phức chất & Kim loại chuyển tiếp', level: 'Thông hiểu', kind: 'mcq', prompt: 'Dung dịch chứa ion Cu²⁺ ở nồng độ thông thường có màu đặc trưng nào?', options: ['Không màu', 'Vàng nhạt', 'Xanh lam', 'Đỏ cam'], answer: 'C', hint: 'Phức [Cu(H2O)6]2+ tạo màu xanh lam quen thuộc.' },
      { topic: 'Tính theo phương trình', level: 'Vận dụng', kind: 'mcq', prompt: 'Cho 0,10 mol Zn tác dụng với dung dịch HCl dư. Thể tích khí H2 (đkc, 24,79 L/mol) thu được là:', options: ['1,24 L', '2,48 L', '4,96 L', '0,25 L'], answer: 'B', hint: 'n(H2) = n(Zn) = 0,10 mol → V = 0,10 × 24,79 ≈ 2,48 L.' },
      { topic: 'Xà phòng hóa ester', level: 'Vận dụng', kind: 'mcq', prompt: 'Thủy phân hoàn toàn 8,8 gam ethyl acetate (M = 88) bằng lượng vừa đủ NaOH thu được bao nhiêu gam sodium acetate (M = 82)?', options: ['6,8 gam', '8,2 gam', '9,6 gam', '4,1 gam'], answer: 'B', hint: 'n(ester) = 0,1 mol → n(CH3COONa) = 0,1 mol → m = 8,2 g.' },
      { topic: 'Điện phân', level: 'Vận dụng', kind: 'mcq', prompt: 'Điện phân dung dịch CuSO4 (điện cực trơ) thu được 3,2 gam Cu ở cathode. Số mol khí O2 thoát ra ở anode là:', options: ['0,025 mol', '0,050 mol', '0,100 mol', '0,015 mol'], answer: 'A', hint: 'n(Cu) = 0,05 mol (trao đổi 0,1 mol e) → n(O2) = 0,1 / 4 = 0,025 mol.' },
      { topic: 'Nhiệt hóa học', level: 'Vận dụng cao', kind: 'mcq', prompt: 'Cho ΔrH°298 của phản ứng 2H2(g) + O2(g) → 2H2O(l) là -571,6 kJ. Nhiệt tạo thành chuẩn của H2O(l) là:', options: ['-571,6 kJ/mol', '-285,8 kJ/mol', '+285,8 kJ/mol', '-1143,2 kJ/mol'], answer: 'B', hint: 'Nhiệt tạo thành chuẩn tính cho 1 mol H2O(l), nên chia đôi hệ số.' },
      { topic: 'Hữu cơ tổng hợp', level: 'Vận dụng cao', kind: 'mcq', prompt: 'Số lượng ester đơn chức mạch hở ứng với công thức phân tử C4H8O2 là bao nhiêu?', options: ['2', '3', '4', '5'], answer: 'C', hint: 'Gồm HCOOC3H7 (2 đồng phân), CH3COOC2H5 (1) và C2H5COOCH3 (1).' }
    ]
  },
  {
    id: 'starter-toan',
    subject: 'Toán học',
    title: 'Toán THPT Trắc nghiệm nhanh (15 câu)',
    questions: [
      { topic: 'Hàm số', level: 'Nhận biết', kind: 'mcq', prompt: 'Đạo hàm của hàm số y = x³ − 3x là biểu thức nào?', options: ['3x² − 3', '3x² + 3', 'x² − 3', '3x − 3'], answer: 'A', hint: 'Áp dụng (x^n)\' = n·x^(n-1).' },
      { topic: 'Logarit', level: 'Nhận biết', kind: 'mcq', prompt: 'Với a > 0, a ≠ 1, giá trị của logₐ(a⁵) bằng bao nhiêu?', options: ['1', '5', 'a⁵', '0'], answer: 'B', hint: 'Công thức cơ bản: log_a(a^k) = k.' },
      { topic: 'Nguyên hàm', level: 'Nhận biết', kind: 'mcq', prompt: 'Một nguyên hàm của hàm số f(x) = cos(x) là:', options: ['−sin(x)', 'sin(x)', 'cos(x)', 'tan(x)'], answer: 'B', hint: 'Vì (sin x)\' = cos x.' },
      { topic: 'Hình học Oxyz', level: 'Nhận biết', kind: 'mcq', prompt: 'Trong không gian Oxyz, vectơ pháp tuyến của mặt phẳng x + 2y − 3z + 1 = 0 là:', options: ['(1; 2; 3)', '(1; 2; −3)', '(2; −3; 1)', '(1; −2; −3)'], answer: 'B', hint: 'Hệ số của x, y, z chính là tọa độ vectơ pháp tuyến.' },
      { topic: 'Tổ hợp', level: 'Nhận biết', kind: 'mcq', prompt: 'Số cách xếp 4 học sinh khác nhau thành một hàng ngang là bao nhiêu?', options: ['16', '24', '12', '4'], answer: 'B', hint: 'Số hoán vị của 4 phần tử là 4!.' },
      { topic: 'Cấp số cộng', level: 'Thông hiểu', kind: 'mcq', prompt: 'Cho cấp số cộng (uₙ) có u₁ = 3 và công sai d = 4. Giá trị u₅ bằng:', options: ['15', '19', '23', '16'], answer: 'B', hint: 'u_n = u_1 + (n - 1)d.' },
      { topic: 'Khối đa diện', level: 'Thông hiểu', kind: 'mcq', prompt: 'Thể tích khối chóp có diện tích đáy B = 12 và chiều cao h = 5 bằng:', options: ['60', '30', '20', '15'], answer: 'C', hint: 'V = (1/3) · B · h.' },
      { topic: 'Lượng giác', level: 'Thông hiểu', kind: 'mcq', prompt: 'Nghiệm của phương trình sin(x) = 1 trên đoạn [0; 2π] là:', options: ['0', 'π/2', 'π', '3π/2'], answer: 'B', hint: 'Tại điểm ngọn cung 90° (π/2), tung độ sin đạt giá trị cực đại là 1.' },
      { topic: 'Bất phương trình mũ', level: 'Thông hiểu', kind: 'mcq', prompt: 'Tập nghiệm của bất phương trình 2ˣ > 8 là:', options: ['(3; +∞)', '(−∞; 3)', '(8; +∞)', '[3; +∞)'], answer: 'A', hint: '8 = 2³, cơ số 2 > 1 nên giữ nguyên chiều bất đẳng thức.' },
      { topic: 'Tích phân', level: 'Thông hiểu', kind: 'mcq', prompt: 'Giá trị của tích phân ∫₀² 3x² dx bằng bao nhiêu?', options: ['6', '8', '12', '4'], answer: 'B', hint: 'Nguyên hàm là x³, thế cận từ 0 đến 2 được 2³ − 0.' },
      { topic: 'Xác suất', level: 'Vận dụng', kind: 'mcq', prompt: 'Gieo một đồng xu cân đối đồng chất 2 lần. Xác suất để có ít nhất 1 lần xuất hiện mặt ngửa là:', options: ['1/4', '1/2', '3/4', '2/3'], answer: 'C', hint: 'Biến cố đối là cả 2 lần đều sấp (xác suất 1/4).' },
      { topic: 'Cực trị hàm số', level: 'Vận dụng', kind: 'mcq', prompt: 'Giá trị nhỏ nhất của hàm số y = x + 4/x trên khoảng (0; +∞) là:', options: ['2', '4', '5', '8'], answer: 'B', hint: 'Áp dụng bất đẳng thức AM-GM cho 2 số dương.' },
      { topic: 'Khối tròn xoay', level: 'Vận dụng', kind: 'mcq', prompt: 'Diện tích xung quanh hình nón có bán kính đáy r = 3 và đường sinh l = 5 là:', options: ['15π', '30π', '45π', '12π'], answer: 'A', hint: 'S_xq = π · r · l.' },
      { topic: 'Số phức / Môđun', level: 'Vận dụng cao', kind: 'mcq', prompt: 'Trong mặt phẳng tọa độ, khoảng cách giữa A(1; 2) và B(4; 6) là bao nhiêu?', options: ['4', '5', '6', '7'], answer: 'B', hint: 'Tam giác vuông cạnh 3 và 4 có cạnh huyền bằng 5.' },
      { topic: 'Tương giao', level: 'Vận dụng cao', kind: 'mcq', prompt: 'Đồ thị hàm số y = x³ − 3x + 1 cắt trục hoành tại bao nhiêu điểm phân biệt?', options: ['1', '2', '3', '0'], answer: 'C', hint: 'Hai giá trị cực trị là 3 và -1 trái dấu nhau.' }
    ]
  },
  {
    id: 'starter-anh',
    subject: 'Tiếng Anh',
    title: 'Tiếng Anh Tổng hợp THPT (15 câu)',
    questions: [
      { topic: 'Tenses', level: 'Nhận biết', kind: 'mcq', prompt: 'While my sister ___ dinner yesterday evening, the doorbell rang.', options: ['cooked', 'was cooking', 'cooks', 'has cooked'], answer: 'B', hint: 'Hành động đang diễn ra trong quá khứ thì hành động khác xen vào.' },
      { topic: 'Prepositions', level: 'Nhận biết', kind: 'mcq', prompt: 'Students should take responsibility ___ protecting the local environment.', options: ['at', 'with', 'for', 'to'], answer: 'C', hint: 'Cụm cố định: take responsibility for + V-ing/N.' },
      { topic: 'Word Form', level: 'Nhận biết', kind: 'mcq', prompt: 'Renewable energy brings significant ___ benefits to modern cities.', options: ['environment', 'environmental', 'environmentally', 'environmentalism'], answer: 'B', hint: 'Trước danh từ "benefits" cần một tính từ.' },
      { topic: 'Relative Clauses', level: 'Nhận biết', kind: 'mcq', prompt: 'The scientist ___ discovered this catalyst won a prestigious award.', options: ['which', 'who', 'whom', 'whose'], answer: 'B', hint: 'Đại từ quan hệ thay cho danh từ chỉ người đóng vai trò chủ ngữ.' },
      { topic: 'Articles', level: 'Nhận biết', kind: 'mcq', prompt: 'She wants to become ___ architect after graduating from university.', options: ['a', 'an', 'the', 'no article'], answer: 'B', hint: '"Architect" bắt đầu bằng âm nguyên âm /ɑː/.' },
      { topic: 'Conditionals', level: 'Thông hiểu', kind: 'mcq', prompt: 'If we ___ public transport more often, urban air pollution would decrease.', options: ['use', 'used', 'had used', 'would use'], answer: 'B', hint: 'Câu điều kiện loại 2 giả định trái với hiện tại (would + V).' },
      { topic: 'Phrasal Verbs', level: 'Thông hiểu', kind: 'mcq', prompt: 'Because of the heavy rain, the outdoor chemistry fair had to be ___.', options: ['put off', 'taken after', 'looked up', 'turned on'], answer: 'A', hint: 'put off = hoãn lại (postpone).' },
      { topic: 'Passive Voice', level: 'Thông hiểu', kind: 'mcq', prompt: 'A new solar power plant ___ in this province next year.', options: ['will build', 'is building', 'will be built', 'built'], answer: 'C', hint: 'Chủ ngữ là vật + thì tương lai nên dùng bị động "will be V3".' },
      { topic: 'Conjunctions', level: 'Thông hiểu', kind: 'mcq', prompt: '___ the heavy workload, Nam still maintained his daily study streak.', options: ['Although', 'Despite', 'Because', 'However'], answer: 'B', hint: '"the heavy workload" là cụm danh từ nên dùng giới từ nhượng bộ.' },
      { topic: 'Collocations', level: 'Thông hiểu', kind: 'mcq', prompt: 'Regular exercise helps students ___ stress before important exams.', options: ['relieve', 'make', 'do', 'create'], answer: 'A', hint: 'relieve stress = giải tỏa căng thẳng.' },
      { topic: 'Participle Clauses', level: 'Vận dụng', kind: 'mcq', prompt: '___ all the revision exercises, Lan felt confident entering the exam room.', options: ['Completing', 'Having completed', 'Completed', 'To complete'], answer: 'B', hint: 'Nhấn mạnh hành động xảy ra xong trước hành động chính.' },
      { topic: 'Subjunctive', level: 'Vận dụng', kind: 'mcq', prompt: 'The teacher suggested that every candidate ___ arrive 15 minutes early.', options: ['arrives', 'arrived', 'arrive', 'arriving'], answer: 'C', hint: 'Cấu trúc giả định: suggest that + S + (should) + V nguyên mẫu.' },
      { topic: 'Inversion', level: 'Vận dụng', kind: 'mcq', prompt: 'Rarely ___ such remarkable dedication from first-year learners.', options: ['have we seen', 'we have seen', 'did we saw', 'we saw'], answer: 'A', hint: 'Trạng từ phủ định "Rarely" đứng đầu câu yêu cầu đảo trợ động từ.' },
      { topic: 'Idioms', level: 'Vận dụng cao', kind: 'mcq', prompt: 'Minh passed the mock test with flying colors, meaning he ___.', options: ['barely finished it', 'scored very high', 'used colorful pens', 'missed easy items'], answer: 'B', hint: 'with flying colors = đạt kết quả xuất sắc.' },
      { topic: 'Mixed Conditionals', level: 'Vận dụng cao', kind: 'mcq', prompt: 'If you had reviewed the organic formulas last night, you ___ confused now.', options: ['won\'t be', 'wouldn\'t be', 'wouldn\'t have been', 'aren\'t'], answer: 'B', hint: 'Điều kiện hỗn hợp 3–2: quá khứ (had + V3) ảnh hưởng hiện tại (wouldn\'t be + now).' }
    ]
  },
  {
    id: 'starter-tonghop-100',
    subject: 'Tổng hợp',
    title: 'Đấu trường 100 · Trắc nghiệm + Trả lời ngắn (10 câu)',
    questions: [
      { kind: 'mcq', topic: 'Hóa học', level: 'Nhận biết', prompt: 'Công thức hóa học của khí carbonic (carbon dioxide) là gì?', options: ['CO', 'CO2', 'CaCO3', 'CH4'], answer: 'B', hint: 'Gồm 1 nguyên tử C và 2 nguyên tử O.' },
      { kind: 'short', topic: 'Toán học', level: 'Nhận biết', prompt: 'Nhập giá trị của căn bậc hai số học của 144:', answer: '12', acceptedAnswers: ['12'], hint: '12 × 12 = 144.' },
      { kind: 'mcq', topic: 'Tiếng Anh', level: 'Thông hiểu', prompt: 'Từ nào sau đây đồng nghĩa với "essential"?', options: ['Optional', 'Vital', 'Harmful', 'Minor'], answer: 'B', hint: 'essential = thiết yếu, rất quan trọng.' },
      { kind: 'short', topic: 'Hóa học', level: 'Thông hiểu', prompt: 'Nhập số hiệu nguyên tử (Z) của nguyên tố Carbon (C):', answer: '6', acceptedAnswers: ['6'], hint: 'Carbon đứng thứ 6 trong bảng tuần hoàn.' },
      { kind: 'mcq', topic: 'Vật lý', level: 'Thông hiểu', prompt: 'Đơn vị đo cường độ dòng điện trong hệ SI là gì?', options: ['Volt (V)', 'Ohm (Ω)', 'Ampere (A)', 'Watt (W)'], answer: 'C', hint: 'Đặt theo tên nhà bác học André-Marie Ampère.' },
      { kind: 'short', topic: 'Toán học', level: 'Thông hiểu', prompt: 'Tổng các góc trong của một tam giác phẳng bằng bao nhiêu độ? (Chỉ nhập số)', answer: '180', acceptedAnswers: ['180', '180 độ'], hint: 'Tính chất cơ bản của tam giác Euclid.' },
      { kind: 'mcq', topic: 'Sinh học', level: 'Thông hiểu', prompt: 'Bào quan nào là "nhà máy năng lượng" tổng hợp ATP chủ yếu ở tế bào nhân thực?', options: ['Ribosome', 'Ti thể', 'Bộ máy Golgi', 'Lizôxôm'], answer: 'B', hint: 'Nơi diễn ra hô hấp tế bào hiếu khí.' },
      { kind: 'short', topic: 'Tiếng Anh', level: 'Vận dụng', prompt: 'Điền dạng quá khứ đơn (V2) của động từ "teach":', answer: 'taught', acceptedAnswers: ['taught'], hint: 'Động từ bất quy tắc: teach – taught – taught.' },
      { kind: 'mcq', topic: 'Tổng hợp', level: 'Vận dụng', prompt: 'Trong bảng tuần hoàn chuẩn IUPAC hiện tại có bao nhiêu nguyên tố đã được đặt tên?', options: ['112', '114', '118', '120'], answer: 'C', hint: 'Nguyên tố cuối cùng ở chu kỳ 7 là Oganesson (Z = 118).' },
      { kind: 'short', topic: 'Hóa học', level: 'Vận dụng', prompt: 'Nhập phân tử khối (amu) của nước H2O (biết H=1, O=16):', answer: '18', acceptedAnswers: ['18'], hint: '2 × 1 + 16.' }
    ]
  }
];
