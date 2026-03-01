export function attackerLucky(power, thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries) {
    if (aLucky > 0) {
        if (aLucky >= numParries) numParries = 0;
        else numParries -= aLucky;

        let toReroll = 0;
        if (aLucky <= misses) {
            misses -= aLucky;
            toReroll = aLucky;
        } else if (luckyStrategy === "default" || numCrits > 0) {
            toReroll = misses;
            misses = 0;
        } else {
            toReroll = Math.min(power, aLucky);
            hits = Math.max(0, hits - (aLucky - misses));
            misses = 0;
        }

        for (let reroll = 0; reroll < toReroll; reroll++) {
            let dice = Math.floor(Math.random() * 6) + 1;
            if (dice >= thaco) hits += 1; else misses += 1;
            if (dice === 1) numParries += 1;
            else if (dice === 6) numCrits += 1;
        }
    }
    return [hits, misses, numCrits, numParries];
}

export function defenderLucky(power, thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries) {
    if (dLucky > 0) {
        if (dLucky >= numCrits) numCrits = 0;
        else numCrits -= dLucky;

        let toReroll = 0;
        if (dLucky <= hits) {
            hits -= dLucky;
            toReroll = dLucky;
        } else if (luckyStrategy === "default" || numParries > 0) {
            toReroll = hits;
            hits = 0;
        } else {
            toReroll = Math.min(power, dLucky);
            misses = Math.max(0, misses - (dLucky - hits));
            hits = 0;
        }

        for (let reroll = 0; reroll < toReroll; reroll++) {
            let dice = Math.floor(Math.random() * 6) + 1;
            if (dice >= thaco) hits += 1; else misses += 1;
            if (dice === 1) numParries += 1;
            else if (dice === 6) numCrits += 1;
        }
    }
    return [hits, misses, numCrits, numParries];
}

export function doTrial(power, thaco, fury, aLucky, dLucky, luckyStrategy, order) {
    let hits = 0, misses = 0, numCrits = 0, numParries = 0;
    let furied = false;
    let trialPower = power;

    for (let i = 0; i < trialPower; i++) {
        let dice = Math.floor(Math.random() * 6) + 1;
        if (dice >= thaco) hits += 1; else misses += 1;
        if (dice === 1) numParries += 1;
        else if (dice === 4 && !furied) { trialPower += fury; furied = true; }
        else if (dice === 6) numCrits += 1;
    }

    if (order === "a") {
        [hits, misses, numCrits, numParries] = attackerLucky(trialPower, thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries);
        [hits, misses, numCrits, numParries] = defenderLucky(trialPower, thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries);
    } else {
        [hits, misses, numCrits, numParries] = defenderLucky(trialPower, thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries);
        [hits, misses, numCrits, numParries] = attackerLucky(trialPower, thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries);
    }

    return [hits, numCrits, numParries];
}

export function runSimulation(inputs, numTrials) {
    const { power, crit, accuracy, parry, fury, aLucky, dLucky, luckyOrder, shields, armor } = inputs;
    const thaco = 4 - accuracy + (armor ? 1 : 0);
    const effectivePower = Math.max(0, power - (shields || 0));
    let damageDist = {};

    for (let t = 0; t < numTrials; t++) {
        let [hits, numCrits, numParries] = doTrial(effectivePower, thaco, fury, aLucky, dLucky, "default", luckyOrder);
        let damage = hits;
        if (numCrits > 0) damage += crit;
        if (numParries > 0) damage -= parry;
        if (damage < 0) damage = 0;
        damageDist[damage] = (damageDist[damage] || 0) + 1;
    }
    return damageDist;
}
