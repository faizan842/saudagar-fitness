import { state } from './state.js';

export function getPlanLabel(plan) {
    const labels = { "1": "1 month", "3": "3 month", "6": "6 month", "12": "1 year" };
    return labels[plan] || `${plan} month`;
}

export function formatDisplayDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getNextMembershipId() {
    if (!state.members.length) return 1;
    const ids = state.members.map(m => m.membershipId || 0);
    return Math.max(...ids) + 1;
}

export function calculateExpiry(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + parseInt(months));
    return d.toISOString().split('T')[0];
}

export function normalizePhone(phone) {
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    if (digits.startsWith('0') && digits.length === 11) digits = '91' + digits.slice(1);
    return digits;
}

export function compressImage(src, maxPx = 280) {
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

export function loadImage(src) {
    return new Promise((resolve, reject) => {
        if (!src) return reject(new Error('No image source'));
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
    });
}
