import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Generates 2–3 random 2-digit numbers whose sum is < 99.
 */
function generate() {
  const count = Math.random() < 0.5 ? 2 : 3;
  const nums = [];
  let budget = 98; // max sum allowed: < 99
  for (let i = 0; i < count; i++) {
    const remaining = count - 1 - i;
    const lo = 10;
    const hi = Math.min(49, budget - remaining * 10);
    const n = hi >= lo ? Math.floor(Math.random() * (hi - lo + 1)) + lo : lo;
    nums.push(n);
    budget -= n;
  }
  return nums;
}

/**
 * MathCaptcha — simple arithmetic challenge to confirm destructive actions.
 *
 * Props:
 *   onVerified(bool) — called whenever the answer changes correctness.
 */
export default function MathCaptcha({ onVerified }) {
  const [nums, setNums] = useState(generate);
  const [input, setInput] = useState('');

  const answer = nums.reduce((a, b) => a + b, 0);
  const isCorrect = input.trim() !== '' && parseInt(input, 10) === answer;

  function handleChange(e) {
    const val = e.target.value;
    setInput(val);
    const correct = val.trim() !== '' && parseInt(val, 10) === answer;
    onVerified?.(correct);
  }

  function refresh() {
    setNums(generate());
    setInput('');
    onVerified?.(false);
  }

  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--bg-hover)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
        Solve to confirm
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
          color: 'var(--text-primary)', letterSpacing: 1,
        }}>
          {nums.join(' + ')} = ?
        </span>
        <button
          type="button"
          onClick={refresh}
          className="btn btn-ghost btn-sm"
          style={{ padding: '2px 6px' }}
          title="New challenge"
        >
          <RefreshCw size={11} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          value={input}
          onChange={handleChange}
          placeholder="Answer"
          className="form-control"
          style={{ width: 100, fontSize: 13, padding: '5px 10px', fontFamily: 'var(--font-mono)' }}
          autoComplete="off"
        />
        {input.trim() !== '' && (
          <span style={{
            fontSize: 12, fontFamily: 'var(--font-mono)',
            color: isCorrect ? 'var(--success)' : 'var(--danger)',
          }}>
            {isCorrect ? '✓ Correct' : '✗ Try again'}
          </span>
        )}
      </div>
    </div>
  );
}
