// Ekrandaki ses düğmesi: efekt, müzik ve özel sesler (insan sesleri) için seviye ve aç/kapa paneli; oyun durmaz
import { settings, setSfx, setMusic, setVoice, setAmb, setSfxVol, setMusicVol, setVoiceVol, setAmbVol, play, nextTrack, musicInfo, unlockAudio } from './audio.js';

const ROWS = [
  ['sfx', '🔔', 'Efektler', setSfx, setSfxVol],
  ['music', '🎵', 'Müzik', setMusic, setMusicVol],
  ['voice', '🗣️', 'Özel sesler', setVoice, setVoiceVol],
  ['amb', '🌿', 'Ortam sesleri', setAmb, setAmbVol],
];
const VOLKEY = { sfx: 'sfxVol', music: 'musicVol', voice: 'voiceVol', amb: 'ambVol' };
let el = null;

// düğmedeki çarpı: her şey kapalıysa görünür
export function syncSoundBtn() {
  const b = document.getElementById('musicBtn');
  if (b) b.classList.toggle('off', !settings.sfx && !settings.music && !settings.voice && settings.amb === false);
}
// başka sekmede ses ayarı değişti (audio.js uygular): düğme ve açık panel de güncellensin
addEventListener('storage', (e) => {
  if (e.key !== 'koyBakkali.settings') return;
  syncSoundBtn();
  if (el && el.classList.contains('open')) render();
});

function build() {
  el = document.createElement('div');
  el.id = 'sndPanel';
  el.className = 'hp';
  document.body.appendChild(el);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.tog) {
      const row = ROWS.find((r) => r[0] === t.dataset.tog), on = !settings[row[0]];
      row[3](on);
      t.classList.toggle('on', on);
      t.closest('.sp-row').classList.toggle('mute', !on);
      syncSoundBtn();
      play('toggle');
    }
    if (t.dataset.act === 'next') { nextTrack(true); setTimeout(render, 60); }
  });
  el.addEventListener('input', (e) => {
    const row = ROWS.find((r) => r[0] === e.target.dataset.vol);
    if (row) row[4](+e.target.value / 100);
  });
  // panelin dışına basınca ya da Esc ile kapanır
  addEventListener('pointerdown', (e) => { if (el.classList.contains('open') && !e.target.closest('#musicBtn, #sndPanel')) toggleSoundPanel(false); }, true);
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && el.classList.contains('open')) { e.stopImmediatePropagation(); toggleSoundPanel(false); } }, true);
}

function render() {
  const m = musicInfo();
  el.innerHTML = `<b class="sp-t">Ses</b>${ROWS.map(([k, ic, name]) => `
    <div class="sp-row${settings[k] ? '' : ' mute'}"><span class="sp-ic">${ic}</span><span class="sp-n">${name}</span>
      <input type="range" min="0" max="100" value="${Math.round((settings[VOLKEY[k]] ?? 1) * 100)}" data-vol="${k}" aria-label="${name} seviyesi">
      <button type="button" class="tog${settings[k] ? ' on' : ''}" data-tog="${k}" aria-label="${name} aç/kapat"></button></div>`).join('')}
    <small class="sp-note">Özel sesler: müşteri tepkileri, pazar bağırması ve kutlamalar. Arada bir, kısık çalar.</small>
    ${m.files ? `<div class="sp-track"><span>💿 ${m.name || 'Başlıyor…'}</span><button type="button" class="mini" data-act="next">⏭</button></div>` : ''}`;
}

export function toggleSoundPanel(force) {
  if (!el) build();
  unlockAudio(); // oyuncunun ilk dokunuşu bu düğme olabilir: tarayıcı sesi ancak dokunuşla başlatır
  const on = force ?? !el.classList.contains('open');
  if (on) render();
  el.classList.toggle('open', on);
  play(on ? 'open' : 'close');
}
