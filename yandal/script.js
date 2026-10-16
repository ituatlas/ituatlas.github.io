let yandalData = null;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatValue = (value, decimals = false) => value == null ? '—' : decimals ? value.toFixed(2) : String(value);

document.addEventListener('DOMContentLoaded', async () => {
  for (const id of ['yilSayisi', 'yariyilFilter']) document.getElementById(id).addEventListener('change', renderPrograms);
  document.getElementById('searchInput').addEventListener('input', renderPrograms);
  try {
    const response = await fetch('yandal-data.json');
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    yandalData = await response.json();
    document.getElementById('footerDate').textContent = yandalData.meta.guncelleme_tarihi;
    document.getElementById('yilSayisi').innerHTML = yandalData.meta.donemler.map((_, i) =>
      `<option value="${i + 1}"${i === 2 ? ' selected' : ''}>Son ${i + 1} Yıl</option>`).join('') + '<option value="all">Tüm Yıllar</option>';
    document.getElementById('sourceList').innerHTML = Object.values(yandalData.meta.kaynak_bilgileri)
      .sort((a, b) => b.yil.localeCompare(a.yil))
      .map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.baslik)} ↗</a></li>`).join('');
    renderPrograms();
  } catch (error) {
    document.getElementById('results-container').innerHTML = '<p class="error" role="alert">Yandal verileri yüklenemedi. Lütfen sayfayı yenileyerek tekrar dene.</p>';
  } finally {
    document.getElementById('results-container').setAttribute('aria-busy', 'false');
  }
});

function collectRows(program, years, semester) {
  const rows = [];
  for (const year of years) {
    for (const term of semester === 'all' ? ['3.Yarıyıl', '5.Yarıyıl'] : [semester]) {
      for (const stats of program.istatistikler[year]?.[term] || []) rows.push({ year, term, ...stats });
    }
  }
  return rows;
}

function renderPrograms() {
  if (!yandalData) return;
  const search = document.getElementById('searchInput').value.trim().toLocaleLowerCase('tr');
  const count = document.getElementById('yilSayisi').value;
  const years = count === 'all' ? yandalData.meta.donemler : yandalData.meta.donemler.slice(0, Number(count));
  const semester = document.getElementById('yariyilFilter').value;
  const faculties = new Map();
  let programs = 0;
  let rowCount = 0;
  for (const [name, program] of Object.entries(yandalData.programlar)) {
    if (search && !name.toLocaleLowerCase('tr').includes(search)) continue;
    const rows = collectRows(program, years, semester);
    if (!rows.length) continue;
    if (!faculties.has(program.fakulte)) faculties.set(program.fakulte, []);
    faculties.get(program.fakulte).push({ name, rows });
    programs++;
    rowCount += rows.length;
  }
  const html = [...faculties].sort(([a], [b]) => a.localeCompare(b, 'tr')).map(([faculty, items], facultyIndex) => {
    const bodies = items.sort((a, b) => a.name.localeCompare(b.name, 'tr')).map(({ name, rows }) => {
      const rendered = rows.map((row, i) => `<tr data-yil="${row.year}" data-yariyil="${row.term}">
        ${i === 0 ? `<td class="program-cell" rowspan="${rows.length}"><div class="program-name">${escapeHtml(name)}</div></td>` : ''}
        <td rowspan="1">${row.year}</td>
        <td class="cell-yariyil" data-mobil-text="${row.year} ${row.term.replace('.', '. ')}">${row.term.replace('.', '. ')}</td>
        <td class="cell-kontenjan">${formatValue(row.kontenjan)}</td><td class="cell-yerlesen">${formatValue(row.yerlesen)}</td>
        <td class="cell-tavan">${formatValue(row.tavan, true)}</td><td class="cell-taban">${formatValue(row.taban, true)}</td>
        <td class="cell-aciklama${row.aciklama ? '' : ' is-empty'}">${row.aciklama ? escapeHtml(row.aciklama) : '—'}</td>
      </tr>`).join('');
      return `<tbody><tr class="mobile-program-header"><td colspan="8">${escapeHtml(name)}</td></tr>${rendered}</tbody>`;
    }).join('');
    return `<section class="fakulte-group"><h2 class="fakulte-baslik" id="faculty-${facultyIndex}">${escapeHtml(faculty)}</h2><div class="table-wrapper"><table class="programs-table" aria-labelledby="faculty-${facultyIndex}"><thead><tr><th scope="col">Program</th><th scope="col">Dönem</th><th scope="col">Yarıyıl</th><th scope="col">Kontenjan</th><th scope="col">Yerleşen</th><th scope="col">Tavan AGNO</th><th scope="col">Taban AGNO</th><th scope="col">Açıklama</th></tr></thead>${bodies}</table></div></section>`;
  }).join('');
  document.getElementById('results-container').innerHTML = html || '<p class="no-results">Arama kriterlerine uygun sonuç bulunamadı.</p>';
  document.getElementById('resultCount').textContent = `${programs} program · ${rowCount} sonuç satırı`;
}
