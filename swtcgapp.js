import { runSimulation } from './simulator.js';
import { computeCdf, combineCdfs } from './cdf.js';

const PALETTE = [
    '#4a9eff', '#ff6b6b', '#51cf66', '#ffd43b',
    '#cc5de8', '#ff922b', '#20c997', '#f06595'
];

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const cdfTraces = [];
const numTrials = 5000000;
let globalMaxDamage = 0;
let attackCounter = 1;

function updateCombineCheckboxes() {
    const container = document.getElementById('combineCheckboxes');
    container.innerHTML = '';

    const originalLines = cdfTraces.map((trace, idx) => ({ trace, idx }))
                                   .filter(obj => !obj.trace.name.includes('+'));

    originalLines.forEach(({ trace, idx }) => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = idx;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(trace.name));
        container.appendChild(label);
    });

    const combineSection = document.querySelector('.combine-container');
    const visible = originalLines.length >= 2;
    combineSection.classList.toggle('visible', visible);

    if (visible) positionCombineContainer();
}

window.addEventListener('resize', () => {
    const combineSection = document.querySelector('.combine-container');
    if (combineSection.classList.contains('visible')) {
        positionCombineContainer();
    }
});

function positionCombineContainer() {
    if (window.innerWidth < 600) return;

    const graph = document.getElementById('cdfGraph');
    const overlay = document.querySelector('.combine-container');

    if (!overlay || !graph) return;

    const rect = graph.getBoundingClientRect();

    const padding = 10;
    overlay.style.top = `${rect.top + window.scrollY + rect.height - overlay.offsetHeight - padding}px`;
    overlay.style.left = `${rect.left + window.scrollX + rect.width - overlay.offsetWidth - padding}px`;
}

function updateClearButton() {
    const clearBtn = document.getElementById('clearGraph');
    if (cdfTraces.length > 0) {
        clearBtn.style.display = 'block';
    } else {
        clearBtn.style.display = 'none';
    }
}

function plotCdfs() {
    globalMaxDamage = Math.max(
        ...cdfTraces.map(t => Math.max(...Object.keys(t.rawDist).map(Number)))
    );

    const x = [];
    for (let i = 1; i <= globalMaxDamage; i++) x.push(i);

    cdfTraces.forEach((t, i) => {
        const y = [];
        const cdfDist = t.cdfDist;
        const traceMax = Math.max(...Object.keys(cdfDist).map(Number));
        let lastY = 1;

        for (let xi of x) {
            if (cdfDist[xi] !== undefined) lastY = cdfDist[xi];
            y.push(xi > traceMax ? 0 : lastY);
        }

        const color = PALETTE[i % PALETTE.length];

        t.x = x;
        t.y = y;
        t.mode = 'lines+markers';
        t.line = { shape: 'spline', smoothing: 0.3, width: 2.5, color };
        t.marker = {
            size: 20,
            symbol: 'circle',
            color,
            line: { width: 1, color: '#fff' }
        };
        t.fill = 'tozeroy';
        t.fillcolor = hexToRgba(color, 0.12);
        t.hovertemplate =
            '<b>Damage ≥ %{x}</b><br>' +
            'Probability: %{y:.0%}<extra></extra>'
    });

    const mobile = window.innerWidth < 600;

    const layout = {
        title: {
            text: 'Cumulative Probability of Dealing At Least X Damage',
            x: 0.5,
            xanchor: 'center'
        },
        margin: mobile
            ? { t: 70, l: 40, r: 10, b: 160 }
            : { t: 70, l: 60, r: 280, b: 60 },
        xaxis: {
            title: 'Damage Threshold (≥ X)',
            range: [0.5, globalMaxDamage + 0.5],
            autorange: false,
            dtick: 1,
            automargin: true
        },
        yaxis: {
            title: 'Probability',
            range: [0, 1.05],
            autorange: false,
            tickformat: ',.0%',
            automargin: true
        },
        legend: mobile
            ? { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.28, yanchor: 'top' }
            : { orientation: 'v', x: 1.02, xanchor: 'left', y: 1, yanchor: 'top' },
        dragmode: mobile ? false : undefined,
        hovermode: 'closest',
        showlegend: true
    };

    const config = {
        modeBarButtonsToRemove: [
            'zoom2d',
            'pan2d',
            'select2d',
            'lasso2d',
            'zoomIn2d',
            'zoomOut2d',
            'autoScale2d',
            'resetScale2d',
            'hoverCompareCartesian',
            'hoverClosestCartesian',
            'toggleSpikelines'
        ],
        displaylogo: false,
        responsive: true
    };
    Plotly.newPlot('cdfGraph', cdfTraces, layout, config);
    document.getElementById('cdfGraph').classList.add('visible');
    updateCombineCheckboxes();
}

function getInputs() {
    return {
        power: Number(document.getElementById('power').value),
        accuracy: Number(document.getElementById('accuracy').value),
        crit: Number(document.getElementById('crit').value),
        parry: Number(document.getElementById('parry').value),
        fury: Number(document.getElementById('fury').value),
        aLucky: Number(document.getElementById('aLucky').value),
        dLucky: Number(document.getElementById('dLucky').value),
        luckyOrder: document.querySelector('input[name="luckyOrder"]:checked').value,
        luckyStrategy: "default",
        shields: Number(document.getElementById('shields').value),
        armor: document.getElementById('armor').checked,
        attackName: document.getElementById('attackName').value.trim()
    };
}


const worker = new Worker('worker.js', { type: 'module' });

worker.onmessage = function(event) {
    const { damageDist, attackName } = event.data;

    const cdfDist = computeCdf(damageDist);
    cdfTraces.push({
        name: attackName,
        rawDist: damageDist,
        cdfDist: cdfDist
    });

    plotCdfs();
    updateClearButton();

    const attackInput = document.getElementById('attackName');
    attackInput.placeholder = `Attack ${attackCounter}`;
    attackInput.value = '';
};

function addLine() {
    const inputs = getInputs();
    inputs.attackName = inputs.attackName || `Attack ${attackCounter}`;
    attackCounter++;
    worker.postMessage({inputs, numTrials});
}

function combineSelectedLines() {
    const selectedIndices = Array.from(document.querySelectorAll('#combineCheckboxes input:checked'))
        .map(cb => Number(cb.value));

    if (selectedIndices.length < 2) {
        alert("Select at least two lines to combine.");
        return;
    }

    let combinedDist = { ...cdfTraces[selectedIndices[0]].rawDist };
    for (let i = 1; i < selectedIndices.length; i++) {
        combinedDist = combineCdfs(combinedDist, cdfTraces[selectedIndices[i]].rawDist);
    }

    const combinedName = selectedIndices.map(i => cdfTraces[i].name).join('+');
    const combinedCdfDist = computeCdf(combinedDist);

    cdfTraces.push({ name: combinedName, rawDist: combinedDist, cdfDist: combinedCdfDist });

    plotCdfs();
    updateClearButton();
}

function clearGraph() {
    cdfTraces.length = 0;
    Plotly.purge('cdfGraph');

    const graph = document.getElementById('cdfGraph');
    graph.classList.remove('visible');

    updateCombineCheckboxes();
    updateClearButton();
    attackCounter = 1;

    const attackInput = document.getElementById('attackName');
    attackInput.placeholder = `Attack ${attackCounter}`;
    attackInput.value = '';
}


function loadFromParams() {
    const params = new URLSearchParams(window.location.search);
    if (!params.size) return false;

    const numericFields = ['power', 'accuracy', 'crit', 'parry', 'fury', 'aLucky', 'dLucky', 'shields'];
    numericFields.forEach(id => {
        if (params.has(id)) document.getElementById(id).value = params.get(id);
    });

    if (params.has('luckyOrder')) {
        const radio = document.querySelector(`input[name="luckyOrder"][value="${params.get('luckyOrder')}"]`);
        if (radio) radio.checked = true;
    }

    if (params.has('armor')) {
        document.getElementById('armor').checked = params.get('armor') === '1';
    }

    if (params.has('name')) {
        document.getElementById('attackName').value = params.get('name');
    }

    return true;
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('addLine').addEventListener('click', addLine);
    document.getElementById('clearGraph').addEventListener('click', clearGraph);
    document.getElementById('combineLines').addEventListener('click', combineSelectedLines);
    document.getElementById('selectAll').addEventListener('click', () => {
        document.querySelectorAll('#combineCheckboxes input').forEach(cb => cb.checked = true);
    });
    document.getElementById('clearAll').addEventListener('click', () => {
        document.querySelectorAll('#combineCheckboxes input').forEach(cb => cb.checked = false);
    });
    document.getElementById('attackName').placeholder = `Attack ${attackCounter}`;

    document.querySelectorAll('.stepper-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input[type="number"]');
            const step = Number(input.step) || 1;
            const min = input.min !== '' ? Number(input.min) : -Infinity;
            const max = input.max !== '' ? Number(input.max) : Infinity;
            let value = Number(input.value) || 0;

            if (btn.classList.contains('plus')) {
                value = Math.min(value + step, max);
            } else {
                value = Math.max(value - step, min);
            }

            input.value = value;
        });
    });

    if (loadFromParams()) addLine();
    updateCombineCheckboxes();
});
