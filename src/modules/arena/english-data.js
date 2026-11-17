// Original, copyright-free English study dataset curated for HTVVM Studio (THPT & V-ACT aligned).

export const ENGLISH_THEMES = [
  { id: 'all', label: 'Tất cả chủ đề' },
  { id: 'environment', label: 'Môi trường & Khí hậu' },
  { id: 'technology', label: 'Công nghệ & Chuyển đổi số' },
  { id: 'education', label: 'Giáo dục & Học tập' },
  { id: 'health', label: 'Sức khỏe & Lối sống' },
  { id: 'phrasal', label: 'Phrasal Verbs' },
  { id: 'collocations', label: 'Collocations & Idioms' }
];

export const BASE_VOCAB = [
  // Environment
  { id: 'v1', theme: 'environment', themeLabel: 'Môi trường & Khí hậu', level: 'B2', word: 'sustainable', ipa: '/səˈsteɪnəbl/', pos: 'adj', meaning: 'bền vững, không gây cạn kiệt tài nguyên', example: 'Cities are investing in sustainable public transport networks.' },
  { id: 'v2', theme: 'environment', themeLabel: 'Môi trường & Khí hậu', level: 'B1', word: 'renewable', ipa: '/rɪˈnjuːəbl/', pos: 'adj', meaning: 'có thể tái tạo (năng lượng gió, mặt trời)', example: 'Solar energy is a reliable renewable resource.' },
  { id: 'v3', theme: 'environment', themeLabel: 'Môi trường & Khí hậu', level: 'B2', word: 'biodiversity', ipa: '/ˌbaɪəʊdaɪˈvɜːsəti/', pos: 'n', meaning: 'đa dạng sinh học', example: 'Wetlands play a vital role in preserving biodiversity.' },
  { id: 'v4', theme: 'environment', themeLabel: 'Môi trường & Khí hậu', level: 'B2', word: 'emission', ipa: '/ɪˈmɪʃn/', pos: 'n', meaning: 'khí thải, sự phát thải', example: 'Strict standards help cut industrial carbon emissions.' },
  { id: 'v5', theme: 'environment', themeLabel: 'Môi trường & Khí hậu', level: 'B2', word: 'mitigate', ipa: '/ˈmɪtɪɡeɪt/', pos: 'v', meaning: 'giảm nhẹ, làm dịu bớt tác động', example: 'Urban tree planting helps mitigate extreme heatwaves.' },
  { id: 'v6', theme: 'environment', themeLabel: 'Môi trường & Khí hậu', level: 'B1', word: 'conservation', ipa: '/ˌkɒnsəˈveɪʃn/', pos: 'n', meaning: 'sự bảo tồn thiên nhiên', example: 'Water conservation is crucial during dry seasons.' },
  // Technology
  { id: 'v7', theme: 'technology', themeLabel: 'Công nghệ & Chuyển đổi số', level: 'B2', word: 'automate', ipa: '/ˈɔːtəmeɪt/', pos: 'v', meaning: 'tự động hóa', example: 'Digital tools automate repetitive grading tasks for teachers.' },
  { id: 'v8', theme: 'technology', themeLabel: 'Công nghệ & Chuyển đổi số', level: 'B2', word: 'breakthrough', ipa: '/ˈbreɪkθruː/', pos: 'n', meaning: 'bước đột phá khoa học/công nghệ', example: 'Battery chemistry saw a major breakthrough this decade.' },
  { id: 'v9', theme: 'technology', themeLabel: 'Công nghệ & Chuyển đổi số', level: 'B1', word: 'efficient', ipa: '/ɪˈfɪʃnt/', pos: 'adj', meaning: 'hiệu quả, tiết kiệm thời gian/năng lượng', example: 'Online flashcards offer an efficient way to review terms.' },
  { id: 'v10', theme: 'technology', themeLabel: 'Công nghệ & Chuyển đổi số', level: 'B2', word: 'cybersecurity', ipa: '/ˌsaɪbəsɪˈkjʊərəti/', pos: 'n', meaning: 'an ninh mạng', example: 'Schools prioritize cybersecurity to protect student records.' },
  { id: 'v11', theme: 'technology', themeLabel: 'Công nghệ & Chuyển đổi số', level: 'B2', word: 'versatile', ipa: '/ˈvɜːsətaɪl/', pos: 'adj', meaning: 'đa năng, linh hoạt', example: 'A tablet becomes a versatile digital notebook during lectures.' },
  { id: 'v12', theme: 'technology', themeLabel: 'Công nghệ & Chuyển đổi số', level: 'B2', word: 'obsolete', ipa: '/ˌɒbsəˈliːt/', pos: 'adj', meaning: 'lỗi thời, không còn được dùng', example: 'Floppy disks quickly became obsolete after cloud storage arrived.' },
  // Education
  { id: 'v13', theme: 'education', themeLabel: 'Giáo dục & Học tập', level: 'B2', word: 'curriculum', ipa: '/kəˈrɪkjələm/', pos: 'n', meaning: 'chương trình giảng dạy', example: 'The updated curriculum emphasizes practical laboratory skills.' },
  { id: 'v14', theme: 'education', themeLabel: 'Giáo dục & Học tập', level: 'B2', word: 'perseverance', ipa: '/ˌpɜːsɪˈvɪərəns/', pos: 'n', meaning: 'sự kiên trì, bền bỉ', example: 'Mastering organic chemistry takes steady perseverance.' },
  { id: 'v15', theme: 'education', themeLabel: 'Giáo dục & Học tập', level: 'B1', word: 'comprehend', ipa: '/ˌkɒmprɪˈhend/', pos: 'v', meaning: 'hiểu thấu, lĩnh hội', example: 'Diagrams help learners comprehend abstract concepts faster.' },
  { id: 'v16', theme: 'education', themeLabel: 'Giáo dục & Học tập', level: 'B2', word: 'proficiency', ipa: '/prəˈfɪʃnsi/', pos: 'n', meaning: 'sự thành thạo, trình độ chuyên môn', example: 'Daily reading steadily raises language proficiency.' },
  { id: 'v17', theme: 'education', themeLabel: 'Giáo dục & Học tập', level: 'B2', word: 'critical thinking', ipa: '/ˈkrɪtɪkl ˈθɪŋkɪŋ/', pos: 'n', meaning: 'tư duy phản biện', example: 'Science fairs encourage critical thinking over rote memorization.' },
  { id: 'v18', theme: 'education', themeLabel: 'Giáo dục & Học tập', level: 'B1', word: 'diligent', ipa: '/ˈdɪlɪdʒənt/', pos: 'adj', meaning: 'chăm chỉ, siêng năng', example: 'Diligent note-takers review mistakes after every mock test.' },
  // Health
  { id: 'v19', theme: 'health', themeLabel: 'Sức khỏe & Lối sống', level: 'B2', word: 'resilience', ipa: '/rɪˈzɪliəns/', pos: 'n', meaning: 'khả năng phục hồi, sức bền tinh thần', example: 'Adequate sleep builds mental resilience during exam season.' },
  { id: 'v20', theme: 'health', themeLabel: 'Sức khỏe & Lối sống', level: 'B1', word: 'nutritious', ipa: '/njuːˈtrɪʃəs/', pos: 'adj', meaning: 'giàu dinh dưỡng', example: 'A nutritious breakfast improves morning concentration.' },
  { id: 'v21', theme: 'health', themeLabel: 'Sức khỏe & Lối sống', level: 'B2', word: 'sedentary', ipa: '/ˈsedntri/', pos: 'adj', meaning: 'ít vận động, ngồi nhiều', example: 'Taking stretch breaks counters a sedentary study routine.' },
  { id: 'v22', theme: 'health', themeLabel: 'Sức khỏe & Lối sống', level: 'B1', word: 'relieve', ipa: '/rɪˈliːv/', pos: 'v', meaning: 'làm dịu, giải tỏa (căng thẳng)', example: 'Short walks help relieve eye strain and stress.' },
  { id: 'v23', theme: 'health', themeLabel: 'Sức khỏe & Lối sống', level: 'B2', word: 'immune', ipa: '/ɪˈmjuːn/', pos: 'adj', meaning: 'miễn dịch; miễn nhiễm', example: 'Regular hydration supports a healthy immune system.' },
  { id: 'v24', theme: 'health', themeLabel: 'Sức khỏe & Lối sống', level: 'B2', word: 'fatigue', ipa: '/fəˈtiːɡ/', pos: 'n', meaning: 'sự mệt mỏi, kiệt sức', example: 'Blue light late at night can increase daytime fatigue.' },
  // Phrasal Verbs
  { id: 'v25', theme: 'phrasal', themeLabel: 'Phrasal Verbs', level: 'B1', word: 'put off', ipa: '/pʊt ɒf/', pos: 'phr.v', meaning: 'trì hoãn (= postpone)', example: 'Never put off reviewing weak chapters until exam eve.' },
  { id: 'v26', theme: 'phrasal', themeLabel: 'Phrasal Verbs', level: 'B2', word: 'come across', ipa: '/kʌm əˈkrɒs/', pos: 'phr.v', meaning: 'tình cờ bắt gặp (= encounter)', example: 'I came across a great idiom while reading an article.' },
  { id: 'v27', theme: 'phrasal', themeLabel: 'Phrasal Verbs', level: 'B1', word: 'figure out', ipa: '/ˈfɪɡər aʊt/', pos: 'phr.v', meaning: 'tìm ra lời giải, hiểu ra', example: 'Take your time to figure out the reaction mechanism.' },
  { id: 'v28', theme: 'phrasal', themeLabel: 'Phrasal Verbs', level: 'B2', word: 'carry out', ipa: '/ˈkæri aʊt/', pos: 'phr.v', meaning: 'tiến hành, thực hiện (thí nghiệm/khảo sát)', example: 'Students carried out two titration experiments in lab.' },
  { id: 'v29', theme: 'phrasal', themeLabel: 'Phrasal Verbs', level: 'B2', word: 'make up for', ipa: '/meɪk ʌp fɔː/', pos: 'phr.v', meaning: 'bù đắp cho (= compensate for)', example: 'Focused Sunday review helped make up for missed practice.' },
  { id: 'v30', theme: 'phrasal', themeLabel: 'Phrasal Verbs', level: 'B2', word: 'keep up with', ipa: '/kiːp ʌp wɪð/', pos: 'phr.v', meaning: 'theo kịp tiến độ / xu hướng', example: 'Summarizing lessons weekly makes it easy to keep up with class.' },
  // Collocations & Idioms
  { id: 'v31', theme: 'collocations', themeLabel: 'Collocations & Idioms', level: 'B2', word: 'make progress', ipa: '/meɪk ˈprəʊɡres/', pos: 'colloc', meaning: 'tiến bộ, đạt bước tiến', example: 'Tracking daily streaks helps learners make steady progress.' },
  { id: 'v32', theme: 'collocations', themeLabel: 'Collocations & Idioms', level: 'B2', word: 'pay attention to', ipa: '/peɪ əˈtenʃn tuː/', pos: 'colloc', meaning: 'chú ý tới', example: 'Pay attention to time signals before choosing a verb tense.' },
  { id: 'v33', theme: 'collocations', themeLabel: 'Collocations & Idioms', level: 'B2', word: 'bridge the gap', ipa: '/brɪdʒ ðə ɡæp/', pos: 'idiom', meaning: 'thu hẹp khoảng cách', example: 'Free digital tools help bridge the gap between theory and practice.' },
  { id: 'v34', theme: 'collocations', themeLabel: 'Collocations & Idioms', level: 'C1', word: 'with flying colors', ipa: '/wɪð ˈflaɪɪŋ ˈkʌləz/', pos: 'idiom', meaning: 'xuất sắc, điểm rất cao', example: 'After weeks of disciplined focus, she passed with flying colors.' },
  { id: 'v35', theme: 'collocations', themeLabel: 'Collocations & Idioms', level: 'B2', word: 'take into account', ipa: '/teɪk ˈɪntuː əˈkaʊnt/', pos: 'colloc', meaning: 'cân nhắc, tính đến yếu tố nào đó', example: 'Always take units into account when solving physics problems.' },
  { id: 'v36', theme: 'collocations', themeLabel: 'Collocations & Idioms', level: 'B2', word: 'a double-edged sword', ipa: '/ə ˌdʌbl edʒd ˈsɔːd/', pos: 'idiom', meaning: 'con dao hai lưỡi (vừa lợi vừa hại)', example: 'AI tutors are a double-edged sword if students skip thinking.' }
];

export const GRAMMAR_TOPICS = [
  {
    id: 'g-tenses',
    title: '1. Thì động từ & Phối hợp thì',
    frequency: 'Xuất hiện thường xuyên',
    formula: 'Past Continuous (was/were + V-ing) + WHEN + Past Simple (V2/ed)\nBy + mốc tương lai  →  S + will have + V3/ed\nSince + S + V2/ed,  S + have/has + V3/ed',
    rules: [
      'Hiện tại hoàn thành diễn tả hành động bắt đầu ở quá khứ và còn kéo dài hoặc có kết quả ở hiện tại.',
      'Quá khứ tiếp diễn dùng cho hành động đang diễn ra tại thời điểm xác định ở quá khứ hoặc bị cắt ngang bởi Quá khứ đơn.',
      'Không dùng thì hiện tại hoàn thành với mốc thời gian quá khứ xác định như yesterday, in 2020, ago.'
    ],
    signals: ['since / for / so far', 'by the time + S + V(s/es)', 'at 8 PM last night', 'while / when'],
    traps: 'Nhầm lẫn giữa "since + mốc quá khứ (S + V2)" và vế chính dùng Hiện tại hoàn thành; dùng sai thì tương lai trong mệnh đề thời gian (when/until/as soon as dùng hiện tại đơn).',
    examples: [
      { en: 'While the students were calibrating the sensor, the power flickered.', vi: 'Trong lúc học sinh đang hiệu chỉnh cảm biến thì điện chập chờn.' },
      { en: 'By the time June arrives, she will have completed twenty mock exams.', vi: 'Trước khi tháng Sáu tới, bạn ấy sẽ hoàn thành 20 đề thi thử.' }
    ],
    miniQuiz: {
      prompt: 'Since Lan ___ the online study timer last month, her daily focus hours have doubled.',
      options: ['starts', 'started', 'has started', 'had started'],
      answer: 'B',
      explain: 'Mệnh đề ngay sau "Since" chỉ mốc thời gian bắt đầu trong quá khứ nên chia Quá khứ đơn (started).'
    }
  },
  {
    id: 'g-passive',
    title: '2. Câu bị động & Bị động đặc biệt',
    frequency: 'Cốt lõi THPT / V-ACT',
    formula: 'Cơ bản:  S + be + V3/ed (+ by O)\nKhách quan: It is said/believed that S + V\nNhờ vả: have + vật + V3/ed  |  get + vật + V3/ed',
    rules: [
      'Động từ khuyết thiếu ở dạng bị động: modal (can/should/must/will) + be + V3/ed.',
      'Chủ ngữ giả "It is thought/reported that..." chuyển sang chủ ngữ thực: "S + is/are thought + to V / to have V3".',
      'Thể nhờ vả chủ động là "have sb + V(bare)" và "get sb + to V", nhưng khi tân ngữ là vật đều dùng + V3/ed.'
    ],
    signals: ['by + tác nhân', 'chủ ngữ là đồ vật/kế hoạch', 'have something done'],
    traps: 'Dùng V-ing hoặc V nguyên mẫu cho bị động với vật sau have/get; quên lùi to have V3 khi hành động xảy ra trước động từ tường thuật.',
    examples: [
      { en: 'All submitted answers are graded automatically by the server.', vi: 'Mọi bài làm đã nộp đều được máy chủ chấm điểm tự động.' },
      { en: 'We should have the broken microscope repaired before Friday.', vi: 'Chúng ta nên mang chiếc kính hiển vi bị hỏng đi sửa trước thứ Sáu.' }
    ],
    miniQuiz: {
      prompt: 'Solar panels ___ on the school roof before the next semester begins.',
      options: ['will install', 'will be installed', 'installed', 'are installing'],
      answer: 'B',
      explain: 'Chủ ngữ "Solar panels" chịu tác động lắp đặt ở tương lai nên dùng bị động will be installed.'
    }
  },
  {
    id: 'g-conditionals',
    title: '3. Câu điều kiện & Đảo ngữ điều kiện',
    frequency: 'Trọng tâm cao',
    formula: 'Loại 1: If + S + V(s/es), S + will + V\nLoại 2: If + S + V2/were, S + would + V  (Đảo: Were + S + (to V)...)\nLoại 3: If + S + had V3, S + would have V3  (Đảo: Had + S + V3...)',
    rules: [
      'Điều kiện hỗn hợp (3 → 2): nguyên nhân giả định trong quá khứ (had V3) dẫn tới kết quả trái hiện tại (would + V + now/today).',
      'Khi đảo ngữ loại 2 có động từ thường dùng: "Were + S + to V, S + would + V".',
      'Unless = If ... not (chú ý không dùng thêm phủ định ngay sau Unless).'
    ],
    signals: ['provided that / as long as', 'unless', 'but for / without + N', 'now / today trong vế kết quả loại 3'],
    traps: 'Thấy "would" nằm ngay trong mệnh đề If; bỏ sót "had" ở vế đảo ngữ điều kiện loại 3.',
    examples: [
      { en: 'Had they checked the time limit earlier, no mistake would have occurred.', vi: 'Giá như họ kiểm tra giới hạn thời gian sớm hơn thì sai sót đã không xảy ra.' },
      { en: 'Without renewable energy, carbon emissions would continue rising rapidly.', vi: 'Nếu không có năng lượng tái tạo, lượng khí thải sẽ tiếp tục tăng nhanh.' }
    ],
    miniQuiz: {
      prompt: '___ more carefully, the team would not be facing this issue now.',
      options: ['If they plan', 'Had they planned', 'Did they plan', 'Were they plan'],
      answer: 'B',
      explain: 'Điều kiện hỗn hợp loại 3–2 (trước đây không lập kế hoạch kỹ → bây giờ "now" đang gặp vấn đề), dùng đảo ngữ Had they planned.'
    }
  },
  {
    id: 'g-relative',
    title: '4. Mệnh đề quan hệ & Rút gọn mệnh đề',
    frequency: 'Chắc chắn có trong đề',
    formula: 'Người: who / whom / whose + N\nVật: which / that\nRút gọn chủ động → V-ing  |  bị động → V3/ed  |  so sánh nhất/thứ tự → to V',
    rules: [
      'Không dùng "that" sau dấu phẩy (mệnh đề quan hệ không xác định) hoặc ngay sau giới từ (in which, for whom).',
      'Giới từ + which có thể thay bằng where (nơi chốn), when (thời gian), why (lý do).',
      'Số lượng + of + whom/which luôn đi sau dấu phẩy (both of whom, several of which).'
    ],
    signals: ['dấu phẩy tách mệnh đề', 'the first / the only / so sánh nhất', 'giới từ đứng trước chỗ trống'],
    traps: 'Chọn nhầm "that" sau dấu phẩy hoặc sau giới từ; dùng "V-ing" thay cho bị động "V3/ed" khi rút gọn.',
    examples: [
      { en: 'Students preparing for the national exam should practice timed tests.', vi: 'Những học sinh đang ôn thi tốt nghiệp nên luyện các đề có bấm giờ.' },
      { en: 'The platform built by high school learners supports offline flashcards.', vi: 'Nền tảng được học sinh THPT xây dựng hỗ trợ flashcard ngoại tuyến.' }
    ],
    miniQuiz: {
      prompt: 'The digital handbook, ___ covers 118 chemical elements, runs cleanly on phones.',
      options: ['that', 'which', 'what', 'whose'],
      answer: 'B',
      explain: 'Có dấu phẩy tách mệnh đề không xác định chỉ vật nên bắt buộc dùng which (không dùng that).'
    }
  },
  {
    id: 'g-inversion',
    title: '5. Đảo ngữ nhấn mạnh (Inversion)',
    frequency: 'Mức độ Vận dụng',
    formula: 'Never / Seldom / Rarely / Little / Hardly + trợ động từ + S + V\nOnly after / Not until + mốc/mệnh đề + trợ động từ + S + V\nNo sooner + had S V3 + than S V2',
    rules: [
      'Các cụm đứng đầu câu làm đảo trợ động từ lên trước chủ ngữ như câu hỏi nhưng câu vẫn kết thúc bằng dấu chấm.',
      'Với "Not until" và "Only when/after/if", đảo ngữ đặt ở mệnh đề CHÍNH phía sau, không đảo ngay ở mệnh đề phụ.',
      'Hardly/Scarcely ... when đi cùng Quá khứ hoàn thành ở vế đầu và Quá khứ đơn ở vế sau.'
    ],
    signals: ['Not only ... but also', 'Never / Rarely đầu câu', 'No sooner ... than', 'Only by + V-ing'],
    traps: 'Đảo ngữ sai vị trí ngay sau Only after/Not until; chia động từ V2 sau did thay vì V nguyên mẫu.',
    examples: [
      { en: 'Not only did she review grammar daily, but she also helped classmates.', vi: 'Bạn ấy không chỉ ôn ngữ pháp mỗi ngày mà còn giúp bạn cùng lớp.' },
      { en: 'Not until the countdown hit zero did the system submit automatically.', vi: 'Mãi đến khi đồng hồ về 0 thì hệ thống mới tự động nộp bài.' }
    ],
    miniQuiz: {
      prompt: 'No sooner ___ the exam code than the split-screen sheet appeared.',
      options: ['she entered', 'had she entered', 'she had entered', 'did she entered'],
      answer: 'B',
      explain: 'Cấu trúc No sooner + had + S + V3 + than + S + V2.'
    }
  },
  {
    id: 'g-concession',
    title: '6. Mệnh đề Nhượng bộ & Nguyên nhân',
    frequency: 'Xuất hiện thường xuyên',
    formula: 'Although / Though / Even though + S + V\nDespite / In spite of + Cụm danh từ / V-ing\nBecause + S + V   vs   Because of / Due to + N/V-ing',
    rules: [
      'Cấu trúc đảo tính từ/trạng từ nhượng bộ: "Adj/Adv + as/though + S + V" (Ví dụ: Hard as he tried...).',
      'However / Nevertheless là trạng từ liên kết, thường tách câu bằng dấu chấm hoặc chấm phẩy và có dấu phẩy phía sau.',
      'In spite of the fact that + mệnh đề = Although + mệnh đề.'
    ],
    signals: ['although vs despite', 'because vs because of', 'cụm danh từ phía sau chỗ trống'],
    traps: 'Thấy "Although ... but ..." xuất hiện cùng một câu là sai ngữ pháp (không dùng cả Although và but cho 2 vế).',
    examples: [
      { en: 'Despite having a tight schedule, Nam maintained a 14-day login streak.', vi: 'Mặc dù lịch trình dày đặc, Nam vẫn duy trì chuỗi đăng nhập 14 ngày.' },
      { en: 'Difficult as the stoichiometry question looked, the shortcut solved it quickly.', vi: 'Câu tính toán trông khó nhưng cách giải nhanh xử lý được gọn.' }
    ],
    miniQuiz: {
      prompt: '___ the strict lockdown timer, learners stayed calm and focused on each section.',
      options: ['Although', 'Despite', 'Because', 'Even though'],
      answer: 'B',
      explain: 'Phía sau là cụm danh từ "the strict lockdown timer" (không có động từ chia thì) nên chọn giới từ Despite.'
    }
  },
  {
    id: 'g-participles',
    title: '7. Rút gọn hai mệnh đề đồng chủ ngữ (Participles)',
    frequency: 'Thường gặp ở Đọc & Viết lại câu',
    formula: 'Chủ động đồng thời: V-ing..., S + V\nXảy ra xong trước (chủ động): Having + V3/ed..., S + V\nBị động: (Having been) + V3/ed..., S + V',
    rules: [
      'Điều kiện bắt buộc để rút gọn là hai mệnh đề phải có CÙNG chủ ngữ thực hiện hoặc nhận hành động.',
      'Nếu hành động rút gọn nhấn mạnh hoàn thành xong trước hành động chính mới dùng Having + V3/ed.'
    ],
    signals: ['Hai vế cách nhau bởi dấu phẩy', 'chủ ngữ vế sau là người/vật đối chiếu xem làm chủ hay bị tác động'],
    traps: 'Dangling participle: rút gọn sai khi chủ ngữ vế chính không khớp với phân từ (ví dụ: "Walking into the room, the whiteboard looked huge" là sai).',
    examples: [
      { en: 'Having mastered all 12 structures, Minh tackled the mock exam easily.', vi: 'Sau khi nắm vững 12 cấu trúc, Minh làm đề thi thử khá nhẹ nhàng.' }
    ],
    miniQuiz: {
      prompt: '___ in concise modular files, the codebase is straightforward to verify.',
      options: ['Organizing', 'Organized', 'Having organized', 'To organize'],
      answer: 'B',
      explain: 'Chủ ngữ "the codebase" mang nghĩa bị động (được tổ chức thành các file mô-đun) nên dùng V3/ed: Organized.'
    }
  },
  {
    id: 'g-subjunctive-wish',
    title: '8. Câu giả định (Subjunctive) & Câu ước (Wish)',
    frequency: 'Mức độ Thông hiểu – Vận dụng',
    formula: 'S + suggest / recommend / insist / demand + that + S + (should) + V(bare)\nIt is vital/essential/necessary + that + S + (should) + V(bare)\nWish hiện tại: S + V2/were  |  Wish quá khứ: S + had V3',
    rules: [
      'Trong thức giả định, động từ sau chủ ngữ ngôi 3 số ít KHÔNG thêm -s/-es và phủ định là "not + V(bare)".',
      '"Would rather + S + V2/ed" dùng cho mong muốn ở hiện tại/tương lai đối với người khác.'
    ],
    signals: ['essential that', 'suggest that', 'if only / wish'],
    traps: 'Chia động từ thêm -s/-es theo phản xạ trong mệnh đề "that every student submits" (đúng phải là "submit").',
    examples: [
      { en: 'It is essential that every candidate review the formula sheet beforehand.', vi: 'Điều thiết yếu là mọi thí sinh đều xem trước bảng công thức.' }
    ],
    miniQuiz: {
      prompt: 'The proctor insisted that every phone ___ switched off during the test.',
      options: ['is', 'was', 'be', 'were'],
      answer: 'C',
      explain: 'Sau "insisted that ..." dùng thức giả định với động từ nguyên mẫu không to: be.'
    }
  },
  {
    id: 'g-comparisons',
    title: '9. So sánh kép & So sánh bằng / hơn',
    frequency: 'Mức độ Thông hiểu',
    formula: 'Càng ... càng: The + so sánh hơn + S + V, the + so sánh hơn + S + V\nSố lần: twice / three times + as + adj/adv + as',
    rules: [
      'Với danh từ không đếm được hoặc số nhiều trong so sánh kép dùng: "The more + N + S + V...".',
      'Không dùng "more" kèm với đuôi "-er" (sai: more faster).'
    ],
    signals: ['The more ... the more', 'twice as ... as', 'than ever'],
    traps: 'Quên mạo từ "the" ở vế thứ hai trong cấu trúc so sánh kép.',
    examples: [
      { en: 'The more consistently you review flashcards, the longer words stick in memory.', vi: 'Bạn ôn flashcard càng đều đặn thì từ vựng lưu trong trí nhớ càng lâu.' }
    ],
    miniQuiz: {
      prompt: 'The clearer the diagram is, ___ students grasp complex reactions.',
      options: ['the faster', 'faster', 'more fast', 'fastest'],
      answer: 'A',
      explain: 'Cấu trúc so sánh kép bắt buộc có mạo từ "the" ở cả hai vế: The clearer ..., the faster ....'
    }
  },
  {
    id: 'g-modals',
    title: '10. Động từ khuyết thiếu suy đoán & Quá khứ',
    frequency: 'Mức độ Thông hiểu – Vận dụng',
    formula: 'Chắc hẳn đã: must have + V3/ed\nKhông thể nào đã: can\'t / couldn\'t have + V3/ed\nĐáng lẽ nên làm (nhưng không làm): should have + V3/ed\nKhông cần thiết (nhưng đã làm): needn\'t have + V3/ed',
    rules: [
      'Phủ định của "must have V3" (suy đoán chắc chắn) là "can\'t / couldn\'t have V3", KHÔNG dùng "mustn\'t have V3".',
      'May/Might have V3 diễn tả khả năng đã xảy ra trong quá khứ nhưng không chắc chắn.'
    ],
    signals: ['chắc chắn trong quá khứ', 'trách móc lẽ ra nên làm'],
    traps: 'Chọn "should have V3" cho suy đoán logic (should have là trách móc/khuyên nhủ bị bỏ lỡ, còn must have mới là suy đoán logic).',
    examples: [
      { en: 'You should have backed up your draft before clearing browser cache.', vi: 'Đáng lẽ bạn nên sao lưu bản nháp trước khi xóa bộ nhớ đệm.' }
    ],
    miniQuiz: {
      prompt: 'The street is wet and puddles are everywhere; it ___ heavily overnight.',
      options: ['must rain', 'must have rained', 'should have rained', 'can\'t have rained'],
      answer: 'B',
      explain: 'Suy đoán logic dựa trên bằng chứng ở hiện tại về một sự việc đã diễn ra đêm qua: must have + V3.'
    }
  }
];

export const ENGLISH_QUIZ_BANK = [
  { id: 'eq1', scope: 'grammar', topic: 'Inversion', prompt: 'Seldom ___ a more intuitive interactive whiteboard for chemistry.', options: ['I have used', 'have I used', 'did I used', 'I used'], answer: 'B', explain: 'Seldom ở đầu câu kéo theo đảo ngữ trợ động từ "have I used".' },
  { id: 'eq2', scope: 'vocab', theme: 'environment', prompt: 'Which word means "able to be maintained without exhausting natural resources"?', options: ['obsolete', 'sedentary', 'sustainable', 'diligent'], answer: 'C', explain: 'sustainable = bền vững.' },
  { id: 'eq3', scope: 'vocab', theme: 'phrasal', prompt: 'Scientists decided to ___ an additional trial to confirm the reaction rate.', options: ['put off', 'carry out', 'make up', 'turn down'], answer: 'B', explain: 'carry out = tiến hành, thực hiện.' },
  { id: 'eq4', scope: 'grammar', topic: 'Conditionals', prompt: 'If you had enabled Focus Mode earlier, your off-tab time ___ tracked safely.', options: ['would have been', 'will be', 'was', 'has been'], answer: 'A', explain: 'Điều kiện loại 3 bị động: would have been V3.' },
  { id: 'eq5', scope: 'vocab', theme: 'education', prompt: 'Steady ___ is far better than cramming overnight before the exam.', options: ['fatigue', 'perseverance', 'emission', 'sword'], answer: 'B', explain: 'perseverance = sự kiên trì, bền bỉ.' },
  { id: 'eq6', scope: 'grammar', topic: 'Relative Clauses', prompt: 'The physics lab ___ we tested the pendulum model was recently upgraded.', options: ['which', 'where', 'that', 'whom'], answer: 'B', explain: 'Mệnh đề sau đầy đủ chủ-vị chỉ nơi chốn → dùng where (= in which).' },
  { id: 'eq7', scope: 'vocab', theme: 'technology', prompt: 'Modern grading scripts ___ routine score calculation in milliseconds.', options: ['mitigate', 'automate', 'comprehend', 'relieve'], answer: 'B', explain: 'automate = tự động hóa.' },
  { id: 'eq8', scope: 'grammar', topic: 'Concession', prompt: '___ the tight deadline, every team member reviewed their work thoroughly.', options: ['Although', 'Because of', 'In spite of', 'Though'], answer: 'C', explain: 'Trước cụm danh từ "the tight deadline" mang nghĩa nhượng bộ dùng In spite of.' },
  { id: 'eq9', scope: 'vocab', theme: 'collocations', prompt: 'Choosing balanced rest breaks helps students ___ exam stress effectively.', options: ['do', 'relieve', 'make', 'catch'], answer: 'B', explain: 'Collocation chuẩn: relieve stress (giảm căng thẳng).' },
  { id: 'eq10', scope: 'grammar', topic: 'Participles', prompt: '___ through the 118 element cards, Huy quickly memorized valence rules.', options: ['Flipped', 'Flipping', 'To flip', 'Having flip'], answer: 'B', explain: 'Huy là chủ thể chủ động thực hiện hành động lật thẻ → Flipping.' },
  { id: 'eq11', scope: 'vocab', theme: 'health', prompt: 'Sitting for five hours straight promotes a ___ lifestyle.', options: ['versatile', 'sedentary', 'nutritious', 'renewable'], answer: 'B', explain: 'sedentary = ít vận động, ngồi nhiều.' },
  { id: 'eq12', scope: 'grammar', topic: 'Comparisons', prompt: 'The earlier learners start timed drills, ___ confident they become.', options: ['more', 'the more', 'most', 'the most'], answer: 'B', explain: 'So sánh kép: The + so sánh hơn ..., the + so sánh hơn ...' }
];

export const REWRITE_EXERCISES = [
  {
    id: 'rw1',
    grammarPoint: 'Câu điều kiện loại 3 / hỗn hợp',
    original: 'Lan did not review the flashcards yesterday, so she forgets several words now.',
    promptHint: 'Viết lại bắt đầu bằng: If Lan had ...',
    accepted: [
      'If Lan had reviewed the flashcards yesterday, she would not forget several words now',
      'If Lan had reviewed the flashcards yesterday, she wouldn\'t forget several words now'
    ],
    mcqOptions: [
      'If Lan had reviewed the flashcards yesterday, she wouldn\'t forget several words now.',
      'If Lan reviewed the flashcards yesterday, she wouldn\'t have forgotten several words now.',
      'If Lan didn\'t review the flashcards yesterday, she would forget several words now.',
      'Unless Lan had reviewed the flashcards yesterday, she wouldn\'t forget several words now.'
    ],
    mcqAnswer: 'A',
    explain: 'Nguyên nhân trong quá khứ (had + V3) dẫn đến hệ quả ở hiện tại "now" → điều kiện hỗn hợp loại 3–2.'
  },
  {
    id: 'rw2',
    grammarPoint: 'Nhượng bộ (Although → Despite)',
    original: 'Although the chemistry problem was challenging, Minh solved it in three minutes.',
    promptHint: 'Viết lại bắt đầu bằng: Despite the challenging ...',
    accepted: [
      'Despite the challenging chemistry problem, Minh solved it in three minutes',
      'Despite the fact that the chemistry problem was challenging, Minh solved it in three minutes'
    ],
    mcqOptions: [
      'Despite the challenging chemistry problem, Minh solved it in three minutes.',
      'Because of the challenging chemistry problem, Minh solved it in three minutes.',
      'Despite the chemistry problem was challenging, Minh solved it in three minutes.',
      'In spite of although the chemistry problem was challenging, Minh solved it in three minutes.'
    ],
    mcqAnswer: 'A',
    explain: 'Sau Despite dùng cụm danh từ "the challenging chemistry problem", không dùng mệnh đề chia động từ trực tiếp.'
  },
  {
    id: 'rw3',
    grammarPoint: 'Đảo ngữ phủ định',
    original: 'We had barely opened the practice room when the server synced the clock.',
    promptHint: 'Viết lại bắt đầu bằng: Hardly had ...',
    accepted: [
      'Hardly had we opened the practice room when the server synced the clock',
      'Hardly had we opened the practice room when the clock was synced by the server'
    ],
    mcqOptions: [
      'Hardly had we opened the practice room when the server synced the clock.',
      'Hardly we had opened the practice room than the server synced the clock.',
      'No sooner had we opened the practice room when the server synced the clock.',
      'Hardly did we opened the practice room when the server synced the clock.'
    ],
    mcqAnswer: 'A',
    explain: 'Cấu trúc đúng: Hardly + had + S + V3 + when + S + V2 (lưu ý No sooner đi với than, còn Hardly đi với when).'
  },
  {
    id: 'rw4',
    grammarPoint: 'Bị động tường thuật',
    original: 'People believe that daily spaced repetition boosts vocabulary retention.',
    promptHint: 'Viết lại bắt đầu bằng: Daily spaced repetition is believed ...',
    accepted: [
      'Daily spaced repetition is believed to boost vocabulary retention'
    ],
    mcqOptions: [
      'Daily spaced repetition is believed to boost vocabulary retention.',
      'Daily spaced repetition is believed boosting vocabulary retention.',
      'Daily spaced repetition was believed to boosted vocabulary retention.',
      'Daily spaced repetition believed to boost vocabulary retention.'
    ],
    mcqAnswer: 'A',
    explain: 'Cả hai vế cùng thì hiện tại → dùng động từ nguyên mẫu có "to": is believed to boost.'
  },
  {
    id: 'rw5',
    grammarPoint: 'So sánh kép',
    original: 'When students solve many mock tests, their time management becomes good.',
    promptHint: 'Viết lại bắt đầu bằng: The more mock tests ...',
    accepted: [
      'The more mock tests students solve, the better their time management becomes',
      'The more mock tests students solve, the better becomes their time management'
    ],
    mcqOptions: [
      'The more mock tests students solve, the better their time management becomes.',
      'The more mock tests students solve, better their time management becomes.',
      'The most mock tests students solve, the best their time management becomes.',
      'More mock tests students solve, more good their time management becomes.'
    ],
    mcqAnswer: 'A',
    explain: 'Dạng so sánh hơn của "good" là "better", và bắt buộc có "the" ở đầu cả hai vế.'
  },
  {
    id: 'rw6',
    grammarPoint: 'Cấu trúc Quá... đến nỗi không thể (too...to / so...that)',
    original: 'The lecture note was so dense that beginners could not finish reading it in ten minutes.',
    promptHint: 'Viết lại bắt đầu bằng: The lecture note was too ...',
    accepted: [
      'The lecture note was too dense for beginners to finish reading in ten minutes',
      'The lecture note was too dense for beginners to finish reading it in ten minutes'
    ],
    mcqOptions: [
      'The lecture note was too dense for beginners to finish reading in ten minutes.',
      'The lecture note was too dense that beginners could not finish reading it in ten minutes.',
      'The lecture note was very dense for beginners to finish reading in ten minutes.',
      'So dense the lecture note was for beginners not to finish reading in ten minutes.'
    ],
    mcqAnswer: 'A',
    explain: 'too + adj + (for sb) + to V mang nghĩa quá đến mức không thể làm gì.'
  }
];
