import { SCRIPT_URL, IMGBB_API_KEY } from './config.js';
import { state } from './state.js';
import { loadPhotoLocally, savePhotoLocally, deletePhotoLocally } from './storage.js';
import { updateStats, renderMembers, renderGallery, showToast, closeModal, showMembershipCard } from './ui.js';
import { compressImage } from './utils.js';

export async function fetchMembersFromSheet() {
    showToast('Loading members from cloud...');
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        state.members = data.map(m => ({
            ...m,
            profilePic: loadPhotoLocally(m.id) || m.profilePic || ''
        }));
        updateStats();
        renderMembers();
        renderGallery();
        if (state.members.length > 0) {
            showToast(`✅ Loaded ${state.members.length} members from cloud`);
        } else {
            showToast('Ready! Add your first member.');
        }
    } catch (e) {
        console.log("Fetch failed:", e);
        showToast("⚠️ Could not load from cloud. Check internet or SCRIPT_URL.");
    }
}

export async function saveMember(data) {
    const saveBtn = document.querySelector('button[type="submit"]');
    const originalText = saveBtn.innerText;

    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.7";

    if (data.profilePic && data.profilePic.startsWith('data:')) {
        const compressed = await compressImage(data.profilePic, 150);
        savePhotoLocally(data.id, compressed); // Keep local backup

        try {
            showToast("Uploading photo to cloud...");
            const base64Data = compressed.split(',')[1];
            const formData = new FormData();
            formData.append('image', base64Data);

            const imgResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });

            const imgResult = await imgResponse.json();
            if (imgResult.success) {
                data.profilePic = imgResult.data.url;
            } else {
                console.warn("ImgBB upload failed, falling back to local storage", imgResult);
                data.profilePic = ''; // Don't send huge base64 to google sheets
            }
        } catch (imgErr) {
            console.error("ImgBB error:", imgErr);
            data.profilePic = ''; // Don't send huge base64 to google sheets
        }
    }

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        state.members.push(data);
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
        state.members.push(data);
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

export async function deleteMember(id) {
    if (!confirm("Are you sure you want to remove this member?")) return;

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

    deletePhotoLocally(id);
    state.members = state.members.filter(m => m.id !== id);
    updateStats();
    renderMembers();
    renderGallery();
    showToast('Member removed ✅');
}
