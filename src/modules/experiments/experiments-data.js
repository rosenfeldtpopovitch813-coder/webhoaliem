// Curriculum-aligned experiment catalog for HTVVM Studio (extensible by subject & model).

export const EXPERIMENT_SUBJECTS = Object.freeze([
  { id: 'all', label: 'Tất cả môn học' },
  { id: 'physics', label: 'Vật lý' },
  { id: 'chemistry', label: 'Hóa học' },
  { id: 'biology', label: 'Sinh học' }
]);

export const EXPERIMENTS = [
  {
    id: 'brownian-motion',
    subject: 'physics',
    subjectLabel: 'Vật lý',
    grade: 'Vật lý 12 · Vật lý nhiệt',
    title: 'Thí nghiệm Brown (1827)',
    shortDesc: 'Quan sát hạt phấn hoa, hạt bụi vô cơ và hạt khói chuyển động hỗn loạn không ngừng do va chạm không cân bằng từ các phân tử môi trường.',
    has3D: true,
    simKind: 'brownian',
    history: {
      title: 'Bối cảnh lịch sử',
      summary: 'Năm 1827, nhà thực vật học người Scotland Robert Brown khi quan sát hạt phấn hoa Clarkia pulchella lơ lửng trong giọt nước dưới kính hiển vi quang học đã phát hiện các hạt luôn rung lắc, dịch chuyển giật cục không ngừng dù giọt nước đứng yên. Ban đầu ông nghi ngờ đây là đặc tính của sinh vật sống, nhưng khi thử lại với hạt phấn hoa đã bảo quản hàng trăm năm và các hạt vô cơ (bụi đá, thủy tinh nghiền mịn, muội than), hiện tượng vẫn xảy ra y hệt.',
      milestones: [
        '1827 — Robert Brown công bố quan sát thực nghiệm đầu tiên về chuyển động hỗn loạn không ngừng của các hạt nhỏ cỡ micromet lơ lửng trong chất lỏng.',
        '1905 — Albert Einstein xây dựng lý thuyết định lượng giải thích chuyển động Brown bằng thuyết động học phân tử và suy ra hệ thức độ dịch chuyển trung bình bình phương theo nhiệt độ và hằng số Avogadro $N_A$.',
        '1908 — Nhà vật lý Pháp Jean Perrin thực hiện các phép đo thực nghiệm chính xác về chuyển động Brown, xác định được giá trị hằng số Avogadro $N_A$ và khép lại tranh luận về sự tồn tại thực sự của nguyên tử, phân tử.'
      ]
    },
    setup: {
      title: 'Bố trí thí nghiệm',
      intro: 'Thí nghiệm có thể tiến hành trong chất lỏng (phiên bản gốc của Brown) hoặc trong chất khí (hạt khói trong hộp không khí). Với bố trí tiêu chuẩn trong chất lỏng, hệ thống gồm:',
      items: [
        { name: 'Kính hiển vi quang học độ phóng đại lớn', detail: 'Cho phép quan sát rõ các hạt lơ lửng kích thước cỡ micromet ($10^{-6}\\text{ m}$), lưu ý kính hiển vi quang học không thể nhìn trực tiếp từng phân tử nước.' },
        { name: 'Lam kính (phiến kính) sạch chứa giọt nước cất', detail: 'Đặt phẳng trên mâm kính để loại trừ chuyển động trôi theo dòng chảy vĩ mô.' },
        { name: 'Mẫu vật lơ lửng và mẫu đối chứng', detail: 'Hạt phấn hoa nhỏ (Clarkia pulchella) cùng các mẫu vô cơ đối chứng như hạt bụi mịn, muội than hoặc thủy tinh nghiền nhỏ; bản chất khí dùng hạt khói trong buồng không khí.' },
        { name: 'Nguồn sáng chiếu qua tiêu bản', detail: 'Chiếu sáng từ bên dưới (hoặc chiếu xiên trong buồng khói) giúp hạt hiện rõ trên thị trường kính hiển vi.' },
        { name: 'Thiết bị điều chỉnh nhiệt độ', detail: 'Dùng khi mở rộng thí nghiệm để khảo sát sự thay đổi tốc độ chuyển động của hạt khi tăng nhiệt độ $T$.' }
      ]
    },
    procedure: {
      title: 'Tiến trình thí nghiệm',
      steps: [
        {
          step: 1,
          heading: 'Chuẩn bị tiêu bản nước chứa hạt phấn hoa',
          detail: 'Nhỏ một giọt nước cất lên lam kính sạch, rắc một lượng rất nhỏ hạt phấn hoa sao cho các hạt phân tán đều và lơ lửng trong nước.',
          actionLabel: 'Áp dụng Bước 1 lên 3D',
          presetPatch: { presetId: 'pollen-water', temperatureC: 22, particleRadius: 0.125, viewMode: '3d', showMolecules: false, showTrail: false, showMarkers: false, showForce: false, clearTrail: true }
        },
        {
          step: 2,
          heading: 'Đặt tiêu bản và lấy nét dưới kính hiển vi',
          detail: 'Đặt lam kính lên mâm kính, bật nguồn sáng và chỉnh ốc sơ cấp, vi cấp đến khi quan sát sắc nét từng hạt phấn hoa riêng lẻ trên thị trường kính hiển vi.',
          actionLabel: 'Mở góc nhìn Kính hiển vi',
          presetPatch: { presetId: 'pollen-water', temperatureC: 25, viewMode: 'microscope', showMolecules: false, showTrail: true, showMarkers: false, showForce: false, clearTrail: true }
        },
        {
          step: 3,
          heading: 'Theo dõi và dựng quỹ đạo của một hạt xác định',
          detail: 'Chọn một hạt phấn hoa cố định, đánh dấu vị trí của nó sau mỗi khoảng thời gian bằng nhau (ví dụ mỗi 30 giây thực tế), rồi nối các vị trí liên tiếp bằng đoạn thẳng có mũi tên để thu được quỹ đạo gấp khúc biểu kiến.',
          actionLabel: 'Bật đánh dấu mốc Δt + mũi tên',
          presetPatch: { presetId: 'pollen-water', temperatureC: 28, viewMode: 'microscope', showMolecules: true, showTrail: true, showMarkers: true, showForce: true, clearTrail: true }
        },
        {
          step: 4,
          heading: 'Thay đổi nhiệt độ và mẫu hạt đối chứng',
          detail: 'Tăng nhiệt độ của giọt nước để quan sát tốc độ dịch chuyển tăng lên. Lặp lại thao tác với hạt vô cơ (bụi mịn, muội than) hoặc hạt khói trong không khí để loại trừ dòng đối lưu và yếu tố sự sống.',
          actionLabel: 'Thử mẫu đối chứng & tăng T = 80°C',
          presetPatch: { presetId: 'dust-water', temperatureC: 80, particleRadius: 0.105, viewMode: '3d', showMolecules: true, showTrail: true, showMarkers: true, showForce: true, clearTrail: true }
        }
      ]
    },
    observations: {
      title: 'Kết quả quan sát',
      items: [
        { label: 'Chuyển động hỗn loạn, không ngừng', text: 'Các hạt phấn hoa luôn rung lắc, dịch chuyển giật cục theo mọi hướng bất kỳ và không bao giờ dừng lại dù để yên rất lâu.' },
        { label: 'Quỹ đạo gấp khúc (ziczac)', text: 'Đường nối các vị trí của hạt sau những khoảng thời gian bằng nhau là đường gấp khúc phức tạp, đổi hướng liên tục và không có quy luật xác định.' },
        { label: 'Phụ thuộc vào nhiệt độ', text: 'Khi nhiệt độ nước tăng lên, các hạt phấn hoa chuyển động càng nhanh và biên độ dịch chuyển càng lớn.' },
        { label: 'Không phụ thuộc bản chất sinh học', text: 'Các hạt vô cơ không có sự sống (bụi đá, muội than, hạt khói trong không khí) vẫn chuyển động y hệt; hạt có kích thước càng nhỏ thì chuyển động càng rõ rệt.' }
      ]
    },
    explanation: {
      title: 'Giải thích theo mô hình động học phân tử',
      points: [
        'Nước được cấu tạo từ vô số phân tử nước kích thước vô cùng nhỏ (kính hiển vi quang học không nhìn thấy được), luôn chuyển động nhiệt hỗn loạn không ngừng.',
        'Trong quá trình chuyển động, các phân tử nước liên tục va chạm vào hạt phấn hoa từ mọi phía.',
        'Do tính chất hỗn loạn ngẫu nhiên, tại từng thời điểm tức thời, số lượng phân tử va chạm và lực đẩy tác dụng lên các phía của hạt phấn hoa không cân bằng nhau.',
        'Hợp lực tức thời khác không ($\\vec{F}_{\\text{hl}} \\neq \\vec{0}$) liên tục đổi cả hướng lẫn độ lớn, đẩy hạt phấn hoa chạy theo những đoạn ngắn đổi hướng đột ngột tạo thành quỹ đạo gấp khúc.',
        'Khi nhiệt độ tăng ($T\\text{ (K)} = t\\text{ (}^\\circ\\text{C)} + 273{,}15$), động năng trung bình của các phân tử môi trường tăng, chúng va chạm vào hạt mạnh và thường xuyên hơn khiến hạt chuyển động hỗn loạn nhanh hơn.'
      ]
    },
    conclusion: {
      title: 'Ý nghĩa và kết luận',
      conclusions: [
        'Các phân tử cấu tạo nên chất lỏng và chất khí luôn chuyển động hỗn loạn không ngừng.',
        'Nhiệt độ của chất càng cao thì các phân tử cấu tạo nên chất chuyển động càng nhanh (chuyển động nhiệt).'
      ],
      significance: 'Thí nghiệm Brown là bằng chứng thực nghiệm trực tiếp khẳng định sự tồn tại thực sự của nguyên tử, phân tử và đặt nền móng cho thuyết động học phân tử. Từ kết quả lý thuyết của Einstein (1905) và đo đạc của Jean Perrin (1908), giới vật lý đã tính được hằng số Avogadro $N_A$, chấm dứt cuộc tranh luận nhiều thập kỷ về sự tồn tại của nguyên tử.',
      misconception: 'Phân biệt dễ nhầm khi làm bài tập: Chuyển động Brown là chuyển động của hạt nhỏ lơ lửng (hạt phấn hoa, hạt bụi, hạt khói) quan sát được dưới kính hiển vi, KHÔNG phải bản thân chuyển động của các phân tử nước hay phân tử khí; nó là hệ quả gián tiếp do các phân tử chất lỏng/chất khí va chạm không cân bằng gây ra.'
    }
  }
];
