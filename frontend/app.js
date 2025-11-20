// (Removed: migrated to React)
let currentDatasetId = null;

const $ = (id) => document.getElementById(id);

function renderTable(containerId, columns, rows) {
  const container = $(containerId);
  const table = document.createElement('table');
  table.className = 'min-w-full text-sm';
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${columns.map(c => `<th class='text-left p-2 border-b bg-slate-50'>${c}</th>`).join('')}</tr>`;
  const tbody = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = r.map(v => `<td class='p-2 border-b'>${String(v)}</td>`).join('');
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

async function loadPreview() {
  const data = await fetchJSON(`/api/preview?dataset_id=${currentDatasetId}`);
  renderTable('previewTable', data.columns, data.rows);
}

async function loadProfile() {
  const prof = await fetchJSON(`/api/profile?dataset_id=${currentDatasetId}`);
  $('rowsStat').textContent = prof.info.rows;
  $('colsStat').textContent = prof.info.cols;
  $('corrStat').textContent = (prof.top_correlations[0] ? `${prof.top_correlations[0].col_x} vs ${prof.top_correlations[0].col_y} (${prof.top_correlations[0].corr.toFixed(2)})` : '—');
}

async function loadHists() {
  const preview = await fetchJSON(`/api/preview?dataset_id=${currentDatasetId}`);
  const cols = preview.columns;
  const histContainer = $('hists');
  histContainer.innerHTML = '';
  // Render up to first 6 columns
  const sampleCols = cols.slice(0, 6);
  for (const c of sampleCols) {
    const div = document.createElement('div');
    div.className = 'border rounded p-2';
    const plotId = `plot_${c}`;
    div.innerHTML = `<div class='text-sm font-medium mb-2'>${c}</div><div id='${plotId}' style='height:240px;'></div>`;
    histContainer.appendChild(div);

    try {
      const hist = await fetchJSON(`/api/visual/hist?dataset_id=${currentDatasetId}&column=${encodeURIComponent(c)}&bins=20`);
      let x = hist.bins;
      let y = hist.counts;
      // For numeric, bins is edges. Convert to midpoints for bar chart.
      if (x.length > 1 && typeof x[0] === 'number') {
        const mids = [];
        for (let i = 0; i < x.length - 1; i++) {
          mids.push((x[i] + x[i+1]) / 2);
        }
        x = mids;
      }
      Plotly.newPlot(plotId, [{x, y, type: 'bar', marker: {color: '#3b82f6'}}], {margin: {t: 10, r: 10, b: 30, l: 30}});
    } catch (e) {
      console.error(e);
    }
  }
}

$('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = $('fileInput').files[0];
  if (!file) return;
  $('uploadStatus').textContent = 'Uploading…';
  const fd = new FormData();
  fd.append('file', file);
  try {
    const resp = await fetchJSON('/api/upload', { method: 'POST', body: fd });
    currentDatasetId = resp.dataset_id;
    $('uploadStatus').textContent = 'Uploaded!';
    $('datasetSection').classList.remove('hidden');
    await loadPreview();
    await loadProfile();
    await loadHists();
  } catch (e) {
    $('uploadStatus').textContent = 'Upload failed';
    alert(e.message || 'Upload failed');
  }
});

$('preprocessBtn').addEventListener('click', async () => {
  if (!currentDatasetId) return;
  $('preprocessStatus').textContent = 'Processing…';
  const scale = $('scaleToggle').checked;
  try {
    const resp = await fetchJSON(`/api/preprocess?dataset_id=${currentDatasetId}&scale_numeric=${scale}`, { method: 'POST' });
    if (resp.processed_preview) {
      renderTable('processedPreview', resp.processed_preview.columns, resp.processed_preview.rows);
    }
    const a = document.createElement('a');
    a.href = resp.download_url;
    a.textContent = 'Download processed CSV';
    a.className = 'inline-block mt-2 text-blue-600 hover:underline';
    $('processedPreview').prepend(a);
    $('preprocessStatus').textContent = 'Done';
  } catch (e) {
    $('preprocessStatus').textContent = 'Failed';
    alert(e.message || 'Preprocess failed');
  }
});
// (Removed: migrated to React)
