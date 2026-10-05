import { useEffect, useRef, useState } from 'react';

const STATUS_LABEL = { running: 'Running', success: 'Completed', error: 'Failed' };

export default function ExportTask() {
  const [task, setTask] = useState(null);
  const started = useRef(false);

  const run = async () => {
    const startedAt = new Date();
    setTask({ status: 'running', startedAt });
    try {
      const res = await fetch('/api/export', { method: 'POST' });
      const data = await res.json();
      const done = { ...data, startedAt, status: res.ok ? 'success' : 'error' };
      setTask(done);
      if (res.ok) download(data.file);
    } catch (e) {
      setTask({ status: 'error', startedAt, log: e.message });
    }
  };

  const download = (file) => {
    const a = document.createElement('a');
    a.href = `/api/export/${encodeURIComponent(file)}`;
    a.download = file;
    a.click();
  };

  useEffect(() => {
    // Guard against React StrictMode running the effect twice in dev
    if (started.current) return;
    started.current = true;
    run();
  }, []);

  if (!task) return null;

  return (
    <section className="section export-task">
      <h2>Excel export task</h2>
      <dl className="task-info">
        <dt>Script</dt><dd><code>scripts/export_to_excel.py</code></dd>
        <dt>Status</dt>
        <dd><span className={`badge task-${task.status}`}>{STATUS_LABEL[task.status]}</span></dd>
        <dt>Started</dt><dd>{task.startedAt.toLocaleString()}</dd>
        {task.durationMs != null && (<><dt>Duration</dt><dd>{(task.durationMs / 1000).toFixed(1)} s</dd></>)}
        {task.file && (<><dt>File</dt><dd>{task.file}</dd></>)}
      </dl>

      {task.status === 'running' && <div className="progress"><div /></div>}

      {task.log && (
        <>
          <h3>Execution log</h3>
          <pre className="task-log">{task.log}</pre>
        </>
      )}

      <div className="toolbar">
        {task.file && <button className="btn primary" onClick={() => download(task.file)}>Download file</button>}
        <button className="btn" onClick={run} disabled={task.status === 'running'}>Run again</button>
        <button className="btn" onClick={() => window.close()}>Close tab</button>
      </div>
    </section>
  );
}
