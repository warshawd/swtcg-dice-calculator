function rollDie(thaco, hits, misses, numCrits, numParries) {
    const d = Math.floor(Math.random() * 6) + 1;
    if (d >= thaco) hits++; else misses++;
    if (d === 1) numParries++;
    else if (d === 6) numCrits++;
    return [hits, misses, numCrits, numParries];
}

export function attackerLucky(thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries) {
    if (aLucky <= 0) return [hits, misses, numCrits, numParries];

    // Aggressive: fish for crits by rerolling non-crit hits.
    // Only worth doing if no crit yet (Critical Hit X only triggers once).
    const useAggressive = luckyStrategy === "aggressive" && numCrits === 0;

    // Always reroll parry dice (1s) first, regardless of whether they're hits or misses.
    // Pull from misses first (the normal case), then hits (high accuracy case).
    const parryRerolls = Math.min(aLucky, numParries);
    const parryFromMisses = Math.min(parryRerolls, misses);
    const parryFromHits = parryRerolls - parryFromMisses;
    misses -= parryFromMisses;
    hits -= parryFromHits;
    numParries -= parryRerolls;

    // With remaining Lucky: reroll non-crit hits (aggressive) or misses (default)
    const remaining = aLucky - parryRerolls;
    let extraRerolls;
    if (useAggressive) {
        const nonCritHits = Math.max(0, hits - numCrits);
        extraRerolls = Math.min(remaining, nonCritHits);
        hits -= extraRerolls;
    } else {
        extraRerolls = Math.min(remaining, misses);
        misses -= extraRerolls;
    }

    for (let i = 0; i < parryRerolls + extraRerolls; i++) {
        [hits, misses, numCrits, numParries] = rollDie(thaco, hits, misses, numCrits, numParries);
    }
    return [hits, misses, numCrits, numParries];
}

export function defenderLucky(thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries) {
    if (dLucky <= 0) return [hits, misses, numCrits, numParries];

    // Always reroll crit dice (6s) first, regardless of whether they're hits or misses.
    // Pull from hits first (the normal case), then misses (extreme negative accuracy case).
    const critRerolls = Math.min(dLucky, numCrits);
    const critFromHits = Math.min(critRerolls, hits);
    const critFromMisses = critRerolls - critFromHits;
    hits -= critFromHits;
    misses -= critFromMisses;
    numCrits -= critRerolls;

    // With remaining Lucky: reroll hits
    const remaining = dLucky - critRerolls;
    const hitRerolls = Math.min(remaining, hits);
    hits -= hitRerolls;

    for (let i = 0; i < critRerolls + hitRerolls; i++) {
        [hits, misses, numCrits, numParries] = rollDie(thaco, hits, misses, numCrits, numParries);
    }
    return [hits, misses, numCrits, numParries];
}

export function doTrial(power, thaco, fury, aLucky, dLucky, luckyStrategy, order) {
    let hits = 0, misses = 0, numCrits = 0, numParries = 0;
    let furied = false;
    let trialPower = power;

    for (let i = 0; i < trialPower; i++) {
        const dice = Math.floor(Math.random() * 6) + 1;
        if (dice >= thaco) hits++; else misses++;
        if (dice === 1) numParries++;
        else if (dice === 4 && !furied) { trialPower += fury; furied = true; }
        else if (dice === 6) numCrits++;
    }

    if (order === "a") {
        [hits, misses, numCrits, numParries] = attackerLucky(thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries);
        [hits, misses, numCrits, numParries] = defenderLucky(thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries);
    } else {
        [hits, misses, numCrits, numParries] = defenderLucky(thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries);
        [hits, misses, numCrits, numParries] = attackerLucky(thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries);
    }

    return [hits, numCrits, numParries];
}

export function runSimulation(inputs, numTrials) {
    const { power, crit, accuracy, parry, fury, aLucky, dLucky, luckyOrder, luckyStrategy, shields, armor } = inputs;
    const thaco = 4 - accuracy + (armor ? 1 : 0);
    const effectivePower = Math.max(0, power - (shields || 0));
    let damageDist = {};

    for (let t = 0; t < numTrials; t++) {
        let [hits, numCrits, numParries] = doTrial(effectivePower, thaco, fury, aLucky, dLucky, luckyStrategy || "default", luckyOrder);
        let damage = hits;
        if (numCrits > 0) damage += crit;
        if (numParries > 0) damage -= parry;
        if (damage < 0) damage = 0;
        damageDist[damage] = (damageDist[damage] || 0) + 1;
    }
    return damageDist;
}
