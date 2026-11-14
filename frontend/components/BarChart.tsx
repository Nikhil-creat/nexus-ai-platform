export type Bar = { label: string; value: number };

/** Dependency-free horizontal bar chart (accessible: values are real text, not just colour). */
export default function BarChart({ title, data, format = (n: number) => String(n) }: { title: string; data: Bar[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <h3>{title}</h3>
      {data.length === 0 && <div className="form__status">No data</div>}
      {data.map((d) => (
        <div className="bar" key={d.label}>
          <span title={d.label} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
          <div className="bar__track" role="img" aria-label={`${d.label}: ${format(d.value)}`}>
            <div className="bar__fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <b>{format(d.value)}</b>
        </div>
      ))}
    </figure>
  );
}
