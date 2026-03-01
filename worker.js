import { runSimulation } from './simulator.js';

self.onmessage = function(event) {
    const { inputs, numTrials } = event.data;
    try {
        const damageDist = runSimulation(inputs, numTrials);
        self.postMessage({ damageDist, attackName: inputs.attackName });
    } catch (err) {
        console.error('Worker error:', err);
        self.postMessage({ damageDist: {}, attackName: inputs.attackName, error: err.message });
    }
};