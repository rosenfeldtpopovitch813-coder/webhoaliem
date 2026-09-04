window.MathJax = {
    tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']], packages: {'[+]': ['mhchem']} },
    loader: { load: ['[tex]/mhchem'] }
  };



    tailwind.config = {
        theme: {
            extend: {
                fontFamily: { sans: ['Be Vietnam Pro', 'Plus Jakarta Sans', 'sans-serif'], display: ['Sora', 'sans-serif'] },
                colors: { primary: { 50: '#083344', 100: '#0e4a5c', 500: '#22D3EE', 600: '#0891B2', 700: '#0E7490' } },
                boxShadow: { 'soft': '0 8px 24px -8px rgba(0,0,0,.55)', 'glow': '0 0 0 1px rgba(34,211,238,.25), 0 0 24px -4px rgba(34,211,238,.45)' }
            }
        }
    }



const SHEET_CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vQSOqdBnxsmKXQRqhkygde1R3vJdez_hFxt_9WRI7MEvhjOHD5iL7CkGzNZLYHFLqForH5FcVuZ3SRJ/pub?output=csv';
const firebaseConfig={apiKey:'AIzaSyBrhQE0x-yB4MG64cGNaGzvU7H-UZmYLf8',authDomain:'thikscl.firebaseapp.com',databaseURL:'https://thikscl-default-rtdb.firebaseio.com',projectId:'thikscl'};
let db=null,authUser=null,docsData=[];
// Firebase dùng chung cho toàn bộ ứng dụng.
// Giữ cả biến local và window.* để các module/IIFE khác không bị lệch scope.
window.db = null;
window.auth = null;
window.provider = null;
window.__firebaseReady = false;
window.__firebaseReadyPromise = null;
let examConfig={abcd:0,tf:0,short:0,timeLimit:15,pdfUrl:''},correctAnswers={};
let currentRoomId='',studentName='',answers={},timerInterval=null,timeRemaining=0,timeSpent=0;
// DÁN VÀO ĐÂY NÈ NÍ:
let jsmeApplet = null;
function jsmeOnLoad() {
    jsmeApplet = new JSApplet.JSME("jsme_container", "100%", "400px");
}
function setActiveNav(navId) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600', 'text-orange-600', 'text-purple-600', 'text-emerald-600', 'text-cyan-600');
        btn.classList.add('text-slate-600');
    });
    const btn = document.getElementById(navId);
    if (btn) {
        btn.classList.remove('text-slate-600');
        btn.classList.add('bg-white', 'shadow-sm');
        if (navId === 'nav-teacher') btn.classList.add('text-orange-600');
        else if (navId === 'nav-chemmaker') btn.classList.add('text-purple-600');
        else if (navId === 'nav-toolkit') btn.classList.add('text-emerald-600');
        else if (navId === 'nav-community') btn.classList.add('text-cyan-600');
        else btn.classList.add('text-blue-600'); 
    }
}

function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function norm(v){return String(v??'').trim().toLowerCase().replace(/,/g,'.').replace(/\s+/g,' ');}
function getOriginalUrl(u) {
    return String(u || '').trim();
}
function isDriveFolderUrl(u) {
    const x = String(u || '').trim();
    return /drive\.google\.com\/(drive\/)?folders\//i.test(x) || /drive\.google\.com\/drive\/u\/\d+\/folders\//i.test(x);
}
function getEmbedUrl(u) {
    u=String(u||'').trim();
    if(!u || isDriveFolderUrl(u)) return u;
    if(u.includes('drive.google.com/file/d/')) {
        const id=u.match(/[-\w]{25,}/)?.[0];
        return id ? `https://drive.google.com/file/d/${id}/preview` : u;
    }
    return u;
}

// ==========================================
// HỆ THỐNG AUTHENTICATION (BẮT BUỘC ĐĂNG NHẬP)
// ==========================================
let auth = null;
let provider = null;

// Hàm chuyển tab bình thường
function switchSection(id) { 
    document.querySelectorAll('.app-section').forEach(x => {
        x.classList.remove('active');
        x.classList.add('hidden'); 
    }); 
    
    const target = document.getElementById(id);
    if(target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    window.scrollTo({top: 0}); 
    
    const navMap = {
        'sec-dashboard': 'nav-home',
        'sec-library': 'nav-library',
        'sec-teacher-config': 'nav-teacher',
        'sec-teacher-key': 'nav-teacher',
        'sec-chemmaker': 'nav-chemmaker',
        'sec-exam-list': 'nav-exam',
        'sec-student-join': 'nav-exam',
        'sec-taking-exam': 'nav-exam',
        'sec-leaderboard': 'nav-exam',
        'sec-study': 'nav-study',
        'sec-community': 'nav-community',
        'sec-toolkit': 'nav-toolkit',
        'sec-stats': 'nav-stats'
    };
    setActiveNav(navMap[id]);
}

// Hiệu ứng mờ dần chuyển từ Welcome sang Đăng nhập
function goToLogin() {
    const welcome = document.getElementById('sec-welcome');
    const login = document.getElementById('sec-login');
    
    if(welcome) welcome.style.opacity = '0';
    setTimeout(() => {
        if(welcome) welcome.classList.add('hidden');
        if(login) {
            login.classList.remove('hidden');
            setTimeout(() => login.style.opacity = '1', 50); 
        }
    }, 500);
}
// ==========================================
// HỆ THỐNG HỒ SƠ & STREAK (DUOLINGO STYLE)
// ==========================================
function openProfile() {
    const modal = document.getElementById('profile-modal');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('profile-modal-content').classList.remove('scale-95');
    
    // Tải thông tin cá nhân
    if(auth && auth.currentUser) {
        const uid = auth.currentUser.uid;
        const name = auth.currentUser.displayName || auth.currentUser.email || "U";
        
        db.ref('users/' + uid).once('value').then(snap => {
            const data = snap.val() || {};
            const customAvt = data.customAvatar; 
            const googleAvt = auth.currentUser.photoURL; 
            
            const avtEl = document.getElementById('profile-avatar');
            if (customAvt) {
                avtEl.src = customAvt;
            } else if (googleAvt) {
                avtEl.src = googleAvt;
            } else {
                avtEl.src = `https://ui-avatars.com/api/?name=${name.charAt(0)}&background=3b82f6&color=fff&size=150&bold=true`;
            }
        });

        document.getElementById('profile-name').innerText = name.split('@')[0];
        document.getElementById('profile-email').innerText = auth.currentUser.email;
    }
    
    // SỬA LẠI KHÚC NÀY ĐỂ ĐỌC SỐ CHUẨN KHÔNG BỊ LỖI
    const totalHours = Math.floor((Number(totalStudySeconds) || 0) / 3600);
    document.getElementById('profile-study-time').innerText = totalHours + 'h';

    // Tính danh hiệu
    const dailySeconds = Number(localStorage.getItem('htvvm.todayStudySeconds')) || 0;
    const dailyHours = Math.floor(dailySeconds / 3600);
    document.getElementById('profile-rank-icon').innerText = '💧';
    document.getElementById('profile-rank-name').innerText = 'Tập sự (H₂O)';

    let icon = '💧', rankName = 'Tập sự (H₂O)';
    if (dailyHours >= 1 && dailyHours < 2) { icon = '☕'; rankName = 'Tỉnh táo (Caffein)'; }
    else if (dailyHours >= 2 && dailyHours < 3) { icon = '🚀'; rankName = 'Hưng phấn (Dopamine)'; }
    else if (dailyHours >= 3 && dailyHours < 4) { icon = '⚡'; rankName = 'Bứt phá (Adrenaline)'; }
    else if (dailyHours >= 4 && dailyHours < 5) { icon = '🧠'; rankName = 'Thông thái (Serotonin)'; }
    else if (dailyHours >= 5) { icon = '🚨'; rankName = 'Quá tải (Cortisol)'; }
    
    document.getElementById('profile-rank-icon').innerText = icon;
    document.getElementById('profile-rank-name').innerText = rankName;
}

function closeProfile() {
    const modal = document.getElementById('profile-modal');
    modal.classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('profile-modal-content').classList.add('scale-95');
}

// Hàm AI tự động kiểm tra Chuỗi ngày khi vừa đăng nhập
function checkAndUpdateStreak(user) {
    const userRef = db.ref('users/' + user.uid);
    userRef.once('value', snapshot => {
        const data = snapshot.val() || {};
        const now = new Date();
        // Cắt lấy chuỗi YYYY-MM-DD để so sánh ngày
        const todayStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
        
        let streak = data.streak || 0;
        let lastLogin = data.lastLogin || '';
        
        if (lastLogin !== todayStr) {
            // Lấy ngày hôm qua để check xem có bị đứt chuỗi không
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.getFullYear() + '-' + (yesterday.getMonth() + 1) + '-' + yesterday.getDate();
            
            if (lastLogin === yesterdayStr) {
                streak++; // Học đều đặn -> Nối thêm chuỗi
            } else {
                streak = 1; // Lười học ngắt quãng -> Reset chuỗi về 1 (Đau đớn!)
            }
            
            // Cập nhật lại lên Firebase
            userRef.update({ streak: streak, lastLogin: todayStr });
        }
        
        // In ra Hồ sơ
        document.getElementById('profile-streak').innerText = streak;
        
        // Phục hồi Tổng thời gian học Pomodoro từ những ngày trước.
        // Biến này chỉ dùng cho số liệu tích lũy; danh hiệu được tính theo ngày trong updateRankUI().
        if(data.totalStudySeconds) {
            totalStudySeconds = safeNum(data.totalStudySeconds);
            updateRankUI();
        }
    });
}
// KHỞI TẠO FIREBASE & LẮNG NGHE ĐĂNG NHẬP
function initFirebase() {
    // Tránh khởi tạo lặp nếu script/DOM gọi lại hàm.
    if (window.__firebaseReadyPromise) return window.__firebaseReadyPromise;

    window.__firebaseReadyPromise = (async () => {
        try {
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK chưa được tải.');
            }

            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

            db = firebase.database();
            auth = firebase.auth();
            provider = new firebase.auth.GoogleAuthProvider();

            // QUAN TRỌNG: đồng bộ ra window vì hệ thống phòng dùng window.db/window.auth.
            window.db = db;
            window.auth = auth;
            window.provider = provider;
            window.__firebaseReady = true;

            // Theo dõi trạng thái tài khoản
            auth.onAuthStateChanged(user => {
        const welcome = document.getElementById('sec-welcome');
        const login = document.getElementById('sec-login');
        const nav = document.getElementById('main-nav');
        const userName = document.getElementById('user-display-name');

        if (user) {
            if (typeof initCalendarEventsForUser === 'function') initCalendarEventsForUser(user);
            // Đã có acc: Giấu Welcome, Login, Mở Thư viện
            if(welcome) welcome.classList.add('hidden');
            if(login) login.classList.add('hidden');
            if(nav) nav.classList.remove('hidden');
            switchSection('sec-dashboard'); 
            
            let displayName = user.displayName || user.email || "Học viên";
            if(userName) userName.innerText = String(displayName).split('@')[0];
            db.ref('users/' + user.uid).once('value').then(snap => {
                const data = snap.val() || {};
                const customAvt = data.customAvatar;
                const googleAvt = user.photoURL;
                const navAvt = document.getElementById('nav-avatar');
                
                if (navAvt) {
                    if (customAvt) navAvt.src = customAvt;
                    else if (googleAvt) navAvt.src = googleAvt;
                    else navAvt.src = `https://ui-avatars.com/api/?name=${displayName.charAt(0)}&background=3b82f6&color=fff&bold=true`;
                }
                window.__communityAvatar = customAvt || googleAvt || navAvt?.src || '';
                window.dispatchEvent(new CustomEvent('firebase:user-ready',{detail:{uid:user.uid,avatar:window.__communityAvatar}}));
            }); 
            
            // AI tự động kiểm tra chuỗi ngày của học viên
            checkAndUpdateStreak(user);
            setTimeout(loadDashboardLeaderboards, 150);
            const fallbackName = user.displayName || user.email?.split('@')[0] || 'Học viên';
            db.ref('users/' + user.uid).update({
                name: fallbackName,
                displayName: user.displayName || '',
                email: user.email || '',
                photoURL: user.photoURL || ''
            }).catch(e=>console.warn('user profile sync', e));

            // BẢO MẬT: chỉ tải dữ liệu tài liệu SAU KHI xác thực thành công,
            // không tải sẵn từ lúc trang vừa mở nữa (tránh lộ nội dung khi ai đó
            // ẩn lớp phủ đăng nhập bằng DevTools).
            if (!window.__docsLoaded) {
                window.__docsLoaded = true;
                loadDocuments();
            }
            
        } else {
            if (typeof initCalendarEventsForUser === 'function') initCalendarEventsForUser(null);
            // Chưa đăng nhập: đảm bảo dữ liệu chưa từng được tải/hiển thị
            window.__docsLoaded = false;
            docsData = [];
            const libGrid = document.getElementById('document-grid');
            if (libGrid) libGrid.innerHTML = '';
            // Chưa có acc: Khóa web, Dựng bức tường Welcome
            if(welcome) {
                welcome.classList.remove('hidden');
                welcome.style.opacity = '1';
            }
            if(login) {
                login.classList.add('hidden');
                login.style.opacity = '0';
            }
            if(nav) nav.classList.add('hidden');
            if(userName) userName.innerText = "Chưa đăng nhập";
        }
        });

        return true;
        } catch (error) {
            window.__firebaseReady = false;
            console.error('Firebase init failed:', error);
            throw error;
        }
    })();

    return window.__firebaseReadyPromise;
}

// HÀM ĐĂNG NHẬP GOOGLE
function loginWithGoogle() {
    const errObj = document.getElementById('login-error');
    if(errObj) errObj.classList.add('hidden');
    
    auth.signInWithPopup(provider).catch(error => {
        if(errObj) {
            errObj.innerText = "❌ Lỗi: " + error.message;
            errObj.classList.remove('hidden');
        }
    });
}

// HÀM ĐĂNG XUẤT
function logoutFirebase() {
    if(confirm("Ní muốn đăng xuất khỏi hệ thống à?")) {
        auth.signOut().then(() => {
            location.reload(); 
        });
    }
}

// ==========================================
// KHỞI ĐỘNG HỆ THỐNG
// ==========================================
// ==========================================
// THỐNG KÊ TIẾN ĐỘ HỌC TẬP CÁ NHÂN (nav-stats)
// ==========================================
let __statsChartDays = null, __statsChartExam = null;

function __statsDateKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function __statsShortLabel(d){ return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; }

async function openStats() {
    switchSection('sec-stats');
    const loading = document.getElementById('stats-loading');
    const guest = document.getElementById('stats-guest');
    const content = document.getElementById('stats-content');
    loading.classList.remove('hidden'); guest.classList.add('hidden'); content.classList.add('hidden');

    if (!(typeof auth !== 'undefined' && auth && auth.currentUser && typeof db !== 'undefined' && db)) {
        loading.classList.add('hidden'); guest.classList.remove('hidden');
        return;
    }

    try {
        const uid = auth.currentUser.uid;
        const snap = await db.ref('users/' + uid).once('value');
        const data = snap.val() || {};

        // --- 7 ngày gần nhất: phút học ---
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = __statsDateKey(d);
            const seconds = (data.dailyStudy && data.dailyStudy[key]) || 0;
            days.push({ label: __statsShortLabel(d), minutes: Math.round(seconds / 60) });
        }

        // --- Lịch sử điểm thi (tối đa 10 lần gần nhất) ---
        let examEntries = [];
        if (data.examHistory) {
            examEntries = Object.values(data.examHistory)
                .sort((a, b) => (a.date || 0) - (b.date || 0))
                .slice(-10);
        }

        // --- Thẻ tổng quan ---
        const totalHours = Math.floor((data.totalStudySeconds || 0) / 3600);
        document.getElementById('stat-total-hours').textContent = totalHours + 'h';
        document.getElementById('stat-streak').textContent = data.streak || 0;
        document.getElementById('stat-exam-count').textContent = examEntries.length;
        const avgScore = examEntries.length
            ? (examEntries.reduce((s, e) => s + (Number(e.score) || 0), 0) / examEntries.length).toFixed(1)
            : '0';
        document.getElementById('stat-avg-score').textContent = avgScore;

        // --- Biểu đồ cột: phút học theo ngày ---
        const ctxDays = document.getElementById('chart-study-days').getContext('2d');
        if (__statsChartDays) __statsChartDays.destroy();
        __statsChartDays = new Chart(ctxDays, {
            type: 'bar',
            data: {
                labels: days.map(d => d.label),
                datasets: [{ label: 'Phút học', data: days.map(d => d.minutes), backgroundColor: '#0891B2', borderRadius: 8 }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
        });

        // --- Biểu đồ đường: điểm số theo thời gian ---
        const noExamMsg = document.getElementById('stats-no-exam');
        const examCanvas = document.getElementById('chart-exam-scores');
        if (examEntries.length === 0) {
            examCanvas.classList.add('hidden'); noExamMsg.classList.remove('hidden');
        } else {
            examCanvas.classList.remove('hidden'); noExamMsg.classList.add('hidden');
            const ctxExam = examCanvas.getContext('2d');
            if (__statsChartExam) __statsChartExam.destroy();
            __statsChartExam = new Chart(ctxExam, {
                type: 'line',
                data: {
                    labels: examEntries.map(e => e.title || 'Đề thi'),
                    datasets: [{ label: 'Điểm', data: examEntries.map(e => e.score), borderColor: '#e11d48', backgroundColor: 'rgba(225,29,72,0.15)', fill: true, tension: 0.3, pointRadius: 4 }]
                },
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10 } } }
            });
        }

        loading.classList.add('hidden'); content.classList.remove('hidden');
    } catch (e) {
        console.error('openStats error', e);
        loading.innerHTML = '❌ Lỗi tải thống kê: ' + (e?.message || e);
    }
}

document.addEventListener("DOMContentLoaded", () => { 
    initFirebase(); 
    // loadDocuments() KHÔNG còn được gọi ở đây nữa.
    // Nó chỉ chạy sau khi Firebase xác nhận người dùng đã đăng nhập
    // (xem trong auth.onAuthStateChanged bên trên) để tránh lộ dữ liệu
    // khi lớp phủ đăng nhập bị ẩn thủ công qua DevTools.
});
function loadDocuments(){Papa.parse(SHEET_CSV_URL,{download:true,header:true,complete:r=>{docsData=r.data; renderDocs(docsData);}});}

// --- Document search and filtering ---
let currentFilter = 'all';
// HÀM CHUYỂN ĐỔI QUA LẠI GIỮA CÁC TAB (TRANG CHỦ, THƯ VIỆN, GÓC HỌC TẬP...)
function showSection(sectionId) {
    // 1. Tìm và ẨN tất cả các khu vực có class là 'app-section'
    document.querySelectorAll('.app-section').forEach(section => {
        section.classList.add('hidden');
        section.classList.remove('active');
    });

    // 2. TÌM và HIỆN khu vực mà ní vừa bấm vào
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
    }
}
// Hàm xử lý khi bấm nút Lọc

// Hàm kết hợp bộ lọc và thanh tìm kiếm (Đã nâng cấp chống sai hoa/thường)
// Hàm kết hợp bộ lọc (Đã nâng cấp AI Tìm Kiếm Mờ)

// Hàm render vẽ Card chuẩn Design
// --- Document search and filtering (CHỐNG LỖI TÊN CỘT) ---


// --- Document filtering ---


function filterDocs(category) {
    currentFilter = category;
    
    // Đổi màu nút
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
        btn.classList.add('bg-slate-100', 'text-slate-600');
        if (btn.innerText.trim() === category || (category === 'all' && btn.innerText.trim() === 'Tất cả')) {
            btn.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
            btn.classList.remove('bg-slate-100', 'text-slate-600');
        }
    });
    
    applyFilters();
}

function applyFilters() {
    const k = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = docsData.filter(d => {
        // TUYỆT CHIÊU: Gom toàn bộ chữ của 1 hàng trong Excel thành 1 chuỗi dài
        const rowData = Object.values(d).join(' ').toLowerCase();
        
        // 1. Quét xem có khớp từ khóa tìm kiếm không
        const matchSearch = rowData.includes(k);
        
        // Nếu đang ở tab "Tất cả" thì chỉ cần khớp tìm kiếm là hiện
        if (currentFilter === 'all') return matchSearch;
        
        // 2. Quét xem hàng đó có chứa tên Môn học không (Đã xử lý chữ Hoá / Hóa)
        let filterCat = currentFilter.toLowerCase().replace(/hoá/g, 'hóa');
        let docStr = rowData.replace(/hoá/g, 'hóa');
        
        const matchCategory = docStr.includes(filterCat);
        
        return matchSearch && matchCategory;
    });
    
    renderDocs(filtered);
}

function renderDocs(data) {
    const c = document.getElementById('document-grid');
    
    if (!data || data.length === 0) {
        c.innerHTML = '<div class="col-span-full bg-white rounded-3xl p-12 text-center font-bold border border-slate-200 text-slate-500 shadow-sm">Không tìm thấy tài liệu nào phù hợp với bộ lọc.</div>';
        return;
    }

    c.innerHTML = data.map(d => {
        // Lọc bỏ những dòng trống trong Excel (không có tiêu đề)
        let title = d.title || d.Title || d.Tên || '';
        if (!title.trim()) return ''; 

        let url = getOriginalUrl(d.pdf_url || d.link || d.url || '');
        let isFolder = isDriveFolderUrl(url);
        let subject = d.chapter || d.mon || d['Môn'] || 'TỔNG HỢP';

        return `
        <article class="relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full group">
            <div class="absolute -right-12 top-6 bg-red-500 text-white text-[10px] font-extrabold px-12 py-1.5 rotate-45 shadow-sm z-10 tracking-widest">CHÍNH THỨC</div>
            
            <div class="flex justify-between items-start mb-5 pr-8 relative z-0">
                <div class="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-inner">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                </div>
                <span class="px-3 py-1 bg-slate-100 text-slate-500 font-extrabold text-[10px] uppercase rounded-md tracking-wider">${esc(subject).toUpperCase()}</span>
            </div>

            <h2 class="text-lg font-extrabold text-slate-900 mb-5 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">${esc(title)}</h2>

            <div class="space-y-2 mt-auto text-xs font-semibold">
                <p class="flex items-center gap-2 text-slate-600"><span class="w-5 text-center text-slate-400">👤</span>Tải lên: <span class="text-red-600">Admin Hệ Thống</span></p>
                <p class="flex items-center gap-2 text-slate-600"><span class="w-5 text-center text-slate-400">📅</span>Cập nhật: 3/8/2026</p>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-100">
                ${url ? `<a target="_blank" rel="noopener noreferrer" href="${esc(url)}" class="block w-full text-center py-2.5 rounded-xl ${isFolder ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20 hover:bg-emerald-500 hover:text-white' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white'} font-extrabold text-sm transition-colors border shadow-sm">${isFolder ? '📁 Mở thư mục gốc' : '↗ Mở tài liệu gốc'}</a>` : '<div class="w-full p-2.5 bg-slate-50 rounded-xl text-center font-bold text-slate-400 border border-slate-100 text-sm">Đang cập nhật</div>'}
            </div>
        </article>`;
    }).join('');
}
function openTeacherConfig(){ switchSection('sec-teacher-config'); }
function buildTeacherSheet(){
    const title=document.getElementById('teacher-exam-title').value; if(!title) return alert('Nhập tên đề!');
    examConfig = { abcd: +document.getElementById('numABCD').value, tf: +document.getElementById('numTF').value, short: +document.getElementById('numShort').value, timeLimit: +document.getElementById('teacher-time').value, pdfUrl: document.getElementById('teacher-pdf-url').value };
    document.getElementById('teacher-sheet-container').innerHTML = sheetHTML(examConfig, true);
    if(examConfig.pdfUrl) { document.getElementById('preview-pdf').src=getEmbedUrl(examConfig.pdfUrl); document.getElementById('preview-pdf').classList.remove('hidden'); document.getElementById('preview-placeholder').classList.add('hidden'); }
    switchSection('sec-teacher-key');
}

// Answer sheet
function sheetHTML(c, isTeacher) {
    let h = '', n = 1;
    if (c.abcd) {
        h += `<div class="mb-8"><div class="bg-blue-50/70 border border-blue-100 p-3 rounded-xl mb-4"><h4 class="font-extrabold text-blue-800 text-sm uppercase tracking-wide">Phần I. Trắc nghiệm</h4></div><div class="space-y-3">`;
        for (let i = 1; i <= c.abcd; i++) {
            let q = 'abcd_' + i;
            h += `<div id="row-${q}" class="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm relative group transition-colors"><div class="w-16 text-center bg-slate-50 py-2 rounded-lg font-bold text-slate-600 text-sm">Câu ${n}</div><div class="flex gap-4 flex-wrap flex-1 justify-center sm:justify-start pl-4">${['A', 'B', 'C', 'D'].map(o => `<label class="bubble-label"><input type="radio" name="${q}" value="${o}" onchange="${isTeacher ? `saveKey('${q}','${o}')` : `saveAns('${q}','${o}')`}"><span id="bubble-${q}-${o}" class="bubble">${o}</span></label>`).join('')}</div>${!isTeacher ? `<label class="absolute right-4 flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"><input type="checkbox" onchange="mark('${q}',this.checked)" class="w-4 h-4 rounded text-blue-600"> Đánh dấu</label>` : ''}</div>`;
            n++;
        }
        h += `</div></div>`;
    }
    if (c.tf) {
        h += `<div class="mb-8"><div class="bg-orange-50/70 border border-orange-100 p-3 rounded-xl mb-4"><h4 class="font-extrabold text-orange-800 text-sm uppercase tracking-wide">Phần II. Đúng / Sai</h4></div><div class="space-y-4">`;
        for (let i = 1; i <= c.tf; i++) {
            h += `<div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm transition-colors"><div class="font-extrabold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between"><span class="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-sm">Câu ${n}</span></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-4">`;
            for (let j = 0; j < 4; j++) {
                let q = `tf_${i}_${j}`, l = String.fromCharCode(97 + j);
                h += `<div id="row-${q}" class="flex items-center justify-between gap-3 bg-slate-50 border p-2 pl-4 rounded-xl"><b class="text-slate-600 uppercase">Ý ${l}</b><div class="flex gap-2"><label class="bubble-label"><input type="radio" name="${q}" value="D" onchange="${isTeacher ? `saveKey('${q}','D')` : `saveAns('${q}','D')`}"><span id="bubble-${q}-D" class="bubble !w-10 !h-10 !text-sm">Đ</span></label><label class="bubble-label"><input type="radio" name="${q}" value="S" onchange="${isTeacher ? `saveKey('${q}','S')` : `saveAns('${q}','S')`}"><span id="bubble-${q}-S" class="bubble !w-10 !h-10 !text-sm">S</span></label></div></div>`;
            }
            h += `</div></div>`;
            n++;
        }
        h += `</div></div>`;
    }
    if (c.short) {
        h += `<div class="mb-6"><div class="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl mb-4"><h4 class="font-extrabold text-emerald-800 text-sm uppercase tracking-wide">Phần III. Trả lời ngắn</h4></div><div class="grid grid-cols-1 gap-4">`;
        for (let i = 1; i <= c.short; i++) {
            let q = 'short_' + i;
            h += `<div id="row-${q}" class="flex flex-col gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group transition-colors"><div class="flex justify-between items-center mb-2"><div class="font-extrabold text-slate-700 bg-emerald-50 px-3 py-1 rounded-lg text-sm">Câu ${n}</div>${!isTeacher ? `<label class="flex items-center gap-1 cursor-pointer text-xs font-bold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"><input type="checkbox" onchange="mark('${q}',this.checked)" class="w-4 h-4 rounded text-emerald-600"> Đánh dấu</label>` : ''}</div><input id="input-${q}" class="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-400 transition-all text-lg" placeholder="Nhập đáp án..." oninput="${isTeacher ? `saveKey('${q}',this.value)` : `saveAns('${q}',this.value)`}"></div>`;
            n++;
        }
        h += `</div></div>`;
    }
    return h;
}
function saveKey(q,v){ correctAnswers[q] = String(v).trim(); }
function saveAns(q,v){ answers[q] = String(v).trim(); }
function mark(q, checked) { const row = document.getElementById('row-' + q); if (row) { if (checked) row.classList.add('row-marked'); else row.classList.remove('row-marked'); } }

function showAnswerReview(q, correctAnswer, userAnswer, type='text'){
    const row = document.getElementById('row-' + q);
    if(!row || !correctAnswer) return;
    row.querySelector('.answer-review')?.remove();
    row.querySelector('.answer-review-wrong')?.remove();
    let displayCorrect = String(correctAnswer).trim();
    let displayUser = String(userAnswer || '').trim();
    if(type === 'tf'){
        displayCorrect = displayCorrect.toUpperCase()==='D' ? 'ĐÚNG (Đ)' : displayCorrect.toUpperCase()==='S' ? 'SAI (S)' : displayCorrect;
        displayUser = displayUser.toUpperCase()==='D' ? 'ĐÚNG (Đ)' : displayUser.toUpperCase()==='S' ? 'SAI (S)' : (displayUser || 'Chưa trả lời');
    }
    const box = document.createElement('div');
    box.className = 'answer-review';
    box.innerHTML = `<span>✅ Đáp án đúng:</span><span class="answer-badge">${esc(displayCorrect)}</span><span class="text-emerald-700">${type==='tf'?'':esc(displayCorrect)}</span>`;
    row.appendChild(box);
    if(displayUser && norm(displayUser)!==norm(correctAnswer)){
        const wrong = document.createElement('div');
        wrong.className = 'answer-review-wrong';
        wrong.innerHTML = `❌ Bạn chọn: <b>${esc(displayUser)}</b>`;
        row.appendChild(wrong);
    }
}

// Hệ thống phòng mới ở bên dưới sẽ gán window.createRoomToFirebase.
// Hàm này chỉ là fallback để tránh lỗi nếu nút được bấm trước khi module phòng v2 tải xong.
async function createRoomToFirebase(){
    try {
        if (!window.__firebaseReady) await initFirebase();
        if (typeof window.__createRoomV2 === 'function') return window.__createRoomV2();
        throw new Error('Hệ thống phòng chưa sẵn sàng.');
    } catch (e) {
        console.error(e);
        alert('❌ Không thể tạo phòng: ' + (e?.message || e));
    }
}

// Exam room list
async function loadExamList() {
    switchSection('sec-exam-list'); 
    const c = document.getElementById('live-exams-container'); 
    c.innerHTML = '<div class="col-span-full p-12 text-center font-bold text-slate-500 bg-slate-50 rounded-2xl animate-pulse">Đang tải danh sách phòng thi...</div>';
    try {
        const s = await db.ref('rooms').once('value'); 
        if (!s.exists()) { c.innerHTML = '<div class="col-span-full p-12 text-center font-bold text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">Chưa có phòng thi nào đang mở.</div>'; return; }
        const rooms = []; s.forEach(x => { if(x.val()?.config) rooms.push({id: x.key, ...x.val()}); }); 
        rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        c.innerHTML = rooms.map(r => {
            const tQ = (+r.config.abcd || 0) + (+r.config.tf || 0) + (+r.config.short || 0);
            return `<article class="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col hover:-translate-y-1 transition-transform duration-300"><div class="flex justify-between items-start mb-3"><div class="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-inner"><div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>ĐANG MỞ</div></div><h3 class="text-xl font-extrabold text-slate-900 mb-4 line-clamp-2">${esc(r.title)}</h3><div class="flex gap-2 mb-8 text-xs font-bold text-slate-600"><span class="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">⏱ ${r.config.timeLimit || 0} phút</span><span class="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">📝 ${tQ} câu</span></div><div class="mt-auto flex gap-3"><button onclick="viewLeaderboard('${r.id}')" class="w-1/3 py-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-extrabold border border-amber-200 text-sm transition-colors flex items-center justify-center gap-1">🏆 BXH</button><button onclick="prepareJoin('${r.id}', '${r.config.pdfUrl || ''}')" class="w-2/3 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1">🚀 VÀO THI</button></div></article>`;
        }).join('');
    } catch (e) { c.innerHTML = `<div class="col-span-full p-8 text-center text-red-600 font-bold bg-red-50 rounded-xl border border-red-100">❌ Lỗi tải phòng: ${esc(e.message)}</div>`; }
}

function prepareJoin(id, pdf){ currentRoomId=id; document.getElementById('student-pdf').src=getEmbedUrl(pdf); switchSection('sec-student-join'); }
async function startExam(){
    studentName = document.getElementById('studentName').value; if(!studentName) return alert('Nhập tên!');
    const s = await db.ref('rooms/'+currentRoomId).once('value'); const r = s.val(); answers={}; timeRemaining=r.config.timeLimit*60; timeSpent=0;
    document.getElementById('student-sheet').innerHTML = sheetHTML(r.config, false); document.getElementById('result').classList.add('hidden'); document.getElementById('submit-btn').style.display='block';
    switchSection('sec-taking-exam'); timerInterval=setInterval(()=>{timeRemaining--; timeSpent++; document.getElementById('timer').textContent=`${Math.floor(timeRemaining/60).toString().padStart(2,'0')}:${(timeRemaining%60).toString().padStart(2,'0')}`; if(timeRemaining<=0){clearInterval(timerInterval); submitExam();}}, 1000);
}
function manualSubmit(){ if(confirm('Nộp bài?')) submitExam(); }

// Nộp bài & chấm điểm an toàn
async function submitExam(){
    clearInterval(timerInterval); 
    document.getElementById('submit-btn').style.display = 'none'; 
    const resultDiv = document.getElementById('result');
    const oldLoad = document.getElementById('loading-save'); if(oldLoad) oldLoad.remove();
    resultDiv.insertAdjacentHTML('beforebegin', '<div id="loading-save" class="text-center font-bold text-orange-600 mb-4 animate-pulse">⏳ Đang chấm điểm và lưu kết quả...</div>');
    resultDiv.classList.remove('hidden');

    try {
        const s = await db.ref('rooms/'+currentRoomId).once('value'); 
        const r = s.val(), c = r.config, k = r.answers || {}; 
        let a = 0, t = 0, sh = 0;

        for(let i = 1; i <= c.abcd; i++) { 
            let q = `abcd_${i}`, u = norm(answers[q]), z = norm(k[q]);
            if (u && z && u === z) { a += 0.25; document.getElementById(`bubble-${q}-${u.toUpperCase()}`)?.classList.add('correct-bubble'); } 
            else { if (u) document.getElementById(`bubble-${q}-${u.toUpperCase()}`)?.classList.add('wrong-bubble'); if (z) document.getElementById(`bubble-${q}-${z.toUpperCase()}`)?.classList.add('correct-bubble'); showAnswerReview(q, z, u, 'abcd'); } 
        }

        for(let i = 1; i <= c.tf; i++) { 
            let n = 0; 
            for(let j = 0; j < 4; j++) { 
                let q = `tf_${i}_${j}`, u = norm(answers[q]), z = norm(k[q]);
                if (u && z && u === z) { n++; document.getElementById(`bubble-${q}-${u.toUpperCase()}`)?.classList.add('correct-bubble'); } 
                else { if (u) document.getElementById(`bubble-${q}-${u.toUpperCase()}`)?.classList.add('wrong-bubble'); if (z) document.getElementById(`bubble-${q}-${z.toUpperCase()}`)?.classList.add('correct-bubble'); showAnswerReview(q, z, u, 'tf'); } 
            } 
            if (n === 4) t += 1; else if (n === 3) t += 0.5; else if (n === 2) t += 0.25; else if (n === 1) t += 0.1; 
        }

        for(let i = 1; i <= c.short; i++) { 
            let q = `short_${i}`, u = norm(answers[q]), z = norm(k[q]), el = document.getElementById(`input-${q}`);
            if (u && z && u === z) { sh += 0.25; if (el) el.classList.add('correct-input'); } 
            else if (el) { el.classList.add('wrong-input'); el.value = answers[q] || 'Trống'; showAnswerReview(q, z, u, 'short'); } 
        }

        const max = c.abcd * 0.25 + c.tf * 1 + c.short * 0.25;
        const score = max ? ((a + t + sh) / max * 10) : 0;
        const finalScore = +score.toFixed(2);
        
        document.getElementById('score').textContent = finalScore + '/10';
        await db.ref(`rooms/${currentRoomId}/results`).push({ name: studentName, score: finalScore, timeSpent: timeSpent });
        // Lưu lịch sử điểm vào hồ sơ cá nhân để vẽ biểu đồ tiến độ (nếu đã đăng nhập)
        if (typeof auth !== 'undefined' && auth && auth.currentUser) {
            db.ref('users/' + auth.currentUser.uid + '/examHistory').push({
                score: finalScore,
                title: r.title || 'Đề thi',
                roomId: currentRoomId,
                date: Date.now()
            }).catch(()=>{});
        }
        document.getElementById('loading-save')?.remove();
    } catch(e) {
        document.getElementById('loading-save')?.remove(); document.getElementById('submit-btn').style.display = 'block'; alert('❌ Lỗi chấm điểm: ' + e.message);
    }
}

// Top 10 leaderboard
async function viewLeaderboard(id) {
    switchSection('sec-leaderboard'); 
    const c = document.getElementById('lb-container');
    c.innerHTML = '<div class="p-12 text-center font-bold text-slate-500 bg-slate-50 animate-pulse rounded-2xl border border-slate-200">Đang tải bảng xếp hạng...</div>';
    
    try {
        const roomSnap = await db.ref('rooms/' + id).once('value');
        const roomTitle = roomSnap.exists() ? roomSnap.val().title : 'Đề thi';

        const s = await db.ref(`rooms/${id}/results`).once('value'); 
        if (!s.exists()) {
            c.innerHTML = '<div class="p-12 text-center font-bold text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">Chưa có ai nộp bài. Bạn là người đầu tiên chăng?</div>';
            return;
        }
        
        const arr = []; 
        s.forEach(x => arr.push(x.val())); 
        
        arr.sort((a, b) => {
            let scoreA = Number(a.score) || 0; let scoreB = Number(b.score) || 0;
            let timeA = Number(a.timeSpent) || 0; let timeB = Number(b.timeSpent) || 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            return timeA - timeB;
        });
        
        const top10 = arr.slice(0, 10);
        
        let htmlStr = `<div class="p-4 bg-slate-800 text-white font-bold text-lg rounded-t-2xl shadow-inner uppercase tracking-wide text-center">🏆 TOP 10 XUẤT SẮC NHẤT - ${esc(roomTitle)}</div><table class="w-full min-w-[600px] lb-table text-left border-b border-l border-r border-slate-200 rounded-b-2xl overflow-hidden"><thead class="bg-slate-50"><tr><th class="w-24 text-center py-4 border-b border-slate-200">Hạng</th><th class="py-4 border-b border-slate-200">Họ & Tên</th><th class="text-center w-32 py-4 border-b border-slate-200">Điểm</th><th class="text-right w-40 pr-8 py-4 border-b border-slate-200">Thời gian</th></tr></thead><tbody>`;
            
        htmlStr += top10.map((r, i) => {
            let m = Math.floor((r.timeSpent || 0) / 60).toString().padStart(2, '0'), s = ((r.timeSpent || 0) % 60).toString().padStart(2, '0');
            let rankClass = '', rankIcon = '', rowBg = '';
            if (i === 0) { rankClass = 'bg-yellow-400 text-yellow-900 shadow-md transform scale-125'; rankIcon = '👑'; rowBg = 'bg-yellow-50/50'; } 
            else if (i === 1) { rankClass = 'bg-slate-300 text-slate-800 shadow-md transform scale-110'; rankIcon = '🥈'; rowBg = 'bg-slate-50/80'; } 
            else if (i === 2) { rankClass = 'bg-orange-300 text-orange-900 shadow-md transform scale-110'; rankIcon = '🥉'; rowBg = 'bg-orange-50/30'; } 
            else { rankClass = 'bg-white text-slate-500 border border-slate-200 shadow-sm'; rankIcon = i + 1; rowBg = 'bg-white'; }
            return `<tr class="hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0 ${rowBg}"><td class="text-center py-4"><span class="inline-flex items-center justify-center w-10 h-10 rounded-full text-base font-black ${rankClass} transition-transform">${rankIcon}</span></td><td class="font-extrabold text-slate-800 py-4 text-lg">${esc(r.name)}</td><td class="text-center text-blue-600 font-black text-2xl py-4">${(+r.score || 0).toFixed(2)}</td><td class="text-right font-bold text-slate-500 py-4 pr-8">${m}:${s}</td></tr>`;
        }).join('');
        
        htmlStr += `</tbody></table>`;
        c.innerHTML = htmlStr;
    } catch (e) { c.innerHTML = `<div class="p-8 text-center text-red-600 font-bold bg-red-50 rounded-xl border border-red-100">Lỗi tải dữ liệu: ${esc(e.message)}</div>`; }
}

// --- SOẠN ĐỀ (CHEMMAKER) ---
function openChemMaker() { switchSection('sec-chemmaker'); updateChemPreview(); }
function insertImage(e) { const f = e.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = function(ev) { const tag = `\n<img src="${ev.target.result}" style="height: 150px; display: block; margin: 15px auto;" />\n`; const el = document.getElementById('chem-editor'); el.value = el.value.substring(0, el.selectionStart) + tag + el.value.substring(el.selectionStart); updateChemPreview(); }; reader.readAsDataURL(f); e.target.value = ''; }
function openDrawModal() { document.getElementById('draw-modal').classList.remove('opacity-0', 'pointer-events-none'); }
function closeDrawModal() { document.getElementById('draw-modal').classList.add('opacity-0', 'pointer-events-none'); }
function insertChemStruct() { const s = jsmeApplet.smiles(); if(!s) return alert("Chưa vẽ!"); const u = `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(s)}/image?width=500`; const tag = `\n<img src="${u}" style="height: 150px; display: block; margin: 15px auto;" />\n`; const el = document.getElementById('chem-editor'); el.value = el.value.substring(0, el.selectionStart) + tag + el.value.substring(el.selectionStart); updateChemPreview(); closeDrawModal(); jsmeApplet.reset(); }
let chemTimeout = null;
function updateChemPreview() { clearTimeout(chemTimeout); const rawText = document.getElementById('chem-editor').value.normalize('NFC'); document.getElementById('chem-pdf-content').innerHTML = rawText.replace(/\n/g, '<br>'); chemTimeout = setTimeout(() => { if (window.MathJax) MathJax.typesetPromise([document.getElementById('chem-pdf-content')]); }, 300); }
function exportChemPDF(e) { const el = document.getElementById('chem-pdf-content'), btn = e.currentTarget, old = btn.innerHTML; btn.innerHTML = "⏳ Đang tạo PDF..."; html2pdf().set({margin: [0.5, 0.5, 0.5, 0.5], filename: 'De-Thi-Hoa-HTVVM.pdf', image: {type: 'jpeg', quality: 0.98}, html2canvas: {scale: 2, useCORS: true}, jsPDF: {unit: 'in', format: 'A4', orientation: 'portrait'} }).from(el).save().then(() => btn.innerHTML = old); }

// --- CÔNG CỤ (SỔ TAY) ---
const ptData = [
    { z: 1, sym: 'H', name: 'Hydrogen', mass: '1.008', c: 1, r: 1, type: 'nonmetal', fact: 'Nguyên tố nhẹ nhất và phổ biến nhất vũ trụ (chiếm 75% khối lượng).' },
    { z: 2, sym: 'He', name: 'Helium', mass: '4.002', c: 18, r: 1, type: 'noble', fact: 'Khí hiếm nhẹ nhất, không cháy, dùng để bơm khinh khí cầu.' },
    { z: 3, sym: 'Li', name: 'Lithium', mass: '6.94', c: 1, r: 2, type: 'alkali', fact: 'Kim loại nhẹ nhất, thành phần chính của pin điện thoại, xe điện.' },
    { z: 4, sym: 'Be', name: 'Beryllium', mass: '9.012', c: 2, r: 2, type: 'alkaline', fact: 'Nhẹ và cứng, được dùng làm linh kiện trong hàng không vũ trụ.' },
    { z: 5, sym: 'B', name: 'Boron', mass: '10.81', c: 13, r: 2, type: 'metalloid', fact: 'Thường dùng trong sản xuất thủy tinh chịu nhiệt (Borosilicate).' },
    { z: 6, sym: 'C', name: 'Carbon', mass: '12.011', c: 14, r: 2, type: 'nonmetal', fact: 'Cơ sở của mọi sự sống trên Trái Đất, có thù hình kim cương và than chì.' },
    { z: 7, sym: 'N', name: 'Nitrogen', mass: '14.007', c: 15, r: 2, type: 'nonmetal', fact: 'Khí chiếm 78% thể tích khí quyển Trái Đất.' },
    { z: 8, sym: 'O', name: 'Oxygen', mass: '15.999', c: 16, r: 2, type: 'nonmetal', fact: 'Khí duy trì sự sống và sự cháy, chiếm 21% khí quyển.' },
    { z: 9, sym: 'F', name: 'Fluorine', mass: '18.998', c: 17, r: 2, type: 'halogen', fact: 'Phi kim hoạt động mạnh nhất, có tính oxi hóa mãnh liệt.' },
    { z: 10, sym: 'Ne', name: 'Neon', mass: '20.180', c: 18, r: 2, type: 'noble', fact: 'Phát ra ánh sáng đỏ cam rực rỡ khi cho dòng điện chạy qua ống chân không.' },
    { z: 11, sym: 'Na', name: 'Sodium', mass: '22.990', c: 1, r: 3, type: 'alkali', fact: 'Kim loại kiềm, nổ khi gặp nước. Là thành phần của muối ăn (NaCl).' },
    { z: 12, sym: 'Mg', name: 'Magnesium', mass: '24.305', c: 2, r: 3, type: 'alkaline', fact: 'Cháy tạo ra ánh sáng trắng chói lòa, dùng trong pháo sáng.' },
    { z: 13, sym: 'Al', name: 'Aluminum', mass: '26.982', c: 13, r: 3, type: 'metal', fact: 'Kim loại phổ biến nhất vỏ Trái Đất, nhẹ, bền, không gỉ.' },
    { z: 14, sym: 'Si', name: 'Silicon', mass: '28.085', c: 14, r: 3, type: 'metalloid', fact: 'Thành phần chính của cát, dùng chế tạo chip điện tử bán dẫn.' },
    { z: 15, sym: 'P', name: 'Phosphorus', mass: '30.974', c: 15, r: 3, type: 'nonmetal', fact: 'Có hai dạng: P đỏ (an toàn, dùng ở bao diêm) và P trắng (độc, dễ bốc cháy).' },
    { z: 16, sym: 'S', name: 'Sulfur', mass: '32.06', c: 16, r: 3, type: 'nonmetal', fact: 'Chất rắn màu vàng, sinh ra khí H2S mùi trứng thối đặc trưng.' },
    { z: 17, sym: 'Cl', name: 'Chlorine', mass: '35.45', c: 17, r: 3, type: 'halogen', fact: 'Khí màu vàng lục, độc, được dùng để khử trùng nước sinh hoạt.' },
    { z: 18, sym: 'Ar', name: 'Argon', mass: '39.95', c: 18, r: 3, type: 'noble', fact: 'Dùng làm môi trường khí trơ trong bóng đèn dây tóc để chống cháy dây chằng.' },
    { z: 19, sym: 'K', name: 'Potassium', mass: '39.098', c: 1, r: 4, type: 'alkali', fact: 'Cần thiết cho cơ thể, có nhiều trong chuối. Phản ứng rất mạnh với nước.' },
    { z: 20, sym: 'Ca', name: 'Calcium', mass: '40.078', c: 2, r: 4, type: 'alkaline', fact: 'Thành phần chính cấu tạo nên xương, răng và đá vôi.' },
    { z: 21, sym: 'Sc', name: 'Scandium', mass: '44.956', c: 3, r: 4, type: 'transition', fact: 'Kim loại chuyển tiếp nhẹ, dùng chế tạo hợp kim nhôm cho máy bay chiến đấu.' },
    { z: 22, sym: 'Ti', name: 'Titanium', mass: '47.867', c: 4, r: 4, type: 'transition', fact: 'Siêu bền, siêu nhẹ và hoàn toàn tương thích sinh học (cấy ghép y tế).' },
    { z: 23, sym: 'V', name: 'Vanadium', mass: '50.942', c: 5, r: 4, type: 'transition', fact: 'Dùng để tăng độ cứng và sức chịu va đập cực mạnh cho thép.' },
    { z: 24, sym: 'Cr', name: 'Chromium', mass: '51.996', c: 6, r: 4, type: 'transition', fact: 'Cực kỳ cứng, tạo độ bóng và chống gỉ xuất sắc cho inox.' },
    { z: 25, sym: 'Mn', name: 'Manganese', mass: '54.938', c: 7, r: 4, type: 'transition', fact: 'Hợp chất KMnO4 (thuốc tím) có tính oxi hóa cực mạnh và sát trùng tốt.' },
    { z: 26, sym: 'Fe', name: 'Iron', mass: '55.845', c: 8, r: 4, type: 'transition', fact: 'Kim loại quan trọng nhất trong công nghiệp, chiếm phần lớn lõi Trái Đất.' },
    { z: 27, sym: 'Co', name: 'Cobalt', mass: '58.933', c: 9, r: 4, type: 'transition', fact: 'Thêm vào thủy tinh, gốm sứ để tạo ra màu xanh dương tuyệt đẹp.' },
    { z: 28, sym: 'Ni', name: 'Nickel', mass: '58.693', c: 10, r: 4, type: 'transition', fact: 'Có từ tính giống sắt, dùng nhiều trong sản xuất thép không gỉ và pin sạc.' },
    { z: 29, sym: 'Cu', name: 'Copper', mass: '63.546', c: 11, r: 4, type: 'transition', fact: 'Dẫn điện cực tốt, màu đỏ đặc trưng, dùng làm lõi dây điện.' },
    { z: 30, sym: 'Zn', name: 'Zinc', mass: '65.38', c: 12, r: 4, type: 'transition', fact: 'Đóng vai trò "lá chắn hy sinh", dùng mạ chống gỉ cho sắt thép.' },
    { z: 31, sym: 'Ga', name: 'Gallium', mass: '69.723', c: 13, r: 4, type: 'metal', fact: 'Nhiệt độ nóng chảy cực thấp (29.7°C), tan chảy ngay trong lòng bàn tay.' },
    { z: 32, sym: 'Ge', name: 'Germanium', mass: '72.630', c: 14, r: 4, type: 'metalloid', fact: 'Là chất bán dẫn quan trọng, dùng trong cáp quang và kính hồng ngoại.' },
    { z: 33, sym: 'As', name: 'Arsenic', mass: '74.922', c: 15, r: 4, type: 'metalloid', fact: 'Thường được gọi là Thạch tín, một nguyên tố cực kỳ độc hại.' },
    { z: 34, sym: 'Se', name: 'Selenium', mass: '78.971', c: 16, r: 4, type: 'nonmetal', fact: 'Có tính quang dẫn, dùng trong máy photocopy và pin năng lượng mặt trời.' },
    { z: 35, sym: 'Br', name: 'Bromine', mass: '79.904', c: 17, r: 4, type: 'halogen', fact: 'Phi kim duy nhất tồn tại ở thể lỏng ở điều kiện thường, màu đỏ nâu.' },
    { z: 36, sym: 'Kr', name: 'Krypton', mass: '83.798', c: 18, r: 4, type: 'noble', fact: 'Phát ra ánh sáng trắng rực rỡ, dùng trong đèn flash máy ảnh tốc độ cao.' },
    { z: 37, sym: 'Rb', name: 'Rubidium', mass: '85.468', c: 1, r: 5, type: 'alkali', fact: 'Phản ứng cực kỳ mãnh liệt với nước, tự bốc cháy trong không khí.' },
    { z: 38, sym: 'Sr', name: 'Strontium', mass: '87.62', c: 2, r: 5, type: 'alkaline', fact: 'Cháy với ngọn lửa màu đỏ thắm, là thành phần tạo màu cho pháo hoa.' },
    { z: 39, sym: 'Y', name: 'Yttrium', mass: '88.906', c: 3, r: 5, type: 'transition', fact: 'Từng được dùng để tạo ra màu đỏ rực rỡ trong màn hình TV màu CRT.' },
    { z: 40, sym: 'Zr', name: 'Zirconium', mass: '91.224', c: 4, r: 5, type: 'transition', fact: 'Tinh thể Zirconia lấp lánh và có độ cứng rất giống với kim cương thật.' },
    { z: 41, sym: 'Nb', name: 'Niobium', mass: '92.906', c: 5, r: 5, type: 'transition', fact: 'Có tính siêu dẫn ở nhiệt độ thấp, dùng làm nam châm trong máy chụp MRI.' },
    { z: 42, sym: 'Mo', name: 'Molybdenum', mass: '95.95', c: 6, r: 5, type: 'transition', fact: 'Chịu được nhiệt độ cực cao, làm thành phần thép trong động cơ phản lực.' },
    { z: 43, sym: 'Tc', name: 'Technetium', mass: '(98)', c: 7, r: 5, type: 'transition', fact: 'Nguyên tố nhân tạo đầu tiên, dùng làm chất đánh dấu hình ảnh trong y học.' },
    { z: 44, sym: 'Ru', name: 'Ruthenium', mass: '101.07', c: 8, r: 5, type: 'transition', fact: 'Thêm vào hợp kim titan và palladium để tăng độ bền chống mài mòn.' },
    { z: 45, sym: 'Rh', name: 'Rhodium', mass: '102.91', c: 9, r: 5, type: 'transition', fact: 'Cực kỳ đắt đỏ, được sử dụng trong bộ lọc xúc tác khí thải của ô tô.' },
    { z: 46, sym: 'Pd', name: 'Palladium', mass: '106.42', c: 10, r: 5, type: 'transition', fact: 'Kim loại kỳ diệu có khả năng hấp thụ khí Hydrogen gấp 900 lần thể tích.' },
    { z: 47, sym: 'Ag', name: 'Silver', mass: '107.87', c: 11, r: 5, type: 'transition', fact: 'Kim loại dẫn điện và dẫn nhiệt tốt nhất, phản xạ ánh sáng cao nhất.' },
    { z: 48, sym: 'Cd', name: 'Cadmium', mass: '112.41', c: 12, r: 5, type: 'transition', fact: 'Kim loại rất độc, trước đây dùng rộng rãi trong pin sạc Ni-Cd.' },
    { z: 49, sym: 'In', name: 'Indium', mass: '114.82', c: 13, r: 5, type: 'metal', fact: 'Rất mềm, được dùng làm lớp phủ dẫn điện trong màn hình LCD cảm ứng.' },
    { z: 50, sym: 'Sn', name: 'Tin', mass: '118.71', c: 14, r: 5, type: 'metal', fact: 'Nhiệt độ nóng chảy thấp (Thiếc), thường được dùng để hàn bo mạch điện tử.' },
    { z: 51, sym: 'Sb', name: 'Antimony', mass: '121.76', c: 15, r: 5, type: 'metalloid', fact: 'Nguyên liệu phổ biến để chế tạo các vật liệu chống cháy và đạn dược.' },
    { z: 52, sym: 'Te', name: 'Tellurium', mass: '127.60', c: 16, r: 5, type: 'metalloid', fact: 'Kết hợp với kim loại tạo thành lớp phủ ghi/xóa được trên đĩa CD/DVD.' },
    { z: 53, sym: 'I', name: 'Iodine', mass: '126.90', c: 17, r: 5, type: 'halogen', fact: 'Chất rắn màu đen tím, dễ dàng thăng hoa trực tiếp thành khí màu tím.' },
    { z: 54, sym: 'Xe', name: 'Xenon', mass: '131.29', c: 18, r: 5, type: 'noble', fact: 'Khí hiếm đầu tiên được giới khoa học phát hiện có thể tạo ra hợp chất.' },
    { z: 55, sym: 'Cs', name: 'Cesium', mass: '132.91', c: 1, r: 6, type: 'alkali', fact: 'Kim loại hoạt động mãnh liệt nhất, phát nổ ngay cả khi chạm vào nước đá.' },
    { z: 56, sym: 'Ba', name: 'Barium', mass: '137.33', c: 2, r: 6, type: 'alkaline', fact: 'Muối BaSO4 không tan, được uống làm chất cản quang khi chụp X-quang.' },
    
    // Họ Lanthanides (Rút ra xếp ở hàng 8)
    { z: 57, sym: 'La', name: 'Lanthanum', mass: '138.91', c: 4, r: 8, type: 'lanthanide', fact: 'Dùng trong thủy tinh quang học chất lượng cao (ống kính camera) và đá đánh lửa.' },
    { z: 58, sym: 'Ce', name: 'Cerium', mass: '140.12', c: 5, r: 8, type: 'lanthanide', fact: 'Nguyên tố đất hiếm phổ biến nhất, dùng làm bột đánh bóng màn hình điện thoại.' },
    { z: 59, sym: 'Pr', name: 'Praseodymium', mass: '140.91', c: 6, r: 8, type: 'lanthanide', fact: 'Dùng sản xuất kính bảo hộ thợ hàn vì có khả năng cản tia cực tím rất mạnh.' },
    { z: 60, sym: 'Nd', name: 'Neodymium', mass: '144.24', c: 7, r: 8, type: 'lanthanide', fact: 'Nguyên liệu lõi để chế tạo nam châm vĩnh cửu siêu nhỏ và siêu mạnh (trong tai nghe).' },
    { z: 61, sym: 'Pm', name: 'Promethium', mass: '(145)', c: 8, r: 8, type: 'lanthanide', fact: 'Nguyên tố phóng xạ duy nhất trong họ Lanthanide, dùng làm pin hạt nhân mini.' },
    { z: 62, sym: 'Sm', name: 'Samarium', mass: '150.36', c: 9, r: 8, type: 'lanthanide', fact: 'Dùng chế tạo nam châm chịu được nhiệt độ rất cao trong công nghệ hàng không.' },
    { z: 63, sym: 'Eu', name: 'Europium', mass: '151.96', c: 10, r: 8, type: 'lanthanide', fact: 'Đóng vai trò mực phản quang chống làm giả siêu việt trên các tờ tiền giấy Euro.' },
    { z: 64, sym: 'Gd', name: 'Gadolinium', mass: '157.25', c: 11, r: 8, type: 'lanthanide', fact: 'Là thuốc cản từ đặc thù được tiêm vào cơ thể khi chụp cộng hưởng từ (MRI).' },
    { z: 65, sym: 'Tb', name: 'Terbium', mass: '158.93', c: 12, r: 8, type: 'lanthanide', fact: 'Hợp chất của nó phát ra ánh sáng xanh lá cây rực rỡ trong đèn huỳnh quang.' },
    { z: 66, sym: 'Dy', name: 'Dysprosium', mass: '162.50', c: 13, r: 8, type: 'lanthanide', fact: 'Hấp thụ nơtron cực tốt, dùng làm thanh điều khiển trong lò phản ứng hạt nhân.' },
    { z: 67, sym: 'Ho', name: 'Holmium', mass: '164.93', c: 14, r: 8, type: 'lanthanide', fact: 'Là nguyên tố sở hữu sức hút từ tĩnh mạnh nhất trong bảng tuần hoàn.' },
    { z: 68, sym: 'Er', name: 'Erbium', mass: '167.26', c: 15, r: 8, type: 'lanthanide', fact: 'Được pha vào cáp quang dưới đáy biển biển để khuếch đại tín hiệu ánh sáng internet.' },
    { z: 69, sym: 'Tm', name: 'Thulium', mass: '168.93', c: 16, r: 8, type: 'lanthanide', fact: 'Nguyên tố đất hiếm tự nhiên ít phổ biến nhất, ứng dụng trong dao mổ laser y tế.' },
    { z: 70, sym: 'Yb', name: 'Ytterbium', mass: '173.05', c: 17, r: 8, type: 'lanthanide', fact: 'Đóng vai trò quan trọng trong việc chế tạo các đồng hồ nguyên tử cực kỳ chính xác.' },
    { z: 71, sym: 'Lu', name: 'Lutetium', mass: '174.97', c: 18, r: 8, type: 'lanthanide', fact: 'Nguyên tố cuối cùng của họ Lanthanide, cực kỳ đặc và đắt đỏ do khó tách chiết.' },
    
    // Tiếp tục Chu kỳ 6
    { z: 72, sym: 'Hf', name: 'Hafnium', mass: '178.49', c: 4, r: 6, type: 'transition', fact: 'Rất giỏi hấp thụ nơtron, thường được dùng trong các tàu ngầm hạt nhân.' },
    { z: 73, sym: 'Ta', name: 'Tantalum', mass: '180.95', c: 5, r: 6, type: 'transition', fact: 'Cực kỳ trơ, không phản ứng với dịch cơ thể, dùng làm đinh vít và khớp xương nhân tạo.' },
    { z: 74, sym: 'W', name: 'Tungsten', mass: '183.84', c: 6, r: 6, type: 'transition', fact: 'Nhiệt độ nóng chảy cao nhất bảng tuần hoàn (3422°C), dùng làm dây tóc bóng đèn.' },
    { z: 75, sym: 'Re', name: 'Rhenium', mass: '186.21', c: 7, r: 6, type: 'transition', fact: 'Nguyên tố ổn định cuối cùng được con người phát hiện trong tự nhiên.' },
    { z: 76, sym: 'Os', name: 'Osmium', mass: '190.23', c: 8, r: 6, type: 'transition', fact: 'Kim loại nặng, đặc và đặc khít nhất bảng tuần hoàn (gấp đôi chì).' },
    { z: 77, sym: 'Ir', name: 'Iridium', mass: '192.22', c: 9, r: 6, type: 'transition', fact: 'Kim loại chống ăn mòn vô địch, phần lớn tồn tại nhờ các thiên thạch rơi xuống Trái Đất.' },
    { z: 78, sym: 'Pt', name: 'Platinum', mass: '195.08', c: 10, r: 6, type: 'transition', fact: 'Bạch kim, cực kỳ quý hiếm và trơ với phần lớn các phản ứng hóa học thông thường.' },
    { z: 79, sym: 'Au', name: 'Gold', mass: '196.97', c: 11, r: 6, type: 'transition', fact: 'Vàng - Cực dẻo và dễ dát mỏng, không bao giờ bị oxi hóa (rỉ sét) ngoài không khí.' },
    { z: 80, sym: 'Hg', name: 'Mercury', mass: '200.59', c: 12, r: 6, type: 'transition', fact: 'Thủy ngân, kim loại kỳ lạ duy nhất tồn tại ở thể lỏng ở nhiệt độ phòng.' },
    { z: 81, sym: 'Tl', name: 'Thallium', mass: '204.38', c: 13, r: 6, type: 'metal', fact: 'Cực kỳ độc hại, trước đây từng được sử dụng phổ biến làm thuốc diệt chuột.' },
    { z: 82, sym: 'Pb', name: 'Lead', mass: '207.2', c: 14, r: 6, type: 'metal', fact: 'Chì - Rất nặng và độc, có khả năng ngăn cản tia X và các bức xạ chết người.' },
    { z: 83, sym: 'Bi', name: 'Bismuth', mass: '208.98', c: 15, r: 6, type: 'metal', fact: 'Nguyên tố có từ tính nghịch (đẩy nam châm) mạnh nhất trong tự nhiên.' },
    { z: 84, sym: 'Po', name: 'Polonium', mass: '(209)', c: 16, r: 6, type: 'metalloid', fact: 'Nguyên tố phóng xạ do nữ bác học Marie Curie tìm ra, đặt theo tên quê hương Ba Lan.' },
    { z: 85, sym: 'At', name: 'Astatine', mass: '(210)', c: 17, r: 6, type: 'halogen', fact: 'Nguyên tố hiếm nhất vỏ Trái Đất (ước tính chỉ có khoảng 25 gram trên toàn cầu).' },
    { z: 86, sym: 'Rn', name: 'Radon', mass: '(222)', c: 18, r: 6, type: 'noble', fact: 'Khí hiếm phóng xạ, vô hình vô vị nhưng là nguyên nhân thứ 2 gây ung thư phổi.' },
    
    // Chu kỳ 7 & Họ Actinides
    { z: 87, sym: 'Fr', name: 'Francium', mass: '(223)', c: 1, r: 7, type: 'alkali', fact: 'Nguyên tố tự nhiên hiếm thứ hai, có tính phóng xạ, chu kỳ bán rã chỉ khoảng 22 phút.' },
    { z: 88, sym: 'Ra', name: 'Radium', mass: '(226)', c: 2, r: 7, type: 'alkaline', fact: 'Tự phát sáng trong bóng tối, từng được dùng sơn lên kim đồng hồ đo trước khi biết là nó độc.' },
    
    // Họ Actinides (Rút ra xếp ở hàng 9)
    { z: 89, sym: 'Ac', name: 'Actinium', mass: '(227)', c: 4, r: 9, type: 'actinide', fact: 'Mang tính phóng xạ mạnh đến mức nó có thể tự phát ra ánh sáng màu xanh lam mờ ảo.' },
    { z: 90, sym: 'Th', name: 'Thorium', mass: '232.04', c: 5, r: 9, type: 'actinide', fact: 'Được nghiên cứu thay thế Uranium làm nhiên liệu hạt nhân vì an toàn và dồi dào hơn.' },
    { z: 91, sym: 'Pa', name: 'Protactinium', mass: '231.04', c: 6, r: 9, type: 'actinide', fact: 'Rất hiếm, phóng xạ và cực kỳ độc hại, hầu như không có bất kỳ ứng dụng thực tế nào.' },
    { z: 92, sym: 'U', name: 'Uranium', mass: '238.03', c: 7, r: 9, type: 'actinide', fact: 'Nhiên liệu xương sống cung cấp năng lượng cho phần lớn các nhà máy điện hạt nhân toàn cầu.' },
    { z: 93, sym: 'Np', name: 'Neptunium', mass: '(237)', c: 8, r: 9, type: 'actinide', fact: 'Nguyên tố siêu Uranium (nặng hơn Uranium) đầu tiên được con người tổng hợp nhân tạo.' },
    { z: 94, sym: 'Pu', name: 'Plutonium', mass: '(244)', c: 9, r: 9, type: 'actinide', fact: 'Nhiên liệu hạt nhân cực kỳ mạnh mẽ, dùng chế tạo bom nguyên tử và pin cho tàu vũ trụ.' },
    { z: 95, sym: 'Am', name: 'Americium', mass: '(243)', c: 10, r: 9, type: 'actinide', fact: 'Một lượng cực nhỏ yếu tố này được đặt trong hầu hết các máy báo khói gia đình.' },
    { z: 96, sym: 'Cm', name: 'Curium', mass: '(247)', c: 11, r: 9, type: 'actinide', fact: 'Tên được đặt để vinh danh những cống hiến vĩ đại của vợ chồng nhà khoa học Curie.' },
    { z: 97, sym: 'Bk', name: 'Berkelium', mass: '(247)', c: 12, r: 9, type: 'actinide', fact: 'Được tổng hợp thành công tại khuôn viên trường Đại học UC Berkeley, California.' },
    { z: 98, sym: 'Cf', name: 'Californium', mass: '(251)', c: 13, r: 9, type: 'actinide', fact: 'Làm máy dò mìn và giếng dầu siêu nhạy, là một trong những chất đắt nhất thế giới.' },
    { z: 99, sym: 'Es', name: 'Einsteinium', mass: '(252)', c: 14, r: 9, type: 'actinide', fact: 'Phát hiện lần đầu tiên bất ngờ trong tàn tích của vụ thử bom hydro đầu tiên năm 1952.' },
    { z: 100, sym: 'Fm', name: 'Fermium', mass: '(257)', c: 15, r: 9, type: 'actinide', fact: 'Nguyên tố nặng nhất có thể tạo ra bằng cách ném bom neutron vào nguyên tố nhẹ hơn.' },
    { z: 101, sym: 'Md', name: 'Mendelevium', mass: '(258)', c: 16, r: 9, type: 'actinide', fact: 'Tên nguyên tố là sự vinh danh Dmitri Mendeleev - người cha đẻ vĩ đại của bảng tuần hoàn.' },
    { z: 102, sym: 'No', name: 'Nobelium', mass: '(259)', c: 17, r: 9, type: 'actinide', fact: 'Được đặt theo tên của Alfred Nobel, nhà khoa học phát minh thuốc nổ và sáng lập giải Nobel.' },
    { z: 103, sym: 'Lr', name: 'Lawrencium', mass: '(266)', c: 18, r: 9, type: 'actinide', fact: 'Nguyên tố cuối cùng khép lại họ Actinide, phóng xạ mạnh và thời gian tồn tại rất ngắn.' },
    
    // Trở lại Chu kỳ 7 (Nhóm Siêu Nặng Nhân Tạo)
    { z: 104, sym: 'Rf', name: 'Rutherfordium', mass: '(267)', c: 4, r: 7, type: 'transition', fact: 'Nguyên tố siêu nặng, chu kỳ bán rã dài nhất cũng chỉ tồn tại trong khoảng vài chục giây.' },
    { z: 105, sym: 'Db', name: 'Dubnium', mass: '(268)', c: 5, r: 7, type: 'transition', fact: 'Từng là chủ đề tranh cãi ***** gắt về quyền đặt tên giữa các nhà khoa học Mỹ và Nga.' },
    { z: 106, sym: 'Sg', name: 'Seaborgium', mass: '(269)', c: 6, r: 7, type: 'transition', fact: 'Nguyên tố hiếm hoi được đặt theo tên một người (Glenn Seaborg) khi ông vẫn còn đang sống.' },
    { z: 107, sym: 'Bh', name: 'Bohrium', mass: '(270)', c: 7, r: 7, type: 'transition', fact: 'Nguyên tố nhân tạo mang tên nhà vật lý lượng tử nổi tiếng người Đan Mạch Niels Bohr.' },
    { z: 108, sym: 'Hs', name: 'Hassium', mass: '(270)', c: 8, r: 7, type: 'transition', fact: 'Giống như osmium, nó có thể tạo ra hợp chất tetroxide dễ bay hơi vô cùng đặc biệt.' },
    { z: 109, sym: 'Mt', name: 'Meitnerium', mass: '(278)', c: 9, r: 7, type: 'transition', fact: 'Nguyên tố siêu nặng vinh danh nhà vật lý học thiên tài Lise Meitner.' },
    { z: 110, sym: 'Ds', name: 'Darmstadtium', mass: '(281)', c: 10, r: 7, type: 'transition', fact: 'Tổng hợp thành công và được đặt tên theo thành phố Darmstadt của nước Đức.' },
    { z: 111, sym: 'Rg', name: 'Roentgenium', mass: '(282)', c: 11, r: 7, type: 'transition', fact: 'Vinh danh người đầu tiên tìm ra tia X bí ẩn - nhà vật lý Wilhelm Röntgen.' },
    { z: 112, sym: 'Cn', name: 'Copernicium', mass: '(285)', c: 12, r: 7, type: 'transition', fact: 'Đặt tên theo nhà thiên văn học Nicolaus Copernicus, người đề xuất thuyết Nhật tâm.' },
    { z: 113, sym: 'Nh', name: 'Nihonium', mass: '(286)', c: 13, r: 7, type: 'metal', fact: 'Nguyên tố đầu tiên trong lịch sử được phát hiện tại châu Á, do các nhà khoa học Nhật Bản tổng hợp.' },
    { z: 114, sym: 'Fl', name: 'Flerovium', mass: '(289)', c: 14, r: 7, type: 'metal', fact: 'Được kỳ vọng thuộc "Hòn đảo ổn định" nhưng thực tế nó vẫn phân rã cực nhanh.' },
    { z: 115, sym: 'Mc', name: 'Moscovium', mass: '(290)', c: 15, r: 7, type: 'metal', fact: 'Tổng hợp thành công tại Viện nghiên cứu hạt nhân liên hợp Dubna gần thủ đô Moscow (Nga).' },
    { z: 116, sym: 'Lv', name: 'Livermorium', mass: '(293)', c: 16, r: 7, type: 'metal', fact: 'Vinh danh Phòng thí nghiệm quốc gia Lawrence Livermore (LLNL) tại Mỹ.' },
    { z: 117, sym: 'Ts', name: 'Tennessine', mass: '(294)', c: 17, r: 7, type: 'halogen', fact: 'Nguyên tố siêu nặng thuộc họ halogen, được tổng hợp muộn nhất vào năm 2010.' },
    { z: 118, sym: 'Og', name: 'Oganesson', mass: '(294)', c: 18, r: 7, type: 'noble', fact: 'Là nguyên tố nặng nhất bảng tuần hoàn từng được tạo ra, kết thúc chu kỳ thứ 7.' }

]; // Đã rút gọn để code không quá dài, bạn cứ dán mảng 118 nguyên tố cũ vào nhé

function openToolkit() { switchSection('sec-toolkit'); renderPeriodicTable(); }
function switchTab(tabId){ document.querySelectorAll('.tool-tab').forEach(el=>el.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(el=>{ el.classList.remove('active', 'bg-blue-600', 'text-white'); el.classList.add('text-slate-600'); }); document.getElementById(tabId).classList.add('active'); let btn = document.getElementById('btn-'+tabId); if(btn) { btn.classList.add('active', 'bg-blue-600', 'text-white'); btn.classList.remove('text-slate-600'); } }
function renderPeriodicTable() { const container = document.getElementById('pt-container'); if(container.innerHTML !== '') return; let html = ''; for(let r=1; r<=9; r++) { for(let c=1; c<=18; c++) { if ((r === 8 || r === 9) && c <= 3) { html += `<div style="grid-row:${r}; grid-column:${c};"></div>`; continue; } let el = ptData.find(e => e.r === r && e.c === c); if(el) { let bgClass = el.type === 'lanthanide' ? 'bg-[#e9d5ff] text-[#4c1d95]' : el.type === 'actinide' ? 'bg-[#fbcfe8] text-[#831843]' : `type-${el.type}`; html += `<div onclick='openModal(${JSON.stringify(el)})' class="pt-cell ${bgClass}" style="grid-row:${r}; grid-column:${c};"><span class="text-[0.6rem] font-bold opacity-60 leading-none mt-1">${el.z}</span><span class="text-xl font-extrabold leading-tight">${el.sym}</span><span class="text-[0.5rem] font-bold opacity-80 truncate px-1">${el.mass}</span></div>`; } else { if (r === 6 && c === 3) html += `<div class="pt-cell bg-slate-100 font-extrabold text-slate-400" style="grid-row:${r}; grid-column:${c};">* Lanth</div>`; else if (r === 7 && c === 3) html += `<div class="pt-cell bg-slate-100 font-extrabold text-slate-400" style="grid-row:${r}; grid-column:${c};">** Actin</div>`; else html += `<div style="grid-row:${r}; grid-column:${c};"></div>`; } } } container.innerHTML = html; }
// Hàm mở Modal (Đã tích hợp Mô hình 3D và Đồng bộ màu sắc)
// ==========================================
// KHU VỰC LOGIC BẢNG TUẦN HOÀN & MÔ HÌNH 3D
// ==========================================

// 1. Data cấu hình E thu gọn cho 118 Nguyên Tố (Nằm ở ngoài hàm)
const ecData = [
  "", "1s¹", "1s²", 
  "[He] 2s¹", "[He] 2s²", "[He] 2s² 2p¹", "[He] 2s² 2p²", "[He] 2s² 2p³", "[He] 2s² 2p⁴", "[He] 2s² 2p⁵", "[He] 2s² 2p⁶",
  "[Ne] 3s¹", "[Ne] 3s²", "[Ne] 3s² 3p¹", "[Ne] 3s² 3p²", "[Ne] 3s² 3p³", "[Ne] 3s² 3p⁴", "[Ne] 3s² 3p⁵", "[Ne] 3s² 3p⁶",
  "[Ar] 4s¹", "[Ar] 4s²", "[Ar] 3d¹ 4s²", "[Ar] 3d² 4s²", "[Ar] 3d³ 4s²", "[Ar] 3d⁵ 4s¹", "[Ar] 3d⁵ 4s²", "[Ar] 3d⁶ 4s²", "[Ar] 3d⁷ 4s²", "[Ar] 3d⁸ 4s²", "[Ar] 3d¹⁰ 4s¹", "[Ar] 3d¹⁰ 4s²", "[Ar] 3d¹⁰ 4s² 4p¹", "[Ar] 3d¹⁰ 4s² 4p²", "[Ar] 3d¹⁰ 4s² 4p³", "[Ar] 3d¹⁰ 4s² 4p⁴", "[Ar] 3d¹⁰ 4s² 4p⁵", "[Ar] 3d¹⁰ 4s² 4p⁶",
  "[Kr] 5s¹", "[Kr] 5s²", "[Kr] 4d¹ 5s²", "[Kr] 4d² 5s²", "[Kr] 4d⁴ 5s¹", "[Kr] 4d⁵ 5s¹", "[Kr] 4d⁵ 5s²", "[Kr] 4d⁷ 5s¹", "[Kr] 4d⁸ 5s¹", "[Kr] 4d¹⁰", "[Kr] 4d¹⁰ 5s¹", "[Kr] 4d¹⁰ 5s²", "[Kr] 4d¹⁰ 5s² 5p¹", "[Kr] 4d¹⁰ 5s² 5p²", "[Kr] 4d¹⁰ 5s² 5p³", "[Kr] 4d¹⁰ 5s² 5p⁴", "[Kr] 4d¹⁰ 5s² 5p⁵", "[Kr] 4d¹⁰ 5s² 5p⁶",
  "[Xe] 6s¹", "[Xe] 6s²", "[Xe] 5d¹ 6s²", "[Xe] 4f¹ 5d¹ 6s²", "[Xe] 4f³ 6s²", "[Xe] 4f⁴ 6s²", "[Xe] 4f⁵ 6s²", "[Xe] 4f⁶ 6s²", "[Xe] 4f⁷ 6s²", "[Xe] 4f⁷ 5d¹ 6s²", "[Xe] 4f⁹ 6s²", "[Xe] 4f¹⁰ 6s²", "[Xe] 4f¹¹ 6s²", "[Xe] 4f¹² 6s²", "[Xe] 4f¹³ 6s²", "[Xe] 4f¹⁴ 6s²", "[Xe] 4f¹⁴ 5d¹ 6s²", "[Xe] 4f¹⁴ 5d² 6s²", "[Xe] 4f¹⁴ 5d³ 6s²", "[Xe] 4f¹⁴ 5d⁴ 6s²", "[Xe] 4f¹⁴ 5d⁵ 6s²", "[Xe] 4f¹⁴ 5d⁶ 6s²", "[Xe] 4f¹⁴ 5d⁷ 6s²", "[Xe] 4f¹⁴ 5d⁸ 6s²", "[Xe] 4f¹⁴ 5d⁹ 6s²", "[Xe] 4f¹⁴ 5d¹⁰ 6s²", "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹", "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²", "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³", "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴", "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵", "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶",
  "[Rn] 7s¹", "[Rn] 7s²", "[Rn] 6d¹ 7s²", "[Rn] 5f¹ 6d¹ 7s²", "[Rn] 5f² 6d¹ 7s²", "[Rn] 5f³ 6d¹ 7s²", "[Rn] 5f⁴ 6d¹ 7s²", "[Rn] 5f⁶ 7s²", "[Rn] 5f⁷ 7s²", "[Rn] 5f⁷ 6d¹ 7s²", "[Rn] 5f⁹ 7s²", "[Rn] 5f¹⁰ 7s²", "[Rn] 5f¹¹ 7s²", "[Rn] 5f¹² 7s²", "[Rn] 5f¹³ 7s²", "[Rn] 5f¹⁴ 7s²", "[Rn] 5f¹⁴ 6d¹ 7s²", "[Rn] 5f¹⁴ 6d² 7s²", "[Rn] 5f¹⁴ 6d³ 7s²", "[Rn] 5f¹⁴ 6d⁴ 7s²", "[Rn] 5f¹⁴ 6d⁵ 7s²", "[Rn] 5f¹⁴ 6d⁶ 7s²", "[Rn] 5f¹⁴ 6d⁷ 7s²", "[Rn] 5f¹⁴ 6d⁸ 7s²", "[Rn] 5f¹⁴ 6d⁹ 7s²", "[Rn] 5f¹⁴ 6d¹⁰ 7s²", "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹", "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²", "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³", "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴", "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵", "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶"
];

// 2. Hàm tự động vẽ quỹ đạo Rutherford-Bohr 3D
// ==========================================
// ⚛️ HỆ THỐNG RENDER PHÂN TỬ 3D (3DMOL.JS)
// ==========================================

// 1. Máy tạo tọa độ 3D (XYZ Format) cho các nguyên tố
function getElementXYZ(sym) {
    const diatomics = ['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'];
    
    // Nếu là khí lưỡng nguyên tử (O2, H2...) -> Vẽ 2 quả cầu dính nhau
    if (diatomics.includes(sym)) {
        return `2\nDiatomic Molecule\n${sym} -0.6 0.0 0.0\n${sym} 0.6 0.0 0.0`;
    }
    // Phốt pho trắng P4 (Cấu trúc tứ diện)
    if (sym === 'P') {
        return `4\nP4 Molecule\nP 0.0 0.0 0.0\nP 2.2 0.0 0.0\nP 1.1 1.9 0.0\nP 1.1 0.6 1.8`;
    }
    // Lưu huỳnh S8 (Vòng vương miện Zic-zac)
    if (sym === 'S') {
        return `8\nS8 Crown\nS 1.4 -0.3 1.4\nS 0.0 -1.5 2.0\nS -1.4 -0.3 1.4\nS -2.0 1.0 0.0\nS -1.4 2.3 -1.4\nS 0.0 1.0 -2.0\nS 1.4 2.3 -1.4\nS 2.0 1.0 0.0`;
    }
    // Cacbon (Lưới tinh thể kim cương cơ bản)
    if (sym === 'C') {
        return `5\nDiamond Lattice\nC 0.0 0.0 0.0\nC 1.5 1.5 1.5\nC -1.5 -1.5 1.5\nC -1.5 1.5 -1.5\nC 1.5 -1.5 -1.5`;
    }
    
    // Mặc định các nguyên tố khác: 1 nguyên tử đơn độc
    return `1\nSingle Atom\n${sym} 0.0 0.0 0.0`;
}

let element3DViewer = null;

// 2. Hàm vẽ mô hình 3D lên web
function render3DMolecule(sym) {
    const container = document.getElementById('bohr-model-container');
    container.innerHTML = ''; // Xóa sạch rác cũ
    
    // Căn chỉnh lại khung chứa cho rộng rãi, đẹp mắt
    container.style.width = '100%';
    container.style.height = '180px';
    container.style.position = 'relative';
    container.style.marginBottom = '15px';
    container.style.cursor = 'grab'; // Đổi con trỏ chuột thành hình bàn tay

    // Khởi tạo máy chiếu 3D
    element3DViewer = $3Dmol.createViewer(container, {
        defaultcolors: $3Dmol.rasmolElementColors // Lấy bảng màu chuẩn quốc tế của Hóa học
    });
    
    // Ép phông nền trong suốt (alpha: 0.0) để tiệp màu với cái Modal Dark Mode của ní
    element3DViewer.setBackgroundColor(0xffffff, 0.0);

    // Bơm dữ liệu tọa độ vào
    let xyzData = getElementXYZ(sym);
    element3DViewer.addModel(xyzData, "xyz");
    
    // Giao diện Ball & Stick (Quả cầu và que nối)
    element3DViewer.setStyle({}, { 
        sphere: { scale: 0.4 }, // Thu nhỏ quả cầu lại xíu để thấy rõ que nối
        stick: { radius: 0.15 } // Kích thước que nối
    });
    
    // Nếu chỉ có 1 nguyên tử thì phóng to quả cầu lên cho đẹp
    if (xyzData.startsWith('1\n')) {
        element3DViewer.setStyle({}, { sphere: { scale: 1.0 } });
    }
    
    element3DViewer.zoomTo(); // Tự động căn giữa màn hình
    element3DViewer.spin("y", 1.5); // Tự động xoay lượn lờ cho ngầu
    element3DViewer.render();
}

// 3. Hàm mở Modal Đồng bộ màu & Cấu trúc 2 cột
// ==========================================
// ⚛️ MÁY TẠO CẤU HÌNH ELECTRON 3D
// ==========================================
// Số ngẫu nhiên "giả" nhưng ổn định (deterministic) theo seed, để hạt nhân không bị "nhảy" hình mỗi lần render lại
function bohrSeededRand(seed) {
    let x = Math.sin(seed * 9973.7) * 43758.5453;
    return x - Math.floor(x);
}

// Phân bố electron theo lớp (K, L, M, N...) chuẩn 2-8-18-32-32-18-8
function bohrShellDistribution(z) {
    let shells = [];
    let e = z;
    const limits = [2, 8, 18, 32, 32, 18, 8];
    for (let max of limits) {
        if (e > max) { shells.push(max); e -= max; }
        else if (e > 0) { shells.push(e); break; }
        else break;
    }
    return shells;
}

// Vẽ mô hình Rutherford–Bohr dạng SVG: hạt nhân là cụm cầu proton/neutron xếp khối,
// các lớp electron là vòng tròn đồng tâm quay liên tục — style gần giống ảnh mẫu.
function buildBohrModel(z, massStr) {
    const shells = bohrShellDistribution(z);

    // --- Ước lượng số neutron từ khối lượng (nếu có) ---
    let massNum = massStr ? Math.round(parseFloat(String(massStr).replace(/[()]/g, ''))) : Math.round(z * 2.05);
    if (!isFinite(massNum) || massNum < z) massNum = Math.round(z * 2.05);
    const neutrons = Math.max(0, massNum - z);
    const protons = z;

    // Giới hạn số quả cầu vẽ ra (đại diện) để hạt nhân không bị rối mắt với nguyên tố nặng
    const totalNucleons = protons + neutrons;
    const cap = Math.min(totalNucleons, 30);
    let protonsShown = Math.max(1, Math.round(cap * (protons / totalNucleons)));
    let neutronsShown = Math.max(0, cap - protonsShown);

    // Xếp danh sách proton/neutron xen kẽ "ngẫu nhiên" có seed cố định theo Z
    let nucleonList = [];
    for (let i = 0; i < protonsShown; i++) nucleonList.push('p');
    for (let i = 0; i < neutronsShown; i++) nucleonList.push('n');
    for (let i = nucleonList.length - 1; i > 0; i--) {
        const j = Math.floor(bohrSeededRand(z * 31 + i) * (i + 1));
        [nucleonList[i], nucleonList[j]] = [nucleonList[j], nucleonList[i]];
    }

    // Xếp các quả cầu hạt nhân theo vòng xoắn hoa hướng dương (Fibonacci spiral) -> khối tròn đặc, tự nhiên
    const goldenAngle = 137.508;
    const sphereR = 6.4;
    let nucleonSpheres = [];
    let maxDist = 0;
    nucleonList.forEach((kind, i) => {
        const dist = 3.6 * Math.sqrt(i + 0.5);
        const ang = i * goldenAngle * Math.PI / 180;
        const x = dist * Math.cos(ang);
        const y = dist * Math.sin(ang);
        const r = sphereR * (0.85 + bohrSeededRand(z * 17 + i) * 0.3);
        maxDist = Math.max(maxDist, dist + r);
        nucleonSpheres.push({ x, y, r, kind });
    });
    const nucleusRadius = Math.max(maxDist, 14);

    // --- Kích thước tổng thể khung vẽ ---
    const view = 460;
    const c = view / 2;
    const maxRingRadius = c - 40;
    const ringStart = nucleusRadius + 30;
    const ringGap = shells.length > 1 ? Math.min(30, (maxRingRadius - ringStart) / (shells.length - 1)) : 0;

    let svg = `<svg viewBox="0 0 ${view} ${view}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs>
        <radialGradient id="bohrProton" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#fca5a5"/><stop offset="45%" stop-color="#ef4444"/><stop offset="100%" stop-color="#7f1d1d"/></radialGradient>
        <radialGradient id="bohrNeutron" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="45%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#334155"/></radialGradient>
        <radialGradient id="bohrElectron" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#bfdbfe"/><stop offset="45%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1e3a8a"/></radialGradient>
        <radialGradient id="bohrCoreGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ef4444" stop-opacity=".35"/><stop offset="100%" stop-color="#ef4444" stop-opacity="0"/></radialGradient>
    </defs>`;

    // Quầng sáng mờ phía sau hạt nhân (tạo cảm giác chiều sâu)
    svg += `<circle class="bohr-glow" cx="${c}" cy="${c}" r="${nucleusRadius + 16}" fill="url(#bohrCoreGlow)"/>`;

    // --- Các vòng quỹ đạo (đường viền đứt nét) + electron quay ---
    shells.forEach((count, i) => {
        const radius = ringStart + i * ringGap;
        svg += `<circle cx="${c}" cy="${c}" r="${radius}" fill="none" stroke="rgba(148,163,184,.55)" stroke-width="1.5" stroke-dasharray="2 4"/>`;

        const dir = i % 2 === 0 ? '' : 'rev';
        const duration = (7 + i * 3.2).toFixed(1);
        let group = `<g class="bohr-shell-spin ${dir}" style="animation-duration:${duration}s;">`;
        for (let j = 0; j < count; j++) {
            const angle = (360 / count) * j + i * 12;
            const rad = angle * Math.PI / 180;
            const ex = c + radius * Math.cos(rad);
            const ey = c + radius * Math.sin(rad);
            // Vệt mờ phía sau electron gợi ý chiều chuyển động
            const trailAngle = angle - 16;
            const tradRad = trailAngle * Math.PI / 180;
            const tx = c + radius * Math.cos(tradRad);
            const ty = c + radius * Math.sin(tradRad);
            group += `<path d="M ${tx} ${ty} A ${radius} ${radius} 0 0 1 ${ex} ${ey}" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" opacity=".35"/>`;
            group += `<circle cx="${ex}" cy="${ey}" r="5.5" fill="url(#bohrElectron)" stroke="#1e3a8a" stroke-width=".5"><title>e⁻</title></circle>`;
        }
        group += `</g>`;
        svg += group;
    });

    // --- Hạt nhân: cụm proton (đỏ) + neutron (xám) xếp khối tròn ---
    svg += `<g transform="translate(${c},${c})">`;
    nucleonSpheres.forEach(s => {
        const fill = s.kind === 'p' ? 'url(#bohrProton)' : 'url(#bohrNeutron)';
        svg += `<circle cx="${s.x.toFixed(2)}" cy="${s.y.toFixed(2)}" r="${s.r.toFixed(2)}" fill="${fill}" stroke="rgba(0,0,0,.25)" stroke-width=".4"/>`;
    });
    svg += `</g>`;

    svg += `</svg>`;

    return `<div class="bohr-wrap"><div style="filter:drop-shadow(0 10px 22px rgba(0,0,0,.25))">${svg}</div></div>`;
}

// Hàm mở Modal Đồng bộ màu & Cấu trúc 2 cột
function openModal(el) { 
    // Bơm thông tin cơ bản
    document.getElementById('modal-z').innerText = el.z; 
    document.getElementById('modal-mass').innerText = Math.round(parseFloat(el.mass.replace(/[()]/g, '')));
    document.getElementById('modal-sym').innerText = el.sym; 
    document.getElementById('modal-name').innerText = el.name; 
    document.getElementById('modal-fact').innerText = el.fact; 
    
    // Bơm Nhóm / Chu kỳ
    document.getElementById('modal-group').innerText = `${el.c} / ${el.r}`;
    
    // Đổ Cấu hình E vào
    document.getElementById('modal-ec').innerText = ecData[el.z] || "Đang cập nhật...";
    
    // Đổ Mô hình Bohr (Cấu hình E 3D) vào khung
    document.getElementById('bohr-model-container').innerHTML = buildBohrModel(el.z, el.mass);

    const typeNames = { 'nonmetal': 'Phi kim', 'noble': 'Khí hiếm', 'alkali': 'Kim loại kiềm', 'alkaline': 'Kim loại kiềm thổ', 'transition': 'Kim loại chuyển tiếp', 'metal': 'Kim loại', 'halogen': 'Halogen', 'metalloid': 'Á kim', 'lanthanide': 'Họ Lanthanide', 'actinide': 'Họ Actinide' }; 
    // Theme riêng cho Element Detail Card: nền tối + accent nhóm nguyên tố, tối ưu contrast.
    const typeThemes = {
        nonmetal:   { bg:'#0E2631', accent:'#22D3EE', text:'#F8FAFC', muted:'#C7D2E3', label:'#8FA8B7', border:'rgba(34,211,238,.46)' },
        noble:      { bg:'#2A1828', accent:'#F472B6', text:'#FFF7FA', muted:'#F3D3E2', label:'#CBA4B6', border:'rgba(244,114,182,.46)' },
        alkali:     { bg:'#2B1B0F', accent:'#FB923C', text:'#FFF7ED', muted:'#F5D8BE', label:'#C9A98F', border:'rgba(251,146,60,.46)' },
        alkaline:   { bg:'#29250D', accent:'#FACC15', text:'#FFFCE8', muted:'#EFE6B6', label:'#C6B96C', border:'rgba(250,204,21,.46)' },
        transition: { bg:'#181D3B', accent:'#818CF8', text:'#F5F7FF', muted:'#D4D8F1', label:'#AAB1D0', border:'rgba(129,140,248,.46)' },
        metal:      { bg:'#0F2A22', accent:'#34D399', text:'#ECFFF8', muted:'#CBE9DE', label:'#91BCAF', border:'rgba(52,211,153,.46)' },
        halogen:    { bg:'#211834', accent:'#A78BFA', text:'#F8F5FF', muted:'#DDD2F3', label:'#BBAED0', border:'rgba(167,139,250,.46)' },
        metalloid:  { bg:'#202B12', accent:'#BEF264', text:'#F7FDEB', muted:'#D9E8BE', label:'#A8B984', border:'rgba(190,242,100,.46)' },
        lanthanide: { bg:'#251633', accent:'#D8B4FE', text:'#FBF7FF', muted:'#E2D5F0', label:'#B9A7C8', border:'rgba(216,180,254,.46)' },
        actinide:   { bg:'#2B1825', accent:'#F9A8D4', text:'#FFF7FB', muted:'#F0D2E0', label:'#CBA6B7', border:'rgba(249,168,212,.46)' }
    };
    
    document.getElementById('modal-type').innerText = typeNames[el.type] || 'Khác';
    const cardEl = document.getElementById('modal-info-card');
    const theme = typeThemes[el.type] || typeThemes.transition;
    cardEl.style.setProperty('--element-bg', theme.bg);
    cardEl.style.setProperty('--element-accent', theme.accent);
    cardEl.style.setProperty('--element-text', theme.text);
    cardEl.style.setProperty('--element-muted', theme.muted);
    cardEl.style.setProperty('--element-label', theme.label);
    cardEl.style.setProperty('--element-border', theme.border);
    
    document.getElementById('element-modal').classList.remove('hidden'); 
}
// 4. Hàm đóng Modal chuẩn
function closeModal() { 
    document.getElementById('element-modal').classList.add('hidden'); 
}
function openDonateModal() { const modal = document.getElementById('donate-modal'); modal.classList.remove('opacity-0', 'pointer-events-none'); document.getElementById('donate-modal-content').classList.remove('scale-95'); }
function closeDonateModal() { const modal = document.getElementById('donate-modal'); modal.classList.add('opacity-0', 'pointer-events-none'); document.getElementById('donate-modal-content').classList.add('scale-95'); }

; 
// ==========================================
// TÍNH NĂNG GÓC HỌC TẬP (STUDY DASHBOARD)
// ==========================================

// 1. Logic phát YouTube
function embedYouTube() {
    const url = document.getElementById('yt-input').value;
    let videoId = '';
    
    // Tách ID video từ các định dạng link YT khác nhau
    if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
    else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
    else if (url.includes('youtube.com/embed/')) videoId = url.split('youtube.com/embed/')[1].split('?')[0];
    
    const player = document.getElementById('yt-player');
    if (videoId) {
        player.innerHTML = `<iframe class="w-full h-full rounded-2xl" src="https://www.youtube.com/embed/${videoId}?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        alert('Ní ơi, link YouTube không đúng dạng rồi! Coi lại nghen.');
    }
}

// 2. Logic phát Tài Liệu (PDF / Docs)
function embedDocument() {
    const originalUrl = document.getElementById('doc-input').value.trim();
    const player = document.getElementById('doc-player');
    
    if (!originalUrl) {
        alert('Chưa dán link tài liệu vô kìa ní ơi!');
        return;
    }

    // Folder Google Drive không có chế độ preview như file PDF.
    // Mở đúng link gốc để người dùng duyệt toàn bộ tài liệu trong folder.
    if (isDriveFolderUrl(originalUrl)) {
        window.open(originalUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    const url = getEmbedUrl(originalUrl);
    player.innerHTML = `<iframe class="w-full h-full rounded-2xl bg-white" src="${esc(url)}" frameborder="0" allowfullscreen></iframe>`;
}

// 2.5. Đồng hồ thời gian ở trên web
// Chạy độc lập với Pomodoro: chỉ đo thời gian phiên truy cập hiện tại.
let webVisitStartedAt = Date.now();
let webVisitInterval = null;

function formatWebVisitTime(totalSeconds){
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function updateWebVisitTimer(){
    const el = document.getElementById('web-time-counter');
    if(!el) return;
    // Dùng Date.now thay vì cộng +1 để đồng hồ không bị lệch khi tab/browser lag.
    const elapsed = Math.max(0, Math.floor((Date.now() - webVisitStartedAt) / 1000));
    el.textContent = formatWebVisitTime(elapsed);
}

function startWebVisitTimer(){
    if(webVisitInterval) clearInterval(webVisitInterval);
    webVisitStartedAt = Date.now();
    updateWebVisitTimer();
    webVisitInterval = setInterval(updateWebVisitTimer, 1000);
}

// 3. Logic Đồng hồ Pomodoro & Hệ Thống Xếp Hạng Cày Cuốc
let pomoSeconds = 25 * 60;
let pomoInterval = null;
let isPomoRunning = false;
let currentPomoMode = 'pomo';

// Biến lưu thời gian cày cuốc (Tích lũy kinh nghiệm)
let totalStudySeconds = 0;
let fiveHourAlerted = false;
let continuousStudySeconds = 0;

function setPomoMode(mode) {
    currentPomoMode = mode;
    clearInterval(pomoInterval);
    isPomoRunning = false;
    
    const btn = document.getElementById('btn-pomo-action');
    btn.innerText = 'BẮT ĐẦU';
    btn.className = 'bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl px-8 py-5 rounded-2xl transition-all shadow-md hover:shadow-lg w-full';
    
    ['pomo', 'short', 'long'].forEach(m => {
        document.getElementById(`mode-${m}`).className = 'flex-1 py-2 rounded-lg font-extrabold text-slate-400 hover:text-slate-600 transition-all';
    });

    if(mode === 'pomo') {
        pomoSeconds = 25 * 60;
        document.getElementById('mode-pomo').className = 'flex-1 py-2 rounded-lg font-extrabold bg-white text-emerald-600 shadow-sm transition-all';
    } else if (mode === 'short') {
        pomoSeconds = 5 * 60;
        document.getElementById('mode-short').className = 'flex-1 py-2 rounded-lg font-extrabold bg-white text-blue-500 shadow-sm transition-all';
    } else if (mode === 'long') {
        pomoSeconds = 15 * 60;
        document.getElementById('mode-long').className = 'flex-1 py-2 rounded-lg font-extrabold bg-white text-purple-500 shadow-sm transition-all';
    }
    
    enableInputs();
    updatePomoUI();
}

function userCustomTime() {
    currentPomoMode = 'custom'; 
    ['pomo', 'short', 'long'].forEach(m => {
        document.getElementById(`mode-${m}`).className = 'flex-1 py-2 rounded-lg font-extrabold text-slate-400 hover:text-slate-600 transition-all';
    });
    
    let m = parseInt(document.getElementById('input-m').value) || 0;
    let s = parseInt(document.getElementById('input-s').value) || 0;
    pomoSeconds = (m * 60) + s;
}

function updatePomoUI() {
    let m = Math.floor(pomoSeconds / 60);
    let s = pomoSeconds % 60;
    document.getElementById('input-m').value = m.toString().padStart(2, '0');
    document.getElementById('input-s').value = s.toString().padStart(2, '0');
}

function disableInputs() {
    document.getElementById('input-m').disabled = true;
    document.getElementById('input-s').disabled = true;
    document.getElementById('input-m').classList.add('opacity-80', 'cursor-not-allowed', 'text-emerald-600');
    document.getElementById('input-s').classList.add('opacity-80', 'cursor-not-allowed', 'text-emerald-600');
}

function enableInputs() {
    document.getElementById('input-m').disabled = false;
    document.getElementById('input-s').disabled = false;
    document.getElementById('input-m').classList.remove('opacity-80', 'cursor-not-allowed', 'text-emerald-600');
    document.getElementById('input-s').classList.remove('opacity-80', 'cursor-not-allowed', 'text-emerald-600');
}

// Hàm cập nhật Giao diện Thăng cấp
// LƯU Ý: Danh hiệu là DAILY — chỉ lấy thời gian học của ngày hiện tại.
// totalStudySeconds vẫn giữ nguyên để phục vụ Tổng thời gian học ở hồ sơ/thống kê.
// Hàm cập nhật Giao diện Thăng cấp (Bản hoàn chỉnh không bị reset)
function updateRankUI() {
    // Lấy trực tiếp từ bộ nhớ cục bộ
    const dailySeconds = Number(localStorage.getItem('htvvm.todayStudySeconds')) || 0;
    let h = Math.floor(dailySeconds / 3600);
    let m = Math.floor((dailySeconds % 3600) / 60);
    let s = dailySeconds % 60; // Giữ nguyên đếm giây
    
    document.getElementById('rank-time').innerText = `Hôm nay: ${h > 0 ? h + ' giờ ' : ''}${m} phút ${s} giây`;
    
    let icon = document.getElementById('rank-icon');
    let name = document.getElementById('rank-name');
    let progress = document.getElementById('rank-progress');
    let next = document.getElementById('rank-next');
    
    // Tính phần trăm thanh kinh nghiệm (1 tiếng = 100%)
    let percent = ((dailySeconds % 3600) / 3600) * 100;
    
    if (h === 0) {
        icon.innerText = '💧'; name.innerText = 'Tập sự (H₂O)';
        name.className = 'text-xl font-extrabold text-blue-600 mb-1';
        progress.className = 'bg-blue-500 h-3 rounded-full transition-all duration-1000';
        next.innerText = `Còn ${60 - m}p nữa để thành Caffein`;
    } else if (h === 1) {
        icon.innerText = '☕'; name.innerText = 'Tỉnh táo (Caffein)';
        name.className = 'text-xl font-extrabold text-amber-600 mb-1';
        progress.className = 'bg-amber-500 h-3 rounded-full transition-all duration-1000';
        next.innerText = `Còn ${60 - m}p nữa để thành Dopamine`;
    } else if (h === 2) {
        icon.innerText = '🚀'; name.innerText = 'Hưng phấn (Dopamine)';
        name.className = 'text-xl font-extrabold text-purple-600 mb-1';
        progress.className = 'bg-purple-500 h-3 rounded-full transition-all duration-1000';
        next.innerText = `Còn ${60 - m}p nữa để thành Adrenaline`;
    } else if (h === 3) {
        icon.innerText = '⚡'; name.innerText = 'Bứt phá (Adrenaline)';
        name.className = 'text-xl font-extrabold text-orange-600 mb-1';
        progress.className = 'bg-orange-500 h-3 rounded-full transition-all duration-1000';
        next.innerText = `Còn ${60 - m}p nữa để thành Serotonin`;
    } else if (h === 4) {
        icon.innerText = '🧠'; name.innerText = 'Thông thái (Serotonin)';
        name.className = 'text-xl font-extrabold text-emerald-600 mb-1';
        progress.className = 'bg-emerald-500 h-3 rounded-full transition-all duration-1000';
        next.innerText = `Còn ${60 - m}p nữa để chạm mốc Quá tải`;
    } else if (h >= 5) {
        icon.innerText = '🚨'; name.innerText = 'Quá tải (Cortisol)';
        name.className = 'text-xl font-extrabold text-red-600 mb-1 animate-pulse';
        progress.className = 'bg-red-500 h-3 rounded-full transition-all duration-1000';
        
        // 💡 Ổ KHÓA CỨNG: Ép phần trăm luôn luôn là 100% khi trên 5 tiếng, không cho tụt!
        percent = 100; 
        next.innerText = `Cảnh báo: Bạn đã học quá giới hạn! Nên nghỉ ngơi đi!`;
    }
    
    if(progress) progress.style.width = percent + '%';
}

function togglePomodoro() {
    const btn = document.getElementById('btn-pomo-action');
    if (!btn) return;

    if (isPomoRunning) {
        clearInterval(pomoInterval);
        pomoInterval = null;
        isPomoRunning = false;
        recordSession();
        btn.innerText = 'TIẾP TỤC';
        btn.className = 'bg-amber-500 hover:bg-amber-600 text-white font-black text-xl px-8 py-5 rounded-2xl transition-all shadow-md w-full';
        enableInputs();
        syncFocusOverlay();
        return;
    }

    // The selected preset or edited input already controls pomoSeconds.
    // Do not call userCustomTime() here because it would convert every preset
    // (25/5/15 minutes) into the custom mode on start/resume.
    if (!Number.isFinite(pomoSeconds) || pomoSeconds <= 0) {
        return alert('Ní phải nhập thời gian lớn hơn 0 nghen!');
    }

    ensureTodayStore();
    isPomoRunning = true;
    continuousStudySeconds = 0;
    fiveHourAlerted = false;
    disableInputs();

    btn.innerText = 'DỪNG LẠI';
    btn.className = 'bg-red-500 hover:bg-red-600 text-white font-black text-xl px-8 py-5 rounded-2xl transition-all shadow-inner w-full';
    syncFocusOverlay();

    clearInterval(pomoInterval);
    pomoInterval = setInterval(() => {
        if (!isPomoRunning) return;

        if (pomoSeconds > 0) {
            pomoSeconds--;

            // One timer tick = exactly one study second.
            if (currentPomoMode === 'pomo' || currentPomoMode === 'custom') {
                recordStudySecond();
                continuousStudySeconds = safeNum(continuousStudySeconds) + 1;
            }

            updatePomoUI();
            updateRankUI();
            syncFocusOverlay();

        } else {
            clearInterval(pomoInterval);
            pomoInterval = null;
            isPomoRunning = false;
            enableInputs();
            recordSession();
            syncFocusOverlay();

            btn.innerText = 'BẮT ĐẦU';
            btn.className = 'bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl px-8 py-5 rounded-2xl transition-all shadow-md hover:shadow-lg w-full';
            alert('⏰ Reng reng reng! Hết giờ rồi thằng em ơi!');
        }
    }, 1000);
}

function resetPomodoro() {
    const wasRunning = isPomoRunning;
    clearInterval(pomoInterval);
    pomoInterval = null;
    isPomoRunning = false;
    continuousStudySeconds = 0;
    enableInputs();

    if (currentPomoMode === 'pomo') {
        pomoSeconds = 25 * 60;
    } else if (currentPomoMode === 'short') {
        pomoSeconds = 5 * 60;
    } else if (currentPomoMode === 'long') {
        pomoSeconds = 15 * 60;
    } else {
        // Custom mode resets to the standard Pomodoro length, matching the old UI.
        pomoSeconds = 25 * 60;
    }

    updatePomoUI();
    updateRankUI();
    syncFocusOverlay();

    const btn = document.getElementById('btn-pomo-action');
    if (btn) {
        btn.innerText = 'BẮT ĐẦU';
        btn.className = 'bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl px-8 py-5 rounded-2xl transition-all shadow-md hover:shadow-lg w-full';
    }

    // Resetting after a running session ends that session, without adding time.
    if (wasRunning) recordSession();
}
// ==========================================
// TÍNH NĂNG VẼ ĐỒ THỊ HÀM SỐ
// ==========================================
let mathChart = null;

function plotGraph() {
    let expression = document.getElementById('func-input').value.trim();
    if (!expression) return alert("Bạn chưa nhập hàm số kìa! Nhập thử x^2 xem sao.");

    
    expression = expression.replace(/\|([^|]+)\|/g, 'abs($1)');

    try {
        // Dịch hàm số bằng Math.js
        const expr = math.compile(expression);
        // Tạo mảng điểm X từ -10 đến 10 (bước nhảy 0.1 để đường mượt)
        const xValues = math.range(-10, 10, 0.1).toArray();
        
        // Tính tọa độ Y tương ứng
        const dataPoints = xValues.map(x => {
            try {
                let y = expr.evaluate({ x: x });
                return { x: x, y: y };
            } catch(e) {
                return { x: x, y: null };
            }
        });

        const ctx = document.getElementById('mathChart').getContext('2d');
        
        // Nếu đã có đồ thị cũ thì phá nó đi vẽ cái mới
        if (mathChart) mathChart.destroy();

        // Cấu hình vẽ bằng Chart.js
        mathChart = new Chart(ctx, {
            type: 'scatter', // Dùng Scatter để trục X hiển thị số thực chuẩn
            data: {
                datasets: [{
                    type: 'line',
                    label: `Đồ thị f(x) = ${expression}`,
                    data: dataPoints,
                    borderColor: '#2563eb', // Màu xanh Tailwind
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0, // Ẩn mấy dấu chấm đi cho đường nét nó mượt
                    tension: 0.1, // Bo cong nhẹ
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'linear', position: 'center', grid: { color: '#cbd5e1' } },
                    y: { type: 'linear', position: 'center', grid: { color: '#cbd5e1' } }
                },
                plugins: {
                    legend: { labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold', size: 16 } } }
                }
            },
            // Plugin tự tô nền trắng để khi download ảnh không bị đen thui
            plugins: [{
                id: 'customCanvasBackgroundColor',
                beforeDraw: (chart) => {
                    const {ctx} = chart;
                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                }
            }]
        });
    } catch (e) {
        alert("Ối! Hàm số này viết sai cú pháp Toán học rồi. Kiểm tra lại nha!");
        console.error(e);
    }
}

function downloadGraph() {
    if (!mathChart) return alert("Vẽ đồ thị trước rồi mới tải được chớ ní!");
    const a = document.createElement('a');
    a.href = mathChart.toBase64Image();
    a.download = 'Do-Thi-Ham-So-HTVVM.png';
    a.click();
}
// ==========================================
// TÍNH NĂNG AI TRỢ GIẢNG (CÓ NÃO GEMINI 1.5)
// ==========================================

// ⚠️ NÍ DÁN CÁI MÃ API KEY VỪA COPY VÀO ĐÂY NHÉ:
const GEMINI_API_KEY = ''; // Không dùng ở client. AI production gọi /api/gemini. 

function toggleAIChat() {
    const chatbox = document.getElementById('ai-chatbox');
    if (chatbox.classList.contains('hidden')) {
        chatbox.classList.remove('hidden');
        setTimeout(() => {
            chatbox.classList.remove('scale-95', 'opacity-0');
            chatbox.classList.add('scale-100', 'opacity-100');
        }, 10);
    } else {
        chatbox.classList.remove('scale-100', 'opacity-100');
        chatbox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => chatbox.classList.add('hidden'), 300);
    }
}





/* ==========================================
   HTVVM application services
   - Focus mode / anti-distraction
   - Daily study goal + sessions
   - Autosave exam drafts
   - Better fuzzy search
   - Realtime leaderboard
   - Teacher role gate
   - Secure AI proxy client
========================================== */
(function(){
  const STORE = {
    goal: 'htvvm.dailyGoalMinutes',
    day: 'htvvm.studyDay',
    todaySeconds: 'htvvm.todayStudySeconds',
    sessions: 'htvvm.todaySessions',
    examPrefix: 'htvvm.examDraft.'
  };
  const MIN_STUDY_SECOND = 1;
  let currentRole = 'student';
  let focusMode = false;
  let activeBoardRef = null;
  let focusLostAt = 0;
  let aiHistory = [];

  const pad = n => String(n).padStart(2,'0');
  const dateKey = (d=new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const yesterdayKey = () => { const d=new Date(); d.setDate(d.getDate()-1); return dateKey(d); };
  const safeNum = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const deepGet = (obj,path,fallback=undefined) => String(path).split('/').reduce((acc,k)=>acc==null?undefined:acc[k],obj) ?? fallback;
  const html = (v='') => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function storeGet(key, fallback=null){ try { const v=localStorage.getItem(key); return v===null?fallback:JSON.parse(v); } catch { return fallback; } }
  function storeSet(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn('localStorage unavailable',e); } }
  function toast(msg, ms=2200){ const el=document.getElementById('study-toast'); if(!el) return; el.textContent=msg; el.classList.remove('hidden'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.add('hidden'),ms); }

  let lastKnownStudyDay = localStorage.getItem(STORE.day) || dateKey();

  function ensureTodayStore(){
    const today=dateKey();
    const storedDay=localStorage.getItem(STORE.day);
    if(storedDay!==today){
      const previousSeconds=safeNum(localStorage.getItem(STORE.todaySeconds));
      const previousSessions=safeNum(localStorage.getItem(STORE.sessions));

      // Chuyển sang ngày mới: thời gian/ngày + số phiên của NGÀY HÔM NAY
      // luôn bắt đầu từ 0, kể cả khi người dùng không reload trang lúc 0:00.
      localStorage.setItem(STORE.day,today);
      localStorage.setItem(STORE.todaySeconds,'0');
      localStorage.setItem(STORE.sessions,'0');
      lastKnownStudyDay=today;

      // Lưu snapshot ngày cũ nếu người dùng đang đăng nhập.
      const u = window.auth?.currentUser || (typeof auth!=='undefined' ? auth?.currentUser : null);
      const database = window.db || (typeof db!=='undefined' ? db : null);
      if(u && database && storedDay){
        database.ref('users/'+u.uid).update({
          [`dailyStudy/${storedDay}`]: previousSeconds,
          [`dailySessions/${storedDay}`]: previousSessions
        }).catch(err=>console.warn('daily rollover sync:',err));
      }

      if(typeof updateRankUI==='function') updateRankUI();
      if(typeof updateStudyDashboard==='function') updateStudyDashboard();
      if(typeof loadDashboardLeaderboards==='function') loadDashboardLeaderboards();
      return {changed:true, previousDay:storedDay, today};
    }
    lastKnownStudyDay=today;
    return {changed:false, today};
  }

  // Đồng hồ kiểm tra ngày độc lập với Pomodoro. Vì vậy để web mở qua 0:00
  // là đủ; không cần reload trang để XP/danh hiệu trong ngày về 0.
  let dailyRolloverHeartbeat = setInterval(()=>{
    try{ ensureTodayStore(); }catch(err){ console.warn('daily rollover:',err); }
  },1000);
  function getTodaySeconds(){ ensureTodayStore(); return safeNum(localStorage.getItem(STORE.todaySeconds)); }
  function getTodaySessions(){ ensureTodayStore(); return safeNum(localStorage.getItem(STORE.sessions)); }
  function getDailyGoal(){ const n=safeNum(localStorage.getItem(STORE.goal),60); return n>0?n:60; }
  window.setDailyGoal=function(min){ const n=Math.max(5,Math.min(600,safeNum(min,60))); localStorage.setItem(STORE.goal,String(n)); updateStudyDashboard(); toast(`🎯 Mục tiêu hôm nay: ${n} phút`); };

  let dashboardLeaderboardRefs = {study:null, streak:null};
  function formatStudyTime(sec){
    sec=safeNum(sec);
    const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60);
    if(h>0) return `${h} giờ ${m} phút`;
    return `${m} phút`;
  }
  function medal(i){ return ['🥇','🥈','🥉'][i] || `#${i+1}`; }
  function renderDashboardBoard(elId, rows, type){
    const el=document.getElementById(elId); if(!el) return;
    if(!rows.length){
      el.innerHTML='<div class="py-8 text-center text-sm font-bold text-slate-500">Chưa có dữ liệu vinh danh hôm nay.</div>';
      return;
    }
    el.innerHTML=rows.map((r,i)=>{
      const name=html(r.name||'Ẩn danh');
      const value=type==='study' ? formatStudyTime(r.value) : `${r.value} ngày`;
      const highlight=i===0 ? 'border-cyan-400/30 bg-cyan-400/10' : 'border-white/5 bg-white/[0.03]';
      return `<div class="flex items-center gap-3 rounded-2xl border ${highlight} px-4 py-3">
        <div class="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-lg shrink-0">${medal(i)}</div>
        <div class="min-w-0 flex-1"><div class="font-extrabold text-white truncate">${name}</div><div class="text-[11px] text-slate-500 font-bold mt-0.5">${i===0?'Đang dẫn đầu':'Top '+(i+1)}</div></div>
        <div class="font-black ${type==='study'?'text-cyan-300':'text-amber-300'} text-sm whitespace-nowrap">${value}</div>
      </div>`;
    }).join('');
  }
  function setBoardLoading(message='Đang tải bảng vinh danh...'){
    ['dashboard-top-study','dashboard-top-streak'].forEach(id=>{
      const e=document.getElementById(id);
      if(e) e.innerHTML=`<div class="py-8 text-center text-sm font-bold text-slate-500 animate-pulse">${message}</div>`;
    });
  }
  function loadDashboardLeaderboards(){
    if(!(typeof db!=='undefined' && db)) {
      setTimeout(loadDashboardLeaderboards,500);
      return;
    }
    const today=dateKey();
    const studyRef=db.ref('users').orderByChild(`dailyStudy/${today}`).limitToLast(3);
    const streakRef=db.ref('users').orderByChild('streak').limitToLast(3);
    const cleanup=()=>{
      Object.values(dashboardLeaderboardRefs).forEach(r=>{ if(r) r.off(); });
    };
    cleanup();
    dashboardLeaderboardRefs={study:studyRef,streak:streakRef};
    setBoardLoading();

    // 🚀 THUẬT TOÁN ĐỌC VÀ LẤY TÊN CHUẨN FIREBASE
    const mapRows=(snap,key) => {
        let arr = [];
        // Dùng forEach để Firebase giữ đúng thứ tự bảng xếp hạng
        snap.forEach(child => { arr.push(child.val()); }); 
        
        return arr.map(u => ({
            // Ưu tiên 1: displayName (Tên Google) -> Ưu tiên 2: name (Tên Database) -> Ưu tiên 3: Cắt từ Email
            name: String(u.name || u.displayName || (u.email ? u.email.split('@')[0] : 'Học viên')).trim() || 'Học viên',
            value: key==='study' ? safeNum(deepGet(u,`dailyStudy/${today}`)) : safeNum(u.streak)
        }))
        .filter(x => x.value > 0)
        .sort((a,b) => b.value - a.value)
        .slice(0,3);
    };

    studyRef.on('value',snap=>{
      renderDashboardBoard('dashboard-top-study',mapRows(snap,'study'),'study');
    },err=>{
      console.warn('top study leaderboard',err);
    });

    streakRef.on('value',snap=>{
      renderDashboardBoard('dashboard-top-streak',mapRows(snap,'streak'),'streak');
    },err=>{
      console.warn('top streak leaderboard',err);
    });
  }
  
  // XUẤT HÀM RA ĐỂ Ở ĐÂU CŨNG GỌI ĐƯỢC
  window.loadDashboardLeaderboards = loadDashboardLeaderboards;
   


  async function syncStudyStats(){
    if(!(typeof auth!=='undefined' && auth && auth.currentUser && typeof db!=='undefined' && db)) return;
    try{
      const uid=auth.currentUser.uid;
      const today=dateKey();
      await db.ref(`users/${uid}`).update({
        totalStudySeconds:safeNum(totalStudySeconds),
        lastActiveAt:Date.now(),
        [`dailyStudy/${today}`]:getTodaySeconds(),
        [`dailySessions/${today}`]:getTodaySessions()
      });
      loadDashboardLeaderboards();
    }catch(e){ console.warn('syncStudyStats',e); }
  }

  function updateStudyDashboard(){
    const mins=Math.floor(getTodaySeconds()/60), goal=getDailyGoal();
    const pct=Math.min(100,(mins*60)/(goal*60)*100);
    const p=document.getElementById('today-goal-progress'); if(p) p.style.width=`${pct}%`;
    const t=document.getElementById('today-goal-text'); if(t) t.textContent=`${mins} / ${goal} phút`;
    const l=document.getElementById('today-goal-label'); if(l) l.textContent=`${goal} phút`;
    const m=document.getElementById('today-study-min'); if(m) m.textContent=mins;
    const s=document.getElementById('today-session-count'); if(s) s.textContent=getTodaySessions();
    const fs=document.getElementById('today-focus-streak'); if(fs && document.getElementById('profile-streak')) fs.textContent=document.getElementById('profile-streak').textContent||'0';
    syncFocusOverlay();
  }

  function recordStudySecond(){
    ensureTodayStore();

    // Single source of truth for study XP/time.
    totalStudySeconds = safeNum(totalStudySeconds) + 1;
    const n = getTodaySeconds() + 1;
    localStorage.setItem(STORE.todaySeconds, String(n));

    // Keep the UI realtime and sync to Firebase every 30 seconds.
    updateStudyDashboard();
    updateRankUI();
    if(n % 30 === 0) syncStudyStats();
    if(n / 60 === getDailyGoal()) toast('🎉 Hoàn thành mục tiêu học hôm nay!');
  }

  function recordSession(){
    ensureTodayStore();
    localStorage.setItem(STORE.sessions,String(getTodaySessions()+1));
    updateStudyDashboard();
    syncStudyStats();
  }

  // Streak siêu dễ: Cứ đăng nhập là có lửa (Streak)
  window.checkAndUpdateStreak = async function(user){
    try{
      ensureTodayStore();
      const ref = db.ref('users/' + user.uid);
      const snap = await ref.once('value');
      const data = snap.val() || {};
      
      let profileStreak = safeNum(data.streak);
      const lastLogin = data.lastLoginDate || '';
      const today = dateKey();
      const yesterday = yesterdayKey();

      // Phục hồi tổng giờ học cho thẻ rank
      if(data.totalStudySeconds){ 
          totalStudySeconds = safeNum(data.totalStudySeconds); 
          if(typeof updateRankUI === 'function') updateRankUI(); 
      }

      // THUẬT TOÁN STREAK: CHỈ CẦN LOGIN
      if (lastLogin !== today) {
          if (lastLogin === yesterday) {
              profileStreak += 1; // Nối chuỗi
          } else {
              profileStreak = 1; // Đứt chuỗi -> Bắt đầu lại
          }
          // Lưu lại Firebase ngay lập tức
          await ref.update({ streak: profileStreak, lastLoginDate: today });
      }

      // Cập nhật ra giao diện
      if(document.getElementById('profile-streak')) {
          document.getElementById('profile-streak').textContent = String(profileStreak);
      }
      
      updateStudyDashboard();
    } catch(e) { console.warn('streak lỗi gòi:', e); }
  };

  // Creator model: mọi tài khoản đã đăng nhập đều có quyền tạo phòng thi.
  currentRole='creator';
  async function loadRole(user){
    currentRole='creator';
    const btn=document.getElementById('nav-teacher');
    if(btn) btn.classList.remove('hidden');
    const badge=document.getElementById('user-display-name');
    if(badge && user) badge.textContent=(user.displayName||user.email||'Học viên').split('@')[0];
  }
  window.openTeacherConfig=function(){ switchSection('sec-teacher-config'); };

  // Fuzzy search: bỏ dấu + chuẩn hóa Hoá/Hóa + token gần đúng.
  function fold(s){ return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/hoá/g,'hoa').replace(/[^a-z0-9\s+.#-]/g,' ').replace(/\s+/g,' ').trim(); }
  function lev(a,b){ if(a===b)return 0; if(!a)return b.length; if(!b)return a.length; const m=Array.from({length:b.length+1},(_,i)=>i); for(let i=1;i<=a.length;i++){ let prev=m[0]; m[0]=i; for(let j=1;j<=b.length;j++){ const cur=m[j]; m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1)); prev=cur; } } return m[b.length]; }
  function fuzzyMatch(query,text){ const q=fold(query), t=fold(text); if(!q)return true; if(t.includes(q))return true; return q.split(' ').filter(Boolean).every(token=>t.split(' ').some(w=>w===token || lev(token,w)<=Math.max(1,Math.floor(token.length*0.25)))); }
  window.applyFilters=function(){
    const q=document.getElementById('searchInput')?.value||'';
    const cat=fold(typeof currentFilter!=='undefined'?currentFilter:'all');
    const filtered=(typeof docsData!=='undefined'?docsData:[]).filter(d=>{
      const row=Object.values(d||{}).join(' ');
      const category=fold(d.chapter||d.mon||d.Mon||d['Môn']||d.category||d.chude||row);
      const categoryAliases={ielts:'ngoai ngu',anh:'ngoai ngu','ngoai ngu':'ngoai ngu',hoa:'hoa hoc','hoa hoc':'hoa hoc',ly:'vat ly','vat ly':'vat ly',physics:'vat ly',gdk:'gdktpl','gdktpl':'gdktpl',gdkt:'gdktpl','dia':'dia ly','dia ly':'dia ly',dgnl:'dgnl','danh gia nang luc':'dgnl'};
      const normalizedCat=categoryAliases[cat]||cat;
      const matchQ=fuzzyMatch(q,row);
      const matchCat=cat==='all'||category.includes(normalizedCat)||fold(row).includes(normalizedCat);
      return matchQ&&matchCat;
    });
    renderDocs(filtered);
  };
  window.filterDocs=function(category){ currentFilter=category; document.querySelectorAll('.filter-btn').forEach(btn=>{ const on=btn.innerText.trim()===(category==='all'?'Tất cả':category); btn.classList.toggle('bg-blue-600',on); btn.classList.toggle('text-white',on); btn.classList.toggle('bg-slate-100',!on); btn.classList.toggle('text-slate-600',!on); }); applyFilters(); };

  // Autosave bài thi + khôi phục sau reload.
  function draftKey(){ const uid=(auth&&auth.currentUser&&auth.currentUser.uid)||'guest'; return STORE.examPrefix+(currentRoomId||'none')+'.'+uid; }
  function saveDraft(){
    if(!currentRoomId) return;
    storeSet(draftKey(),{answers:(typeof answers!=='undefined'?answers:{}),marked:{},savedAt:Date.now()});
  }
  function restoreDraft(){
    const d=storeGet(draftKey()); if(!d?.answers) return;
    Object.entries(d.answers).forEach(([q,v])=>{
      if(q.startsWith('short_')){ const el=document.getElementById('input-'+q); if(el) el.value=v; }
      else document.querySelector(`input[name="${CSS.escape(q)}"][value="${CSS.escape(v)}"]`)?.click();
    });
    toast('♻️ Đã khôi phục câu trả lời đang làm dở.');
  }
  const teacherDraftKey=()=>{
    const uid=(auth&&auth.currentUser&&auth.currentUser.uid)||'guest';
    return 'htvvm.teacherDraft.'+uid;
  };
  const originalSaveKey=window.saveKey;
  window.saveKey=function(q,v){
    if(typeof originalSaveKey==='function') originalSaveKey(q,v); else correctAnswers[q]=String(v).trim();
    const d=storeGet(teacherDraftKey(),{}); d[q]=String(v).trim(); storeSet(teacherDraftKey(),d);
  };
  const originalBuildTeacherSheet=window.buildTeacherSheet;
  window.buildTeacherSheet=function(){
    const title=document.getElementById('teacher-exam-title')?.value?.trim();
    if(title) storeSet('htvvm.teacherMeta.'+((auth&&auth.currentUser&&auth.currentUser.uid)||'guest'),{title,time:document.getElementById('teacher-time')?.value,abcd:document.getElementById('numABCD')?.value,tf:document.getElementById('numTF')?.value,short:document.getElementById('numShort')?.value,pdf:document.getElementById('teacher-pdf-url')?.value});
    originalBuildTeacherSheet();
    const saved=storeGet(teacherDraftKey(),{});
    Object.entries(saved||{}).forEach(([q,v])=>{
      if(q.startsWith('short_')){const el=document.getElementById('input-'+q);if(el)el.value=v;}
      else document.querySelector(`input[name="${CSS.escape(q)}"][value="${CSS.escape(v)}"]`)?.click();
    });
  };
  const originalStartExam=window.startExam;
  window.startExam=async function(){ await originalStartExam(); setTimeout(restoreDraft,150); window._examStartedAt=Date.now(); };
  const originalSaveAns=window.saveAns;
  window.saveAns=function(q,v){ if(typeof originalSaveAns==='function') originalSaveAns(q,v); else answers[q]=String(v).trim(); saveDraft(); };
  const originalSubmitExam=window.submitExam;
  window.submitExam=async function(){ saveDraft(); try{ await originalSubmitExam(); localStorage.removeItem(draftKey()); }catch(e){ throw e; } };
  window.addEventListener('beforeunload',e=>{ if(document.getElementById('sec-taking-exam')?.classList.contains('active')){ saveDraft(); e.preventDefault(); e.returnValue=''; } });

  // Realtime leaderboard
  window.viewLeaderboard=function(id){
    switchSection('sec-leaderboard');
    if(activeBoardRef) activeBoardRef.off('value',activeBoardRef._handler);
    const c=document.getElementById('lb-container'); c.innerHTML='<div class="p-10 text-center font-bold text-slate-500 animate-pulse">Đang kết nối BXH realtime...</div>';
    activeBoardRef=db.ref(`rooms/${id}`);
    const handler=snap=>{
      const room=snap.val()||{}; const results=room.results?Object.values(room.results):[];
      results.sort((a,b)=>(safeNum(b.score)-safeNum(a.score))||(safeNum(a.timeSpent)-safeNum(b.timeSpent)));
      const top=results.slice(0,10);
      if(!top.length){ c.innerHTML=`<div class="p-12 text-center font-bold text-slate-500 bg-slate-50 rounded-2xl border">Chưa có ai nộp bài.</div>`; return; }
      c.innerHTML=`<div class="p-4 bg-slate-800 text-white font-bold text-lg rounded-t-2xl text-center uppercase tracking-wide">🏆 TOP 10 REALTIME • ${html(room.title||'Đề thi')}</div><div class="overflow-x-auto"><table class="w-full min-w-[600px] lb-table"><thead><tr><th>Hạng</th><th>Họ & Tên</th><th class="text-center">Điểm</th><th class="text-right">Thời gian</th></tr></thead><tbody>${top.map((r,i)=>{const m=Math.floor(safeNum(r.timeSpent)/60),s=safeNum(r.timeSpent)%60;return `<tr><td class="text-center font-black">${i<3?['👑','🥈','🥉'][i]:i+1}</td><td class="font-extrabold">${html(r.name||'Ẩn danh')}</td><td class="text-center text-blue-600 font-black text-xl">${safeNum(r.score).toFixed(2)}</td><td class="text-right font-bold pr-6">${pad(m)}:${pad(s)}</td></tr>`}).join('')}</tbody></table></div><div class="px-4 py-3 text-xs text-slate-400 font-bold text-center bg-slate-50">● Đang cập nhật trực tiếp</div>`;
    };
    handler._room=id; activeBoardRef._handler=handler; activeBoardRef.on('value',handler);
  };

  // Focus Mode
  window.toggleFocusMode=function(){
    focusMode=!focusMode; document.body.classList.toggle('focus-lock',focusMode); const ov=document.getElementById('focus-overlay'); if(ov) ov.classList.toggle('hidden',!focusMode); if(focusMode) syncFocusOverlay();
  };

  document.addEventListener('keydown',e=>{ if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();toggleFocusMode();} if(e.key==='Escape'&&focusMode) toggleFocusMode(); });

  // Chống xao nhãng: nếu đổi tab khi timer đang chạy, tự pause và ghi nhận sự kiện.
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && typeof isPomoRunning!=='undefined' && isPomoRunning){
      focusLostAt=Date.now();
      clearInterval(pomoInterval);
      pomoInterval=null;
      isPomoRunning=false;
      recordSession();
      const btn=document.getElementById('btn-pomo-action');
      if(btn){btn.textContent='TIẾP TỤC'; btn.className='bg-amber-500 hover:bg-amber-600 text-white font-black text-xl px-8 py-5 rounded-2xl transition-all shadow-md w-full';}
      if(typeof enableInputs==='function') enableInputs();
      toast('⏸️ Đã tạm dừng vì bạn rời tab.');
      syncFocusOverlay();
    }
  });

  // Study time is recorded directly by the Pomodoro interval.
  // Do not run a second polling timer here or study points would be counted twice.

  // AI proxy: API key không còn nằm trong browser bundle. Frontend gọi /api/gemini.
  function aiBubble(content, me=false){ const body=document.getElementById('ai-chat-body'); if(!body) return null; const div=document.createElement('div'); div.className=me?'bg-blue-600 text-white p-3 rounded-2xl rounded-tr-none self-end max-w-[85%] font-medium shadow-sm mt-4':'bg-white border border-slate-200 text-slate-800 p-4 rounded-2xl rounded-tl-none self-start max-w-[90%] shadow-sm mt-4 leading-relaxed'; div.innerHTML=me?html(content):html(content).replace(/\n/g,'<br>'); body.appendChild(div); body.scrollTop=body.scrollHeight; if(!me&&window.MathJax) MathJax.typesetPromise([div]).catch(()=>{}); return div; }
  window.askGemini=async function(promptText, base64Image=null, mimeType=null){
    const systemInstruction='Bạn là gia sư Hóa học và Toán học cho học sinh Việt Nam. Hướng dẫn từng bước, ưu tiên gợi ý trước khi cho đáp án hoàn chỉnh. Dùng LaTeX $...$ cho công thức. Nếu là đề thi, nêu rõ dữ kiện, phương pháp, kết quả và kiểm tra đáp số.';
    const resp=await fetch('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction,prompt:promptText,image:base64Image?{data:base64Image,mimeType}:null,history:aiHistory.slice(-10)})});
    let data=null;
    try{ data=await resp.json(); }catch(_){ data=null; }
    if(!resp.ok){
      const msg=data?.error||'AI proxy error';
      const err=new Error(msg);
      err.status=resp.status;
      err.retryable=!!data?.retryable;
      throw err;
    }
    return data?.text||'AI chưa trả về nội dung.';
  };
  window.sendAIMessage=async function(){
    const input=document.getElementById('ai-input'); const text=input?.value.trim(); if(!text)return;
    aiBubble(text,true); input.value='';
    const loading=aiBubble('🤖 AI đang suy nghĩ...');
    try{ const answer=await askGemini(text); aiHistory.push({role:'user',text}); aiHistory.push({role:'model',text:answer}); if(loading) loading.remove(); aiBubble(answer,false); }
    catch(e){
      if(loading) loading.remove();
      let message='❌ Không gọi được AI. ';
      if(e?.retryable || [408,429,500,502,503,504].includes(e?.status)){
        message+='Gemini đang quá tải hoặc tạm thời bận. Hệ thống đã tự thử lại và fallback model; vui lòng gửi lại sau ít giây.';
      }else{
        message+=e?.message||'Kiểm tra cấu hình GEMINI_API_KEY trên Vercel.';
      }
      aiBubble(message);
      console.error('[AI]',e);
    }
  };
  window.handleAIImageUpload=async function(e){
    const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=async ev=>{ const body=document.getElementById('ai-chat-body'); if(body){ const img=document.createElement('img'); img.src=ev.target.result; img.className='self-end max-w-[80%] rounded-2xl shadow-sm border border-slate-200 mt-4'; body.appendChild(img); body.scrollTop=body.scrollHeight; } const loading=aiBubble('🤖 AI đang đọc ảnh và phân tích...'); try{const b64=String(ev.target.result).split(',')[1]; const answer=await askGemini('Hãy đọc ảnh này và hướng dẫn giải bài thật rõ ràng.',b64,file.type); aiHistory.push({role:'user',text:'[Ảnh bài tập]'}); aiHistory.push({role:'model',text:answer}); if(loading)loading.remove(); aiBubble(answer,false);}catch(err){if(loading)loading.remove();aiBubble('❌ Không xử lý được ảnh.');console.error(err);} }; reader.readAsDataURL(file); e.target.value='';
  };

  // Khởi động lớp tối ưu sau khi DOM sẵn sàng.
  document.addEventListener('DOMContentLoaded',()=>{
    startWebVisitTimer();
    ensureTodayStore();
    updatePomoUI();
    updateRankUI();
    updateStudyDashboard();
    if(typeof auth!=='undefined' && auth) auth.onAuthStateChanged(u=>{ if(u) loadRole(u); });
    const input=document.getElementById('searchInput'); if(input) input.setAttribute('autocomplete','off');
  });
})();



/* ============================================================
   Exam room services
   - Ai đăng nhập cũng được tạo phòng
   - Tên đề KHÔNG dùng làm định danh
   - Mã phòng 6 ký tự là định danh duy nhất
   - Link chia sẻ: ?room=XXXXXX
   - Có copy link / copy mã / QR / mở phòng
   ============================================================ */
(function(){
  const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let createdRoomCode = '';
  let createdRoomLink = '';
  let roomRouteHandled = false;

  function randomRoomCode(){
    let out='';
    const arr = new Uint32Array(6);
    crypto.getRandomValues(arr);
    for(let i=0;i<6;i++) out += ROOM_ALPHABET[arr[i] % ROOM_ALPHABET.length];
    return out;
  }

  async function makeUniqueRoomCode(){
    for(let i=0;i<8;i++){
      const code=randomRoomCode();
      const snap=await (window.db || db).ref('rooms/'+code).once('value');
      if(!snap.exists()) return code;
    }
    throw new Error('Không tạo được mã phòng duy nhất. Hãy thử lại.');
  }

  function getRoomLink(code){
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', code);
    return url.toString();
  }

  function getRoomCodeFromUrl(){
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('room') || '').trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(code) ? code : '';
  }

  function currentCreator(){
    const u = (window.auth && auth.currentUser) ? auth.currentUser : null;
    return {
      uid: u?.uid || '',
      name: u?.displayName || (u?.email ? u.email.split('@')[0] : 'Học viên')
    };
  }

  function setSharePanel(room){
    createdRoomCode = room.code;
    createdRoomLink = getRoomLink(room.code);
    const p=document.getElementById('room-share-panel');
    if(!p) return;
    p.classList.remove('hidden');
    document.getElementById('created-room-code').textContent=room.code;
    document.getElementById('created-room-meta').textContent=`${room.title} • ${room.config.timeLimit || 0} phút`;
    document.getElementById('created-room-link').textContent=createdRoomLink;
    document.getElementById('room-qr').src='https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data='+encodeURIComponent(createdRoomLink);
    const qr=document.getElementById('room-qr-box');
    if(qr) qr.classList.add('hidden');
  }

  window.copyCreatedRoomLink = async function(){
    if(!createdRoomLink) return;
    try{
      await navigator.clipboard.writeText(createdRoomLink);
      alert('✅ Đã sao chép link phòng!');
    }catch(e){
      window.prompt('Copy link phòng:', createdRoomLink);
    }
  };

  window.copyCreatedRoomCode = async function(){
    if(!createdRoomCode) return;
    try{
      await navigator.clipboard.writeText(createdRoomCode);
      alert('✅ Đã sao chép mã phòng: '+createdRoomCode);
    }catch(e){
      window.prompt('Copy mã phòng:', createdRoomCode);
    }
  };

  window.showRoomQR = function(){
    const qr=document.getElementById('room-qr-box');
    if(qr) qr.classList.toggle('hidden');
  };

  window.openCreatedRoom = function(){
    if(createdRoomCode) window.location.href=getRoomLink(createdRoomCode);
  };

  /* Creator Studio: ai đăng nhập cũng tạo được */
  window.__createRoomV2 = async function(){
    const btn=document.getElementById('create-room-btn');
    const title=String(document.getElementById('teacher-exam-title')?.value || '').trim();
    if(!title) return alert('❌ Nhập tên đề trước nhé!');

    // Chờ Firebase khởi tạo thay vì kiểm tra window.db quá sớm.
    try {
      if (!window.__firebaseReady) await initFirebase();
    } catch(e) {
      console.error('Firebase readiness error:', e);
      return alert('❌ Firebase không khởi tạo được: ' + (e?.message || e));
    }

    const database = window.db || db;
    if(!database) return alert('❌ Firebase Database chưa sẵn sàng. Hãy tải lại trang.');

    const creator=currentCreator();
    if(!creator.uid){
      return alert('❌ Bạn cần đăng nhập để tạo phòng.');
    }

    if(btn){ btn.disabled=true; btn.textContent='⏳ Đang tạo phòng...'; }
    try{
      const code=await makeUniqueRoomCode();
      const room={
        code,
        title,
        creatorUid:creator.uid,
        creatorName:creator.name,
        createdAt:Date.now(),
        status:'open',
        config:{...examConfig},
        answers:{...correctAnswers}
      };

      await database.ref('rooms/'+code).set(room);
      setSharePanel(room);
      switchSection('sec-teacher-key');
      alert(`✅ Tạo phòng thành công!\n\nMã phòng: ${code}`);
    }catch(e){
      console.error(e);
      alert('❌ Lỗi tạo phòng: '+(e?.message || e));
    }finally{
      if(btn){ btn.disabled=false; btn.textContent='🚀 Tạo phòng'; }
    }
  };

  // Public API duy nhất mà HTML button gọi.
  window.createRoomToFirebase = window.__createRoomV2;

  /* Load danh sách theo room code, vẫn cho phép vào phòng theo link */
  window.loadExamList = async function(){
    switchSection('sec-exam-list');
    const c=document.getElementById('live-exams-container');
    if(!c) return;
    c.innerHTML='<div class="col-span-full p-12 text-center font-bold text-slate-500 bg-slate-50 rounded-2xl animate-pulse">Đang tải danh sách phòng thi...</div>';
    try{
      const s=await (window.db || db).ref('rooms').once('value');
      const rooms=[];
      if(s.exists()) s.forEach(x=>{
        const r=x.val();
        if(r?.config) rooms.push({id:x.key,...r,code:r.code||x.key});
      });
      rooms.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      if(!rooms.length){
        c.innerHTML='<div class="col-span-full p-12 text-center font-bold text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">Chưa có phòng thi nào đang mở.</div>';
        return;
      }
      c.innerHTML=rooms.map(r=>{
        const total=(+r.config.abcd||0)+(+r.config.tf||0)+(+r.config.short||0);
        const link=getRoomLink(r.code);
        const creator=esc(r.creatorName||'Người tạo');
        const own=(currentCreator().uid && r.creatorUid===currentCreator().uid);
        return `<article class="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col hover:-translate-y-1 transition-transform duration-300">
          <div class="flex justify-between items-start gap-3 mb-3">
            <div class="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-inner"><div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>ĐANG MỞ</div>
            <span class="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-black tracking-[0.18em]">${esc(r.code)}</span>
          </div>
          <h3 class="text-xl font-extrabold text-slate-900 mb-2 line-clamp-2">${esc(r.title)}</h3>
          <p class="text-xs font-semibold text-slate-500 mb-5">👤 ${creator}</p>
          <div class="flex flex-wrap gap-2 mb-8 text-xs font-bold text-slate-600">
            <span class="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">⏱ ${r.config.timeLimit||0} phút</span>
            <span class="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">📝 ${total} câu</span>
          </div>
          <div class="mt-auto grid grid-cols-2 gap-2">
            <button onclick="viewLeaderboard('${esc(r.code)}')" class="py-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-extrabold border border-amber-200 text-sm">🏆 BXH</button>
            <button onclick="prepareJoin('${esc(r.code)}')" class="py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold text-sm shadow-md">🚀 VÀO THI</button>
            <button onclick="copyRoomLink('${esc(r.code)}')" class="py-2.5 rounded-xl bg-blue-50 text-blue-700 font-extrabold text-xs">🔗 Link</button>
            <button onclick="copyRoomCode('${esc(r.code)}')" class="py-2.5 rounded-xl bg-slate-50 text-slate-700 font-extrabold text-xs">📋 Mã</button>
            ${own ? `<button onclick="deleteRoom('${esc(r.code)}')" class="col-span-2 py-2.5 rounded-xl bg-rose-50 text-rose-600 font-extrabold text-xs border border-rose-100">🗑 Xóa phòng của tôi</button>` : ''}
          </div>
          <button onclick="showQuickQR('${esc(r.code)}')" class="mt-2 w-full py-2 rounded-xl bg-slate-900 text-white font-extrabold text-xs">▣ Hiện QR</button>
        </article>`;
      }).join('');
    }catch(e){
      c.innerHTML=`<div class="col-span-full p-8 text-center text-red-600 font-bold bg-red-50 rounded-xl border border-red-100">❌ Lỗi tải phòng: ${esc(e?.message||e)}</div>`;
    }
  };

  window.copyRoomLink=async function(code){
    const link=getRoomLink(code);
    try{ await navigator.clipboard.writeText(link); alert('✅ Đã sao chép link: '+link); }
    catch(e){ window.prompt('Copy link:',link); }
  };
  window.copyRoomCode=async function(code){
    try{ await navigator.clipboard.writeText(code); alert('✅ Đã sao chép mã phòng: '+code); }
    catch(e){ window.prompt('Copy mã phòng:',code); }
  };
  window.showQuickQR=function(code){
    const link=getRoomLink(code);
    const html=`<div id="quick-qr-modal" class="fixed inset-0 z-[9999] bg-slate-900/70 flex items-center justify-center p-4" onclick="this.remove()"><div class="bg-white rounded-3xl p-6 text-center shadow-2xl" onclick="event.stopPropagation()"><div class="text-lg font-black mb-2">Mã phòng ${esc(code)}</div><img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(link)}" class="w-64 h-64 mx-auto rounded-xl border" alt="QR"><div class="text-xs text-slate-500 font-semibold mt-3">Quét để vào phòng</div><button onclick="document.getElementById('quick-qr-modal').remove()" class="mt-4 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-extrabold">Đóng</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
  };

  window.deleteRoom=async function(code){
    const me=currentCreator();
    const snap=await (window.db || db).ref('rooms/'+code).once('value');
    const r=snap.val();
    if(!r) return alert('Phòng không tồn tại.');
    if(r.creatorUid!==me.uid) return alert('❌ Bạn chỉ được xóa phòng do chính mình tạo.');
    if(!confirm(`Xóa phòng ${code} - ${r.title}?`)) return;
    await (window.db || db).ref('rooms/'+code).remove();
    alert('✅ Đã xóa phòng.');
    loadExamList();
  };

  window.prepareJoin=async function(id){
    currentRoomId=String(id||'').trim().toUpperCase();
    if(!currentRoomId) return alert('Mã phòng không hợp lệ.');
    try{
      const s=await (window.db || db).ref('rooms/'+currentRoomId).once('value');
      if(!s.exists()) return alert('❌ Không tìm thấy phòng '+currentRoomId+'.');
      const r=s.val();
      document.getElementById('join-title').textContent=r.title||'Phòng thi';
      document.getElementById('join-room-code').textContent='MÃ PHÒNG: '+currentRoomId+(r.creatorName?' • '+r.creatorName:'');
      const pdf=r.config?.pdfUrl||'';
      const pdfEl=document.getElementById('student-pdf');
      if(pdfEl) pdfEl.src=getEmbedUrl(pdf);
      switchSection('sec-student-join');
    }catch(e){ alert('❌ Không thể mở phòng: '+(e?.message||e)); }
  };

  /* Deep-link: domain/?room=ABC123 */
  async function handleRoomRoute(){
    if(roomRouteHandled) return;
    const code=getRoomCodeFromUrl();
    if(!code || !window.db) return;
    if(window.auth && !auth.currentUser) return; // chờ đăng nhập xong rồi mới mở phòng
    try{
      const snap=await (window.db || db).ref('rooms/'+code).once('value');
      if(!snap.exists()) return;
      roomRouteHandled=true;
      await prepareJoin(code);
    }catch(e){ console.error('Room route:',e); }
  }
  window.addEventListener('load',()=>setTimeout(handleRoomRoute,900));
  if(window.auth) window.auth.onAuthStateChanged(()=>setTimeout(handleRoomRoute,400));
})();



(function(){
  const ids=['numABCD','numTF','numShort'];
  function updateTotal(){
    let total=0; ids.forEach(id=>{const el=document.getElementById(id); total+=Number(el?.value||0)});
    const out=document.getElementById('total-preview'); if(out) out.textContent=total;
  }
  document.addEventListener('input',e=>{ if(ids.includes(e.target?.id)) updateTotal(); });
  document.addEventListener('DOMContentLoaded',updateTotal);
})();
// ==========================================
// 💡 HỆ THỐNG CÔNG TẮC SÁNG / TỐI (DARK MODE TOGGLE)
// ==========================================

function applyTheme(theme) {
  const dark = theme !== 'light';
  document.documentElement.classList.toggle('htvvm-dark-mode', dark);
  document.body.classList.toggle('htvvm-dark-mode', dark);
  const button = document.getElementById('theme-toggle-btn');
  if (button) button.innerText = dark ? '☀️' : '🌙';
  localStorage.setItem('htvvm_theme', dark ? 'dark' : 'light');
}

function toggleTheme() {
  const current = localStorage.getItem('htvvm_theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem('htvvm_theme') || 'dark');
});

// ==========================================
// 📹 HỆ THỐNG PHÒNG HỌC ẢO (JITSI MEET INTEGRATION)
// ==========================================
let studyRoomApi = null;

function joinStudyRoom() {
    const container = document.getElementById('study-room-container');
    // Tìm cái nút bấm để đổi chữ (Ní nhớ thêm id="btn-study-room" vào thẻ button trên HTML nha, không có thì bỏ qua dòng này)
    const btn = document.querySelector('button[onclick="joinStudyRoom()"]'); 

    // Nếu ĐANG TRONG PHÒNG -> Bấm cái nữa là TẮT PHÒNG
    if (studyRoomApi) {
        studyRoomApi.dispose(); // Phá hủy hoàn toàn khung Jitsi
        studyRoomApi = null;
        container.classList.add('hidden'); // Ẩn khung đen đi
        if (btn) btn.innerHTML = "VÀO PHÒNG NGAY"; // Đổi lại chữ
        return;
    }

    // Nếu CHƯA VÀO PHÒNG -> Mở phòng
    container.classList.remove('hidden');
    if (btn) btn.innerHTML = "TẮT PHÒNG";

    let userName = "Học viên ẩn danh";
    if (typeof auth !== 'undefined' && auth.currentUser) {
        userName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
    }

    const domain = 'meet.jit.si';
    const options = {
        roomName: 'HTVVM_StudyRoom_VIP_2026',
        width: '100%',
        height: '100%',
        parentNode: container,
        userInfo: {
            displayName: userName
        },
        configOverwrite: { 
            startWithAudioMuted: true, 
            startWithVideoMuted: false, 
            prejoinPageEnabled: false   
        },
        interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'profile', 'chat',
                'settings', 'raisehand', 'videoquality', 'filmstrip',
                'tileview', 'select-background'
            ],
        },
    };
    
    studyRoomApi = new JitsiMeetExternalAPI(domain, options);

    // 🚀 THUẬT TOÁN ANTI-QUẢNG CÁO 🚀
    // Lắng nghe sự kiện: Ngay khi học sinh bấm cúp máy trong Jitsi
    studyRoomApi.addListener('readyToClose', () => {
        // 1. Phá hủy ngay lập tức cái iframe để nó không hiện quảng cáo
        if (studyRoomApi) studyRoomApi.dispose();
        studyRoomApi = null;
        
        // 2. Đóng khung lại và đổi chữ nút bấm về như cũ
        container.classList.add('hidden');
        if (btn) btn.innerHTML = "VÀO PHÒNG NGAY";
    });
}



/* ==========================================================================
   LỚP CHỐNG "XEM TRỘM" (DETERRENT) — không phải bảo mật tuyệt đối!
   Trình duyệt LUÔN LUÔN phải tải HTML/CSS/JS xuống máy người dùng để chạy
   được trang web, nên KHÔNG có cách nào giấu 100% mã nguồn phía client.
   Đoạn này chỉ làm khó người dùng phổ thông (chặn chuột phải, phím tắt
   mở DevTools, cảnh báo khi phát hiện DevTools đang mở) — người rành kỹ
   thuật vẫn có cách vượt qua. Bảo mật DỮ LIỆU THẬT phải nằm ở Firebase
   Security Rules / backend, không thể chỉ dựa vào đoạn script này.
   ========================================================================== */
(function () {
  // 1) Chặn chuột phải (mở menu "Inspect")
  document.addEventListener('contextmenu', e => e.preventDefault());

  // 2) Chặn các phím tắt mở DevTools / xem mã nguồn phổ biến
  document.addEventListener('keydown', e => {
    const k = e.key ? e.key.toUpperCase() : '';
    if (
      k === 'F12' ||
      (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'J' || k === 'C')) ||
      (e.ctrlKey && k === 'U') ||
      (e.metaKey && e.altKey && (k === 'I' || k === 'J' || k === 'C')) // macOS
    ) {
      e.preventDefault();
    }
  });
})();



let calendarCursor = new Date();
let calendarEvents = {};
let calendarEventsRef = null;
let calendarEventsBoundForUid = null;

function openCalendar(){
  const m=document.getElementById('calendar-modal');
  if(!m) return;
  calendarCursor=new Date();
  m.classList.remove('hidden');
  m.classList.add('flex');
  const today=calendarKeyFromDate(new Date());
  if(!document.getElementById('calendar-event-date').value) document.getElementById('calendar-event-date').value=today;
  renderCalendar();
  renderCalendarEventList();
}
function closeCalendar(){
  const m=document.getElementById('calendar-modal');
  if(!m) return;
  m.classList.add('hidden');
  m.classList.remove('flex');
}
function changeCalendarMonth(delta){calendarCursor.setMonth(calendarCursor.getMonth()+delta,1);renderCalendar();}
function goCalendarToday(){calendarCursor=new Date();renderCalendar();}
function calendarPad(n){return String(n).padStart(2,'0');}
function calendarKey(y,m,d){return `${y}-${calendarPad(m+1)}-${calendarPad(d)}`;}
function calendarKeyFromDate(d){return calendarKey(d.getFullYear(),d.getMonth(),d.getDate());}
function escCalendar(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function getCalendarUser(){return window.auth?.currentUser||null;}
function calendarEventsStorageKey(uid){return `htvvm.calendar.events.${uid}`;}
function loadCalendarEventsCache(uid){
  try{ const raw=localStorage.getItem(calendarEventsStorageKey(uid)); calendarEvents=raw?JSON.parse(raw):{}; }
  catch{ calendarEvents={}; }
}
function saveCalendarEventsCache(uid){try{localStorage.setItem(calendarEventsStorageKey(uid),JSON.stringify(calendarEvents));}catch{} }
function normalizeCalendarEvent(v,id){
  return {id:id||v?.id||'',title:String(v?.title||'Sự kiện'),date:String(v?.date||''),time:String(v?.time||''),note:String(v?.note||''),createdAt:Number(v?.createdAt||0)};
}
function calendarEventMoment(ev){
  if(!ev?.date) return NaN;
  const time=ev.time||'23:59';
  return new Date(`${ev.date}T${time}:00`).getTime();
}
function calendarEventDayDiff(ev,now=new Date()){
  const [y,m,d]=String(ev.date||'').split('-').map(Number);
  if(!y||!m||!d) return null;
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const target=new Date(y,m-1,d);
  return Math.round((target-start)/86400000);
}
function sortedUpcomingCalendarEvents(){
  const now=Date.now();
  return Object.values(calendarEvents||{})
    .map(e=>normalizeCalendarEvent(e,e.id))
    .filter(e=>Number.isFinite(calendarEventMoment(e)) && calendarEventMoment(e)>=now-60000)
    .sort((a,b)=>calendarEventMoment(a)-calendarEventMoment(b));
}

async function initCalendarEventsForUser(user){
  const uid=user?.uid;
  if(calendarEventsRef && typeof calendarEventsRef.off==='function') { try{calendarEventsRef.off();}catch{} }
  calendarEventsRef=null; calendarEventsBoundForUid=null; calendarEvents={};
  if(!uid){ renderCalendarEventList(); renderDashboardUpcomingEvents(); return; }
  loadCalendarEventsCache(uid);
  renderCalendar(); renderCalendarEventList(); renderDashboardUpcomingEvents();
  try{
    const database=window.db||((typeof db!=='undefined')?db:null);
    if(!database)return;
    calendarEventsRef=database.ref(`users/${uid}/calendarEvents`);
    calendarEventsRef.on('value',snap=>{
      const next={};
      snap.forEach(child=>{ const ev=normalizeCalendarEvent(child.val()||{},child.key); next[child.key]=ev; });
      calendarEvents=next; saveCalendarEventsCache(uid); calendarEventsBoundForUid=uid;
      renderCalendar(); renderCalendarEventList(); renderDashboardUpcomingEvents();
    },err=>{
      console.warn('calendar events realtime',err);
      renderCalendarEventList(); renderDashboardUpcomingEvents();
    });
  }catch(e){console.warn('calendar events bind',e);}
}

function ensureCalendarEventsBinding(){
  const u=getCalendarUser();
  if(u && calendarEventsBoundForUid!==u.uid) initCalendarEventsForUser(u);
  if(!u && calendarEventsBoundForUid){initCalendarEventsForUser(null);}
}

async function loadCalendarStudyDays(){
  try{
    if(!(typeof auth!=='undefined' && auth && auth.currentUser && typeof db!=='undefined' && db)) return;
    const snap=await db.ref(`users/${auth.currentUser.uid}/dailyStudy`).once('value');
    window.__calendarStudyDays=snap.val()||{};
  }catch(e){console.warn('calendar study days',e);window.__calendarStudyDays={};}
}
function calendarStoredStudyDays(){try{return window.__calendarStudyDays||{};}catch{return {};}}

async function renderCalendar(){
  const title=document.getElementById('calendar-month-title'), daysEl=document.getElementById('calendar-days');
  if(!title||!daysEl) return;
  ensureCalendarEventsBinding();
  title.textContent=`Tháng ${calendarCursor.getMonth()+1} ${calendarCursor.getFullYear()}`;
  await loadCalendarStudyDays();
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  const mondayIndex=(first.getDay()+6)%7, cells=[];
  for(let i=0;i<mondayIndex;i++){const d=new Date(y,m,1-(mondayIndex-i));cells.push({d,muted:true});}
  for(let d=1;d<=last.getDate();d++)cells.push({d:new Date(y,m,d),muted:false});
  while(cells.length%7){const next=new Date(y,m+1,cells.length-(mondayIndex+last.getDate())+1);cells.push({d:next,muted:true});}
  const now=new Date(),today=calendarKeyFromDate(now),study=calendarStoredStudyDays();
  const eventsByDate={};
  Object.values(calendarEvents||{}).forEach(ev=>{if(ev.date)(eventsByDate[ev.date]??=[]).push(ev);});
  daysEl.innerHTML=cells.map(({d,muted})=>{
    const key=calendarKeyFromDate(d),studied=Number(study[key]||0)>0,hasEvent=Boolean(eventsByDate[key]?.length);
    const cls=['calendar-day',muted?'muted':'',key===today?'today':'',studied?'studied':'',hasEvent?'has-event':''].filter(Boolean).join(' ');
    const mins=Math.floor(Number(study[key]||0)/60);
    const eventText=hasEvent?` • ${eventsByDate[key].map(e=>e.title).join(', ')}`:'';
    const label=(studied?`${d.getDate()} • ${mins} phút học`:`${d.getDate()}`)+eventText;
    return `<button type="button" class="${cls}" title="${escCalendar(label)}" onclick="selectCalendarDate('${key}')">${d.getDate()}</button>`;
  }).join('');
}
function selectCalendarDate(key){
  const dateInput=document.getElementById('calendar-event-date'); if(dateInput)dateInput.value=key;
  const parts=key.split('-').map(Number); if(parts.length===3){calendarCursor=new Date(parts[0],parts[1]-1,1);renderCalendar();}
  document.getElementById('calendar-event-title')?.focus();
}
function resetCalendarEventForm(){
  const form=document.getElementById('calendar-event-form'); if(form)form.reset();
  const id=document.getElementById('calendar-event-id'); if(id)id.value='';
  const date=document.getElementById('calendar-event-date'); if(date)date.value=calendarKeyFromDate(new Date());
  const btn=document.getElementById('calendar-event-save-btn'); if(btn)btn.textContent='LƯU SỰ KIỆN';
}
async function saveCalendarEvent(e){
  e.preventDefault();
  const user=getCalendarUser();
  if(!user)return alert('❌ Bạn cần đăng nhập để lưu sự kiện.');
  const id=document.getElementById('calendar-event-id')?.value.trim();
  const title=document.getElementById('calendar-event-title')?.value.trim();
  const date=document.getElementById('calendar-event-date')?.value;
  const time=document.getElementById('calendar-event-time')?.value||'';
  const note=document.getElementById('calendar-event-note')?.value.trim()||'';
  if(!title||!date)return alert('❌ Hãy nhập tên và ngày sự kiện.');
  const eventData={title,date,time,note,createdAt:id?(calendarEvents[id]?.createdAt||Date.now()):Date.now(),updatedAt:Date.now()};
  try{
    const database=window.db||((typeof db!=='undefined')?db:null);
    if(!database)throw new Error('Firebase Database chưa sẵn sàng.');
    const ref=database.ref(`users/${user.uid}/calendarEvents`);
    if(id)await ref.child(id).update(eventData);else await ref.push(eventData);
    resetCalendarEventForm();
    alert('✅ Đã lưu sự kiện. Trang chủ sẽ tự cập nhật đếm ngược.');
  }catch(err){
    console.warn('save calendar event',err);
    // Fallback local cache nếu Firebase tạm lỗi.
    const eventId=id||`local-${Date.now()}`;
    calendarEvents[eventId]={id:eventId,...eventData};saveCalendarEventsCache(user.uid);renderCalendar();renderCalendarEventList();renderDashboardUpcomingEvents();
    resetCalendarEventForm();
    alert('⚠️ Firebase đang lỗi tạm thời, sự kiện đã được lưu trên thiết bị này.');
  }
}
async function deleteCalendarEvent(id){
  const ev=calendarEvents?.[id]; if(!ev)return;
  if(!confirm(`Xóa sự kiện “${ev.title}”?`))return;
  const user=getCalendarUser();
  try{
    const database=window.db||((typeof db!=='undefined')?db:null);
    if(database && !String(id).startsWith('local-')) await database.ref(`users/${user.uid}/calendarEvents/${id}`).remove();
  }catch(err){console.warn('delete calendar event',err);}
  delete calendarEvents[id];if(user)saveCalendarEventsCache(user.uid);renderCalendar();renderCalendarEventList();renderDashboardUpcomingEvents();
}
function editCalendarEvent(id){
  const ev=calendarEvents?.[id];if(!ev)return;
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
  set('calendar-event-id',ev.id);set('calendar-event-title',ev.title);set('calendar-event-date',ev.date);set('calendar-event-time',ev.time);set('calendar-event-note',ev.note);
  const btn=document.getElementById('calendar-event-save-btn');if(btn)btn.textContent='CẬP NHẬT SỰ KIỆN';
  document.getElementById('calendar-event-title')?.focus();
}
function calendarFormatDate(dateStr){
  const [y,m,d]=String(dateStr||'').split('-').map(Number);if(!y||!m||!d)return dateStr||'';
  return new Date(y,m-1,d).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function calendarDaysLabel(ev){
  const diff=calendarEventDayDiff(ev);
  if(diff===0)return 'Hôm nay';
  if(diff===1)return 'Ngày mai';
  if(diff>1)return `Còn ${diff} ngày`;
  if(diff<0)return `Đã qua ${Math.abs(diff)} ngày`;
  return '';
}
function renderCalendarEventList(){
  const box=document.getElementById('calendar-event-list'),count=document.getElementById('calendar-event-count');if(!box)return;
  const events=Object.values(calendarEvents||{}).map(e=>normalizeCalendarEvent(e,e.id)).sort((a,b)=>{
    const am=calendarEventMoment(a),bm=calendarEventMoment(b);return (am||Infinity)-(bm||Infinity);
  });
  const upcoming=events.filter(e=>calendarEventMoment(e)>=Date.now()-60000);
  if(count)count.textContent=`${events.length} sự kiện`;
  if(!events.length){box.innerHTML='<div class="dashboard-event-empty">Chưa có sự kiện nào. Đặt mốc đầu tiên ngay bên trên.</div>';return;}
  const visible=(upcoming.length?upcoming:events).slice(0,10);
  box.innerHTML=visible.map(ev=>{
    const diff=calendarDaysLabel(ev),done=calendarEventMoment(ev)<Date.now()-60000;
    return `<div class="calendar-event-item ${done?'opacity-60':''}"><div class="calendar-event-datebox"><b>${escCalendar(ev.date.slice(8,10))}</b><span>${escCalendar(ev.date.slice(5,7))}/${escCalendar(ev.date.slice(0,4))}</span></div><div class="min-w-0 flex-1"><div class="font-black text-white truncate">${escCalendar(ev.title)}</div><div class="text-xs text-slate-500 mt-1">${escCalendar(ev.time||'Cả ngày')} · ${escCalendar(diff)}</div>${ev.note?`<div class="text-xs text-slate-400 mt-1 truncate">${escCalendar(ev.note)}</div>`:''}</div><button class="calendar-event-delete shrink-0" title="Xóa" onclick="deleteCalendarEvent('${escCalendar(ev.id)}')">✕</button></div>`;
  }).join('');
}
function renderDashboardUpcomingEvents(){
  const box=document.getElementById('dashboard-upcoming-event-body');if(!box)return;
  const events=sortedUpcomingCalendarEvents();
  if(!events.length){box.innerHTML='<div class="dashboard-event-empty">Chưa có sự kiện sắp tới. Bấm “Mở lịch” để đặt một mốc quan trọng.</div>';return;}
  const ev=events[0];
  const diff=calendarEventDayDiff(ev),days=Number(diff);
  let big=days>0?days:days===0?'0':'—',label=days===0?'Hôm nay':days===1?'Ngày mai':days>1?'Ngày nữa':(calendarEventMoment(ev)-Date.now()<86400000?'Đang diễn ra':'Sắp tới');
  box.innerHTML=`<div class="dashboard-event-card"><div class="min-w-0 flex-1"><div class="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">${escCalendar(calendarFormatDate(ev.date))}${ev.time?` · ${escCalendar(ev.time)}`:''}</div><div class="text-2xl font-black text-white mt-1 truncate">${escCalendar(ev.title)}</div>${ev.note?`<div class="text-sm text-slate-400 mt-2">${escCalendar(ev.note)}</div>`:''}<div class="text-sm font-bold text-slate-400 mt-3">${escCalendar(label)}</div></div><div class="dashboard-event-days"><strong>${big}</strong><span>${days>1?'ngày':'trạng thái'}</span></div></div>`;
}

// Đồng bộ Firebase/Auth -> lịch sự kiện.
document.addEventListener('DOMContentLoaded',()=>{
  const bind=()=>{
    const a=window.auth;
    if(a&&typeof a.onAuthStateChanged==='function'){
      a.onAuthStateChanged(user=>initCalendarEventsForUser(user));
      if(a.currentUser)initCalendarEventsForUser(a.currentUser);
    }
  };
  setTimeout(bind,300);
  setInterval(()=>{renderDashboardUpcomingEvents();},30000);
});
window.addEventListener('beforeunload',()=>{try{calendarEventsRef?.off();}catch{}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCalendar();});



(function(){
  const src=()=>document.getElementById('web-time-counter'), dst=()=>document.getElementById('dashboard-web-time');
  setInterval(()=>{ const a=src(),b=dst(); if(a&&b) b.textContent=a.textContent; },500);

  // Mirror "Mục tiêu hôm nay" (sec-study) lên khối tóm tắt của Dashboard — chỉ đọc, không đổi logic gốc.
  function mirrorText(fromId,toId,transform){
    const a=document.getElementById(fromId), b=document.getElementById(toId);
    if(a&&b) b.textContent = transform ? transform(a.textContent) : a.textContent;
  }
  setInterval(()=>{
    const nameEl=document.getElementById('user-display-name');
    const greetEl=document.getElementById('dashboard-greeting');
    if(nameEl && greetEl){
      const name=nameEl.textContent||'';
      greetEl.textContent = (name && name!=='Đang kết nối...') ? `Xin chào, ${name} 👋` : 'Xin chào 👋';
    }
    mirrorText('profile-streak','dashboard-streak');
    mirrorText('today-goal-label','dashboard-goal-label');
    mirrorText('today-goal-text','dashboard-goal-text');
    mirrorText('today-session-count','dashboard-session-count');
    const p=document.getElementById('today-goal-progress'), dp=document.getElementById('dashboard-goal-progress');
    if(p&&dp) dp.style.width = p.style.width || '0%';
  },500);
})();



(function(){
  let communityFeedRef=null;
  let communityBound=false;
  let communityLastPosts=[];
  let communityAuthorAvatarRefs={};
  const cesc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const ctime=ts=>new Date(Number(ts)||Date.now()).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const defaultAvatar=name=>`https://ui-avatars.com/api/?name=${encodeURIComponent(String(name||'H').charAt(0).toUpperCase())}&background=0891B2&color=fff&bold=true`;

  function getCommunityUser(){
    const u=(window.auth&&window.auth.currentUser)?window.auth.currentUser:null;
    if(!u) return null;
    let finalAvt=window.__communityAvatar||'';
    const navAvt=document.getElementById('nav-avatar');
    if(!finalAvt&&navAvt?.src&&!navAvt.src.includes('ui-avatars.com')) finalAvt=navAvt.src;
    if(!finalAvt) finalAvt=u.photoURL||'';
    return {uid:u.uid,name:(u.displayName||(u.email?u.email.split('@')[0]:'Học viên')).trim()||'Học viên',photoURL:finalAvt};
  }
  window.cuser=getCommunityUser;

  async function getCommunityDb(){
    if(!window.__firebaseReady&&typeof initFirebase==='function') await initFirebase();
    const database=window.db||((typeof db!=='undefined')?db:null);
    if(!database) throw new Error('Firebase Database chưa sẵn sàng.');
    if(!getCommunityUser()) throw new Error('Bạn cần đăng nhập để sử dụng cộng đồng.');
    return database;
  }

  function postAvatar(p){
    const u=getCommunityUser();
    if(u&&p.authorUid===u.uid&&u.photoURL)return u.photoURL;
    return p.photoURL||p.photoUrl||p.avatarURL||communityAuthorAvatarRefs[p.authorUid]||defaultAvatar(p.authorName);
  }
  function commentAvatar(c){
    const u=getCommunityUser();
    if(u&&c.authorUid===u.uid&&u.photoURL)return u.photoURL;
    return c.photoURL||c.photoUrl||c.avatarURL||communityAuthorAvatarRefs[c.authorUid]||defaultAvatar(c.authorName);
  }

  function renderPosts(posts){
    const feed=document.getElementById('community-feed');
    if(!feed)return;
    communityLastPosts=posts||[];
    const activeEl=document.activeElement;
    let activeId=null,activeVal='';
    if(activeEl?.id?.startsWith('comment-')){activeId=activeEl.id;activeVal=activeEl.value;}
    const currentUser=getCommunityUser();

    if(!posts.length){
      feed.innerHTML='<div class="rounded-2xl border border-white/10 bg-slate-900/60 p-12 text-center text-slate-500 font-bold">Chưa có bài viết nào. Hãy là người đầu tiên hỏi bài.</div>';
    }else{
      feed.innerHTML=posts.map(p=>{
        const comments=p.comments&&typeof p.comments==='object'
          ?Object.entries(p.comments).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)) : [];
        const avatar=`<img src="${cesc(postAvatar(p))}" data-community-avatar-uid="${cesc(p.authorUid||'')}" class="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" alt="Avatar" loading="lazy" referrerpolicy="no-referrer">`;
        const ch=comments.slice(-8).map(c=>{
          const av=`<img src="${cesc(commentAvatar(c))}" data-community-avatar-uid="${cesc(c.authorUid||'')}" class="w-8 h-8 rounded-full object-cover shrink-0 border border-white/5" alt="Avatar" loading="lazy" referrerpolicy="no-referrer">`;
          return `<div class="flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">${av}<div class="min-w-0"><div class="text-xs font-black text-slate-200">${cesc(c.authorName||'Học viên')} <span class="text-slate-600 font-bold ml-1">${ctime(c.createdAt)}</span></div><div class="text-sm text-slate-300 mt-1 whitespace-pre-wrap break-words community-post-body">${cesc(c.body||'')}</div></div></div>`;
        }).join('');
        const likes=p.likes&&typeof p.likes==='object'?p.likes:{};
        const likeCount=Object.keys(likes).length;
        const isLiked=!!(currentUser&&likes[currentUser.uid]);
        const heartIcon=isLiked?'❤️':'🤍';
        const heartColor=isLiked?'text-rose-500 bg-rose-500/10 border-rose-500/30':'text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border-white/5 hover:border-rose-500/20';
        return `<article class="rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-xl overflow-hidden"><div class="p-5 sm:p-6"><div class="flex items-start gap-3">${avatar}<div class="min-w-0 flex-1"><div class="font-black text-white truncate community-post-author">${cesc(p.authorName||'Học viên')}</div><div class="text-xs text-slate-500 mt-0.5">${ctime(p.createdAt||p.updatedAt)} · ${cesc(p.subject||'Khác')}</div></div></div><h3 class="text-xl font-black text-white mt-4 community-post-author">${cesc(p.title||'Không có tiêu đề')}</h3><div class="text-slate-300 mt-3 leading-relaxed whitespace-pre-wrap break-words community-post-body">${cesc(p.body||'')}</div></div><div class="px-5 sm:px-6 py-4 border-t border-white/5 bg-white/[0.02]"><div class="flex items-center justify-between mb-3"><button onclick="toggleCommunityLike('${cesc(p.id)}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all font-black text-sm ${heartColor}"><span>${heartIcon}</span> ${likeCount}</button><div class="text-xs font-black text-slate-500 uppercase tracking-wider">💬 ${comments.length} bình luận</div></div><div class="space-y-2.5">${ch||'<div class="text-sm text-slate-600 italic">Chưa có bình luận. Giải giúp bạn đầu tiên nào.</div>'}</div><div class="mt-4 flex gap-2"><input id="comment-${cesc(p.id)}" maxlength="1000" class="tw-input flex-1" placeholder="Viết cách giải hoặc góp ý..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();addCommunityComment(\'${cesc(p.id)}\')}" /><button onclick="addCommunityComment('${cesc(p.id)}')" class="px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black">Gửi</button></div></div></article>`;
      }).join('');
    }
    if(activeId)setTimeout(()=>{const el=document.getElementById(activeId);if(el){el.focus();el.value=activeVal;}},10);
  }

  async function syncCommunityAuthorAvatars(posts){
    const database=window.db||((typeof db!=='undefined')?db:null);
    if(!database||!posts?.length)return;
    const uids=[...new Set(posts.flatMap(p=>[p.authorUid,...(p.comments&&typeof p.comments==='object'?Object.values(p.comments).map(c=>c?.authorUid):[])]).filter(Boolean))];
    await Promise.all(uids.map(async uid=>{
      const me=getCommunityUser();
      if(me&&uid===me.uid&&me.photoURL){communityAuthorAvatarRefs[uid]=me.photoURL;return;}
      if(communityAuthorAvatarRefs[uid])return;
      try{
        const snap=await database.ref(`users/${uid}`).once('value');
        const data=snap.val()||{};
        const avt=data.customAvatar||data.photoURL||data.avatarURL||'';
        if(avt)communityAuthorAvatarRefs[uid]=avt;
      }catch(e){console.debug('community avatar lookup skipped',uid,e?.message||e);}
    }));
    renderPosts(communityLastPosts);
  }

  async function bindCommunityRealtime(){
    const database=await getCommunityDb();
    const feed=document.getElementById('community-feed');
    if(!feed)return;
    if(communityFeedRef)communityFeedRef.off();
    communityFeedRef=database.ref('community/posts').limitToLast(100);
    communityBound=true;
    feed.innerHTML='<div class="rounded-2xl border border-cyan-400/10 bg-slate-900/60 p-10 text-center text-slate-500 font-bold animate-pulse">Đang đồng bộ cộng đồng realtime...</div>';
    communityFeedRef.on('value',snap=>{
      const posts=[];
      snap.forEach(child=>posts.push({id:child.key,...(child.val()||{})}));
      posts.sort((a,b)=>(Number(b.updatedAt)||Number(b.createdAt)||0)-(Number(a.updatedAt)||Number(a.createdAt)||0));
      renderPosts(posts);
      syncCommunityAuthorAvatars(posts);
    },err=>{
      console.error('community load',err); communityBound=false;
      feed.innerHTML=`<div class="rounded-2xl border border-red-400/20 bg-red-500/5 p-8 text-center text-red-300 font-bold">❌ Không tải được cộng đồng: ${cesc(err?.message||err)}<br><span class="text-xs text-red-200/70">Kiểm tra Firebase Rules cho /community/posts.</span></div>`;
    });
  }

  window.loadCommunityPosts=async function(force=false){
    const feed=document.getElementById('community-feed'); if(!feed)return;
    try{if(force||!communityBound||!communityFeedRef)await bindCommunityRealtime();}
    catch(e){communityBound=false;feed.innerHTML=`<div class="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-8 text-center text-amber-300 font-bold">${cesc(e?.message||e)}</div>`;}
  };

  window.openCommunity=function(){switchSection('sec-community');setTimeout(()=>window.loadCommunityPosts(false),0);};

  window.createCommunityPost=async function(){
    const title=document.getElementById('community-title')?.value.trim()||'';
    const subject=document.getElementById('community-subject')?.value||'Khác';
    const body=document.getElementById('community-body')?.value.trim()||'';
    if(title.length<3)return alert('❌ Tiêu đề phải có ít nhất 3 ký tự.');
    if(body.length<5)return alert('❌ Nội dung bài viết quá ngắn.');
    const user=getCommunityUser(); if(!user)return alert('❌ Bạn cần đăng nhập.');
    const btn=document.getElementById('community-post-btn');
    try{
      const database=await getCommunityDb(); if(btn){btn.disabled=true;btn.textContent='⏳ Đang đăng...';}
      const now=Date.now();
      await database.ref('community/posts').push({title,subject,body,authorUid:user.uid,authorName:user.name,photoURL:user.photoURL||'',createdAt:now,updatedAt:now,commentsCount:0,likes:{}});
      document.getElementById('community-title').value=''; document.getElementById('community-body').value='';
    }catch(e){alert('❌ Không đăng được bài: '+(e?.message||e));console.error(e);}
    finally{if(btn){btn.disabled=false;btn.textContent='ĐĂNG BÀI';}}
  };

  window.addCommunityComment=async function(postId){
    const input=document.getElementById('comment-'+postId),body=input?.value.trim()||'';
    if(!body)return; const user=getCommunityUser(); if(!user)return alert('❌ Bạn cần đăng nhập.');
    try{
      const database=await getCommunityDb();
      await database.ref(`community/posts/${postId}/comments`).push({authorUid:user.uid,authorName:user.name,photoURL:user.photoURL||'',body,createdAt:Date.now()});
      await database.ref(`community/posts/${postId}`).update({updatedAt:Date.now()});
      if(input)input.value='';
    }catch(e){alert('❌ Không gửi được bình luận: '+(e?.message||e));console.error(e);}
  };

  window.toggleCommunityLike=async function(postId){
    const user=getCommunityUser(); if(!user)return alert('❌ Bạn cần đăng nhập để thả tim nhé!');
    try{const database=await getCommunityDb();const likeRef=database.ref(`community/posts/${postId}/likes/${user.uid}`);const snap=await likeRef.once('value');if(snap.exists())await likeRef.remove();else await likeRef.set(true);}
    catch(e){console.error('Lỗi thả tim:',e);alert('❌ Không thả tim được, kiểm tra lại Firebase Rules/mạng nha!');}
  };

  window.addEventListener('community:avatar-updated',e=>{
    const uid=e?.detail?.uid,url=e?.detail?.url;
    if(!uid||!url)return; communityAuthorAvatarRefs[uid]=url; window.__communityAvatar=url;
    if(communityLastPosts.length)renderPosts(communityLastPosts);
  });

  window.addEventListener('firebase:user-ready',()=>{
    const sec=document.getElementById('sec-community');
    if(sec?.classList.contains('active'))window.loadCommunityPosts(true);
  });
})();
// ==========================================
// HỆ THỐNG UP ẢNH ĐẠI DIỆN TÙY CHỈNH
// ==========================================
window.uploadCustomAvatar = function(e) {
    const file = e.target.files[0];
    if (!file || !auth.currentUser) return;
    
    // Đổi chữ thành đang tải cho ngầu
    const avtEl = document.getElementById('profile-avatar');
    const oldSrc = avtEl.src;
    avtEl.src = "https://i.gifer.com/ZKZg.gif"; // Ảnh loading tạm
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Dùng Canvas ép nhỏ ảnh lại thành 150x150 pixel cho nhẹ Database
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const SIZE = 150; 
            
            canvas.width = SIZE; 
            canvas.height = SIZE;
            
            // Cắt cúp ảnh cho vuông vức
            const minSize = Math.min(img.width, img.height);
            const startX = (img.width - minSize) / 2;
            const startY = (img.height - minSize) / 2;
            
            ctx.drawImage(img, startX, startY, minSize, minSize, 0, 0, SIZE, SIZE);
            
            // Nén thành chuỗi Base64 cực nhẹ (Chất lượng 0.8)
            const base64Avatar = canvas.toDataURL('image/jpeg', 0.8);
            
            // Bơm thẳng lên Firebase
            db.ref('users/' + auth.currentUser.uid).update({ customAvatar: base64Avatar })
              .then(() => {
                  avtEl.src = base64Avatar; // Cập nhật ảnh ngay lập tức
                  const navAvt = document.getElementById('nav-avatar');
                  if(navAvt) navAvt.src = base64Avatar;
                  window.__communityAvatar = base64Avatar;
                  const uid = auth.currentUser?.uid;
                  if(uid) window.dispatchEvent(new CustomEvent('community:avatar-updated',{detail:{uid,url:base64Avatar}}));
                  alert('✅ Đổi ảnh đại diện thành công!');
              })
                  
              .catch(err => {
                  avtEl.src = oldSrc;
                  alert('❌ Lỗi ròi: ' + err.message);
              });
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset khung chọn file
};



/* Pomodoro engine
   - Uses Date.now() as source of truth, not decrement-only intervals.
   - Exactly one study-time accounting path.
   - Safe even when browser throttles setInterval.
*/
(function(){
  let pomoTargetAt = 0;
  let pomoLastAwardAt = 0;
  let pomoTickId = null;
  let pomoFinished = false;

  const $ = id => document.getElementById(id);
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  // Engine mới dùng window.pomoSeconds làm nguồn hiển thị duy nhất.
  window.updatePomoUI = function(){
    const total = Math.max(0, Math.floor(num(window.pomoSeconds)));
    const m = Math.floor(total / 60);
    const s = total % 60;
    const minEl = $('input-m');
    const secEl = $('input-s');
    if(minEl) minEl.value = String(m).padStart(2,'0');
    if(secEl) secEl.value = String(s).padStart(2,'0');
  };

  window.syncFocusOverlay = function(){
    const total = Math.max(0, Math.floor(num(window.pomoSeconds)));
    const clock = $('focus-clock');
    const status = $('focus-status');
    if(clock) clock.textContent = `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
    if(status) status.textContent = window.isPomoRunning
      ? 'Đang tập trung — không mở tab linh tinh nhé.'
      : 'Đang tạm dừng — bấm ▶ để tiếp tục.';
  };

  function setBtn(running, paused){
    const btn = $('btn-pomo-action');
    if(!btn) return;
    if(running){
      btn.textContent = 'DỪNG LẠI';
      btn.className = 'bg-red-500 hover:bg-red-600 text-white font-black text-xl px-8 py-5 rounded-2xl transition-all shadow-inner w-full';
    }else if(paused){
      btn.textContent = 'TIẾP TỤC';
      btn.className = 'bg-amber-500 hover:bg-amber-600 text-white font-black text-xl px-8 py-5 rounded-2xl transition-all shadow-md w-full';
    }else{
      btn.textContent = 'BẮT ĐẦU';
      btn.className = 'bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl px-8 py-5 rounded-2xl transition-all shadow-md hover:shadow-lg w-full';
    }
  }

  function renderRemaining(){
    const remaining = Math.max(0, Math.ceil((pomoTargetAt - Date.now()) / 1000));
    if(typeof window.pomoSeconds !== 'undefined') window.pomoSeconds = remaining;
    if(typeof updatePomoUI === 'function') updatePomoUI();
    if(typeof syncFocusOverlay === 'function') syncFocusOverlay();
    return remaining;
  }

  function awardStudySeconds(delta, day=dateKeyNow()){
    delta = Math.max(0, Math.floor(delta));
    if(!delta) return;
    try{
      const todayKey=dateKeyNow();
      // Không bao giờ cộng thời gian của ngày cũ vào bộ đếm của ngày mới.
      if(localStorage.getItem('htvvm.studyDay')!==day){
        localStorage.setItem('htvvm.studyDay',day);
        localStorage.setItem('htvvm.todayStudySeconds','0');
        localStorage.setItem('htvvm.todaySessions','0');
      }

      const key = 'htvvm.todayStudySeconds';
      let today = num(localStorage.getItem(key));
      today += delta;
      localStorage.setItem(key, String(today));
      if(typeof window.totalStudySeconds !== 'undefined') window.totalStudySeconds = num(window.totalStudySeconds) + delta;
      else if(typeof totalStudySeconds !== 'undefined') totalStudySeconds += delta;

      if(typeof updateStudyDashboard === 'function') updateStudyDashboard();
      if(typeof updateRankUI === 'function') updateRankUI();

      // Đồng bộ tối đa mỗi 30 giây; ngày nào ghi đúng ngày đó.
      if(today % 30 < delta){
        const u = window.auth?.currentUser || (typeof auth !== 'undefined' ? auth?.currentUser : null);
        const database = window.db || (typeof db !== 'undefined' ? db : null);
        if(u && database){
          database.ref('users/'+u.uid).update({
            totalStudySeconds: (typeof window.totalStudySeconds !== 'undefined' ? num(window.totalStudySeconds) : num(totalStudySeconds)),
            [`dailyStudy/${day}`]: today,
            lastActiveAt: Date.now()
          }).catch(err=>console.warn('Pomodoro Firebase sync:',err));
        }
      }
    }catch(err){
      console.warn('awardStudySeconds:', err);
    }
  }

  function addAwardedSecondsAcrossMidnight(startMs,endMs){
    let cursor=startMs;
    const end=endMs;
    while(cursor < end){
      const d=new Date(cursor);
      const day=dateKeyNow(d);
      const nextMidnight=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1,0,0,0,0).getTime();
      const segmentEnd=Math.min(end,nextMidnight);
      const seconds=Math.floor((segmentEnd-cursor)/1000);

      if(seconds>0){
        awardStudySeconds(seconds,day);
        cursor += seconds*1000;
      }

      // Nếu đã chạm mốc 0:00 thì chuyển hẳn sang ngày mới.
      // Phần lẻ dưới 1 giây được giữ lại khi chưa tới mốc ngày mới.
      if(cursor>=segmentEnd){
        cursor=segmentEnd;
      }else if(segmentEnd===nextMidnight){
        cursor=segmentEnd;
      }else{
        break;
      }

      if(segmentEnd===end) break;
    }
    return cursor;
  }

  function dateKeyNow(d=new Date()){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function flushAwardUntil(now){
    if(!pomoLastAwardAt){ pomoLastAwardAt=now; return; }
    if(now <= pomoLastAwardAt) return;
    pomoLastAwardAt = addAwardedSecondsAcrossMidnight(pomoLastAwardAt,now);
    ensureTodayStore();
  }

  function stopTick(){
    if(pomoTickId){ clearInterval(pomoTickId); pomoTickId=null; }
  }

  function tick(){
    if(!window.isPomoRunning) return;
    const now = Date.now();
    flushAwardUntil(now);
    const remaining = renderRemaining();
    if(remaining <= 0){
      finish();
    }
  }

  function finish(){
    if(pomoFinished) return;
    pomoFinished = true;
    stopTick();
    window.isPomoRunning = false;
    const now = Date.now();
    if(pomoTargetAt) flushAwardUntil(Math.max(now, pomoTargetAt));
    window.pomoSeconds = 0;
    if(typeof updatePomoUI === 'function') updatePomoUI();
    if(typeof updateRankUI === 'function') updateRankUI();
    if(typeof syncStudyStats === 'function') syncStudyStats();
    if(typeof enableInputs === 'function') enableInputs();
    setBtn(false,false);
    if(typeof syncFocusOverlay === 'function') syncFocusOverlay();
    if(typeof toast === 'function') toast('⏰ Hết giờ Pomodoro! Giỏi lắm, thêm một phiên cày cuốc.');
    else alert('⏰ Hết giờ Pomodoro!');
  }

  window.togglePomodoro = function(){
    const seconds = num(window.pomoSeconds);

    // PAUSE / RESUME
    if(window.isPomoRunning){
      const now = Date.now();
      flushAwardUntil(now);
      const remaining = Math.max(0, Math.ceil((pomoTargetAt - now)/1000));
      window.pomoSeconds = remaining;
      stopTick();
      window.isPomoRunning = false;
      pomoTargetAt = 0;
      pomoFinished = false;
      if(typeof enableInputs === 'function') enableInputs();
      setBtn(false,true);
      if(typeof updatePomoUI === 'function') updatePomoUI();
      if(typeof updateRankUI === 'function') updateRankUI();
      if(typeof syncStudyStats === 'function') syncStudyStats();
      if(typeof syncFocusOverlay === 'function') syncFocusOverlay();
      return;
    }

    if(!Number.isFinite(seconds) || seconds <= 0){
      alert('Ní phải nhập thời gian lớn hơn 0 nghen!');
      return;
    }

    try{ if(typeof ensureTodayStore === 'function') ensureTodayStore(); }catch(_){ }
    pomoFinished = false;
    pomoTargetAt = Date.now() + seconds*1000;
    pomoLastAwardAt = Date.now();
    window.isPomoRunning = true;
    if(typeof disableInputs === 'function') disableInputs();
    setBtn(true,false);
    renderRemaining();
    stopTick();
    pomoTickId = setInterval(tick, 250);
    tick();
  };

  window.resetPomodoro = function(){
    const mode = String(window.currentPomoMode || 'pomo');
    stopTick();
    window.isPomoRunning = false;
    pomoTargetAt = 0;
    pomoLastAwardAt = 0;
    pomoFinished = false;
    if(typeof enableInputs === 'function') enableInputs();
    window.pomoSeconds = mode === 'short' ? 5*60 : mode === 'long' ? 15*60 : 25*60;
    if(typeof updatePomoUI === 'function') updatePomoUI();
    if(typeof updateRankUI === 'function') updateRankUI();
    if(typeof syncFocusOverlay === 'function') syncFocusOverlay();
    setBtn(false,false);
  };

  // Preset modes — keep their mode and duration stable.
  window.setPomoMode = function(mode){
    stopTick();
    window.isPomoRunning = false;
    window.currentPomoMode = mode;
    pomoTargetAt = 0;
    pomoLastAwardAt = 0;
    pomoFinished = false;
    const seconds = mode === 'short' ? 5*60 : mode === 'long' ? 15*60 : 25*60;
    window.pomoSeconds = seconds;
    ['pomo','short','long'].forEach(m=>{
      const el = $('mode-'+m);
      if(el) el.className = 'flex-1 py-2 rounded-lg font-extrabold text-slate-400 hover:text-slate-600 transition-all';
    });
    const active = $('mode-'+mode);
    if(active) active.className = 'flex-1 py-2 rounded-lg font-extrabold bg-white text-emerald-600 shadow-sm transition-all';
    if(typeof enableInputs === 'function') enableInputs();
    if(typeof updatePomoUI === 'function') updatePomoUI();
    setBtn(false,false);
    if(typeof syncFocusOverlay === 'function') syncFocusOverlay();
  };

  // Custom input handler.
  window.userCustomTime = function(){
    if(window.isPomoRunning) return;
    window.currentPomoMode = 'custom';
    const m = Math.max(0, Math.floor(num($('input-m')?.value)));
    const s = Math.max(0, Math.min(59, Math.floor(num($('input-s')?.value))));
    window.pomoSeconds = m*60+s;
    ['pomo','short','long'].forEach(x=>{ const el=$('mode-'+x); if(el) el.className='flex-1 py-2 rounded-lg font-extrabold text-slate-400 hover:text-slate-600 transition-all'; });
    if(typeof syncFocusOverlay === 'function') syncFocusOverlay();
  };

  // Keep display sane on first paint.
  document.addEventListener('DOMContentLoaded',()=>{
    try{
      if(typeof window.pomoSeconds !== 'number') window.pomoSeconds=25*60;
      if(typeof updatePomoUI === 'function') updatePomoUI();
      if(typeof updateRankUI === 'function') updateRankUI();
      if(typeof syncFocusOverlay === 'function') syncFocusOverlay();
      setBtn(false,false);
    }catch(err){ console.warn('Pomodoro init:',err); }
  });
})();
