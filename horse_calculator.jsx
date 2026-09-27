import React, { useState, useEffect, useRef, useMemo } from 'react';

const MIN_SPEED = 4.74, MAX_SPEED = 14.23;
const MIN_JUMP = 1.19, MAX_JUMP = 5.29;
const MIN_HEARTS = 7.5, MAX_HEARTS = 15;

function clamp01to100(v) { return Math.max(0, Math.min(100, v)); }
function normalize(value, min, max) {
  return clamp01to100(((value - min) / (max - min)) * 100);
}

function scoreColor(score) {
  if (score >= 90) return '#ffd54a';
  if (score >= 70) return '#7cc242';
  if (score >= 50) return '#f0a830';
  if (score >= 30) return '#d96a3a';
  return '#c0392b';
}

function scoreLabel(score, mode = 'perfect') {
  if (mode === 'trash') {
    if (score >= 95) return 'PERFECT TRASH';
    if (score >= 85) return 'ATROCIOUS';
    if (score >= 70) return 'TERRIBLE';
    if (score >= 50) return 'GETTING BAD';
    if (score >= 30) return 'NOT BAD ENOUGH';
    return 'TOO GOOD';
  }
  if (score >= 95) return 'LEGENDARY';
  if (score >= 85) return 'AMAZING';
  if (score >= 70) return 'GREAT';
  if (score >= 50) return 'DECENT';
  if (score >= 30) return 'WEAK';
  return 'TRASH';
}

// Display score: in trash mode, low overall is the goal, so we flip for display
function displayOf(overall, mode) {
  return mode === 'trash' ? 100 - overall : overall;
}

// === Breeding simulation (Java 1.19.4+ formula) ===
// Foal stat = average of parents + r * (|parent_diff| + 0.3 * range)
// where r is triangular on [-0.5, 0.5] centered at 0 (biased toward 0)
function simulateStat(v1, v2, min, max) {
  const avg = (v1 + v2) / 2;
  const diff = Math.abs(v1 - v2);
  const range = max - min;
  // Triangular distribution via average of two uniforms
  const r = (Math.random() + Math.random() - 1) / 2;
  const deviation = r * (diff + 0.3 * range);
  return Math.max(min, Math.min(max, avg + deviation));
}

function simulateFoal(a, b) {
  const speed = simulateStat(a.speed, b.speed, MIN_SPEED, MAX_SPEED);
  const jump = simulateStat(a.jump, b.jump, MIN_JUMP, MAX_JUMP);
  const hearts = simulateStat(a.hearts, b.hearts, MIN_HEARTS, MAX_HEARTS);
  const s = normalize(speed, MIN_SPEED, MAX_SPEED);
  const j = normalize(jump, MIN_JUMP, MAX_JUMP);
  const h = normalize(hearts, MIN_HEARTS, MAX_HEARTS);
  return { speed, jump, hearts, overall: (s + j + h) / 3 };
}

function analyzePair(a, b, mode = 'perfect', n = 800) {
  let sumOverall = 0;
  let bestForGoal = mode === 'perfect' ? 0 : 100;
  let beatsParents = 0, nearGoal = 0, perfectGoal = 0;
  let sumSpeed = 0, sumJump = 0, sumHearts = 0;
  const bestParentOverall = Math.max(a.total, b.total);
  const worstParentOverall = Math.min(a.total, b.total);
  for (let i = 0; i < n; i++) {
    const f = simulateFoal(a, b);
    sumOverall += f.overall;
    if (mode === 'perfect') {
      if (f.overall > bestForGoal) bestForGoal = f.overall;
      if (f.overall > bestParentOverall) beatsParents++;
      if (f.overall >= 95) nearGoal++;
      if (f.overall >= 99) perfectGoal++;
    } else {
      if (f.overall < bestForGoal) bestForGoal = f.overall;
      if (f.overall < worstParentOverall) beatsParents++;
      if (f.overall <= 5) nearGoal++;
      if (f.overall <= 1) perfectGoal++;
    }
    sumSpeed += f.speed;
    sumJump += f.jump;
    sumHearts += f.hearts;
  }
  return {
    a, b,
    meanOverall: sumOverall / n,
    bestForGoal,
    pBeatsParents: beatsParents / n,
    pNearGoal: nearGoal / n,
    pPerfectGoal: perfectGoal / n,
    avgSpeed: sumSpeed / n,
    avgJump: sumJump / n,
    avgHearts: sumHearts / n,
  };
}

function getAllPairs(horses, mode = 'perfect') {
  const pairs = [];
  for (let i = 0; i < horses.length; i++) {
    for (let j = i + 1; j < horses.length; j++) {
      pairs.push(analyzePair(horses[i], horses[j], mode));
    }
  }
  pairs.sort((x, y) => mode === 'perfect'
    ? y.meanOverall - x.meanOverall
    : x.meanOverall - y.meanOverall);
  return pairs;
}

function findDominated(horses, mode = 'perfect') {
  const result = [];
  for (const h of horses) {
    const dominator = horses.find(other => {
      if (other.id === h.id) return false;
      if (mode === 'perfect') {
        return other.speed >= h.speed &&
          other.jump >= h.jump &&
          other.hearts >= h.hearts &&
          (other.speed > h.speed || other.jump > h.jump || other.hearts > h.hearts);
      }
      return other.speed <= h.speed &&
        other.jump <= h.jump &&
        other.hearts <= h.hearts &&
        (other.speed < h.speed || other.jump < h.jump || other.hearts < h.hearts);
    });
    if (dominator) result.push({ horse: h, dominator });
  }
  return result;
}

function findStatLeaders(horses, mode = 'perfect') {
  if (horses.length === 0) return null;
  const better = mode === 'perfect' ? (a, b) => a > b : (a, b) => a < b;
  return {
    speed: horses.reduce((b, h) => better(h.speed, b.speed) ? h : b),
    jump: horses.reduce((b, h) => better(h.jump, b.jump) ? h : b),
    hearts: horses.reduce((b, h) => better(h.hearts, b.hearts) ? h : b),
  };
}

export default function HorseCalc() {
  const [speed, setSpeed] = useState(9.5);
  const [jump, setJump] = useState(3.2);
  const [hearts, setHearts] = useState(11);
  const [name, setName] = useState('');
  const [savedHorses, setSavedHorses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [itemsInput, setItemsInput] = useState(String(Math.round(760 / 9.5)));
  const [tab, setTab] = useState('calc');
  const [mode, setMode] = useState('perfect');
  const updatingFromItemsRef = useRef(false);

  const storageKey = mode === 'perfect' ? 'horses' : 'trash_horses';

  // Sync items text whenever speed changes from somewhere other than the items input
  useEffect(() => {
    if (updatingFromItemsRef.current) {
      updatingFromItemsRef.current = false;
      return;
    }
    setItemsInput((760 / speed).toFixed(1));
  }, [speed]);

  function handleItemsChange(e) {
    const text = e.target.value;
    setItemsInput(text);
    const v = parseFloat(text);
    if (!isNaN(v) && v > 0) {
      updatingFromItemsRef.current = true;
      const newSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, 760 / v));
      setSpeed(newSpeed);
    }
  }

  const itemsNum = parseFloat(itemsInput);
  const itemsOutOfRange = !isNaN(itemsNum) && itemsNum > 0 && (
    itemsNum < 760 / MAX_SPEED - 0.05 || itemsNum > 760 / MIN_SPEED + 0.05
  );

  useEffect(() => {
    async function load() {
      setLoaded(false);
      try {
        const result = await window.storage.get(storageKey);
        if (result && result.value) {
          setSavedHorses(JSON.parse(result.value));
        } else {
          setSavedHorses([]);
        }
      } catch (e) { setSavedHorses([]); }
      finally { setLoaded(true); }
    }
    load();
  }, [storageKey]);

  const speedScore = normalize(speed, MIN_SPEED, MAX_SPEED);
  const jumpScore = normalize(jump, MIN_JUMP, MAX_JUMP);
  const healthScore = normalize(hearts, MIN_HEARTS, MAX_HEARTS);
  const total = (speedScore + jumpScore + healthScore) / 3;
  const shown = displayOf(total, mode);

  function sortByMode(list) {
    return [...list].sort((a, b) => mode === 'perfect' ? b.total - a.total : a.total - b.total);
  }

  async function persist(list) {
    try { await window.storage.set(storageKey, JSON.stringify(list)); }
    catch (e) { console.error('save failed', e); }
  }

  async function saveHorse() {
    const horseName = name.trim() || `Horse #${savedHorses.length + 1}`;
    const newHorse = {
      id: Date.now(),
      name: horseName,
      speed: Number(speed),
      jump: Number(jump),
      hearts: Number(hearts),
      total,
    };
    const updated = sortByMode([...savedHorses, newHorse]);
    setSavedHorses(updated);
    setName('');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
    persist(updated);
  }

  async function deleteHorse(id) {
    const updated = savedHorses.filter(h => h.id !== id);
    setSavedHorses(updated);
    persist(updated);
  }

  function loadHorse(h) {
    setSpeed(h.speed);
    setJump(h.jump);
    setHearts(h.hearts);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const color = scoreColor(shown);
  const filledBlocks = Math.round(shown / 5);

  // Pixel heart rendering
  function HeartIcon({ size = 14 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 9 8" style={{ imageRendering: 'pixelated', display: 'inline-block', verticalAlign: 'middle' }}>
        <rect x="1" y="1" width="2" height="1" fill="#7a0a0a"/>
        <rect x="6" y="1" width="2" height="1" fill="#7a0a0a"/>
        <rect x="0" y="2" width="4" height="2" fill="#d63030"/>
        <rect x="5" y="2" width="4" height="2" fill="#d63030"/>
        <rect x="1" y="4" width="7" height="1" fill="#d63030"/>
        <rect x="2" y="5" width="5" height="1" fill="#d63030"/>
        <rect x="3" y="6" width="3" height="1" fill="#d63030"/>
        <rect x="4" y="7" width="1" height="1" fill="#d63030"/>
        <rect x="1" y="2" width="1" height="1" fill="#ff6b6b"/>
        <rect x="6" y="2" width="1" height="1" fill="#ff6b6b"/>
      </svg>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1410',
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px),
        radial-gradient(ellipse at top, rgba(74,100,40,0.15), transparent 60%)
      `,
      backgroundSize: '16px 16px, 16px 16px, 100% 100%',
      color: '#e8e0d0',
      fontFamily: '"VT323", "Courier New", monospace',
      padding: '16px',
      paddingBottom: '40px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
        * { box-sizing: border-box; }
        .pixel-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 18px;
          background: #2a221c;
          outline: none;
          border: 2px solid #0a0805;
          box-shadow: inset 2px 2px 0 rgba(0,0,0,0.6), inset -1px -1px 0 rgba(255,255,255,0.05);
          margin: 0;
          padding: 0;
        }
        .pixel-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 26px;
          background: #7cc242;
          cursor: pointer;
          border: 2px solid #0a0805;
          box-shadow: inset 2px 2px 0 rgba(255,255,255,0.35), inset -2px -2px 0 rgba(0,0,0,0.4);
          border-radius: 0;
        }
        .pixel-slider::-moz-range-thumb {
          width: 22px;
          height: 26px;
          background: #7cc242;
          cursor: pointer;
          border: 2px solid #0a0805;
          box-shadow: inset 2px 2px 0 rgba(255,255,255,0.35), inset -2px -2px 0 rgba(0,0,0,0.4);
          border-radius: 0;
        }
        @keyframes flash {
          0%, 100% { background: #7cc242; }
          50% { background: #ffd54a; }
        }
        .saved-flash { animation: flash 0.6s ease-in-out 2; }
        .pixel-btn {
          font-family: '"Press Start 2P", monospace';
          font-size: 11px;
          padding: 12px 14px;
          background: #7cc242;
          color: #0a0805;
          border: 2px solid #0a0805;
          box-shadow: inset 2px 2px 0 rgba(255,255,255,0.3), inset -2px -2px 0 rgba(0,0,0,0.3);
          cursor: pointer;
          letter-spacing: 1px;
          transition: transform 0.05s;
        }
        .pixel-btn:active { transform: translate(1px, 1px); box-shadow: inset 2px 2px 0 rgba(0,0,0,0.3), inset -2px -2px 0 rgba(255,255,255,0.2); }
        .pixel-btn-sm {
          font-family: '"Press Start 2P", monospace';
          font-size: 8px;
          padding: 8px 10px;
          background: #8b6f47;
          color: #f4ead5;
          border: 2px solid #0a0805;
          box-shadow: inset 2px 2px 0 rgba(255,255,255,0.2), inset -2px -2px 0 rgba(0,0,0,0.3);
          cursor: pointer;
          letter-spacing: 1px;
        }
        .pixel-btn-sm:active { transform: translate(1px, 1px); }
        .pixel-btn-danger { background: #b03028; color: #f4ead5; }
        .pixel-input {
          font-family: '"VT323", monospace';
          font-size: 22px;
          padding: 10px 12px;
          background: #0f0a07;
          color: #f4ead5;
          border: 2px solid #0a0805;
          box-shadow: inset 2px 2px 0 rgba(0,0,0,0.5);
          width: 100%;
          outline: none;
        }
        .pixel-input:focus { border-color: #7cc242; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] { -moz-appearance: textfield; }
        .panel {
          background: #2a221c;
          border: 2px solid #0a0805;
          box-shadow: inset 2px 2px 0 rgba(255,255,255,0.06), inset -2px -2px 0 rgba(0,0,0,0.5), 4px 4px 0 rgba(0,0,0,0.4);
          padding: 16px;
          margin-bottom: 16px;
        }
        .title-font { font-family: '"Press Start 2P", monospace'; }
        .body-font { font-family: '"VT323", monospace'; }
      `}</style>

      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16, paddingTop: 8 }}>
          <div className="title-font" style={{ fontSize: 18, color: mode === 'perfect' ? '#7cc242' : '#c0392b', letterSpacing: 2, lineHeight: 1.6, textShadow: '3px 3px 0 #0a0805' }}>
            HORSE
          </div>
          <div className="title-font" style={{ fontSize: 14, color: mode === 'perfect' ? '#ffd54a' : '#a89880', letterSpacing: 2, marginTop: 8, textShadow: '2px 2px 0 #0a0805' }}>
            {mode === 'perfect' ? 'PERFECTION' : 'IMPERFECTION'}
          </div>
          <div style={{ fontSize: 18, color: '#8b7355', marginTop: 8, letterSpacing: 2 }}>
            ━━━ {tab === 'calc' ? 'CALCULATOR' : 'BREEDING'} ━━━
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          <button
            onClick={() => setMode('perfect')}
            style={{
              flex: 1,
              padding: '12px 8px',
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 10,
              letterSpacing: 1.5,
              background: mode === 'perfect' ? '#7cc242' : '#1f1813',
              color: mode === 'perfect' ? '#0a0805' : '#5a4a38',
              border: '2px solid #0a0805',
              boxShadow: mode === 'perfect'
                ? 'inset 2px 2px 0 rgba(255,255,255,0.3), inset -2px -2px 0 rgba(0,0,0,0.3)'
                : 'inset 2px 2px 0 rgba(0,0,0,0.5)',
              cursor: 'pointer',
            }}
          >
            ★ PERFECT
          </button>
          <button
            onClick={() => setMode('trash')}
            style={{
              flex: 1,
              padding: '12px 8px',
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 10,
              letterSpacing: 1.5,
              background: mode === 'trash' ? '#c0392b' : '#1f1813',
              color: mode === 'trash' ? '#f4ead5' : '#5a4a38',
              border: '2px solid #0a0805',
              boxShadow: mode === 'trash'
                ? 'inset 2px 2px 0 rgba(255,255,255,0.2), inset -2px -2px 0 rgba(0,0,0,0.4)'
                : 'inset 2px 2px 0 rgba(0,0,0,0.5)',
              cursor: 'pointer',
            }}
          >
            ☠ TRASH
          </button>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          <button
            onClick={() => setTab('calc')}
            style={{
              flex: 1,
              padding: '14px 8px',
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 11,
              letterSpacing: 2,
              background: tab === 'calc' ? '#7cc242' : '#2a221c',
              color: tab === 'calc' ? '#0a0805' : '#a89880',
              border: '2px solid #0a0805',
              boxShadow: tab === 'calc'
                ? 'inset 2px 2px 0 rgba(255,255,255,0.3), inset -2px -2px 0 rgba(0,0,0,0.3)'
                : 'inset 2px 2px 0 rgba(0,0,0,0.4)',
              cursor: 'pointer',
            }}
          >
            CALC
          </button>
          <button
            onClick={() => setTab('breed')}
            style={{
              flex: 1,
              padding: '14px 8px',
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 11,
              letterSpacing: 2,
              background: tab === 'breed' ? '#ffd54a' : '#2a221c',
              color: tab === 'breed' ? '#0a0805' : '#a89880',
              border: '2px solid #0a0805',
              boxShadow: tab === 'breed'
                ? 'inset 2px 2px 0 rgba(255,255,255,0.3), inset -2px -2px 0 rgba(0,0,0,0.3)'
                : 'inset 2px 2px 0 rgba(0,0,0,0.4)',
              cursor: 'pointer',
            }}
          >
            BREED {savedHorses.length >= 2 ? `(${savedHorses.length})` : ''}
          </button>
        </div>

        {tab === 'calc' && (<>

        {/* Score Display */}
        <div className="panel" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 16, color: '#8b7355', letterSpacing: 3, marginBottom: 8 }}>
            {mode === 'perfect' ? 'PERFECTION SCORE' : 'TRASH SCORE'}
          </div>
          <div className="title-font" style={{
            fontSize: 56,
            color,
            textShadow: `4px 4px 0 #0a0805, 0 0 20px ${color}40`,
            lineHeight: 1,
            margin: '8px 0',
          }}>
            {shown.toFixed(1)}
          </div>
          <div className="title-font" style={{ fontSize: 12, color, letterSpacing: 3, marginTop: 12, marginBottom: 16 }}>
            {scoreLabel(shown, mode)}
          </div>
          {/* Pixel progress bar */}
          <div style={{
            display: 'flex',
            gap: 2,
            justifyContent: 'center',
            padding: 4,
            background: '#0f0a07',
            border: '2px solid #0a0805',
            boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.6)',
          }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{
                width: 'calc((100% - 38px) / 20)',
                height: 14,
                background: i < filledBlocks ? color : '#1a1410',
                boxShadow: i < filledBlocks ? `inset 1px 1px 0 rgba(255,255,255,0.4), inset -1px -1px 0 rgba(0,0,0,0.3)` : 'none',
              }}/>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="panel">
          {/* Speed */}
          <StatRow
            label="SPEED"
            icon="⚡"
            iconColor="#ffd54a"
            value={speed}
            unit="blocks/sec"
            min={4.7}
            max={14.3}
            step={0.1}
            precision={2}
            score={speedScore}
            onChange={setSpeed}
          >
            <div style={{
              marginTop: 12,
              padding: 10,
              background: '#0f0a07',
              border: '2px solid #0a0805',
              boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.6)',
            }}>
              <div className="title-font" style={{ fontSize: 8, color: '#ffd54a', letterSpacing: 1, marginBottom: 6 }}>
                ▸ FROM ITEMS MACHINE
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  className="pixel-input"
                  value={itemsInput}
                  onChange={handleItemsChange}
                  min="1"
                  step="1"
                  placeholder="80"
                  style={{ fontSize: 20, padding: '6px 8px', flex: 1 }}
                />
                <div style={{ fontSize: 16, color: '#8b7355', letterSpacing: 1, flexShrink: 0 }}>
                  items
                </div>
                <div style={{ fontSize: 22, color: '#7cc242', flexShrink: 0 }}>→</div>
                <div style={{ fontSize: 20, color: '#f4ead5', flexShrink: 0, minWidth: 70, textAlign: 'right' }}>
                  {speed.toFixed(2)}
                </div>
              </div>
              <div style={{ fontSize: 14, color: '#5a4a38', marginTop: 6, textAlign: 'center', letterSpacing: 1 }}>
                760 ÷ items = blocks/sec
              </div>
              {itemsOutOfRange && (
                <div style={{ fontSize: 14, color: '#f0a830', marginTop: 4, textAlign: 'center', letterSpacing: 1 }}>
                  ⚠ outside horse range ({(760/MAX_SPEED).toFixed(0)}–{(760/MIN_SPEED).toFixed(0)} items) — speed clamped
                </div>
              )}
            </div>
          </StatRow>
          <div style={{ height: 16 }} />
          {/* Jump */}
          <StatRow
            label="JUMP"
            icon="↑"
            iconColor="#7cc242"
            value={jump}
            unit="blocks high"
            min={1}
            max={5.5}
            step={0.5}
            precision={1}
            score={jumpScore}
            onChange={setJump}
          />
          <div style={{ height: 16 }} />
          {/* Health */}
          <StatRow
            label="HEALTH"
            icon={<HeartIcon size={14} />}
            value={hearts}
            unit="hearts"
            min={MIN_HEARTS}
            max={MAX_HEARTS}
            step={0.5}
            precision={1}
            score={healthScore}
            onChange={setHearts}
            renderValue={() => <HeartIcon size={16} />}
          />
        </div>

        {/* Save */}
        <div className="panel">
          <div className="title-font" style={{ fontSize: 10, color: '#ffd54a', letterSpacing: 2, marginBottom: 10 }}>
            ▸ NAME THIS HORSE
          </div>
          <input
            className="pixel-input"
            type="text"
            placeholder="e.g. Thunderbolt"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            style={{ marginBottom: 12 }}
          />
          <button
            className={`pixel-btn ${justSaved ? 'saved-flash' : ''}`}
            onClick={saveHorse}
            style={{ width: '100%' }}
          >
            {justSaved ? 'SAVED!' : '+ ADD TO STABLE'}
          </button>
        </div>

        {/* Saved horses */}
        {loaded && savedHorses.length > 0 && (
          <div className="panel">
            <div className="title-font" style={{ fontSize: 11, color: mode === 'perfect' ? '#ffd54a' : '#c0392b', letterSpacing: 2, marginBottom: 14 }}>
              ▸ {mode === 'perfect' ? 'YOUR STABLE' : 'YOUR TRASH STABLE'} ({savedHorses.length})
            </div>
            {savedHorses.map((h, idx) => {
              const hShown = displayOf(h.total, mode);
              return (
              <div key={h.id} style={{
                background: idx === 0 ? (mode === 'perfect' ? '#3a3120' : '#3a1a14') : '#1f1813',
                border: '2px solid #0a0805',
                boxShadow: idx === 0
                  ? `inset 2px 2px 0 ${mode === 'perfect' ? 'rgba(255,213,74,0.15)' : 'rgba(192,57,43,0.2)'}, inset -2px -2px 0 rgba(0,0,0,0.4)`
                  : 'inset 2px 2px 0 rgba(255,255,255,0.04), inset -2px -2px 0 rgba(0,0,0,0.4)',
                padding: 12,
                marginBottom: 10,
                position: 'relative',
              }}>
                {idx === 0 && (
                  <div className="title-font" style={{
                    position: 'absolute',
                    top: -10,
                    right: 8,
                    fontSize: 8,
                    color: mode === 'perfect' ? '#0a0805' : '#f4ead5',
                    background: mode === 'perfect' ? '#ffd54a' : '#c0392b',
                    padding: '3px 6px',
                    border: '2px solid #0a0805',
                    letterSpacing: 1,
                  }}>{mode === 'perfect' ? '★ BEST' : '☠ TRASHIEST'}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ fontSize: 22, color: '#f4ead5', fontWeight: 'bold', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.name}
                  </div>
                  <div className="title-font" style={{
                    fontSize: 16,
                    color: scoreColor(hShown),
                    textShadow: '2px 2px 0 #0a0805',
                  }}>
                    {hShown.toFixed(1)}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: '#a89880', marginBottom: 10, lineHeight: 1.4 }}>
                  <span style={{ color: '#ffd54a' }}>⚡</span> {h.speed.toFixed(2)} b/s
                  <span style={{ margin: '0 8px', color: '#5a4a38' }}>│</span>
                  <span style={{ color: '#7cc242' }}>↑</span> {h.jump.toFixed(2)} b
                  <span style={{ margin: '0 8px', color: '#5a4a38' }}>│</span>
                  <HeartIcon size={12} /> {h.hearts.toFixed(1)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="pixel-btn-sm" onClick={() => loadHorse(h)} style={{ flex: 1 }}>
                    LOAD
                  </button>
                  <button className="pixel-btn-sm pixel-btn-danger" onClick={() => deleteHorse(h.id)} style={{ width: 60 }}>
                    DEL
                  </button>
                </div>
              </div>
              );
            })}
            {savedHorses.length >= 2 && (
              <div style={{
                marginTop: 14,
                padding: 10,
                background: '#0f0a07',
                border: '2px solid #0a0805',
                fontSize: 18,
                color: '#a89880',
                lineHeight: 1.4,
              }}>
                <span style={{ color: mode === 'perfect' ? '#7cc242' : '#c0392b' }}>▸ TIP:</span>{' '}
                {mode === 'perfect'
                  ? `Breed your top 2 horses (${savedHorses[0].name} × ${savedHorses[1].name}) for the best foal — or check the BREED tab for a full pair-by-pair analysis.`
                  : `Breed your trashiest 2 (${savedHorses[0].name} × ${savedHorses[1].name}) to push toward perfect garbage. The BREED tab has full analysis.`}
              </div>
            )}
          </div>
        )}

        </>)}

        {tab === 'breed' && (
          <BreedingTab horses={savedHorses} loaded={loaded} HeartIcon={HeartIcon} mode={mode} />
        )}

        {/* Footer info */}
        <div style={{
          textAlign: 'center',
          fontSize: 16,
          color: '#5a4a38',
          marginTop: 20,
          lineHeight: 1.6,
        }}>
          Stats normalized against in-game min/max.<br/>
          Speed 4.74–14.23 │ Jump 1.19–5.29 │ HP 7.5–15
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, icon, iconColor, value, unit, min, max, step, score, onChange, renderValue, children, precision = 2 }) {
  const color = scoreColor(score);
  const [text, setText] = useState(value.toFixed(precision));
  const updatingFromTextRef = useRef(false);

  useEffect(() => {
    if (updatingFromTextRef.current) {
      updatingFromTextRef.current = false;
      return;
    }
    setText(value.toFixed(precision));
  }, [value, precision]);

  function handleTextChange(e) {
    const t = e.target.value;
    setText(t);
    const v = parseFloat(t);
    if (!isNaN(v)) {
      updatingFromTextRef.current = true;
      onChange(Math.max(min, Math.min(max, v)));
    }
  }

  function handleTextBlur() {
    setText(value.toFixed(precision));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22, color: iconColor || '#f4ead5' }}>{icon}</span>
          <span className="title-font" style={{ fontSize: 11, color: '#f4ead5', letterSpacing: 2 }}>{label}</span>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={text}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              style={{
                fontSize: 22,
                color: '#f4ead5',
                background: '#0f0a07',
                border: '2px solid #3a3024',
                outline: 'none',
                textAlign: 'right',
                width: 70,
                fontFamily: 'inherit',
                padding: '2px 4px',
                borderRadius: 0,
                MozAppearance: 'textfield',
              }}
            />
            {renderValue && <span>{renderValue(value)}</span>}
          </div>
          <div style={{ fontSize: 14, color: '#8b7355', letterSpacing: 1, marginTop: 2 }}>{unit}</div>
        </div>
      </div>
      <input
        type="range"
        className="pixel-slider"
        min={min}
        max={max}
        step={step}
        value={Math.max(min, Math.min(max, value))}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 14, color: '#5a4a38' }}>
        <span>{min.toFixed(precision === 0 ? 1 : precision === 2 ? 1 : precision)}</span>
        <span className="title-font" style={{ fontSize: 9, color, letterSpacing: 1 }}>
          {score.toFixed(0)}/100
        </span>
        <span>{max.toFixed(precision === 0 ? 1 : precision === 2 ? 1 : precision)}</span>
      </div>
      {children}
    </div>
  );
}

function ParentCard({ horse, HeartIcon, mode = 'perfect' }) {
  const shown = displayOf(horse.total, mode);
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      padding: 10,
      background: '#1f1813',
      border: '2px solid #0a0805',
      boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.04), inset -2px -2px 0 rgba(0,0,0,0.4)',
    }}>
      <div style={{
        fontSize: 18,
        color: '#f4ead5',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginBottom: 4,
      }}>{horse.name}</div>
      <div className="title-font" style={{
        fontSize: 14,
        color: scoreColor(shown),
        textShadow: '2px 2px 0 #0a0805',
        marginBottom: 6,
      }}>
        {shown.toFixed(1)}
      </div>
      <div style={{ fontSize: 15, color: '#a89880', lineHeight: 1.5 }}>
        <div><span style={{ color: '#ffd54a' }}>⚡</span> {horse.speed.toFixed(2)} b/s</div>
        <div><span style={{ color: '#7cc242' }}>↑</span> {horse.jump.toFixed(1)} b</div>
        <div><HeartIcon size={11} /> {horse.hearts.toFixed(1)}</div>
      </div>
    </div>
  );
}

function BreedingTab({ horses, loaded, HeartIcon, mode = 'perfect' }) {
  const analysis = useMemo(() => {
    if (horses.length < 2) return null;
    return {
      pairs: getAllPairs(horses, mode),
      dominated: findDominated(horses, mode),
      leaders: findStatLeaders(horses, mode),
    };
  }, [horses, mode]);

  if (!loaded) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 18, color: '#a89880' }}>Loading stable...</div>
      </div>
    );
  }

  if (horses.length === 0) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 24 }}>
        <div className="title-font" style={{ fontSize: 11, color: '#8b7355', letterSpacing: 2, marginBottom: 14 }}>
          {mode === 'perfect' ? 'EMPTY STABLE' : 'EMPTY TRASH'}
        </div>
        <div style={{ fontSize: 18, color: '#a89880', lineHeight: 1.5 }}>
          Switch to the CALC tab and add some horses to {mode === 'perfect' ? 'your stable' : 'this stable'}. Once you have at least 2 horses, this tab will show you the optimal breeding pair.
        </div>
      </div>
    );
  }

  if (horses.length === 1) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 24 }}>
        <div className="title-font" style={{ fontSize: 11, color: '#8b7355', letterSpacing: 2, marginBottom: 14 }}>
          ONE HORSE ONLY
        </div>
        <div style={{ fontSize: 18, color: '#a89880', lineHeight: 1.5 }}>
          Add at least one more horse to your stable to see breeding recommendations.
        </div>
      </div>
    );
  }

  const { pairs, dominated, leaders } = analysis;
  const top = pairs[0];
  const otherPairs = pairs.slice(1, 5);
  const topShown = displayOf(top.meanOverall, mode);
  const bestShown = displayOf(top.bestForGoal, mode);

  // Plateau warning: best pair barely improves on goal direction
  const extremeStableValue = mode === 'perfect'
    ? Math.max(...horses.map(h => h.total))
    : Math.min(...horses.map(h => h.total));
  const extremeShown = displayOf(extremeStableValue, mode);
  const plateaued = top.pBeatsParents < 0.15 && extremeShown < 90;

  const accent = mode === 'perfect' ? '#ffd54a' : '#c0392b';
  const accentText = mode === 'perfect' ? '#0a0805' : '#f4ead5';
  const recommendLabel = mode === 'perfect' ? '★ BREED THESE TWO' : '☠ BREED THESE TWO';
  const beatLabel = mode === 'perfect' ? 'Beats both parents' : 'Worse than both parents';
  const nearLabel = mode === 'perfect' ? 'Near-perfect (95+)' : 'Near-trash (≤5)';
  const perfectLabel = mode === 'perfect' ? 'Perfect (99+)' : 'True trash (≤1)';

  return (
    <>
      {/* Stat Leaders */}
      <div className="panel">
        <div className="title-font" style={{ fontSize: 10, color: accent, letterSpacing: 2, marginBottom: 12 }}>
          ▸ {mode === 'perfect' ? 'STAT LEADERS' : 'TRASHIEST STATS'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div style={{ padding: 8, background: '#0f0a07', border: '2px solid #0a0805' }}>
            <div style={{ color: '#ffd54a', fontSize: 14, letterSpacing: 1 }}>⚡ SPEED</div>
            <div style={{ color: '#f4ead5', fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leaders.speed.name}</div>
            <div style={{ color: '#a89880', fontSize: 14 }}>{leaders.speed.speed.toFixed(2)}</div>
          </div>
          <div style={{ padding: 8, background: '#0f0a07', border: '2px solid #0a0805' }}>
            <div style={{ color: '#7cc242', fontSize: 14, letterSpacing: 1 }}>↑ JUMP</div>
            <div style={{ color: '#f4ead5', fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leaders.jump.name}</div>
            <div style={{ color: '#a89880', fontSize: 14 }}>{leaders.jump.jump.toFixed(1)}</div>
          </div>
          <div style={{ padding: 8, background: '#0f0a07', border: '2px solid #0a0805' }}>
            <div style={{ color: '#d63030', fontSize: 14, letterSpacing: 1 }}><HeartIcon size={10}/> HEALTH</div>
            <div style={{ color: '#f4ead5', fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leaders.hearts.name}</div>
            <div style={{ color: '#a89880', fontSize: 14 }}>{leaders.hearts.hearts.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Recommended Pair */}
      <div className="panel" style={{
        borderColor: accent,
        boxShadow: `inset 2px 2px 0 ${mode === 'perfect' ? 'rgba(255,213,74,0.15)' : 'rgba(192,57,43,0.2)'}, inset -2px -2px 0 rgba(0,0,0,0.4), 4px 4px 0 rgba(0,0,0,0.4)`,
        position: 'relative',
        paddingTop: 22,
      }}>
        <div className="title-font" style={{
          position: 'absolute',
          top: -10,
          left: 12,
          fontSize: 9,
          color: accentText,
          background: accent,
          padding: '4px 8px',
          border: '2px solid #0a0805',
          letterSpacing: 1,
        }}>
          {recommendLabel}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
          <ParentCard horse={top.a} HeartIcon={HeartIcon} mode={mode} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="title-font" style={{ fontSize: 16, color: accent }}>×</div>
          </div>
          <ParentCard horse={top.b} HeartIcon={HeartIcon} mode={mode} />
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <div className="title-font" style={{ fontSize: 9, color: '#8b7355', letterSpacing: 2, marginBottom: 6 }}>
            EXPECTED FOAL
          </div>
          <div className="title-font" style={{
            fontSize: 32,
            color: scoreColor(topShown),
            textShadow: `3px 3px 0 #0a0805, 0 0 16px ${scoreColor(topShown)}40`,
            lineHeight: 1,
          }}>
            {topShown.toFixed(1)}
          </div>
          <div style={{ fontSize: 16, color: '#a89880', marginTop: 6 }}>
            best simulated: <span style={{ color: scoreColor(bestShown) }}>{bestShown.toFixed(1)}</span>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: 12, background: '#0f0a07', border: '2px solid #0a0805', boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.5)' }}>
          <ProbRow label={beatLabel} value={top.pBeatsParents} />
          <ProbRow label={nearLabel} value={top.pNearGoal} small />
          <ProbRow label={perfectLabel} value={top.pPerfectGoal} small last />
        </div>

        {plateaued && (
          <div style={{
            marginTop: 12,
            padding: 10,
            background: '#3a2814',
            border: '2px solid #f0a830',
            fontSize: 15,
            color: '#f0a830',
            lineHeight: 1.4,
          }}>
            ⚠ <strong>PLATEAU WARNING:</strong> Even your best pair has only a {(top.pBeatsParents*100).toFixed(0)}% chance of {mode === 'perfect' ? 'beating both parents' : 'being worse than both parents'}. Your {mode === 'perfect' ? 'top' : 'trashiest'} horses likely share a {mode === 'perfect' ? 'weakness' : 'strong stat'} — try crossing with the per-stat leader for that stat to introduce new genes.
          </div>
        )}

        {top.pNearGoal > 0.05 && (
          <div style={{
            marginTop: 12,
            padding: 10,
            background: '#1a2a14',
            border: '2px solid #7cc242',
            fontSize: 15,
            color: '#7cc242',
            lineHeight: 1.4,
          }}>
            ✓ <strong>GOOD POSITION:</strong> ~{(top.pNearGoal*100).toFixed(0)}% chance of a {mode === 'perfect' ? 'near-perfect' : 'near-trash'} foal per breeding. Breed this pair repeatedly until you get a winner, then replace the {mode === 'perfect' ? 'worse' : 'better'} parent.
          </div>
        )}
      </div>

      {/* Alternatives */}
      {otherPairs.length > 0 && (
        <div className="panel">
          <div className="title-font" style={{ fontSize: 10, color: '#7cc242', letterSpacing: 2, marginBottom: 12 }}>
            ▸ ALTERNATIVE PAIRS
          </div>
          {otherPairs.map((p, idx) => {
            const pShown = displayOf(p.meanOverall, mode);
            const pBestShown = displayOf(p.bestForGoal, mode);
            return (
            <div key={idx} style={{
              padding: 10,
              background: '#1f1813',
              border: '2px solid #0a0805',
              boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.04), inset -2px -2px 0 rgba(0,0,0,0.4)',
              marginBottom: idx === otherPairs.length - 1 ? 0 : 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ color: '#f4ead5', fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                  {p.a.name} × {p.b.name}
                </span>
                <span className="title-font" style={{ fontSize: 12, color: scoreColor(pShown), textShadow: '2px 2px 0 #0a0805' }}>
                  {pShown.toFixed(1)}
                </span>
              </div>
              <div style={{ fontSize: 14, color: '#8b7355', letterSpacing: 0.5 }}>
                best {pBestShown.toFixed(0)} · {mode === 'perfect' ? 'beats' : 'worse than'} parents {(p.pBeatsParents*100).toFixed(0)}%
                {p.pNearGoal > 0 && ` · ${mode === 'perfect' ? '95+' : '≤5'} ${(p.pNearGoal*100).toFixed(1)}%`}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Cull list */}
      <div className="panel">
        <div className="title-font" style={{ fontSize: 10, color: dominated.length > 0 ? '#c0392b' : '#7cc242', letterSpacing: 2, marginBottom: 10 }}>
          ▸ {dominated.length > 0 ? `SAFE TO CULL (${dominated.length})` : 'STABLE IS LEAN'}
        </div>
        {dominated.length === 0 ? (
          <div style={{ fontSize: 16, color: '#a89880', lineHeight: 1.5 }}>
            {mode === 'perfect'
              ? 'Every horse contributes something unique — none is strictly worse than another on all three stats. To make room for new foals, delete the lowest-scoring horses manually from the CALC tab.'
              : 'Every horse is unique in its awfulness — none is strictly better than another on all three stats. To make room, manually delete the highest-scoring (least trashy) horses from the CALC tab.'}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, color: '#8b7355', marginBottom: 10, lineHeight: 1.4 }}>
              {mode === 'perfect'
                ? "These horses are beaten on every stat by another horse you own. Cull them without remorse — they can't contribute anything to breeding."
                : "These horses are out-trashed on every stat by another horse you own. They're not bad enough to keep — cull them and free up space."}
            </div>
            {dominated.map(({ horse, dominator }) => {
              const hShown = displayOf(horse.total, mode);
              const dShown = displayOf(dominator.total, mode);
              return (
              <div key={horse.id} style={{
                padding: 10,
                background: '#2a1410',
                border: '2px solid #0a0805',
                boxShadow: 'inset 2px 2px 0 rgba(192,57,43,0.1), inset -2px -2px 0 rgba(0,0,0,0.4)',
                marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ color: '#f4ead5', fontSize: 17 }}>
                    <span style={{ color: '#c0392b' }}>✗</span> {horse.name}
                  </span>
                  <span style={{ color: '#8b7355', fontSize: 14 }}>{hShown.toFixed(1)}</span>
                </div>
                <div style={{ fontSize: 14, color: '#8b7355', lineHeight: 1.4 }}>
                  {mode === 'perfect' ? 'dominated by' : 'out-trashed by'} <span style={{ color: '#a89880' }}>{dominator.name}</span> ({dShown.toFixed(1)})
                </div>
              </div>
              );
            })}
          </>
        )}
      </div>

      {/* Methodology note */}
      <div style={{
        textAlign: 'center',
        fontSize: 14,
        color: '#5a4a38',
        marginTop: 8,
        marginBottom: 12,
        lineHeight: 1.5,
      }}>
        Stats from 800 simulated foals per pair, using the actual Java 1.19.4+ breeding formula.
      </div>
    </>
  );
}

function ProbRow({ label, value, small, last }) {
  const pct = (value * 100);
  const display = small
    ? (pct >= 1 ? pct.toFixed(1) : pct.toFixed(2))
    : pct.toFixed(0);
  const color = value >= 0.3 ? '#7cc242' : value >= 0.05 ? '#ffd54a' : '#a89880';
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: last ? 0 : 8,
      fontSize: 16,
    }}>
      <span style={{ color: '#a89880' }}>{label}</span>
      <span className="title-font" style={{ fontSize: small ? 11 : 14, color, letterSpacing: 1 }}>
        {display}%
      </span>
    </div>
  );
}
