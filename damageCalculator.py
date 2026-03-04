import random
import io
from collections import Counter

DEFAULT_NUM_TRIALS = 10**6

def probAtLeast(dist, x, numTrials):
	return sum(dist[k] for k in dist if k >= x) / numTrials


def cdfAtLeast(dist, numTrials):
	cdf = {}
	for k in sorted(dist):
		cdf[k] = sum(dist[x] for x in dist if x >= k) / numTrials
	return cdf

def pmf(dist, numTrials):
	return {k: v / numTrials for k, v in dist.items()}

def expectedValue(dist):
	total = sum(dist.values())
	return sum(k * v for k, v in dist.items()) / total

def plotDamagePmf(damageDist, numTrials):
	import matplotlib.pyplot as plt
	pmfDist = pmf(damageDist, numTrials)

	x = sorted(pmfDist.keys())
	y = [pmfDist[k] for k in x]

	plt.figure()
	plt.bar(x, y)
	plt.xlabel("Damage")
	plt.ylabel("Probability")
	plt.title("Damage Probability Mass Function")
	plt.grid(axis="y", alpha=0.3)
	plt.savefig("damage_pmf.png")
	plt.close()

def plotDamageCdf(damageDist, numTrials):
	import matplotlib.pyplot as plt
	cdfDist = cdfAtLeast(damageDist, numTrials)

	x = sorted(cdfDist.keys())
	y = [cdfDist[k] for k in x]

	plt.figure()
	plt.step(x, y, where="post")
	plt.xlabel("Damage Threshold (≥ X)")
	plt.ylabel("Probability")
	plt.title("Cumulative Probability of Dealing At Least X Damage")
	plt.ylim(0, 1)
	plt.grid(True, alpha=0.3)
	plt.savefig("damage_cdf.png")
	plt.close()

def generatePlotBuffer(damageDist, title="Attack"):
	"""Generate a damage CDF chart matching the web app style and return it as
	an in-memory PNG buffer. Uses Plotly + kaleido for rendering.
	"""
	import plotly.graph_objects as go
	import plotly.io as pio

	color = '#4a9eff'  # PALETTE[0] from swtcgapp.js
	r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
	fillcolor = f'rgba({r},{g},{b},0.12)'

	numTrials = sum(damageDist.values())
	cdfDist = cdfAtLeast(damageDist, numTrials)

	# Web app starts x from 1 — x=0 is trivially 100%
	maxDamage = max(cdfDist.keys())
	x = list(range(1, maxDamage + 1))
	lastY = 1.0
	y = []
	for xi in x:
		if xi in cdfDist:
			lastY = cdfDist[xi]
		y.append(lastY)

	trace = go.Scatter(
		x=x, y=y,
		name=title,
		mode='lines+markers',
		line=dict(shape='spline', smoothing=0.8, width=2.5, color=color),
		marker=dict(size=20, symbol='circle', color=color,
		            line=dict(width=1, color='#fff')),
		fill='tozeroy',
		fillcolor=fillcolor,
		hovertemplate='<b>Damage ≥ %{x}</b><br>Probability: %{y:.0%}<extra></extra>'
	)

	layout = go.Layout(
		title=dict(text=title, x=0.5, xanchor='center'),
		margin=dict(t=70, l=60, r=40, b=60),
		xaxis=dict(
			title='Damage Threshold (≥ X)',
			range=[0.5, maxDamage + 0.5],
			autorange=False,
			dtick=1
		),
		yaxis=dict(
			title='Probability',
			range=[0, 1.05],
			autorange=False,
			tickformat=',.0%'
		),
		showlegend=False
	)

	fig = go.Figure(data=[trace], layout=layout)
	buf = io.BytesIO(pio.to_image(fig, format='png', width=960, height=480))
	buf.seek(0)
	return buf

def attackerLucky(thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries):
	if aLucky <= 0:
		return hits, misses, numCrits, numParries

	# Aggressive: fish for crits by rerolling non-crit hits.
	# Only worth doing if no crit yet (Critical Hit X only triggers once).
	useAggressive = luckyStrategy == "aggressive" and numCrits == 0

	# Always reroll parry dice (1s) first, regardless of whether they're hits or misses.
	# Pull from misses first (the normal case), then hits (high accuracy case).
	parryRerolls = min(aLucky, numParries)
	parryFromMisses = min(parryRerolls, misses)
	parryFromHits = parryRerolls - parryFromMisses
	misses -= parryFromMisses
	hits -= parryFromHits
	numParries -= parryRerolls

	# With remaining Lucky: reroll non-crit hits (aggressive) or misses (default)
	remaining = aLucky - parryRerolls
	if useAggressive:
		nonCritHits = max(0, hits - numCrits)
		extraRerolls = min(remaining, nonCritHits)
		hits -= extraRerolls
	else:
		extraRerolls = min(remaining, misses)
		misses -= extraRerolls

	_randint = random.randint
	for _ in range(parryRerolls + extraRerolls):
		dice = _randint(1, 6)
		if dice >= thaco:
			hits += 1
		else:
			misses += 1
		if dice == 1:
			numParries += 1
		elif dice == 6:
			numCrits += 1
	return hits, misses, numCrits, numParries


def defenderLucky(thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries):
	if dLucky <= 0:
		return hits, misses, numCrits, numParries

	# Always reroll crit dice (6s) first, regardless of whether they're hits or misses.
	# Pull from hits first (the normal case), then misses (extreme negative accuracy case).
	critRerolls = min(dLucky, numCrits)
	critFromHits = min(critRerolls, hits)
	critFromMisses = critRerolls - critFromHits
	hits -= critFromHits
	misses -= critFromMisses
	numCrits -= critRerolls

	# With remaining Lucky: reroll hits
	remaining = dLucky - critRerolls
	hitRerolls = min(remaining, hits)
	hits -= hitRerolls

	_randint = random.randint
	for _ in range(critRerolls + hitRerolls):
		dice = _randint(1, 6)
		if dice >= thaco:
			hits += 1
		else:
			misses += 1
		if dice == 1:
			numParries += 1
		elif dice == 6:
			numCrits += 1
	return hits, misses, numCrits, numParries

def doTrial(power, thaco, fury, aLucky, dLucky, luckyStrategy, order):
	hits = 0
	misses = 0
	numCrits = 0
	numParries = 0
	furied = False
	_randint = random.randint
	# Have to generate dice in multiple rounds due to fury triggering dice that are eligible for lucky but not the other way around
	tempPower = power
	i = 0
	while i < tempPower:
		dice = _randint(1, 6)
		if dice >= thaco:
			hits += 1
		else:
			misses += 1
		if dice == 1:
			numParries += 1
		elif dice == 4:
			if not furied:
				tempPower += fury
				furied = True
		elif dice == 6:
			numCrits += 1
		i += 1
		# Deal with lucky values on either unit
	if order == "a":
		hits, misses, numCrits, numParries = attackerLucky(thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries)
		hits, misses, numCrits, numParries = defenderLucky(thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries)
	else:
		hits, misses, numCrits, numParries = defenderLucky(thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries)
		hits, misses, numCrits, numParries = attackerLucky(thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries)
	return hits, numCrits, numParries



def runSimulation(power, criticalHit=0, accuracy=0, parry=0, fury=0, aLucky=0, dLucky=0,
                  luckyStrategy="default", order="a", numTrials=DEFAULT_NUM_TRIALS):

	thaco = 4 - accuracy

	totalDamage = 0
	totalHits = 0
	totalCrits = 0
	totalParries = 0

	damageDist = Counter()
	hitsDist = Counter()

	for _ in range(numTrials):
		hits, numCrits, numParries = doTrial(power, thaco, fury, aLucky, dLucky, luckyStrategy, order)

		damage = hits
		if numCrits > 0:
			damage += criticalHit
			totalCrits += 1
		if numParries > 0:
			damage -= parry
			totalParries += 1
		if damage < 0:
			damage = 0

		totalDamage += damage
		totalHits += hits

		damageDist[damage] += 1
		hitsDist[hits] += 1

	return totalDamage / numTrials, totalHits / numTrials, totalCrits / numTrials, totalParries / numTrials, damageDist, hitsDist

if __name__ == "__main__":
	import argparse

	numTrials = DEFAULT_NUM_TRIALS
	parser = argparse.ArgumentParser()
	parser.add_argument("power", help="Unit's Power", type=int)
	parser.add_argument("-c", "--crit", help="Critical Hit", type=int, default=0)
	parser.add_argument("-a", "--accuracy", help="Accuracy", type=int, default=0)
	parser.add_argument("-p", "--parry", help="Parry", type=int, default=0)
	parser.add_argument("-f", "--fury", help="Fury", type=int, default=0)
	parser.add_argument("-al", "--alucky", help="Attacker Lucky", type=int, default=0)
	parser.add_argument("-dl", "--dlucky", help="Defender Lucky", type=int, default=0)
	parser.add_argument("-s", "--strategy", help="Lucky Strategy", default="default")
	parser.add_argument("-o", "--order", help="Lucky Order", default="a")
	args = parser.parse_args()

	def constructMessage():
		message = "Simulating an attack with " + str(args.power) + " power"
		if args.crit > 0:
			message += ", Critical Hit " + str(args.crit)
		if args.accuracy != 0:
			message += ", Accuracy " + str(args.accuracy)
		if args.parry > 0:
			message += ", Parry " + str(args.parry)
		if args.fury > 0:
			message += ", Fury " + str(args.fury)
		if args.alucky > 0:
			message += ", (Attacker) Lucky " + str(args.alucky)
		if args.dlucky > 0:
			message += ", (Defender) Lucky " + str(args.dlucky)
		if args.strategy != "default":
			message += ", Aggressive Rerolling strategy"
		if args.alucky > 0 and args.dlucky > 0:
			if args.order == "a":
				message += ", and using the Attacker's Lucky first."
			else:
				message += ", and using the Defender's Lucky first."
		return message

	print(constructMessage())

	(averageDamage, averageHits,
	averageCrits, averageParries,
	damageDist, hitsDist) = runSimulation(
		args.power, args.crit, args.accuracy, args.parry,
		args.fury, args.alucky, args.dlucky,
		args.strategy, args.order,
		numTrials=numTrials
	)

	print("Average damage is " + str(averageDamage))
	print("Average number of hits is " + str(averageHits))

	if args.crit > 0:
		print("Critical Hit was hit " + str(averageCrits * 100) + "% of the time")
	if args.parry > 0:
		print("Parry was hit " + str(averageParries * 100) + "% of the time")

	# plotDamagePmf(damageDist, numTrials)
	plotDamageCdf(damageDist, numTrials)
