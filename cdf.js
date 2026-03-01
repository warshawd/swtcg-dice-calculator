export function computeCdf(damageDist) {
    const keys = Object.keys(damageDist).map(Number);
    if (keys.length === 0) return {};

    const maxDamage = Math.max(...keys);
    const minDamage = Math.min(...keys);
    const total = Object.values(damageDist).reduce((sum, val) => sum + val, 0) || 1;

    let cdf = {};
    let runningSum = 0;

    for (let dmg = maxDamage; dmg >= minDamage; dmg--) {
        const count = damageDist[dmg] || 0;
        runningSum += count;
        cdf[dmg] = runningSum / total;
    }

    for (let dmg = 0; dmg < minDamage; dmg++) {
        cdf[dmg] = 1.0;
    }

    return cdf;
}

export function combineCdfs(distA, distB) {
    const result = {};

    for (let dmgA in distA) {
        for (let dmgB in distB) {
            const total = Number(dmgA) + Number(dmgB);
            result[total] = (result[total] || 0) + distA[dmgA] * distB[dmgB];
        }
    }

    return result;
}
