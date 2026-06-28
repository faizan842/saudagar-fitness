import { GYM_PHONE, GYM_OWNER } from './config.js';
import { loadPhotoLocally } from './storage.js';
import { loadImage, formatDisplayDate, getPlanLabel } from './utils.js';

export async function generateCardImage(member) {
    const t0 = performance.now();
    const W = 600, H = 320;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.beginPath();
    ctx.arc(W + 30, H / 2 + 30, 140, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();

    ctx.fillStyle = '#111111';
    ctx.font = '900 28px Inter, Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('Saudagar Fitness Club', 28, 22);

    ctx.fillStyle = '#555555';
    ctx.font = '400 14px Inter, Arial, sans-serif';
    ctx.fillText(`${GYM_PHONE} (${GYM_OWNER})`, 28, 56);

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

    const waveY = 82;
    const grad = ctx.createLinearGradient(20, waveY, W - 20, waveY);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.5, '#34d399');
    grad.addColorStop(1, '#10b981');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(W / 2, waveY + 12, (W - 40) * 0.55, 12, 0, Math.PI, 0);
    ctx.fill();

    const photoX = 100, photoY = 200, photoR = 68;

    ctx.beginPath();
    ctx.arc(photoX, photoY, photoR + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2);
    ctx.fillStyle = '#f0fdf4';
    ctx.fill();

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
        ctx.fillStyle = '#059669';
        ctx.font = '36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👤', photoX, photoY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

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

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    const url = canvas.toDataURL('image/jpeg', 0.92);
    console.log(`Card generated in ${Math.round(performance.now() - t0)}ms`);
    return url;
}
