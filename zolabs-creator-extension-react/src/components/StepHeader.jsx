export default function StepHeader({ step, title, subtitle }) {
  return (
    <header className="step-header">
      <div className="step-badge">Step {step}</div>
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
}
