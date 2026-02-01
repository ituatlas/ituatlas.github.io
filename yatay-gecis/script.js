let appData = null;
let currentYksPuan = null;
let currentYksYil = null;
let selectedYariyilFilter = 'all'; // 'all', '3.Yarıyıl', '5.Yarıyıl'

// Sayfa yüklendiğinde verileri çek
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('app-data.json');
    if (!response.ok) throw new Error('Veri dosyası yüklenemedi');
    appData = await response.json();

    document.getElementById('footerDate').textContent = appData.meta.guncelleme_tarihi;

    // YKS yılı seçeneklerini güncelle
    const yilSelect = document.getElementById('yksYil');
    yilSelect.innerHTML = appData.meta.yks_yillari
      .map(y => `<option value="${y}">${y}</option>`)
      .join('');

    renderInitialMessage();
  } catch (error) {
    document.getElementById('results-container').innerHTML =
      `<div class="error-message">Hata: ${error.message}</div>`;
  }
});

function renderInitialMessage() {
  document.getElementById('results-container').innerHTML =
    `<div class="loading">
           <p style="font-size: 1.1rem; color: var(--text);">Sonuçları görmek için <strong>YKS Puanınızı</strong> girip <strong>Sınav Yılınızı</strong> seçtikten sonra <strong>Hesapla</strong> butonuna tıklayın.</p>
         </div>`;
}

function hesapla() {
  const yksPuan = parseFloat(document.getElementById('yksPuan').value);
  const yksYil = parseInt(document.getElementById('yksYil').value);

  if (!yksPuan || yksPuan <= 0) {
    alert('Lütfen geçerli bir YKS puanı girin.');
    return;
  }

  currentYksPuan = yksPuan;
  currentYksYil = yksYil;

  renderPrograms();
}

function hesaplaGNO(yatayGecisTabanPuani, yksPuan, osymTaban) {
  if (!osymTaban || osymTaban === 0) return null;

  // Formül: Puan = (YKS / ÖSYM_Taban) * 0.40 + (GNO / 4 * 100) * 0.60
  // Tersine: GNO = ((Puan - (YKS / ÖSYM_Taban) * 0.40) / 0.60) * 4 / 100
  const yksKatkisi = (yksPuan / osymTaban) * 0.40;
  const gnoKatkisi = yatayGecisTabanPuani - yksKatkisi;
  const gno = (gnoKatkisi / 0.60) * 4;

  return gno;
}

function formatGNO(gno) {
  if (gno === null) return { text: 'Hesaplanamıyor', class: 'info' };

  if (gno <= 0) {
    return { text: 'Herhangi bir AGNO ile geçiş mümkün', class: 'info' };
  } else if (gno > 4) {
    return { text: 'Bu YKS puanıyla geçiş zor (AGNO > 4.00 gerekir)', class: 'error' };
  } else {
    return { text: gno.toFixed(2), class: '' };
  }
}

function renderPrograms() {
  if (!appData || !currentYksPuan) return;

  const programlar = appData.programlar;
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  let html = `
        <table class="programs-table">
          <thead>
            <tr>
              <th class="col-program">Bölüm</th>
              <th class="col-yil">Dönem</th>
              <th class="col-yariyil">
                Yarıyıl <select id="yariyilFilter" class="yariyil-filter" onchange="filterByYariyil()">
                  <option value="all" ${selectedYariyilFilter === 'all' ? 'selected' : ''}>Tümü</option>
                  <option value="3.Yarıyıl" ${selectedYariyilFilter === '3.Yarıyıl' ? 'selected' : ''}>3. Yarıyıl</option>
                  <option value="5.Yarıyıl" ${selectedYariyilFilter === '5.Yarıyıl' ? 'selected' : ''}>5. Yarıyıl</option>
                </select>
              </th>
              <th class="col-stat">Kontenjan</th>
              <th class="col-stat">Yerleşen</th>
              <th class="col-stat">Taban Puan</th>
              <th class="col-stat">Tavan Puan</th>
              <th class="col-gno">Min AGNO</th>
              <th class="col-gno">Max AGNO</th>
            </tr>
          </thead>
      `;
  let count = 0;

  // Programları 2025 YKS puanına göre sırala (yüksekten düşüğe)
  const sortedPrograms = Object.entries(programlar)
    .filter(([programAdi, programData]) => {
      // Arama filtresi
      return !searchTerm || programAdi.toLowerCase().includes(searchTerm);
    })
    .sort(([, dataA], [, dataB]) => {
      const puanA = dataA.osym_taban_puanlari[2025] || 0;
      const puanB = dataB.osym_taban_puanlari[2025] || 0;
      return puanB - puanA; // Yüksekten düşüğe sıralama
    });

  for (const [programAdi, programData] of sortedPrograms) {
    count++;
    const osymTaban = programData.osym_taban_puanlari[currentYksYil];

    // Yıllara göre gruplanmış verileri al
    const groupedRows = collectGroupedRows(programData, osymTaban);

    html += '<tbody class="program-group">';

    if (Object.keys(groupedRows).length === 0) {
      // Veri yoksa tek satır göster
      const osymBadge = osymTaban
        ? `<span class="osym-badge">${currentYksYil} Taban Puanı: ${osymTaban.toFixed(2)}</span>`
        : `<span class="osym-badge warning">${currentYksYil} Taban Puanı: Veri Yok</span>`;

      html += `
            <tr>
              <td class="col-program">
                <span class="program-cell-title">${programAdi}</span>
                <span class="program-cell-faculty">${programData.fakulte}</span>
                ${osymBadge}
              </td>
              <td colspan="8" class="no-data-cell">Görüntülenecek geçmiş dönem verisi bulunamadı</td>
            </tr>
          `;
    } else {
      // Her yıl grubu için döngü
      let isFirstYear = true;
      for (const [yilLabel, rows] of Object.entries(groupedRows)) {

        rows.forEach((rowHtml, index) => {
          html += '<tr>';

          // İlk yılın ilk satırında program bilgisi
          if (isFirstYear && index === 0) {
            // Toplam satır sayısını hesapla
            let totalRows = 0;
            Object.values(groupedRows).forEach(r => totalRows += r.length);

            const osymBadge = osymTaban
              ? `<span class="osym-badge">${currentYksYil} Taban Puanı: ${osymTaban.toFixed(2)}</span>`
              : `<span class="osym-badge warning">${currentYksYil} Taban Puanı: Veri Yok</span>`;

            html += `
                  <td class="col-program" rowspan="${totalRows}">
                    <span class="program-cell-title">${programAdi}</span>
                    <span class="program-cell-faculty">${programData.fakulte}</span>
                    ${osymBadge}
                  </td>
                `;
            isFirstYear = false;
          }

          // Yılın ilk satırında Yıl hücresi
          if (index === 0) {
            html += `<td class="col-yil" rowspan="${rows.length}">${yilLabel}</td>`;
          }

          html += rowHtml;
          html += '</tr>';
        });
      }
    }
    html += '</tbody>';
  }

  html += '</table>';

  document.getElementById('results-container').innerHTML = html;

  if (count === 0) {
    document.getElementById('results-container').innerHTML = '<div class="loading">Aramanızla eşleşen program bulunamadı.</div>';
  }
}

function collectGroupedRows(programData, osymTaban) {
  const donemler = appData.meta.donemler;
  const grouped = {}; // { '2025-2026': [rowHtml1, rowHtml2], '2024-2025': [...] }

  for (const donem of donemler) {
    const donemData = programData.yatay_gecis_istatistikleri[donem];
    if (!donemData) continue;

    const yilLabel = formatDonemKisa(donem);
    if (!grouped[yilLabel]) {
      grouped[yilLabel] = [];
    }

    for (const [yariyil, data] of Object.entries(donemData)) {
      // Yarıyıl filtresi uygula
      if (selectedYariyilFilter !== 'all' && yariyil !== selectedYariyilFilter) {
        continue;
      }

      const rowHtml = createDataRow(yilLabel, yariyil, data, osymTaban);
      if (rowHtml) grouped[yilLabel].push(rowHtml);
    }

    // Eğer filtreleme sonucu yıl boş kaldıysa key'i sil
    if (grouped[yilLabel].length === 0) {
      delete grouped[yilLabel];
    }
  }

  return grouped;
}

function filterByYariyil() {
  const filterSelect = document.getElementById('yariyilFilter');
  selectedYariyilFilter = filterSelect.value;
  if (currentYksPuan) {
    renderPrograms();
  }
}

function formatDonemKisa(donem) {
  // 202610 -> 2025-2026 (akademik yıl formatı, dönem adı olmadan)
  const yil = parseInt(donem.substring(0, 4));
  const ay = donem.substring(4);

  if (ay === '10') {
    // Güz dönemi: bir önceki yıl ile başlar (2026 Güz -> 2025-2026)
    return `${yil - 1}-${yil}`;
  } else {
    // Bahar dönemi: aynı akademik yıl (2025 Bahar -> 2024-2025)  
    return `${yil - 1}-${yil}`;
  }
}

function createDataRow(yil, yariyil, data, osymTaban) {
  const { kontenjan, yerlesen, taban, tavan } = data;

  if (kontenjan === 0) {
    return `
              <td class="col-yariyil" data-label="Dönem" data-yil="${yil}" data-yariyil-text="${yariyil}">${yariyil}</td>
              <td colspan="6" class="no-data-cell">Kontenjan Açılmadı</td>
            `;
  }

  if (yerlesen === 0) {
    return `
              <td class="col-yariyil" data-label="Dönem" data-yil="${yil}" data-yariyil-text="${yariyil}">${yariyil}</td>
              <td class="col-stat" data-label="Kontenjan">${kontenjan}</td>
              <td class="col-stat" data-label="Yerleşen">0</td>
              <td colspan="4" class="no-data-cell">Yerleşen Yok</td>
            `;
  }

  // GNO Hesaplama
  const gnoTaban = hesaplaGNO(taban, currentYksPuan, osymTaban);
  const gnoTavan = hesaplaGNO(tavan, currentYksPuan, osymTaban);

  let minGnoDisplay = '-';
  let maxGnoDisplay = '-';
  let minClass = '';
  let maxClass = '';

  if (gnoTaban !== null && gnoTavan !== null) {
    const minGno = Math.max(0, Math.min(gnoTaban, gnoTavan));
    const maxGno = Math.min(4, Math.max(gnoTaban, gnoTavan));

    if (gnoTaban > 4 && gnoTavan > 4) {
      minGnoDisplay = '>4.00';
      maxGnoDisplay = '>4.00';
      minClass = 'gno-error';
      maxClass = 'gno-error';
    } else if (gnoTaban <= 0 && gnoTavan <= 0) {
      minGnoDisplay = 'Yok';
      maxGnoDisplay = 'Yok';
      minClass = 'gno-info';
      maxClass = 'gno-info';
    } else {
      minGnoDisplay = minGno.toFixed(2);
      if (maxGno > 4) {
        maxGnoDisplay = '4.00+';
        maxClass = 'gno-warning';
      } else {
        maxGnoDisplay = maxGno.toFixed(2);
      }
      minClass = '';
      if (!maxClass) maxClass = '';
    }
  } else {
    minGnoDisplay = 'N/A';
    maxGnoDisplay = 'N/A';
    minClass = 'gno-warning';
    maxClass = 'gno-warning';
  }

  return `
          <td class="col-yariyil" data-label="Dönem" data-yil="${yil}" data-yariyil-text="${yariyil}">${yariyil}</td>
          <td class="col-stat" data-label="Kont">${kontenjan}</td>
          <td class="col-stat" data-label="Yer">${yerlesen}</td>
          <td class="col-stat" data-label="Taban">${taban ? taban.toFixed(4) : '-'}</td>
          <td class="col-stat" data-label="Tavan">${tavan ? tavan.toFixed(4) : '-'}</td>
          <td class="col-gno ${minClass}" data-label="Min GNO">${minGnoDisplay}</td>
          <td class="col-gno ${maxClass}" data-label="Max GNO">${maxGnoDisplay}</td>
        `;
}

function filterPrograms() {
  if (currentYksPuan) {
    renderPrograms();
  }
}

// Enter tuşu ile hesaplama
document.getElementById('yksPuan').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') hesapla();
});

// Modal Açma/Kapama Fonksiyonları
function openModal(modalId) {
  document.getElementById(modalId).style.display = "block";
  document.body.style.overflow = "hidden"; // Arka plan kaydırmayı engelle
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
  document.body.style.overflow = "auto"; // Kaydırmayı geri aç
}

// Modal dışına tıklayınca kapatma
window.onclick = function (event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = "none";
    document.body.style.overflow = "auto";
  }
}
