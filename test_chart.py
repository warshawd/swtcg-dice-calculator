"""Temporary test script — delete after verifying chart output on Pi."""
import sys, time
sys.path.insert(0, '.')
from damageCalculator import runSimulation, generatePlotBuffer

_, _, _, _, damageDist, _ = runSimulation(
    power=8, criticalHit=3, accuracy=1, parry=1, fury=2, aLucky=2, dLucky=2,
    numTrials=250000
)

t = time.time()
buf = generatePlotBuffer(damageDist, title="Test — Power 8 | Crit 3 | Acc 1 | Parry 1 | Fury 2 | Lucky A2/D2")
print(f"Rendered in {time.time() - t:.2f}s")

out = "/tmp/test_chart.png"
with open(out, "wb") as f:
    f.write(buf.read())
print(f"Saved to {out}")
