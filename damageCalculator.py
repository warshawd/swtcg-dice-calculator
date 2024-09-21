import random
import argparse

numTrials = 10**6
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

def attackerLucky(power, thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries):
	if aLucky > 0:
		# We have enough lucky to potentially reset the parry
		if aLucky >= numParries:
			numParries = 0
		else:
			numParries -= aLucky
		# Full lucky value (at least as many misses as lucky)
		if aLucky <= misses:
			misses -= aLucky
			toReroll = aLucky
		# We reroll all available misses
		elif luckyStrategy == "default" or numCrits > 0:
			toReroll = misses
			misses = 0
		# We reroll hits too (to crit-fish)
		else:
			toReroll = min(power, aLucky)
			hits -= (aLucky - misses)
			misses = 0
		reroll = 0
		while reroll < toReroll:
			dice = random.randint(1, 6)
			if dice >= thaco:
				hits += 1
			else:
				misses += 1
			if dice == 1:
				numParries += 1
			elif dice == 6:
				numCrits += 1
			reroll += 1
	return hits, misses, numCrits, numParries




def defenderLucky(power, thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries):
	if dLucky > 0:
		# We have enough lucky to potentially reset the crit
		if dLucky >= numCrits:
			numCrits = 0
		else:
			numCrits -= dLucky
		# Full lucky value (at least as many hits as lucky)
		if dLucky <= hits:
			hits -= dLucky
			toReroll = dLucky
		# We reroll all available hits
		elif luckyStrategy == "default" or numParries > 0:
			toReroll = hits
			hits = 0
		# We reroll misses too (to fish for parry)
		else:
			toReroll = min(power, dLucky)
			misses -= (aLucky - hits)
			hits = 0
		reroll = 0
		while reroll < toReroll:
			dice = random.randint(1, 6)
			if dice >= thaco:
				hits += 1
			else:
				misses += 1
			if dice == 1:
				numParries += 1
			elif dice == 6:
				numCrits += 1
			reroll += 1
	return hits, misses, numCrits, numParries

def doTrial(power, thaco, fury, aLucky, dLucky, luckyStrategy, order):
	hits = 0
	misses = 0
	numCrits = 0
	numParries = 0
	furied = False
	# Have to generate dice in multiple rounds due to fury triggering dice that are eligible for lucky but not the other way around
	tempPower = power
	i = 0
	while i < tempPower:
		dice = random.randint(1, 6)
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
		hits, misses, numCrits, numParries = attackerLucky(tempPower, thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries)
		hits, misses, numCrits, numParries = defenderLucky(tempPower, thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries)
	else:
		hits, misses, numCrits, numParries = defenderLucky(tempPower, thaco, dLucky, luckyStrategy, hits, misses, numCrits, numParries)
		hits, misses, numCrits, numParries = attackerLucky(tempPower, thaco, aLucky, luckyStrategy, hits, misses, numCrits, numParries)
	return hits, numCrits, numParries



def runSimulation(power, criticalHit = 0, accuracy = 0, parry = 0, fury = 0, aLucky = 0, dLucky = 0, luckyStrategy = "default", order = "a"):
	trial = 0
	totalDamage = 0
	totalHits = 0
	totalCrits = 0
	totalParries = 0
	thaco = 4 - accuracy
	while trial < numTrials:
		hits, numCrits, numParries = doTrial(power, thaco, fury, aLucky, dLucky, luckyStrategy, order)
		# Compute final damage
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

		trial += 1

	return totalDamage/numTrials, totalHits/numTrials, totalCrits/numTrials, totalParries/numTrials

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

def main():
	print(constructMessage())
	averageDamage, averageHits, averageCrits, averageParries = runSimulation(args.power, args.crit, args.accuracy, args.parry, args.fury, args.alucky, args.dlucky, args.strategy, args.order)
	print("Average damage is " + str(averageDamage))
	print("Average number of hits is " + str(averageHits))
	if args.crit > 0:
		print("Critical Hit was hit " + str(averageCrits*100) + "% of the time")
	if args.parry > 0:
		print("Parry was hit " + str(averageParries*100) + "% of the time")

main()
