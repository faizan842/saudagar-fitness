const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlUv97inWJyk7VxjlLfW3OW4-S3LKQQEfwrPqwqSA-QEE6rNM9d0YKdAWtBnGm_o8/exec";
const ADMISSION_FEE = 200;
const GYM_PHONE = "+91-8888946574";
const GYM_OWNER = "Faizan Saudagar";
let members = [];
let activeCardMember = null;
let activeCardImageUrl = null;
const cardCache = new Map();
const imageUrlCache = new Map();

window.onload = () => {
    fetchMembersFromSheet();
};

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

function openModal() { document.getElementById('memberModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('memberModal').classList.add('hidden'); }
function closeCardModal() { document.getElementById('cardModal').classList.add('hidden'); }

function switchTab(tab) {
    const isMembers = tab === 'members';
    document.getElementById('membersSection').classList.toggle('hidden', !isMembers);
    document.getElementById('gallerySection').classList.toggle('hidden', isMembers);
    document.getElementById('tabMembers').className = `tab-btn flex-1 py-3 rounded-xl font-bold text-sm ${isMembers ? 'bg-emerald-600 text-white' : 'text-emerald-700'}`;
    document.getElementById('tabGallery').className = `tab-btn flex-1 py-3 rounded-xl font-bold text-sm ${!isMembers ? 'bg-emerald-600 text-white' : 'text-emerald-700'}`;
    if (!isMembers) renderGallery();
}

document.getElementById('mPhoto').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('photoPreview');
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            preview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover">`;
        };
        reader.readAsDataURL(file);
    }
});

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
    let digits = phone.replace(/\D/g, '');
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
    const url = `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(message)}`;
    window.location.href = url;
}

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

function waitForImages(container) {
    const imgs = [...container.querySelectorAll('img')];
    return Promise.all(imgs.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 400); });
    }));
}

function prewarmCardCache(member) {
    if (cardCache.has(member.id) && imageUrlCache.has(member.id)) return;
    generateCardImage(member)
        .then(url => uploadCardImage(url).then(publicUrl => imageUrlCache.set(member.id, publicUrl)))
        .catch(() => {});
}

async function uploadCardImage(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();

    // Catbox litterbox (fast, direct image link)
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('time', '72h');
        form.append('fileToUpload', blob, 'gym-pass.jpg');
        const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form });
        const url = (await res.text()).trim();
        if (url.startsWith('http')) return url;
    } catch (e) { console.log('litterbox failed', e); }

    // tmpfiles.org fallback
    try {
        const form = new FormData();
        form.append('file', blob, 'gym-pass.jpg');
        const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: form });
        const json = await res.json();
        if (json.status === 'success' && json.data?.url) {
            return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        }
    } catch (e) { console.log('tmpfiles failed', e); }

    // telegra.ph fallback
    const form = new FormData();
    form.append('file', blob, 'gym-pass.jpg');
    const res = await fetch('https://telegra.ph/upload', { method: 'POST', body: form });
    const json = await res.json();
    if (json[0]?.src) return 'https://telegra.ph' + json[0].src;

    throw new Error('Image upload failed');
}

function buildMembershipCardHTML(member) {
    return `
        <div class="membership-card" id="membershipCard">
            <div class="mc-header">
                <div class="mc-brand">
                    <h1>Saudagar Fitness Club</h1>
                    <p>${GYM_PHONE} (${GYM_OWNER})</p>
                </div>
                <div class="mc-gym-logo">
                    <i class="fas fa-dumbbell"></i>
                </div>
            </div>
            <div class="mc-wave"></div>
            <div class="mc-body">
                <div class="mc-photo-wrap">
                    <img src="${member.profilePic}" alt="${member.name}" crossorigin="anonymous">
                </div>
                <div class="mc-details">
                    <p><strong>Name:</strong> ${member.name}</p>
                    <p><strong>Membership Id:</strong> ${member.membershipId}</p>
                    <p><strong>Plan Name:</strong> ${getPlanLabel(member.plan)}</p>
                    <p><strong>Start Date:</strong> ${formatDisplayDate(member.joinDate)}</p>
                    <p><strong>End Date:</strong> ${formatDisplayDate(member.expDate)}</p>
                </div>
                <div class="mc-curve"></div>
            </div>
        </div>
    `;
}

async function generateCardImage(member) {
    if (cardCache.has(member.id)) return cardCache.get(member.id);

    const pic = await compressImage(member.profilePic);
    const target = document.getElementById('cardRenderTarget');
    target.innerHTML = buildMembershipCardHTML({ ...member, profilePic: pic });
    await waitForImages(target);

    const card = document.getElementById('membershipCard');
    const canvas = await html2canvas(card, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
    });
    const url = canvas.toDataURL('image/jpeg', 0.88);
    cardCache.set(member.id, url);
    return url;
}

async function sendWhatsAppWithCard(member) {
    activeCardMember = member;
    showToast('Preparing gym pass card...');

    try {
        activeCardImageUrl = cardCache.get(member.id) || await generateCardImage(member);

        let publicImageUrl = imageUrlCache.get(member.id);
        if (!publicImageUrl) {
            publicImageUrl = await uploadCardImage(activeCardImageUrl);
            imageUrlCache.set(member.id, publicImageUrl);
        }

        const message = `${getWhatsAppMessage(member)}\n\n🎫 Gym Pass Card:\n${publicImageUrl}`;
        openWhatsAppToNumber(member.phone, message);
        showToast('WhatsApp opened! Tap Send — card image is in the message ✅');
    } catch (err) {
        console.error(err);
        openWhatsAppToNumber(member.phone, getWhatsAppMessage(member));
        showToast('Card upload failed. Message sent — try WhatsApp again in a moment.');
    }
}

async function showMembershipCard(member) {
    activeCardMember = member;
    const preview = document.getElementById('cardPreviewArea');
    document.getElementById('cardModal').classList.remove('hidden');

    const cached = cardCache.get(member.id);
    if (cached) {
        activeCardImageUrl = cached;
        preview.innerHTML = `<img src="${cached}" class="w-full rounded-xl" alt="Membership Card">`;
        return;
    }

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

async function saveMember(data) {
    const saveBtn = document.querySelector('button[type="submit"]');
    const originalText = saveBtn.innerText;

    saveBtn.innerText = "Saving to Cloud...";
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.7";

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

        const admissionNote = data.admissionFee ? `\nAdmission fee: ₹${data.admissionFee}` : '';
        prewarmCardCache(data);
        alert(`✅ Member Saved!\nPlan: ${getPlanLabel(data.plan)}${admissionNote}`);
        await showMembershipCard(data);
    } catch (error) {
        console.error("Error saving data:", error);
        members.push(data);
        updateStats();
        renderMembers();
        renderGallery();
        prewarmCardCache(data);
        alert("⚠️ Connection Error. Saved on screen only.");
        await showMembershipCard(data);
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
    }
}

async function fetchMembersFromSheet() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        members = data;
        updateStats();
        renderMembers();
        renderGallery();
    } catch (e) {
        console.log("Initial fetch failed. Add your first member!");
    }
}

function updateStats() {
    const today = new Date();
    const expiringSoon = members.filter(m => {
        const diffDays = Math.ceil((new Date(m.expDate) - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 15 && diffDays > 0;
    }).length;

    document.getElementById('memberCount').innerText = members.length;
    document.getElementById('expiringCount').innerText = expiringSoon;
}

document.getElementById('gymForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const photoElement = document.querySelector('#photoPreview img');
    const photoSrc = photoElement ? photoElement.src : 'https://via.placeholder.com/200';

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
        container.innerHTML += `
            <div class="bg-white p-4 rounded-[2rem] shadow-sm border ${isWarning ? 'border-red-200 bg-red-50/30' : 'border-emerald-50'} flex items-center gap-4 animate-in">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 ${isWarning ? 'border-red-500' : 'border-emerald-500'} shadow-sm bg-emerald-100">
                    <img src="${m.profilePic}" class="w-full h-full object-cover">
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

function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!members.length) {
        grid.innerHTML = '<p class="col-span-3 text-center text-slate-400 py-10">No members yet. Add your first member!</p>';
        return;
    }

    members.forEach(m => {
        grid.innerHTML += `
            <button onclick="showMembershipCard(members.find(x => x.id === ${m.id}))" class="gallery-item group">
                <img src="${m.profilePic}" alt="${m.name}" class="w-full h-full object-cover">
                <div class="gallery-overlay">
                    <p class="text-white text-[10px] font-bold truncate px-1">${m.name}</p>
                    <i class="fas fa-id-card text-white text-xs"></i>
                </div>
            </button>
        `;
    });
}

function deleteMember(id) {
    if (confirm("Are you sure you want to remove this member?")) {
        members = members.filter(m => m.id !== id);
        updateStats();
        renderMembers();
        renderGallery();
    }
}
