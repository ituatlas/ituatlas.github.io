let capData = null;
let selectedYariyilFilter = 'all';

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('cap-data.json');
    capData = await response.json();

    // Footer tarihini güncelle
    document.getElementById('footerDate').textContent = capData.meta.guncelleme_tarihi;

    // Yıl sayısı seçeneklerini dinamik oluştur
    populateYilSecenekleri();

    // Tabloyu render et
    renderPrograms();
  } catch (error) {
    console.error('Veri yüklenemedi:', error);
    document.getElementById('results-container').innerHTML =
      '<p class="error">Veriler yüklenirken bir hata oluştu.</p>';
  }
});

function populateYilSecenekleri() {
  const select = document.getElementById('yilSayisi');
  const totalYears = capData.meta.donemler.length;

  let html = '';
  for (let i = 1; i <= totalYears; i++) {
    const selected = i === 3 ? 'selected' : '';
    html += `<option value="${i}" ${selected}>Son ${i} Yıl</option>`;
  }
  html += `<option value="all">Tüm Yıllar</option>`;

  select.innerHTML = html;
}

function filterByYariyil(selectElement) {
  selectedYariyilFilter = selectElement.value;
  renderPrograms();
}

// Programları render et
function renderPrograms() {
  if (!capData) return;

  const container = document.getElementById('results-container');
  const searchTerm = document.getElementById('searchInput').value.toLocaleLowerCase('tr').trim();
  const yilSayisi = document.getElementById('yilSayisi').value;

  // Gösterilecek dönemleri belirle
  let donemler = [...capData.meta.donemler];
  if (yilSayisi !== 'all') {
    donemler = donemler.slice(0, parseInt(yilSayisi));
  }

  // Programları fakülteye göre grupla
  const fakulteler = {};
  for (const [programAdi, programData] of Object.entries(capData.programlar)) {
    // Arama filtresi
    if (searchTerm && !programAdi.toLocaleLowerCase('tr').includes(searchTerm)) {
      continue;
    }

    const fakulte = programData.fakulte || 'Diğer';
    if (!fakulteler[fakulte]) {
      fakulteler[fakulte] = [];
    }
    fakulteler[fakulte].push({ ad: programAdi, ...programData });
  }

  // HTML oluştur
  let html = '';

  // Fakülte sıralama
  const fakulteSirasi = [
    "Bilgisayar ve Bilişim Fakültesi",
    "Elektrik - Elektronik Fakültesi",
    "Uçak ve Uzay Bilimleri Fakültesi",
    "Makina Fakültesi",
    "Fen - Edebiyat Fakültesi",
    "İşletme Fakültesi",
    "Kimya - Metalurji Fakültesi",
    "İnşaat Fakültesi",
    "Maden Fakültesi",
    "Gemi İnşaatı ve Deniz Bilimleri Fakültesi",
    "Mimarlık Fakültesi",
    "Tekstil Teknolojileri ve Tasarımı Fakültesi",
    "Türk Musikisi Devlet Konservatuarı",
    "Türk Musikisi Devlet Konservatuvarı",
    "İTÜ-KKTC"
  ];

  const fakulteListesi = Object.keys(fakulteler).sort((a, b) => {
    let indexA = fakulteSirasi.indexOf(a);
    let indexB = fakulteSirasi.indexOf(b);

    // Listede olmayanları en sona at
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;

    if (indexA !== indexB) {
      return indexA - indexB;
    }
    // Eşitlik durumunda (veya ikisi de listede yoksa) alfabetik sırala
    return a.localeCompare(b, 'tr');
  });

  for (const fakulte of fakulteListesi) {
    const programlar = fakulteler[fakulte].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

    html += `
      <div class="fakulte-group">
        <h3 class="fakulte-baslik">${fakulte}</h3>
        <div class="table-wrapper">
          <table class="programs-table">
            <thead>
              <tr>
                <th>Bölüm</th>
                <th>Dönem</th>
                <th>
                  Yarıyıl
                  <select onchange="filterByYariyil(this)" style="margin-left: 5px; padding: 2px; font-size: 0.9em;">
                    <option value="all" ${selectedYariyilFilter === 'all' ? 'selected' : ''}>Tümü</option>
                    <option value="3.Yarıyıl" ${selectedYariyilFilter === '3.Yarıyıl' ? 'selected' : ''}>3. Yarıyıl</option>
                    <option value="5.Yarıyıl" ${selectedYariyilFilter === '5.Yarıyıl' ? 'selected' : ''}>5. Yarıyıl</option>
                  </select>
                </th>
                <th>Kontenjan</th>
                <th>Yerleşen</th>
                <th>Tavan</th>
                <th>Taban</th>
              </tr>
            </thead>
    `;

    for (const program of programlar) {
      // Yıllara göre gruplanmış satırları topla
      const groupedRows = collectGroupedRows(program, donemler);

      if (Object.keys(groupedRows).length === 0) continue;

      html += '<tbody>';

      // Mobil görünüm için başlık satırı
      html += `
        <tr class="mobile-program-header">
          <td colspan="5">${program.ad}</td>
        </tr>
      `;

      let isFirstYear = true;
      let totalProgramRows = 0;
      Object.values(groupedRows).forEach(rows => totalProgramRows += rows.length);

      for (const [yilLabel, rows] of Object.entries(groupedRows)) {

        rows.forEach((rowHtml, index) => {
          // Mobil görünüm için data attribute'ları ekle - data-program artık gerekmiyor
          html += `<tr data-yil="${yilLabel}">`;

          // Program hücresi sadece en başta (rowspan ile) - Masaüstü görünüm için
          if (isFirstYear && index === 0) {
            html += `
              <td class="program-cell" rowspan="${totalProgramRows}">
                <div class="program-name">${program.ad}</div>
              </td>
            `;
            isFirstYear = false;
          }

          // Dönem hücresi her yılın başında (rowspan ile)
          if (index === 0) {
            html += `<td rowspan="${rows.length}">${yilLabel}</td>`;
          }

          html += rowHtml;
          html += '</tr>';
        });
      }

      html += '</tbody>';
    }

    html += `
          </table>
        </div>
      </div>
    `;
  }

  if (!html) {
    html = '<p class="no-results">Arama kriterlerine uygun sonuç bulunamadı.</p>';
  }

  container.innerHTML = html;

  // Tooltip event listeners (Mobil ve Desktop için tıklama/hover desteği)
  document.querySelectorAll('.aciklama-icon').forEach(icon => {
    icon.style.cursor = 'pointer';

    const showTooltip = () => {
      const title = icon.getAttribute('data-title');
      if (!title) return;

      const existing = document.querySelector('.custom-tooltip');
      if (existing && existing.dataset.triggerId === icon.dataset.uniqueId) return;
      if (existing) existing.remove();

      if (!icon.dataset.uniqueId) icon.dataset.uniqueId = Math.random().toString(36).substr(2, 9);

      const tooltip = document.createElement('div');
      tooltip.className = 'custom-tooltip';
      tooltip.textContent = title;
      tooltip.dataset.triggerId = icon.dataset.uniqueId;
      document.body.appendChild(tooltip);

      const rect = icon.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      let left = rect.left;
      if (left > window.innerWidth - 220) {
        left = window.innerWidth - 230;
      }
      if (left < 10) left = 10;

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${rect.bottom + scrollTop + 5}px`;
    };

    const hideTooltip = () => {
      const existing = document.querySelector('.custom-tooltip');
      if (existing) existing.remove();
    };

    // Desktop Hover
    icon.addEventListener('mouseenter', () => {
      // Sadece fare ile üzerine gelince aç, eğer tıklanarak açılmamışsa
      const existing = document.querySelector('.custom-tooltip');
      if (!existing || existing.dataset.triggerId !== icon.dataset.uniqueId) {
        showTooltip();
      }
    });

    icon.addEventListener('mouseleave', () => {
      // Eğer tıklanarak sabitlenmemişse kapat
      const existing = document.querySelector('.custom-tooltip');
      if (existing && existing.dataset.triggerId === icon.dataset.uniqueId && !existing.dataset.locked) {
        hideTooltip();
      }
    });

    // Click (Hem mobil hem desktop için sabitleme/açma/kapama)
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault(); // Bazı mobil tarayıcılarda çift tetiklemeyi önlemek için

      const existing = document.querySelector('.custom-tooltip');

      // Eğer zaten açıksa
      if (existing && existing.dataset.triggerId === icon.dataset.uniqueId) {
        // Eğer zaten kilitliyse (tıklanarak açılmışsa), kapat
        if (existing.dataset.locked) {
          hideTooltip();
        } else {
          // Hover ile açılmış ama şimdi tıklandı -> Kilitle
          existing.dataset.locked = "true";
        }
      } else {
        // Hiç açık değilse veya başka birininki açıksa -> Aç ve kilitle
        showTooltip();
        const newTooltip = document.querySelector('.custom-tooltip');
        if (newTooltip) newTooltip.dataset.locked = "true";
      }
    });
  });

  // Sayfada boş bir yere tıklayınca tooltip'i kapat
  document.addEventListener('click', () => {
    const existingTooltip = document.querySelector('.custom-tooltip');
    if (existingTooltip) existingTooltip.remove();
  }, { once: false });
}

// Yıllara göre gruplanmış satırları oluştur
function collectGroupedRows(program, donemler) {
  const grouped = {};

  for (const donem of donemler) {
    const donemData = program.istatistikler[donem];
    if (!donemData) continue;

    // Filtreleme
    const yariyillar = selectedYariyilFilter === 'all'
      ? ['3.Yarıyıl', '5.Yarıyıl']
      : [selectedYariyilFilter];

    const yearRows = [];

    for (const yariyil of yariyillar) {
      const data = donemData[yariyil];
      if (!data) continue;

      if (Array.isArray(data)) {
        for (const item of data) {
          yearRows.push(createRowHtml(yariyil, item, donem));
        }
      } else {
        yearRows.push(createRowHtml(yariyil, data, donem));
      }
    }

    if (yearRows.length > 0) {
      grouped[donem] = yearRows;
    }
  }

  return grouped;
}

// Satır HTML'i (Sadece veri hücreleri)
function createRowHtml(yariyil, data, yilLabel) {
  const kontenjan = data.kontenjan !== null ? data.kontenjan : '-';
  const yerlesen = data.yerlesen || 0;
  const tavan = formatGPA(data.tavan);
  const taban = formatGPA(data.taban);

  const tavanClass = getGPAClass(data.tavan);
  const tabanClass = getGPAClass(data.taban);

  const aciklamaAttr = data.aciklama ? `data-title="${data.aciklama}"` : '';
  const aciklamaIcon = data.aciklama ? ` <span class="aciklama-icon" ${aciklamaAttr}>*</span>` : '';

  // Yıl ve Yarıyıl birleşimi (Örn: 2024-2025 3. Yarıyıl)
  const fullYariyilText = `${yilLabel ? yilLabel + ' ' : ''}${yariyil.replace('.Yarıyıl', '. Yarıyıl')}`;

  return `
    <td class="cell-yariyil" data-mobil-text="${fullYariyilText}">${yariyil.replace('.Yarıyıl', '. Yarıyıl')}</td>
    <td class="cell-kontenjan"><div class="stat-content">${kontenjan}${aciklamaIcon}</div></td>
    <td class="cell-yerlesen">${yerlesen}</td>
    <td class="cell-tavan ${tavanClass}">${tavan}</td>
    <td class="cell-taban ${tabanClass}">${taban}</td>
  `;
}

// GPA formatla
function formatGPA(value) {
  if (value === null || value === undefined) return '-';
  return value.toFixed(2);
}

// GPA için CSS sınıfı
function getGPAClass(value) {
  if (value === null || value === undefined) return 'gno-neutral';
  if (value >= 3.75) return 'gno-high'; // Kırmızı (3.75 - 4.00)
  if (value >= 3.50) return 'gno-medium'; // Turuncu (3.50 - 3.75)
  return ''; // Normal text rengi
}

// Arama filtresi
function filterPrograms() {
  renderPrograms();
}

// Modal fonksiyonları
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  document.body.style.overflow = 'auto';
}

// Modal dışına tıklandığında kapat
window.onclick = function (event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
};

// ESC tuşu ile modal kapatma
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
  }
});
