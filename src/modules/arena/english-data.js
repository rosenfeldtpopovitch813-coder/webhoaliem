// Original, copyright-free English study dataset curated for HTVVM Studio (THPT & V-ACT aligned).

export const ENGLISH_THEMES = [
  { id: 'all', label: 'Tất cả chủ đề' },
  { id: 'family-society', label: 'Gia đình, Thế hệ & Xã hội' },
  { id: 'environment', label: 'Môi trường, Khí hậu & Sống xanh' },
  { id: 'technology', label: 'Công nghệ, Phát minh & AI' },
  { id: 'education', label: 'Giáo dục, Tự lập & Học tập suốt đời' },
  { id: 'health', label: 'Sức khỏe & Lối sống lành mạnh' },
  { id: 'culture-heritage', label: 'Văn hóa, Di sản & Đa văn hóa' },
  { id: 'career-work', label: 'Nghề nghiệp & Thế giới việc làm' },
  { id: 'urban-media', label: 'Đô thị hóa & Truyền thông' },
  { id: 'phrasal', label: 'Phrasal Verbs trọng tâm THPT' },
  { id: 'collocations', label: 'Collocations & Idioms trọng tâm THPT' }
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
  { id: 'v36', theme: 'collocations', themeLabel: 'Collocations & Idioms trọng tâm THPT', level: 'B2', word: 'a double-edged sword', ipa: '/ə ˌdʌbl edʒd ˈsɔːd/', pos: 'idiom', meaning: 'con dao hai lưỡi (vừa lợi vừa hại)', example: 'AI tutors are a double-edged sword if students skip thinking.' },

  // === MỞ RỘNG TỪ VỰNG THPT 10–12 (GLOBAL SUCCESS & ÔN THI THPT QUỐC GIA) ===

  // 1. Family, Generation Gap & Society (14 words)
  { id: 'v37', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B1', word: 'breadwinner', ipa: '/ˈbredwɪnə(r)/', pos: 'n', meaning: 'người trụ cột kiếm sống trong gia đình', example: 'In many modern families, both parents share the role of breadwinner.' },
  { id: 'v38', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B1', word: 'household chores', ipa: '/ˈhaʊshəʊld tʃɔːz/', pos: 'n', meaning: 'việc nhà, công việc nội trợ', example: 'Dividing household chores fairly teaches teenagers responsibility.' },
  { id: 'v39', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B1', word: 'generation gap', ipa: '/ˌdʒenəˈreɪʃn ɡæp/', pos: 'n', meaning: 'khoảng cách thế hệ', example: 'Open dialogue helps families narrow the generation gap.' },
  { id: 'v40', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B1', word: 'nuclear family', ipa: '/ˌnjuːkliə ˈfæməli/', pos: 'n', meaning: 'gia đình hạt nhân (cha mẹ và con cái)', example: 'Urban housing trends have made the nuclear family more common.' },
  { id: 'v41', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B1', word: 'extended family', ipa: '/ɪkˌstendɪd ˈfæməli/', pos: 'n', meaning: 'đại gia đình nhiều thế hệ cùng sống', example: 'Growing up in an extended family gave her strong support from grandparents.' },
  { id: 'v42', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B2', word: 'gender equality', ipa: '/ˈdʒendə ɪˈkwɒləti/', pos: 'n', meaning: 'bình đẳng giới', example: 'Promoting gender equality expands opportunities in science and leadership.' },
  { id: 'v43', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B2', word: 'discrimination', ipa: '/dɪˌskrɪmɪˈneɪʃn/', pos: 'n', meaning: 'sự phân biệt đối xử', example: 'Fair workplace policies aim to eliminate discrimination based on age or gender.' },
  { id: 'v44', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B2', word: 'peer pressure', ipa: '/ˈpɪə preʃə(r)/', pos: 'n', meaning: 'áp lực đồng trang lứa', example: 'Confident students can resist negative peer pressure at school.' },
  { id: 'v45', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B2', word: 'cyberbullying', ipa: '/ˈsaɪbəbʊliɪŋ/', pos: 'n', meaning: 'bắt nạt qua mạng', example: 'Schools run workshops to help teens recognize and report cyberbullying.' },
  { id: 'v46', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B1', word: 'voluntary', ipa: '/ˈvɒləntri/', pos: 'adj', meaning: 'tình nguyện, tự nguyện', example: 'Joining voluntary campaigns connects students with local communities.' },
  { id: 'v47', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B2', word: 'empathy', ipa: '/ˈempəθi/', pos: 'n', meaning: 'sự đồng cảm, thấu hiểu cảm xúc người khác', example: 'Listening patiently builds empathy between parents and teenagers.' },
  { id: 'v48', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B2', word: 'stereotype', ipa: '/ˈsteriətaɪp/', pos: 'n', meaning: 'khuôn mẫu, định kiến xã hội', example: 'Young engineers are challenging outdated gender stereotypes.' },
  { id: 'v49', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B2', word: 'overpopulation', ipa: '/ˌəʊvəˌpɒpjuˈleɪʃn/', pos: 'n', meaning: 'bùng nổ dân số, quá tải dân số', example: 'Overpopulation strains clean water supplies and public clinics.' },
  { id: 'v50', theme: 'family-society', themeLabel: 'Gia đình, Thế hệ & Xã hội', level: 'B2', word: 'welfare', ipa: '/ˈwelfeə(r)/', pos: 'n', meaning: 'phúc lợi xã hội, sự an sinh', example: 'Community funds improve child welfare in remote villages.' },

  // 2. Environment, Climate & Green Living (+10 words, total 16 with v1-v6)
  { id: 'v51', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'B2', word: 'carbon footprint', ipa: '/ˌkɑːbən ˈfʊtprɪnt/', pos: 'n', meaning: 'dấu chân carbon (lượng khí thải CO2 tạo ra)', example: 'Cycling to school is a simple way to shrink your carbon footprint.' },
  { id: 'v52', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'B2', word: 'deforestation', ipa: '/ˌdiːˌfɒrɪˈsteɪʃn/', pos: 'n', meaning: 'nạn phá rừng', example: 'Rapid deforestation threatens rare species and increases landslide risk.' },
  { id: 'v53', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'B2', word: 'ecosystem', ipa: '/ˈiːkəʊsɪstəm/', pos: 'n', meaning: 'hệ sinh thái', example: 'Coral reefs form a delicate marine ecosystem sensitive to warming.' },
  { id: 'v54', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'B2', word: 'biodegradable', ipa: '/ˌbaɪəʊdɪˈɡreɪdəbl/', pos: 'adj', meaning: 'có thể phân hủy sinh học', example: 'Shops are switching to biodegradable packaging instead of single-use plastic.' },
  { id: 'v55', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'B2', word: 'endangered', ipa: '/ɪnˈdeɪndʒəd/', pos: 'adj', meaning: 'có nguy cơ tuyệt chủng', example: 'Strict patrols protect endangered sea turtles during nesting season.' },
  { id: 'v56', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'B2', word: 'poaching', ipa: '/ˈpəʊtʃɪŋ/', pos: 'n', meaning: 'nạn săn bắt trộm động vật hoang dã', example: 'National parks use camera traps to deter illegal poaching.' },
  { id: 'v57', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'B1', word: 'ecotourism', ipa: '/ˈiːkəʊtʊərɪzəm/', pos: 'n', meaning: 'du lịch sinh thái có trách nhiệm', example: 'Responsible ecotourism generates income while protecting natural habitats.' },
  { id: 'v58', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'B2', word: 'fossil fuel', ipa: '/ˈfɒsl fjuːəl/', pos: 'n', meaning: 'nhiên liệu hóa thạch (than, dầu mỏ, khí đốt)', example: 'Replacing fossil fuels with wind power slows global warming.' },
  { id: 'v59', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'B2', word: 'compost', ipa: '/ˈkɒmpɒst/', pos: 'v/n', meaning: 'ủ phân hữu cơ; phân trộn', example: 'Our school canteen separates fruit peels to compost for the garden.' },
  { id: 'v60', theme: 'environment', themeLabel: 'Môi trường, Khí hậu & Sống xanh', level: 'C1', word: 'deplete', ipa: '/dɪˈpliːt/', pos: 'v', meaning: 'làm cạn kiệt (tài nguyên)', example: 'Overfishing can quickly deplete coastal fish populations.' },

  // 3. Technology, Inventions & AI (+10 words, total 16 with v7-v12)
  { id: 'v61', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'B2', word: 'artificial intelligence', ipa: '/ˌɑːtɪfɪʃl ɪnˈtelɪdʒəns/', pos: 'n', meaning: 'trí tuệ nhân tạo', example: 'Artificial intelligence helps doctors analyze medical scans faster.' },
  { id: 'v62', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'B2', word: 'algorithm', ipa: '/ˈælɡərɪðəm/', pos: 'n', meaning: 'thuật toán', example: 'Search engines rely on complex algorithms to rank relevant articles.' },
  { id: 'v63', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'B2', word: 'cutting-edge', ipa: '/ˌkʌtɪŋ ˈedʒ/', pos: 'adj', meaning: 'tiên tiến nhất, hiện đại bậc nhất', example: 'The laboratory invested in cutting-edge microscopes for biology classes.' },
  { id: 'v64', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'B2', word: 'simulate', ipa: '/ˈsɪmjuleɪt/', pos: 'v', meaning: 'mô phỏng', example: 'Interactive apps simulate particle collisions in three dimensions.' },
  { id: 'v65', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'B1', word: 'portable', ipa: '/ˈpɔːtəbl/', pos: 'adj', meaning: 'nhỏ gọn, dễ mang theo', example: 'Portable chargers keep phones powered during long field trips.' },
  { id: 'v66', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'B2', word: 'facial recognition', ipa: '/ˌfeɪʃl ˌrekəɡˈnɪʃn/', pos: 'n', meaning: 'nhận diện khuôn mặt', example: 'Facial recognition speeds up airport boarding gates.' },
  { id: 'v67', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'B2', word: 'virtual reality', ipa: '/ˌvɜːtʃuəl riˈæləti/', pos: 'n', meaning: 'thực tế ảo (VR)', example: 'Virtual reality lets students explore ancient monuments from class.' },
  { id: 'v68', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'B2', word: 'malfunction', ipa: '/ˌmælˈfʌŋkʃn/', pos: 'v/n', meaning: 'trục trặc, hoạt động lỗi', example: 'Technicians inspected the sensor after an unexpected malfunction.' },
  { id: 'v69', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'B2', word: 'revolutionize', ipa: '/ˌrevəˈluːʃənaɪz/', pos: 'v', meaning: 'cách mạng hóa, thay đổi hoàn toàn', example: 'Mobile banking has revolutionized everyday payments across rural areas.' },
  { id: 'v70', theme: 'technology', themeLabel: 'Công nghệ, Phát minh & AI', level: 'C1', word: 'ubiquitous', ipa: '/juːˈbɪkwɪtəs/', pos: 'adj', meaning: 'phổ biến khắp nơi', example: 'QR codes have become ubiquitous in classrooms and libraries.' },

  // 4. Education, Independence & Lifelong Learning (+10 words, total 16 with v13-v18)
  { id: 'v71', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B1', word: 'blended learning', ipa: '/ˌblendɪd ˈlɜːnɪŋ/', pos: 'n', meaning: 'học kết hợp trực tiếp và trực tuyến', example: 'Blended learning combines classroom discussion with online practice.' },
  { id: 'v72', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B2', word: 'vocational', ipa: '/vəʊˈkeɪʃənl/', pos: 'adj', meaning: 'thuộc hướng nghiệp, đào tạo nghề', example: 'Vocational schools equip graduates with hands-on technical skills.' },
  { id: 'v73', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B2', word: 'self-motivated', ipa: '/ˌself ˈməʊtɪveɪtɪd/', pos: 'adj', meaning: 'có tính tự giác, tự tạo động lực', example: 'Self-motivated learners stick to their revision timetable without reminders.' },
  { id: 'v74', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B2', word: 'lifelong learning', ipa: '/ˌlaɪflɒŋ ˈlɜːnɪŋ/', pos: 'n', meaning: 'học tập suốt đời', example: 'Rapid industry shifts make lifelong learning essential for every adult.' },
  { id: 'v75', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B1', word: 'time management', ipa: '/ˈtaɪm mænɪdʒmənt/', pos: 'n', meaning: 'quản lý thời gian', example: 'Good time management helps seniors balance mock exams and rest.' },
  { id: 'v76', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B2', word: 'scholarship', ipa: '/ˈskɒləʃɪp/', pos: 'n', meaning: 'học bổng', example: 'Her strong academic record earned her a full university scholarship.' },
  { id: 'v77', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B2', word: 'qualification', ipa: '/ˌkwɒlɪfɪˈkeɪʃn/', pos: 'n', meaning: 'bằng cấp, chứng chỉ chuyên môn', example: 'Applicants should list their language qualifications clearly on the resume.' },
  { id: 'v78', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B2', word: 'autonomous', ipa: '/ɔːˈtɒnəməs/', pos: 'adj', meaning: 'tự chủ, độc lập', example: 'Project-based tasks encourage students to become autonomous thinkers.' },
  { id: 'v79', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B2', word: 'acquire', ipa: '/əˈkwaɪə(r)/', pos: 'v', meaning: 'tiếp thu, lĩnh hội (kiến thức, kỹ năng)', example: 'Internships help young people acquire practical workplace skills.' },
  { id: 'v80', theme: 'education', themeLabel: 'Giáo dục, Tự lập & Học tập suốt đời', level: 'B2', word: 'extracurricular', ipa: '/ˌekstrəkəˈrɪkjələ(r)/', pos: 'adj', meaning: 'ngoại khóa', example: 'Science clubs are valuable extracurricular activities for high schoolers.' },

  // 5. Health & Healthy Lifestyle (+8 words, total 14 with v19-v24)
  { id: 'v81', theme: 'health', themeLabel: 'Sức khỏe & Lối sống lành mạnh', level: 'B2', word: 'life expectancy', ipa: '/ˈlaɪf ɪkspektənsi/', pos: 'n', meaning: 'tuổi thọ trung bình', example: 'Advances in preventive medicine have raised life expectancy worldwide.' },
  { id: 'v82', theme: 'health', themeLabel: 'Sức khỏe & Lối sống lành mạnh', level: 'B1', word: 'balanced diet', ipa: '/ˌbælənst ˈdaɪət/', pos: 'n', meaning: 'chế độ ăn cân bằng', example: 'A balanced diet with vegetables and protein sustains study energy.' },
  { id: 'v83', theme: 'health', themeLabel: 'Sức khỏe & Lối sống lành mạnh', level: 'B2', word: 'metabolism', ipa: '/məˈtæbəlɪzəm/', pos: 'n', meaning: 'sự trao đổi chất', example: 'Morning exercise boosts metabolism and improves mood.' },
  { id: 'v84', theme: 'health', themeLabel: 'Sức khỏe & Lối sống lành mạnh', level: 'B2', word: 'antibiotic', ipa: '/ˌæntibaɪˈɒtɪk/', pos: 'n', meaning: 'thuốc kháng sinh', example: 'Antibiotics treat bacterial infections, not viral colds.' },
  { id: 'v85', theme: 'health', themeLabel: 'Sức khỏe & Lối sống lành mạnh', level: 'B2', word: 'chronic', ipa: '/ˈkrɒnɪk/', pos: 'adj', meaning: 'mạn tính, kéo dài', example: 'Long-term sleep deprivation can lead to chronic stress.' },
  { id: 'v86', theme: 'health', themeLabel: 'Sức khỏe & Lối sống lành mạnh', level: 'B1', word: 'stamina', ipa: '/ˈstæmɪnə/', pos: 'n', meaning: 'sức bền, thể lực dẻo dai', example: 'Swimming three times a week steadily builds physical stamina.' },
  { id: 'v87', theme: 'health', themeLabel: 'Sức khỏe & Lối sống lành mạnh', level: 'B2', word: 'longevity', ipa: '/lɒnˈdʒevəti/', pos: 'n', meaning: 'sự trường thọ, tuổi thọ cao', example: 'Active social connections are strongly linked to longevity.' },
  { id: 'v88', theme: 'health', themeLabel: 'Sức khỏe & Lối sống lành mạnh', level: 'B2', word: 'remedy', ipa: '/ˈremədi/', pos: 'n', meaning: 'phương thuốc, biện pháp khắc phục', example: 'Warm ginger tea is a popular traditional remedy for a sore throat.' },

  // 6. Culture, Heritage & Multicultural World (14 words)
  { id: 'v89', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'cultural identity', ipa: '/ˌkʌltʃərəl aɪˈdentəti/', pos: 'n', meaning: 'bản sắc văn hóa', example: 'Traditional festivals help younger generations cherish their cultural identity.' },
  { id: 'v90', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'heritage', ipa: '/ˈherɪtɪdʒ/', pos: 'n', meaning: 'di sản (văn hóa, thiên nhiên)', example: 'Hoi An Ancient Town is recognized as a world cultural heritage site.' },
  { id: 'v91', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'multicultural', ipa: '/ˌmʌltiˈkʌltʃərəl/', pos: 'adj', meaning: 'đa văn hóa', example: 'Living in a multicultural neighborhood broadens your worldview.' },
  { id: 'v92', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'intangible', ipa: '/ɪnˈtændʒəbl/', pos: 'adj', meaning: 'phi vật thể', example: 'Folk songs and craft traditions are priceless intangible heritage.' },
  { id: 'v93', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'preserve', ipa: '/prɪˈzɜːv/', pos: 'v', meaning: 'bảo tồn, giữ gìn nguyên vẹn', example: 'Local artisans work hard to preserve lacquer painting techniques.' },
  { id: 'v94', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'restore', ipa: '/rɪˈstɔː(r)/', pos: 'v', meaning: 'trùng tu, khôi phục', example: 'Architects carefully restore historic wooden roofs using original materials.' },
  { id: 'v95', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B1', word: 'cuisine', ipa: '/kwɪˈziːn/', pos: 'n', meaning: 'ẩm thực', example: 'Vietnamese cuisine is admired globally for its fresh herbs and balance.' },
  { id: 'v96', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'assimilate', ipa: '/əˈsɪməleɪt/', pos: 'v', meaning: 'hòa nhập, đồng hóa văn hóa', example: 'Exchange students adapt quickly without losing their roots as they assimilate.' },
  { id: 'v97', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'diversity', ipa: '/daɪˈvɜːsəti/', pos: 'n', meaning: 'sự đa dạng', example: 'ASEAN summits celebrate linguistic and cultural diversity across the region.' },
  { id: 'v98', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B1', word: 'custom', ipa: '/ˈkʌstəm/', pos: 'n', meaning: 'phong tục, tập quán', example: 'Giving lucky money at Tet is a cherished custom in Viet Nam.' },
  { id: 'v99', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'globalization', ipa: '/ˌɡləʊbəlaɪˈzeɪʃn/', pos: 'n', meaning: 'toàn cầu hóa', example: 'Globalization has made international music and cinema accessible everywhere.' },
  { id: 'v100', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'monument', ipa: '/ˈmɒnjumənt/', pos: 'n', meaning: 'di tích, tượng đài lịch sử', example: 'Visitors must follow preservation rules when touring ancient monuments.' },
  { id: 'v101', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B2', word: 'culture shock', ipa: '/ˈkʌltʃə ʃɒk/', pos: 'n', meaning: 'sốc văn hóa', example: 'Learning local etiquette beforehand softens culture shock when studying abroad.' },
  { id: 'v102', theme: 'culture-heritage', themeLabel: 'Văn hóa, Di sản & Đa văn hóa', level: 'B1', word: 'solidarity', ipa: '/ˌsɒlɪˈdærəti/', pos: 'n', meaning: 'tình đoàn kết', example: 'Regional youth forums foster solidarity among ASEAN member states.' },

  // 7. Career, World of Work & Inspiring Lives (14 words)
  { id: 'v103', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'applicant', ipa: '/ˈæplɪkənt/', pos: 'n', meaning: 'ứng viên nộp đơn xin việc/học bổng', example: 'Each applicant submitted a portfolio demonstrating lab projects.' },
  { id: 'v104', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'vacancy', ipa: '/ˈveɪkənsi/', pos: 'n', meaning: 'vị trí việc làm đang tuyển', example: 'The research center posted a vacancy for a junior data analyst.' },
  { id: 'v105', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'dedication', ipa: '/ˌdedɪˈkeɪʃn/', pos: 'n', meaning: 'sự tận tụy, cống hiến hết mình', example: 'Marie Curie is remembered for her lifelong dedication to science.' },
  { id: 'v106', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'adaptable', ipa: '/əˈdæptəbl/', pos: 'adj', meaning: 'dễ thích nghi, linh hoạt', example: 'Employers value adaptable graduates who learn new tools rapidly.' },
  { id: 'v107', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'entrepreneur', ipa: '/ˌɒntrəprəˈnɜː(r)/', pos: 'n', meaning: 'doanh nhân khởi nghiệp', example: 'Young entrepreneurs are launching eco-friendly agritech startups.' },
  { id: 'v108', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'recruitment', ipa: '/rɪˈkruːtmənt/', pos: 'n', meaning: 'sự tuyển dụng', example: 'University career fairs connect final-year students with recruitment teams.' },
  { id: 'v109', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'probation', ipa: '/prəˈbeɪʃn/', pos: 'n', meaning: 'thời gian thử việc', example: 'After a two-month probation period, she signed a full-time contract.' },
  { id: 'v110', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B1', word: 'apprentice', ipa: '/əˈprentɪs/', pos: 'n', meaning: 'người học việc, thực tập nghề', example: 'He started as an electrical apprentice before opening his workshop.' },
  { id: 'v111', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'collaborate', ipa: '/kəˈlæbəreɪt/', pos: 'v', meaning: 'hợp tác, cộng tác', example: 'Chemists and software engineers collaborate to design molecular models.' },
  { id: 'v112', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'ambitious', ipa: '/æmˈbɪʃəs/', pos: 'adj', meaning: 'có hoài bão, tham vọng lớn', example: 'Ambitious goals become achievable when split into daily milestones.' },
  { id: 'v113', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'work-life balance', ipa: '/ˌwɜːk laɪf ˈbæləns/', pos: 'n', meaning: 'cân bằng công việc và cuộc sống', example: 'Flexible hours help remote workers maintain a healthy work-life balance.' },
  { id: 'v114', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'mentor', ipa: '/ˈmentɔː(r)/', pos: 'n/v', meaning: 'người cố vấn, hướng dẫn chuyên môn', example: 'Having an experienced mentor accelerates early career growth.' },
  { id: 'v115', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'C1', word: 'prestigious', ipa: '/preˈstɪdʒəs/', pos: 'adj', meaning: 'danh giá, uy tín cao', example: 'The national science olympiad is a prestigious competition for high schoolers.' },
  { id: 'v116', theme: 'career-work', themeLabel: 'Nghề nghiệp & Thế giới việc làm', level: 'B2', word: 'redundant', ipa: '/rɪˈdʌndənt/', pos: 'adj', meaning: 'dư thừa, bị cắt giảm nhân sự', example: 'Workers retrain in digital skills so automation does not make their roles redundant.' },

  // 8. Urbanisation & Mass Media (14 words)
  { id: 'v117', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'urbanisation', ipa: '/ˌɜːbənaɪˈzeɪʃn/', pos: 'n', meaning: 'quá trình đô thị hóa', example: 'Rapid urbanisation calls for smarter metro lines and green parks.' },
  { id: 'v118', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'infrastructure', ipa: '/ˈɪnfrəstrʌktʃə(r)/', pos: 'n', meaning: 'cơ sở hạ tầng', example: 'Upgrading transport infrastructure eases rush-hour congestion.' },
  { id: 'v119', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'commuter', ipa: '/kəˈmjuːtə(r)/', pos: 'n', meaning: 'người đi làm/đi học hằng ngày từ vùng ven', example: 'Electric buses offer commuters a quieter and cleaner daily ride.' },
  { id: 'v120', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B1', word: 'congestion', ipa: '/kənˈdʒestʃən/', pos: 'n', meaning: 'sự ùn tắc (giao thông)', example: 'Staggered school start times can reduce morning traffic congestion.' },
  { id: 'v121', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'affordable', ipa: '/əˈfɔːdəbl/', pos: 'adj', meaning: 'giá cả phải chăng, vừa túi tiền', example: 'Growing cities need more affordable housing for young families.' },
  { id: 'v122', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'megacity', ipa: '/ˈmeɡəsɪti/', pos: 'n', meaning: 'siêu đô thị (trên 10 triệu dân)', example: 'Managing waste efficiently is a top challenge for any megacity.' },
  { id: 'v123', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'sanitation', ipa: '/ˌsænɪˈteɪʃn/', pos: 'n', meaning: 'hệ thống vệ sinh công cộng', example: 'Clean water and modern sanitation sharply lower disease rates.' },
  { id: 'v124', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'mass media', ipa: '/ˌmæs ˈmiːdiə/', pos: 'n', meaning: 'phương tiện truyền thông đại chúng', example: 'Mass media plays a major role in spreading public health alerts.' },
  { id: 'v125', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'credible', ipa: '/ˈkredəbl/', pos: 'adj', meaning: 'đáng tin cậy, có cơ sở', example: 'Always verify breaking news against credible academic or official sources.' },
  { id: 'v126', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'misinformation', ipa: '/ˌmɪsɪnfəˈmeɪʃn/', pos: 'n', meaning: 'thông tin sai lệch', example: 'Media literacy classes teach teenagers to spot online misinformation.' },
  { id: 'v127', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'fact-check', ipa: '/ˈfækt tʃek/', pos: 'v', meaning: 'kiểm chứng thông tin, đối chiếu sự thật', example: 'Responsible readers fact-check viral claims before sharing them.' },
  { id: 'v128', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'biased', ipa: '/ˈbaɪəst/', pos: 'adj', meaning: 'thiên vị, thiếu khách quan', example: 'A balanced report avoids biased language and presents verified data.' },
  { id: 'v129', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B1', word: 'broadcast', ipa: '/ˈbrɔːdkɑːst/', pos: 'v/n', meaning: 'phát sóng, truyền thanh/truyền hình', example: 'The national television channel broadcast the science final live.' },
  { id: 'v130', theme: 'urban-media', themeLabel: 'Đô thị hóa & Truyền thông', level: 'B2', word: 'interactive', ipa: '/ˌɪntərˈæktɪv/', pos: 'adj', meaning: 'có tính tương tác hai chiều', example: 'Digital platforms turn passive lectures into interactive workshops.' },

  // 9. Phrasal Verbs trọng tâm THPT (+8 words, total 14 with v25-v30)
  { id: 'v131', theme: 'phrasal', themeLabel: 'Phrasal Verbs trọng tâm THPT', level: 'B2', word: 'bring about', ipa: '/brɪŋ əˈbaʊt/', pos: 'phr.v', meaning: 'mang lại, gây ra sự thay đổi (= cause)', example: 'Clean energy policies can bring about cleaner urban air.' },
  { id: 'v132', theme: 'phrasal', themeLabel: 'Phrasal Verbs trọng tâm THPT', level: 'B2', word: 'account for', ipa: '/əˈkaʊnt fɔː(r)/', pos: 'phr.v', meaning: 'chiếm tỉ lệ; giải thích cho', example: 'Renewable sources now account for over a third of local power.' },
  { id: 'v133', theme: 'phrasal', themeLabel: 'Phrasal Verbs trọng tâm THPT', level: 'B1', word: 'take up', ipa: '/teɪk ʌp/', pos: 'phr.v', meaning: 'bắt đầu theo đuổi (sở thích/thói quen); chiếm (thời gian)', example: 'She decided to take up jogging to boost her focus.' },
  { id: 'v134', theme: 'phrasal', themeLabel: 'Phrasal Verbs trọng tâm THPT', level: 'B2', word: 'drop out of', ipa: '/drɒp aʊt əv/', pos: 'phr.v', meaning: 'bỏ học giữa chừng, rút khỏi', example: 'Financial aid prevents talented students from dropping out of college.' },
  { id: 'v135', theme: 'phrasal', themeLabel: 'Phrasal Verbs trọng tâm THPT', level: 'B2', word: 'cut down on', ipa: '/kʌt daʊn ɒn/', pos: 'phr.v', meaning: 'cắt giảm (lượng tiêu thụ)', example: 'Cutting down on sugary drinks helps maintain steady concentration.' },
  { id: 'v136', theme: 'phrasal', themeLabel: 'Phrasal Verbs trọng tâm THPT', level: 'B2', word: 'look up to', ipa: '/lʊk ʌp tuː/', pos: 'phr.v', meaning: 'kính trọng, ngưỡng mộ (= admire)', example: 'Many students look up to teachers who explain complex ideas patiently.' },
  { id: 'v137', theme: 'phrasal', themeLabel: 'Phrasal Verbs trọng tâm THPT', level: 'B2', word: 'turn down', ipa: '/tɜːn daʊn/', pos: 'phr.v', meaning: 'từ chối (= refuse); vặn nhỏ âm lượng', example: 'He turned down a tempting offer to focus on his final exams.' },
  { id: 'v138', theme: 'phrasal', themeLabel: 'Phrasal Verbs trọng tâm THPT', level: 'B2', word: 'run out of', ipa: '/rʌn aʊt əv/', pos: 'phr.v', meaning: 'cạn kiệt, hết sạch', example: 'Check the clock carefully so you do not run out of time on the last section.' },

  // 10. Collocations & Idioms trọng tâm THPT (+8 words, total 14 with v31-v36)
  { id: 'v139', theme: 'collocations', themeLabel: 'Collocations & Idioms trọng tâm THPT', level: 'B2', word: 'raise awareness of', ipa: '/reɪz əˈweənəs əv/', pos: 'colloc', meaning: 'nâng cao nhận thức về', example: 'Student campaigns raise awareness of plastic pollution on campus.' },
  { id: 'v140', theme: 'collocations', themeLabel: 'Collocations & Idioms trọng tâm THPT', level: 'B2', word: 'make an effort', ipa: '/meɪk ən ˈefət/', pos: 'colloc', meaning: 'nỗ lực, cố gắng', example: 'She made an effort to practice twenty new words every evening.' },
  { id: 'v141', theme: 'collocations', themeLabel: 'Collocations & Idioms trọng tâm THPT', level: 'B2', word: 'pose a threat to', ipa: '/pəʊz ə θret tuː/', pos: 'colloc', meaning: 'gây ra mối đe dọa cho', example: 'Habitat loss poses a serious threat to rare migratory birds.' },
  { id: 'v142', theme: 'collocations', themeLabel: 'Collocations & Idioms trọng tâm THPT', level: 'B2', word: 'play a vital role in', ipa: '/pleɪ ə ˈvaɪtl rəʊl ɪn/', pos: 'colloc', meaning: 'đóng vai trò thiết yếu trong', example: 'Visual models play a vital role in teaching abstract physics concepts.' },
  { id: 'v143', theme: 'collocations', themeLabel: 'Collocations & Idioms trọng tâm THPT', level: 'B2', word: 'take responsibility for', ipa: '/teɪk rɪˌspɒnsəˈbɪləti fɔː(r)/', pos: 'colloc', meaning: 'chịu trách nhiệm về', example: 'Independent learners take responsibility for reviewing their own mistakes.' },
  { id: 'v144', theme: 'collocations', themeLabel: 'Collocations & Idioms trọng tâm THPT', level: 'C1', word: 'broaden one’s horizons', ipa: '/ˈbrɔːdn wʌnz həˈraɪznz/', pos: 'idiom', meaning: 'mở mang tầm nhìn, mở rộng hiểu biết', example: 'Reading international science journals broadens students’ horizons.' },
  { id: 'v145', theme: 'collocations', themeLabel: 'Collocations & Idioms trọng tâm THPT', level: 'B2', word: 'make ends meet', ipa: '/meɪk endz miːt/', pos: 'idiom', meaning: 'trang trải đủ chi phí sinh hoạt', example: 'Rising city rents make it harder for fresh graduates to make ends meet.' },
  { id: 'v146', theme: 'collocations', themeLabel: 'Collocations & Idioms trọng tâm THPT', level: 'C1', word: 'strike a balance between', ipa: '/straɪk ə ˈbæləns bɪˈtwiːn/', pos: 'colloc', meaning: 'đạt sự cân bằng giữa', example: 'Modern cities must strike a balance between economic growth and heritage.' }
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
