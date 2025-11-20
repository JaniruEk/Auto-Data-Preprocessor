import React, { useState } from "react";
import Plot from "react-plotly.js";
import "./App.css";

const API = "/api";

function App() {
  const [file, setFile] = useState(null);
  const [datasetId, setDatasetId] = useState("");
  const [preview, setPreview] = useState({ columns: [], rows: [] });
  const [stats, setStats] = useState(null);
  const [hists, setHists] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(null);
  const [scaleNumeric, setScaleNumeric] = useState(true);
  const [error, setError] = useState("");

  const uploadCSV = async (e) => {
    e.preventDefault();
    if (!file) return;
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const resp = await fetch(`${API}/upload`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setDatasetId(data.dataset_id);
      setPreview(data.preview);
      fetchStats(data.dataset_id);
      fetchHists(data.dataset_id, data.preview.columns);
      setProcessed(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchStats = async (id) => {
    const resp = await fetch(`${API}/profile?dataset_id=${id}`);
    setStats(await resp.json());
  };

  const fetchHists = async (id, columns) => {
    const plots = await Promise.all(
      columns.slice(0, 6).map(async (col) => {
        const resp = await fetch(`${API}/visual/hist?dataset_id=${id}&column=${encodeURIComponent(col)}&bins=20`);
        const data = await resp.json();
        return { col, ...data };
      })
    );
    setHists(plots);
  };

  const preprocess = async () => {
    setProcessing(true);
    setError("");
    try {
      const resp = await fetch(`${API}/preprocess?dataset_id=${datasetId}&scale_numeric=${scaleNumeric}`, { method: "POST" });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setProcessed(data.processed_preview);
    } catch (err) {
      setError(err.message);
    }
    setProcessing(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">CSV Auto Preprocess & Visualize (React)</h1>
      <form className="flex gap-3 items-center mb-6" onSubmit={uploadCSV}>
        <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} />
        <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">Upload CSV</button>
        {error && <span className="text-red-600 ml-3">{error}</span>}
      </form>
      {preview.columns.length > 0 && (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Preview</h2>
            <div className="overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>{preview.columns.map((c) => <th key={c} className="p-2 border-b bg-slate-50">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i}>{r.map((v, j) => <td key={j} className="p-2 border-b">{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {stats && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded p-4">
                <div className="text-slate-500">Rows</div>
                <div className="text-3xl font-semibold">{stats.info.rows}</div>
              </div>
              <div className="bg-white border rounded p-4">
                <div className="text-slate-500">Columns</div>
                <div className="text-3xl font-semibold">{stats.info.cols}</div>
              </div>
              <div className="bg-white border rounded p-4">
                <div className="text-slate-500">Top Correlations</div>
                <div className="text-sm">{stats.top_correlations[0] ? `${stats.top_correlations[0].col_x} vs ${stats.top_correlations[0].col_y} (${stats.top_correlations[0].corr.toFixed(2)})` : '—'}</div>
              </div>
            </div>
          )}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Histograms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hists.map((h) => (
                <div key={h.col} className="border rounded p-2">
                  <div className="text-sm font-medium mb-2">{h.col}</div>
                  <Plot
                    data={[
                      {
                        x: h.bins.length > 1 && typeof h.bins[0] === 'number'
                          ? h.bins.slice(0, -1).map((b, i) => (b + h.bins[i + 1]) / 2)
                          : h.bins,
                        y: h.counts,
                        type: 'bar',
                        marker: { color: '#3b82f6' },
                      },
                    ]}
                    layout={{ margin: { t: 10, r: 10, b: 30, l: 30 }, height: 220, width: 320 }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mb-6 bg-white border rounded p-4">
            <div className="flex items-center gap-4 mb-3">
              <h2 className="text-lg font-semibold">Auto Preprocess</h2>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={scaleNumeric} onChange={e => setScaleNumeric(e.target.checked)} /> Scale numeric
              </label>
              <button className="px-4 py-2 bg-emerald-600 text-white rounded" onClick={preprocess} disabled={processing}>
                {processing ? "Processing…" : "Run Preprocess"}
              </button>
            </div>
            {processed && (
              <>
                <div className="overflow-auto border rounded mb-2">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>{processed.columns.map((c) => <th key={c} className="p-2 border-b bg-slate-50">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {processed.rows.map((r, i) => (
                        <tr key={i}>{r.map((v, j) => <td key={j} className="p-2 border-b">{v}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <a href={`${API}/download?dataset_id=${datasetId}&type=processed`} className="text-blue-600 hover:underline" download>
                  Download processed CSV
                </a>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
