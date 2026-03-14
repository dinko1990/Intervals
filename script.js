const defaults = {
  active: 10,
  pause: 15,
  reps: 10,
  sets: 3,
  rest: 60,
};

const els = {
  body: document.body,
  activeInput: document.getElementById('activeInput'),
  pauseInput: document.getElementById('pauseInput'),
  repsInput: document.getElementById('repsInput'),
  setsInput: document.getElementById('setsInput'),
  restInput: document.getElementById('restInput'),
  soundToggle: document.getElementById('soundToggle'),
  startBtn: document.getElementById('startBtn'),
  resetBtn: document.getElementById('resetBtn'),
  phaseLabel: document.getElementById('phaseLabel'),
  timerDisplay: document.getElementById('timerDisplay'),
  repDisplay: document.getElementById('repDisplay'),
  setDisplay: document.getElementById('setDisplay'),
  statusText: document.getElementById('statusText'),
  paramsSummary: document.getElementById('paramsSummary'),
};

let soundOn = true;
let timerId = null;
let currentRep = 0;
let currentSet = 0;
let totalReps = defaults.reps;
let totalSets = defaults.sets;
let runConfig = { ...defaults };
let isRunning = false;
let audioCtx = null;

function updateSummary() {
  const cfg = getConfig();
  els.paramsSummary.innerHTML = `
    <span>Active: ${cfg.active}s</span>
    <span>Pause: ${cfg.pause}s</span>
    <span>Reps: ${cfg.reps}</span>
    <span>Sets: ${cfg.sets}</span>
    <span>Rest between sets: ${cfg.rest}s</span>
  `;
  if (!isRunning) {
    totalReps = cfg.reps;
    totalSets = cfg.sets;
    els.repDisplay.textContent = `Rep 0 / ${cfg.reps}`;
    els.setDisplay.textContent = `Set 0 / ${cfg.sets}`;
  }
}

function getConfig() {
  return {
    active: Math.max(1, Number(els.activeInput.value) || defaults.active),
    pause: Math.max(0, Number(els.pauseInput.value) || defaults.pause),
reps: Math.max(1, Number(els.repsInput.value) || defaults.reps),
    sets: Math.max(1, Number(els.setsInput.value) || defaults.sets),
    rest: Math.max(1, Number(els.restInput.value) || defaults.rest),
  };
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function setScreen(type) {
  els.body.className = `screen-${type}`;
}

function updateDisplay({ phase, seconds, status, repNumber = currentRep, setNumber = currentSet }) {
  els.phaseLabel.textContent = phase;
  els.timerDisplay.textContent = formatTime(seconds);
  els.repDisplay.textContent = `Rep ${repNumber} / ${totalReps}`;
  els.setDisplay.textContent = `Set ${setNumber} / ${totalSets}`;
  els.statusText.textContent = status;
}

function beep(duration = 140, frequency = 880, volume = 0.03) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.value = volume;

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration / 1000);
  } catch (err) {
    console.warn('Audio unavailable:', err);
  }
}

function clearCurrentTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function resetApp() {
  clearCurrentTimer();
  isRunning = false;
  currentRep = 0;
  currentSet = 0;
  runConfig = { ...getConfig() };
  totalReps = runConfig.reps;
  totalSets = runConfig.sets;
  setScreen('setup');
  updateSummary();
  updateDisplay({
    phase: 'Ready',
    seconds: 0,
    status: 'Set your parameters and press Start',
    repNumber: 0,
    setNumber: 0,
  });
  els.startBtn.textContent = 'Start';
}

function runPhase(name, seconds, screenType, status, repNumber, setNumber) {
  return new Promise((resolve) => {
    let timeLeft = seconds;
    setScreen(screenType);
    updateDisplay({ phase: name, seconds: timeLeft, status, repNumber, setNumber });

    if (timeLeft <= 0) {
      resolve();
      return;
    }

    timerId = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft > 0 && timeLeft <= 3) beep(90, 980, 0.025);
      updateDisplay({ phase: name, seconds: timeLeft, status, repNumber, setNumber });

      if (timeLeft <= 0) {
        clearCurrentTimer();
        beep(180, 660, 0.04);
        resolve();
      }
    }, 1000);
  });
}

async function runStartCountdown() {
  for (let n = 5; n >= 1; n -= 1) {
    setScreen('countdown');
    updateDisplay({
      phase: 'Get Ready',
      seconds: n,
      status: `Starting in ${n}...`,
      repNumber: 0,
      setNumber: 0,
    });
    beep(100, 700 + (5 - n) * 50, 0.025);
    await new Promise((resolve) => {
      timerId = setTimeout(resolve, 1000);
    });
  }
}

async function startWorkout() {
  if (isRunning) return;
  isRunning = true;
  runConfig = { ...getConfig() };
  totalReps = runConfig.reps;
  totalSets = runConfig.sets;
  els.startBtn.textContent = 'Running';
  updateSummary();

  try {
    await runStartCountdown();

    for (currentSet = 1; currentSet <= runConfig.sets; currentSet += 1) {
      for (currentRep = 1; currentRep <= runConfig.reps; currentRep += 1) {
        await runPhase('Active', runConfig.active, 'active', 'Work', currentRep, currentSet);

        const isLastRepInSet = currentRep === runConfig.reps;
        if (!isLastRepInSet && runConfig.pause > 0) {
          await runPhase('Pause', runConfig.pause, 'pause', 'Pause', currentRep, currentSet);
        }
      }

      const isLastSet = currentSet === runConfig.sets;
      if (!isLastSet) {
        await runPhase('Rest', runConfig.rest, 'rest', 'Rest between sets', runConfig.reps, currentSet);
      }
    }

    setScreen('finished');
    updateDisplay({
      phase: 'Done',
      seconds: 0,
      status: 'Workout complete',
      repNumber: runConfig.reps,
      setNumber: runConfig.sets,
    });
    beep(320, 520, 0.05);
    setTimeout(() => beep(320, 700, 0.05), 220);
  } finally {
    clearCurrentTimer();
    isRunning = false;
    els.startBtn.textContent = 'Start';
  }
}

els.soundToggle.addEventListener('click', () => {
  soundOn = !soundOn;
  els.soundToggle.textContent = soundOn ? 'Beep: ON' : 'Beep: OFF';
  els.soundToggle.setAttribute('aria-pressed', String(soundOn));
});

[els.activeInput, els.pauseInput, els.repsInput, els.setsInput, els.restInput].forEach((input) => {
  input.addEventListener('input', updateSummary);
});

els.startBtn.addEventListener('click', startWorkout);
els.resetBtn.addEventListener('click', resetApp);

resetApp();
