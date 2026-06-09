// ╔════════════════════════════════════════════════════════════════════╗
// ║  SAUDAGAR FITNESS CLUB — Main Application Script                  ║
// ╚════════════════════════════════════════════════════════════════════╝

// ─── CONFIGURATION ──────────────────────────────────────────────────
// ⚠️ REPLACE THIS with YOUR Google Apps Script Web App URL:
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIwc66OCmtZd6WHs6ZKRY_LuEmlmklCMIbG4iXwZWvAiteD-jlZbn1fqHQNv9-YSEQfQ/exec";
const ADMISSION_FEE = 200;
const GYM_PHONE = "+91-8888946574";
const GYM_OWNER = "Faizan Saudagar";

// ─── STATE ──────────────────────────────────────────────────────────
let members = [];
let activeCardMember = null;
let activeCardImageUrl = null;

// ─── INIT ───────────────────────────────────────────────────────────
window.onload = () => {
    fetchMembersFromSheet();
};

// ─── AUTH ────────────────────────────────────────────────────────────
function handleLogin() {
    const pin = document.getElementById('pinInput').value;
    if (pin === "1234") {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
    } else {
        alert("Wrong PIN! Try 1234");
    }
}

function handleLogout() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appContent').classList.add('hidden');
    document.getElementById('pinInput').value = "";
}

// ─── MODALS ─────────────────────────────────────────────────────────
function openModal() { document.getElementById('memberModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('memberModal').classList.add('hidden'); }
function closeCardModal() { document.getElementById('cardModal').classList.add('hidden'); }

// ─── TABS ───────────────────────────────────────────────────────────
function switchTab(tab) {
    const isMembers = tab === 'members';
    document.getElementById('membersSection').classList.toggle('hidden', !isMembers);
    document.getElementById('gallerySection').classList.toggle('hidden', isMembers);
    document.getElementById('tabMembers').className = `tab-btn flex-1 py-3 rounded-xl font-bold text-sm ${isMembers ? 'bg-emerald-600 text-white' : 'text-emerald-700'}`;
    document.getElementById('tabGallery').className = `tab-btn flex-1 py-3 rounded-xl font-bold text-sm ${!isMembers ? 'bg-emerald-600 text-white' : 'text-emerald-700'}`;
    if (!isMembers) renderGallery();
}

// ─── PHOTO PREVIEW ──────────────────────────────────────────────────
document.getElementById('mPhoto').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('photoPreview');
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            preview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover">`;
        };
        reader.readAsDataURL(file);
    }
});

// ─── HELPERS ────────────────────────────────────────────────────────
function getPlanLabel(plan) {
    const labels = { "1": "1 month", "3": "3 month", "6": "6 month", "12": "1 year" };
    return labels[plan] || `${plan} month`;
}

function formatDisplayDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getNextMembershipId() {
    if (!members.length) return 1;
    const ids = members.map(m => m.membershipId || 0);
    return Math.max(...ids) + 1;
}

function calculateExpiry(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + parseInt(months));
    return d.toISOString().split('T')[0];
}

function getWhatsAppMessage(member) {
    const start = formatDisplayDate(member.joinDate);
    const end = formatDisplayDate(member.expDate);
    return `Hi ${member.name} ! 🙌 Your gym pass is here! 🎉 You can use it to access Saudagar Fitness Club from ${start} to ${end}`;
}

function normalizePhone(phone) {
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    if (digits.startsWith('0') && digits.length === 11) digits = '91' + digits.slice(1);
    return digits;
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => t.classList.add('hidden'), 4000);
}

function openWhatsAppToNumber(phone, message) {
    const p = normalizePhone(phone);
    const url = `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// ─── LOCAL PHOTO STORAGE (localStorage) ─────────────────────────────
// Photos are stored on your device only — too large for Google Sheets.

function savePhotoLocally(id, dataUrl) {
    try {
        localStorage.setItem(`gym_photo_${id}`, dataUrl);
    } catch (e) {
        console.warn('Photo save failed (storage full?):', e);
    }
}

function loadPhotoLocally(id) {
    return localStorage.getItem(`gym_photo_${id}`) || '';
}

function deletePhotoLocally(id) {
    localStorage.removeItem(`gym_photo_${id}`);
}

// ─── IMAGE UTILITIES ────────────────────────────────────────────────
function compressImage(src, maxPx = 280) {
    return new Promise(resolve => {
        if (!src?.startsWith('data:image')) return resolve(src);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        if (!src) return reject(new Error('No image source'));
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
    });
}

// ─── CANVAS-BASED CARD GENERATION (fast, no html2canvas) ────────────
// Uses native Canvas API — ~200ms vs 1-2 seconds with html2canvas

async function generateCardImage(member) {
    const t0 = performance.now();
    const W = 600, H = 320;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── White background ──
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // ── Green decorative curve (right side) ──
    ctx.beginPath();
    ctx.arc(W + 30, H / 2 + 30, 140, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();

    // ── Header: Gym name ──
    ctx.fillStyle = '#111111';
    ctx.font = '900 28px Inter, Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('Saudagar Fitness Club', 28, 22);

    // ── Header: Phone / Owner ──
    ctx.fillStyle = '#555555';
    ctx.font = '400 14px Inter, Arial, sans-serif';
    ctx.fillText(`${GYM_PHONE} (${GYM_OWNER})`, 28, 56);

    // ── Logo circle (top-right) ──
    const logoX = W - 60, logoY = 42;
    ctx.beginPath();
    ctx.arc(logoX, logoY, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#ecfdf5';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#059669';
    ctx.font = '900 16px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SF', logoX, logoY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // ── Green wave bar ──
    const waveY = 82;
    const grad = ctx.createLinearGradient(20, waveY, W - 20, waveY);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.5, '#34d399');
    grad.addColorStop(1, '#10b981');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(W / 2, waveY + 12, (W - 40) * 0.55, 12, 0, Math.PI, 0);
    ctx.fill();

    // ── Member photo (circular) ──
    const photoX = 100, photoY = 200, photoR = 68;

    // Green border
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoR + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();

    // Background fill
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2);
    ctx.fillStyle = '#f0fdf4';
    ctx.fill();

    // Draw member photo (with object-fit: cover)
    try {
        const pic = member.profilePic || loadPhotoLocally(member.id);
        if (pic) {
            const img = await loadImage(pic);
            ctx.save();
            ctx.beginPath();
            ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2);
            ctx.clip();
            const ratio = img.width / img.height;
            let dw, dh;
            if (ratio > 1) { dh = photoR * 2; dw = dh * ratio; }
            else { dw = photoR * 2; dh = dw / ratio; }
            ctx.drawImage(img, photoX - dw / 2, photoY - dh / 2, dw, dh);
            ctx.restore();
        }
    } catch (e) {
        // Placeholder icon
        ctx.fillStyle = '#059669';
        ctx.font = '36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👤', photoX, photoY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    // ── Member details text ──
    const detailX = 198;
    let detailY = 118;
    const lineH = 33;

    const details = [
        ['Name: ', member.name || ''],
        ['Membership Id: ', String(member.membershipId || '')],
        ['Plan Name: ', getPlanLabel(member.plan)],
        ['Start Date: ', formatDisplayDate(member.joinDate)],
        ['End Date: ', formatDisplayDate(member.expDate)]
    ];

    details.forEach(([label, value]) => {
        ctx.fillStyle = '#111111';
        ctx.font = '800 15px Inter, Arial, sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        const lw = ctx.measureText(label).width;
        ctx.fillText(label, detailX, detailY);
        ctx.font = '400 15px Inter, Arial, sans-serif';
        ctx.fillText(value, detailX + lw, detailY);
        detailY += lineH;
    });

    // ── Thin border ──
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    const url = canvas.toDataURL('image/jpeg', 0.92);
    console.log(`Card generated in ${Math.round(performance.now() - t0)}ms`);
    return url;
}

// ─── WHATSAPP SHARING ───────────────────────────────────────────────
function openWhatsAppInstructionModal(member) {
    const modal = document.getElementById('whatsappInstructionModal');
    const directBtn = document.getElementById('whatsappDirectLink');
    
    // Set up click handler on the button to open WhatsApp synchronously (prevents popup blockers)
    directBtn.onclick = () => {
        openWhatsAppToNumber(member.phone, getWhatsAppMessage(member));
        closeWhatsAppInstructionModal();
        closeCardModal(); // Close membership card modal if open
    };

    modal.classList.remove('hidden');
}

function closeWhatsAppInstructionModal() {
    document.getElementById('whatsappInstructionModal').classList.add('hidden');
}

async function sendWhatsAppWithCard(member) {
    activeCardMember = member;
    showToast('Preparing gym pass card...');

    try {
        // Generate card image
        activeCardImageUrl = await generateCardImage(member);

        // Copy card image to clipboard as PNG
        const pngBlob = await imageToPngBlob(activeCardImageUrl);
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
        ]);

        showToast('✅ Card copied! Opening steps...');

        // Open instructions modal instead of auto-opening
        openWhatsAppInstructionModal(member);
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        showToast('⚠️ Could not copy card. Opening WhatsApp steps...');
        // Even if copy fails, show the modal so they can proceed
        openWhatsAppInstructionModal(member);
    }
}

// Convert any image data URL to PNG Blob (clipboard requires PNG)
async function imageToPngBlob(dataUrl) {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function downloadCardImage(dataUrl, memberName) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${memberName.replace(/\s+/g, '_')}_GymPass.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ─── CARD PREVIEW MODAL ─────────────────────────────────────────────
async function showMembershipCard(member) {
    activeCardMember = member;
    const preview = document.getElementById('cardPreviewArea');
    document.getElementById('cardModal').classList.remove('hidden');

    preview.innerHTML = '<p class="text-center text-slate-400 py-8">Generating card...</p>';
    try {
        activeCardImageUrl = await generateCardImage(member);
        preview.innerHTML = `<img src="${activeCardImageUrl}" class="w-full rounded-xl" alt="Membership Card">`;
    } catch (err) {
        console.error(err);
        preview.innerHTML = '<p class="text-center text-red-500 py-8">Could not generate card. Try again.</p>';
    }
}

function shareCardOnWhatsApp() {
    if (activeCardMember) sendWhatsAppWithCard(activeCardMember);
}

function sendPassToMember(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;
    sendWhatsAppWithCard(member);
}

// ─── CLOUD SAVE ─────────────────────────────────────────────────────
async function saveMember(data) {
    const saveBtn = document.querySelector('button[type="submit"]');
    const originalText = saveBtn.innerText;

    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.7";

    // Compress photo for both local and cloud storage
    if (data.profilePic && data.profilePic.startsWith('data:')) {
        const compressed = await compressImage(data.profilePic, 150);
        savePhotoLocally(data.id, compressed);
        data.profilePic = compressed;
    }

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        members.push(data);
        updateStats();
        renderMembers();
        renderGallery();

        closeModal();
        document.getElementById('gymForm').reset();
        document.getElementById('photoPreview').innerHTML = `<i class="fas fa-camera text-3xl text-emerald-400"></i>`;

        showToast('✅ Member saved to cloud!');
        await showMembershipCard(data);
    } catch (error) {
        console.error("Cloud save error:", error);
        members.push(data);
        updateStats();
        renderMembers();
        renderGallery();
        showToast("⚠️ Saved locally. Cloud sync failed — check internet.");
        await showMembershipCard(data);
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
    }
}

// ─── CLOUD FETCH ────────────────────────────────────────────────────
async function fetchMembersFromSheet() {
    showToast('Loading members from cloud...');
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        // Reattach locally-stored photos to cloud data
        members = data.map(m => ({
            ...m,
            profilePic: loadPhotoLocally(m.id) || m.profilePic || ''
        }));
        updateStats();
        renderMembers();
        renderGallery();
        if (members.length > 0) {
            showToast(`✅ Loaded ${members.length} members from cloud`);
        } else {
            showToast('Ready! Add your first member.');
        }
    } catch (e) {
        console.log("Fetch failed:", e);
        showToast("⚠️ Could not load from cloud. Check internet or SCRIPT_URL.");
    }
}

// ─── STATS ──────────────────────────────────────────────────────────
function updateStats() {
    const today = new Date();
    const expiringSoon = members.filter(m => {
        const diffDays = Math.ceil((new Date(m.expDate) - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 15 && diffDays > 0;
    }).length;

    document.getElementById('memberCount').innerText = members.length;
    document.getElementById('expiringCount').innerText = expiringSoon;
}

// ─── FORM SUBMIT ────────────────────────────────────────────────────
document.getElementById('gymForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const photoElement = document.querySelector('#photoPreview img');
    const photoSrc = photoElement ? photoElement.src : '';

    const memberData = {
        id: Date.now(),
        membershipId: getNextMembershipId(),
        profilePic: photoSrc,
        name: document.getElementById('mName').value,
        phone: document.getElementById('mPhone').value,
        weight: document.getElementById('mWeight').value,
        height: document.getElementById('mHeight').value,
        joinDate: document.getElementById('mDate').value,
        plan: document.querySelector('input[name="plan"]:checked').value,
        admissionFee: document.getElementById('mAdmission').checked ? ADMISSION_FEE : 0,
        expDate: calculateExpiry(document.getElementById('mDate').value, document.querySelector('input[name="plan"]:checked').value)
    };

    saveMember(memberData);
});

// ─── MEMBER LIST RENDER ─────────────────────────────────────────────
function renderMembers() {
    const container = document.getElementById('memberList');
    container.innerHTML = '';

    members.forEach(m => {
        const today = new Date();
        const expDateObj = new Date(m.expDate);
        const diffDays = Math.ceil((expDateObj - today) / (1000 * 60 * 60 * 24));
        const isWarning = diffDays <= 15 && diffDays > 0;
        const mid = m.membershipId || '-';
        const planLabel = getPlanLabel(m.plan);
        const photoSrc = m.profilePic || loadPhotoLocally(m.id) || 'https://via.placeholder.com/200?text=No+Photo';
        container.innerHTML += `
            <div class="bg-white p-4 rounded-[2rem] shadow-sm border ${isWarning ? 'border-red-200 bg-red-50/30' : 'border-emerald-50'} flex items-center gap-4 animate-in">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 ${isWarning ? 'border-red-500' : 'border-emerald-500'} shadow-sm bg-emerald-100">
                    <img src="${photoSrc}" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-emerald-900 leading-tight">${m.name}</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: ${mid} · ${planLabel}</p>
                    ${m.admissionFee ? `<p class="text-[10px] text-amber-600 font-bold">Admission: ₹${m.admissionFee}</p>` : ''}
                    <p class="text-xs ${isWarning ? 'text-red-600 font-bold' : 'text-emerald-600'}">Expires: ${formatDisplayDate(m.expDate)}</p>
                    ${isWarning ? '<span class="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase">15 Days Left</span>' : ''}
                </div>
                <div class="flex flex-col gap-2">
                    <button onclick="showMembershipCard(members.find(x => x.id === ${m.id}))" class="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm" title="View Card">
                        <i class="fas fa-id-card"></i>
                    </button>
                    <button onclick="sendPassToMember(${m.id})"
                       class="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md" title="Send Gym Pass on WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="deleteMember(${m.id})" class="w-10 h-10 bg-red-50 text-red-400 rounded-xl">
                        <i class="fas fa-trash-alt text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

// ─── GALLERY RENDER ─────────────────────────────────────────────────
function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!members.length) {
        grid.innerHTML = '<p class="col-span-3 text-center text-slate-400 py-10">No members yet. Add your first member!</p>';
        return;
    }

    members.forEach(m => {
        const photoSrc = m.profilePic || loadPhotoLocally(m.id) || 'https://via.placeholder.com/200?text=No+Photo';
        grid.innerHTML += `
            <button onclick="showMembershipCard(members.find(x => x.id === ${m.id}))" class="gallery-item group">
                <img src="${photoSrc}" alt="${m.name}" class="w-full h-full object-cover">
                <div class="gallery-overlay">
                    <p class="text-white text-[10px] font-bold truncate px-1">${m.name}</p>
                    <i class="fas fa-id-card text-white text-xs"></i>
                </div>
            </button>
        `;
    });
}

// ─── DELETE MEMBER ──────────────────────────────────────────────────
async function deleteMember(id) {
    if (!confirm("Are you sure you want to remove this member?")) return;

    // Delete from cloud
    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'delete', id: id })
        });
    } catch (e) {
        console.warn('Cloud delete failed:', e);
    }

    // Delete locally
    deletePhotoLocally(id);
    members = members.filter(m => m.id !== id);
    updateStats();
    renderMembers();
    renderGallery();
    showToast('Member removed ✅');
}
