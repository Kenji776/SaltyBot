var express = require('express');
var sh = require('execSync');
var app = express();
var fs = require('fs');
var http = require('http');
var Firebase = require('firebase');
var saltyData = new Firebase('https://saltybet.firebaseio.com/');

app.fighterData = new Object();
app.knownDuplicates = new Object();
var crypto = require('crypto');
var $ = require('jquery');
var readAttempts = 0;
var maxReadAttempts = 10;
var readFileInterval = null;
var betHistoryImportStatus = null;

app.currentFighter1;
app.currentFighter2;

var port = process.env.PORT || 80;
//configure static content route blah
app.configure(function ()
{
	app.use(express.methodOverride());
	app.use(express.bodyParser());
	app.use(express.static(__dirname + '/public'));
	app.use(express.errorHandler(
	{
		dumpExceptions: true,
		showStack: true
	}));
	app.use(app.router);
});

//******************************************************* SAFELY HANDLE ERRORS  ******************************************************
// catch the uncaught errors that weren't wrapped in a domain or try catch statement
// do not use this in modules, but only in applications, as otherwise we could have multiple of these bound
process.on('uncaughtException', function (err)
{
	// handle the error safely
	console.log(err);	
});
//******************************************************* OBJECT PROTOTYPES* ******************************************************
app.projectedFightResult = function ()
{
	this.fighter1Name;
	this.fighter2Name;
	this.projectedWinner;
	this.projectedWinnerPlayer;
	this.suggestedBetPercent;
	this.shouldBet = new Object();
	this.previousMatches = new Array();
	this.fighters = new Array();
}
//a summary of an entire fighting career
app.fightCareer = function ()
{
	this.fighterName = '';
	this.fighterLabel = '';
	this.wins = 0;
	this.knownDuplicate = false;
	this.losses = 0;
	this.winPercent = 0;
	this.total = 0;
	this.eloScore = 1200;
	this.ratingDiff = 0;
	this.isDream = false;
	this.eloWinProbability = 'N/A';
	this.computedWinProbability = 0;
	this.careerMatches = new Object();
	this.addMatch = function (matchRecord)
	{


		if (!matchRecord instanceof app.fightRecord)
		{
			return false;
		}
		for (careerMatch in this.careerMatches)
		{
			if (careerMatch == matchRecord.id)
			{
				return false;
			}
		}
		this.careerMatches[matchRecord.id] = matchRecord;
		return true;
	}
}

//a record of a single match between two fighters
app.fightRecord = function ()
{
	this.id = ''
	this.date = '';
	this.winner = '';
	this.loser = '';
	this.winnerElo = 1200;
	this.loserElo = 1200;
	this.winnerEloChange = 0;
	this.loserEloChange = 0;
}

app.listen(port, function ()
{
	console.log('Listening on ' + port);
});


app.sendResult = function (request, response, data)
{
	try
	{
		if (request.query.callback != null)
		{
			return response.send(request.query.callback + '(' + JSON.stringify(data) + ');');
		}
		else
		{
			return response.send(data);
		}
	}
	catch (e)
	{
		app.dumpError(e);
	}
}


app.readNamesFromFile = function (callback)
{
	console.log('Attempting to read names from file');
	try
	{
		fs.readFile('public\\fighter1Name.txt', "utf-8", function (err, fighter1)
		{
			if (err) console.log(err);
			fs.readFile('public\\fighter2Name.txt', "utf-8", function (err, fighter2)
			{
				if (err) console.log(err);
				var fighters = new Object();
				fighters.fighter1 = app.simplifyName(fighter1.trim().replace(/(\r\n|\n|\r)/gm, ""));
				fighters.fighter2 = app.simplifyName(fighter2.trim().replace(/(\r\n|\n|\r)/gm, ""));
				if (!app.fighterData.hasOwnProperty(fighters.fighter1))
				{
					fighters.fighter1 = app.fixFighterName(fighters.fighter1);
					fs.writeFile("public\\fighter1Name.txt", fighters.fighter1);
				}

				if (!app.fighterData.hasOwnProperty(fighters.fighter2))
				{
					fighters.fighter2 = app.fixFighterName(fighters.fighter2);
					fs.writeFile("public\\fighter2Name.txt", fighters.fighter2);
				}
				app.currentFighter1 = fighters.fighter1;
				app.currentFighter2 = fighters.fighter2;

				callback(fighters);
			});
		});
	}
	catch (e)
	{
		app.dumpError(e);
	}
}


//******************************************************* API CALLS* ******************************************************
app.get('/getFighters', function (request, response)
{
	try
	{
		var now = new Date();
		console.log('Request made to build fighter data from:' + request.connection.remoteAddress);

		fs.writeFile("public\\fighter1Name.txt", null);
		fs.writeFile("public\\fighter2Name.txt", null);
		var readAttempts = 0;
		//sometimes the screenshot tool doesn't work right, or the background on a currently animated background makes it unreadable.
		//for that reason we have a loop that attempts to read the fighter names every 5 seconds for a maximum for 5 times, or until the 
		//data is read successfully. When it is not able to read it usually just returns the letter e by itself, so testing for that we know
		//if the text returned is for real, or a fail.
		readFileInterval = setInterval(function ()
		{
			if (readAttempts > maxReadAttempts)
			{
				console.log('Too many failed read attempts. Aborting');
				clearInterval(readFileInterval);
				app.sendResult(request, response, null);
				return false;
			}
			console.log('Running screenshot utility attempt ' + readAttempts);
			var result = sh.exec('cmd /C screenshot.bat');
			app.readNamesFromFile(function (fighters)
			{
				if ((fighters.fighter1 != 'e' && fighters.fighter2 != 'e'))
				{
					clearInterval(readFileInterval);
					return app.sendResult(request, response, fighters);
				}
				else
				{
					console.log('Unable to read fighter data. Trying again in three seconds. Attempt ' + readAttempts + ' of ' + maxReadAttempts);
					readAttempts++;
					return false;
				}
			});
		}, 3000);
	}
	catch (e)
	{
		app.dumpError(e);
	}
});

app.get('/fighters', function (request, response)
{

	app.getCurrentFighterData(function (result)
	{
		var allNames = new Object();
		for (fighter in result)
		{
			allNames[result[fighter].fighterName] = result[fighter].fighterName;
		}
		app.sendResult(request, response, allNames);
	});
});

app.get('/fighters/duplicates', function (request, response)
{
	app.sendResult(request, response, app.knownDuplicates);
});


app.get('/allfighters', function (request, response)
{
	app.getCurrentFighterData(function (result)
	{
		app.sendResult(request, response, result);
	});
});


app.get('/fighters/:fighter', function (request, response)
{
	app.getCurrentFighterData(function (result)
	{
		for (fighter in result)
		{
			if (fighter == request.params.fighter)
			{
				return app.sendResult(request, response, result[fighter], true);
			}
		}
		response.statusCode = 404;
		return app.sendResult(request, response, 'Fighter with id ' + request.params.fighter + ' not found. Please use /fightername/save to create');
	});
	

});

app.get('/fight', function (request, response)
{
	var readAttempts = 0;
	var result = new app.projectedFightResult();
	var getFightInterval = setInterval(function ()
	{
		if ((app.currentFighter1 != 'e' && app.currentFighter2 != 'e') || readAttempts > maxReadAttempts)
		{
			var result = new app.projectedFightResult();
			clearInterval(getFightInterval);
			result.fighter1Name = app.currentFighter1;
			result.fighter2Name = app.currentFighter2;
			result.fighters.push(app.fighterData[app.currentFighter1]);
			result.fighters.push(app.fighterData[app.currentFighter2]);
			result = app.getFightResultProbabilities(result);
			return app.sendResult(request, response, result);
		}
		else
		{
			readAttempts++;
		}
	}, 3000);

});


app.get('/matchup', function (request, response)
{
	var result = new app.projectedFightResult();
	result.fighter1Name = request.query.fighter1;
	result.fighter2Name = request.query.fighter2;
	result.fighters.push(app.fighterData[request.query.fighter1]);
	result.fighters.push(app.fighterData[request.query.fighter2]);
	result = app.getFightResultProbabilities(result);
	app.sendResult(request, response, result);

});
//Save the results of a fight. Query params should include the winner name, loser name and the date.
app.get('/fights/save', function (request, response)
{

	app.sendResult(request, response,
	{
		success: true,
		status: 'Method Depreciated'
	}, true);

});

//Save the results of a fight. Query params should include the winner name, loser name and the date.
app.get('/fights/import', function (request, response)
{
	console.log('Got request to save data for a fight');
	if (betHistoryImportStatus == 'done')
	{
		betHistoryImportStatus = 'importing'
		app.importBetHistory();
		app.sendResult(request, response,
		{
			success: true,
			status: 'Bet History Importing'
		}, true);
	}
	else
	{
		app.sendResult(request, response,
		{
			success: false,
			status: 'Request to import history already received this round'
		}, true);
	}


});

app.CalculateEloRatingChange = function (player1Score, player2Score, result, gamesPlayed)
{
	try
	{
		var eloResult = new Object();
		gamesPlayed = gamesPlayed == 0 ? 1 : gamesPlayed;
		var Elo1 = player1Score;
		var Elo2 = player2Score;
		var K = Math.round(800 / gamesPlayed);
		var EloDifference = Elo2 - Elo1;
		var percentage = 1 / (1 + Math.pow(10, EloDifference / 400));
		var win = Math.round(K * (1 - percentage));
		var draw = Math.round(K * (.5 - percentage));
		if (win > 0) win = "+" + win;
		if (draw > 0) draw = "+" + draw;

		if (result == 'win')
		{
			return parseInt(win, 10);
		}
		else
		{
			return parseInt(Math.round(K * (0 - percentage)), 10);
		}
	}
	catch (e)
	{
		app.dumpError(e);
	}
}

app.calculateEloScores = function (fighterCareers)
{
	try
	{
		for (fighter in fighterCareers)
		{
			var thisFighter = fighterCareers[fighter];

			for (fightRecord in thisFighter.careerMatches)
			{
				var thisFight = thisFighter.careerMatches[fightRecord];
				var winner = thisFight.winner;
				var loser = thisFight.loser;

				var winnerPrevScore = parseInt(fighterCareers[winner].eloScore, 10);
				var loserPrevScore = parseInt(fighterCareers[loser].eloScore, 10);

				thisFight.winnerElo = winnerPrevScore;
				thisFight.loserElo = loserPrevScore;

				thisFight.winnerEloChange = parseInt(app.CalculateEloRatingChange(winnerPrevScore, loserPrevScore, 'win', fighterCareers[winner].total), 10);
				thisFight.loserEloChange = parseInt(app.CalculateEloRatingChange(loserPrevScore, winnerPrevScore, 'lose', fighterCareers[loser].total), 10);

				fighterCareers[winner].eloScore = parseInt(winnerPrevScore + thisFight.winnerEloChange, 10);
				fighterCareers[loser].eloScore = parseInt(loserPrevScore + thisFight.loserEloChange, 10);
			}
		}
	}
	catch (e)
	{
		app.dumpError(e);
	}
	return fighterCareers;

}

//uses some basic logic to figure out if we have enough information to place a 'safe' bet. Checks out total fights the char has been in
//and how close the percentages are between the two. If it is too close or we don't have at least 5 matches for each char then don't bet.

app.shouldBet = function (fightData)
{
	var returnObject = new Object();
	returnObject.reasonCode = 'data is sufficient for reasonable prediction';
	returnObject.shouldBet = true;
	try
	{
	
		if (fightData.fighters[0].total < 5 || fightData.fighters[1].total < 5)
		{
			returnObject.reasonCode = 'not enough fighter data to be sure';
			returnObject.shouldBet = false;
		}
		if (fightData.fighters[0].computedWinProbability < 55 && fightData.fighters[0].computedWinProbability > 47)
		{
			returnObject.reasonCode = 'win probabilities too close';
			returnObject.shouldBet = false;
		}
		if (fightData.fighters[0].knownDuplicate || fightData.fighters[1].knownDuplicate)
		{
			returnObject.reasonCode = 'at least one fighter is a  known duplicate';
			returnObject.shouldBet = false;
		}
		
	}
	catch(e)
	{
		app.dumpError(e);
	}
	return returnObject;
}

//function for figuring out how much we should bet based on our confidence in the result. The more confident we are (as judged by the win probability spread)
//the more of our total salty bucks we will bet. At a spread greater than 50 we just automatically get it all.
app.calculateBetAmount = function (fightResult)
{
	var betPercent = 0.1;
	try
	{
		
		var winPercentDifference = fightResult.fighters[0].winPercent > fightResult.fighters[1].winPercent ? fightResult.fighters[0].winPercent - fightResult.fighters[1].winPercent : fightResult.fighters[1].winPercent - fightResult.fighters[0].winPercent;
		
	
		//if there is a big enough spread between the fighers to basically be a sure thing, or if we don't have enough money to really worry about since we'll just get most
		//of it back via bailout; just bet it all.
		//otherwise for every percent point difference, bet two percent of our total pot. So if P1 had a 60% chance
		//and p2 had a fourty percent chance that means there is a 20% spread. That means we should be 40% of our total saltybucks.
		betPercent = Math.abs(Math.ceil(winPercentDifference * 2));
	
		betPercent = betPercent > 100 ? 100 : betPercent;
	}
	catch(e)
	{
		app.dumpError(e);
	}
	return betPercent;
}

app.fixFighterName = function (sourceFighterName)
{
	var targetName = sourceFighterName;
	try
	{
		var lowestDistance = 100;

		for (fighterName in app.fighterData)
		{
			var distance = app.getEditDistance(sourceFighterName, fighterName); // 3 
			if (distance < lowestDistance)
			{
				lowestDistance = distance;
				targetName = fighterName;
			}
		}		
	}
	catch(e)
	{
		app.dumpError(e);
	}
	return targetName;
}



app.parseBetHistoryTable = function (htmlContent, callback)
{
	fs.readFile('totals.htm', "utf-8", function (err, response)
	{
		result = $(response);

		var totals = new Object();

		result.find("tr").each(function ()
		{
			var label = $(this).find("td").eq(0).text();
			var name = app.simplifyName(label).trim();

			//because the name may get modified later to avoid dupes,
			//but we still want to be aware of dupes we make a copy of the original name
			var originalName = name;
			var isDupe = false;
			if (name.length == 0 && label.length == 0)
			{
				return;
			}

			if (totals.hasOwnProperty(name))
			{
				isDupe = true;
				//if we don't have an entry for this char in the known duplicates object then that means this is the first
				//time we've detected a duplicate so we need to add the original entry, and later we'll add this new one as well
				//so both chars are logged but shouldn't end up having multiple copies of the same data.
				if (!app.knownDuplicates.hasOwnProperty(name))
				{
					app.knownDuplicates[name] = new Array();
					totals[name].knownDuplicate = true;
					app.knownDuplicates[name].push(totals[name]);
				}

				console.log('Uh oh, we\'ve got a known duplicate fighter name at : ' + name);
				//since we know we have a duplicate we should modify the name to make sure it doesn't collide. We should do it in a methodical way thoug
				//instead of just a random number adjustments, so we'll look at the last char and add one to it.
				var lastChar = name[name - 1];
				if (!isNaN(lastChar))
				{
					name = name + parseInt(lastChar + 1);
				}


			}

			totals[name] = new app.fightCareer();
			totals[name].fighterName = name;
			totals[name].fighterLabel = label;
			totals[name].wins = parseInt($(this).find("td").eq(2).html(), 10);
			totals[name].losses = parseInt($(this).find("td").eq(3).html(), 10);
			totals[name].total = parseInt($(this).find("td").eq(1).html(), 10);
			totals[name].winPercent = totals[name].wins > 0 ? (totals[name].wins / totals[name].total * 100).toFixed(2) : 0;

			if (isDupe)
			{
				totals[name].knownDuplicate = true;
				app.knownDuplicates[originalName].push(totals[name]);

			}
		});
		//Now that we know their career highlights we should get the match by match breakdown
		app.getPreviousMatchupResult(totals, false, function (result)
		{
			callback(app.calculateEloScores(result));
		});
	});
}



app.getAllBetFiles = function (dir, callback)
{
	try
	{
		EventEmitter = require('events').EventEmitter,
		filesEE = new EventEmitter(),
		myfiles = [];

		// read all files from current directory
		fs.readdir('bets/', function (err, files)
		{
			if (err) throw err;
			files.forEach(function (file)
			{
				myfiles.push(file);
			});
			filesEE.emit('files_ready'); // trigger files_ready event
		});

		// this event will be called when all files have been added to myfiles
		filesEE.on('files_ready', function ()
		{
			callback(myfiles);
		});
	}
	catch (e)
	{
		app.dumpError(e);
	}
}
app.getPreviousMatchupResult = function (careers, useCache, callback)
{
	var totalBets = 0;
	EventEmitter = require('events').EventEmitter,
	filesEE = new EventEmitter();

	var allFighterData = new Object();

	app.getAllBetFiles('bets\\', function (files)
	{

		for (var i = 0; i < files.length; i++)
		{
			fs.readFile('bets\\' + files[i], "utf-8", function (err, response)
			{
				result = $(response);

				result.find("tr").each(function ()
				{
					totalBets++;
					var thisFight = new app.fightRecord();

					//figure out who fought, and create array by splitting on the word ' vs ' to get an array element one contains player1 name, and element two contains player2name
					var matchup = app.simplifyName($(this).find("td").eq(1).text()).split('vs');
					if (matchup.length == 0)
					{
						return;
					}
					//the winner of this matchup is the name of the player located in the 3rd cell.
					thisFight.winner = app.simplifyName($(this).find("td").eq(3).children().text());

					//the loser of the match was the name of the person who isn't the winner				
					thisFight.loser = matchup[0] == thisFight.winner ? matchup[1] : matchup[0];

					//get the date of the match				
					thisFight.date = $(this).find("td").eq(5).text()

					//set the matches id
					thisFight.id = app.buildFightRecordId(thisFight);

					//append this match to the winners and losers history	
					if (careers.hasOwnProperty(thisFight.winner))
					{
						careers[thisFight.winner].addMatch(thisFight);
					}
					if (careers.hasOwnProperty(thisFight.loser))
					{
						careers[thisFight.loser].addMatch(thisFight);
					}
				});
				filesEE.emit('data_ready'); // trigger files_ready event
			});

		}

	});

	// this event will be called when all files have been added to myfiles
	filesEE.on('data_ready', function ()
	{
		console.log('Parsed ' + totalBets + ' bet records in total');
		callback(careers);
	});

}
app.saveFighter = function (fighterData, callback)
{
	var fighterRef = new Firebase('https://saltybet.firebaseio.com/' + fighterData.fighterName);

	console.log('Saving data for ' + fighterData.fighterName);
	fighterRef.set(fighterData, callback);
}

app.getCurrentFighterData = function (callback, flushCache)
{
	flushCache = flushCache || false;
	if (Object.keys(app.fighterData).length == 0 || flushCache)
	{
		console.log('Getting all fighter data');
		saltyData.on('value', function (snapshot)
		{
			app.fighterData = snapshot.val();
			callback(app.fighterData);
		});
	}
	else
	{
		callback(app.fighterData);
	}
}

//takes a fighterCareer object and modifies it
app.getFightResultProbabilities = function (thisProjectedFightResult)
{
	try
	{
		var player1 = thisProjectedFightResult.fighters[0];
		var player2 = thisProjectedFightResult.fighters[1];

		//find players rating difference and record
		player1.ratingDiff = player1.eloScore - player2.eloScore;
		player2.ratingDiff = player2.eloScore - player1.eloScore;

		//calculate their win probabilities. The Elo system has it's own function for calculating win probability
		//based on scores, so I just use that as my 'baseline' probabilities. Then I modify it using my other data later on.
		player1.eloWinProbability = parseInt(app.calculateEloWinOddsPercent(player1.ratingDiff) * 100, 10);
		player2.eloWinProbability = parseInt(app.calculateEloWinOddsPercent(player2.ratingDiff) * 100, 10);

		//calculate custom their win probabilities starting at ELO
		player1.computedWinProbability = player1.eloWinProbability;
		player2.computedWinProbability = player2.eloWinProbability;

		//now we need to see if these two players have had any previous matches together. If so we iterate over them
		//and modify their win probabilities accordingly.
		thisProjectedFightResult.previousMatches = app.findPreviousMatch(thisProjectedFightResult)


		//we will need to know what element in the fighters array holds the winner and loser, so lets deduce that now.

		for (var i = 0; i < thisProjectedFightResult.previousMatches.length; i++)
		{
			var winner = thisProjectedFightResult.previousMatches[i].winner;
			var loser = thisProjectedFightResult.previousMatches[i].loser;

			//we don't want to make their probability much higher than 95 because we can never be that sure and also
			//anything over 100 is totally meaningless. I decided a factor of 8 percent per win seems about decent. Maybe
			//it should be a little more? I don't know it's still something I'm kind of playing with. But yeah, for every win a 
			//char has against the other char they get +8% likelyhood to win and the other char losses 8%.
			if (winner.computedWinProbability < .92)
			{
				winner.computedWinProbability = winner.computedWinProbability + 0.08;
			}
			if (loser.computedWinProbability > .08)
			{
				loser.computedWinProbability = loser.computedWinProbability - 0.08;
			}
		}

		//their win loss percent can be a good statistic if it is composed of enough data points to be meaningful.
		//here is where I wish I had more prob and stats background because I really don't know how many matches it would
		//take for this percent to be actually significant. I'm guessing at 10, so I decided to go with that. If both chars
		//have more than 10 matches under their belt, then lets include their win loss percents in our calculation.
		if (player1.total >= 10 && player2.total >= 10)
		{
			//get the difference between the two win percents. So if we had p1 with 50 and p2 with 75 the difference is 25
			//yes I know ternaries are hard to read, but its cleaner than a stupid one line if statment. Just know that this
			//will return a positive amount that is the difference in win percent between the two.
			var winPercentDifference = player1.winPercent > player2.winPercent ? player1.winPercent - player2.winPercent : player2.winPercent - player1.winPercent;

			//multiple that difference by how confident we are (total number of matches) topping out at. So a number from 20 to 100
			var confidenceScore = player1.total + player2.total > 100 ? 100 : player1.total + player2.total;

			var adjustment = Math.round((winPercentDifference) * (confidenceScore / 100) / 2);

			//make the actual adjustments to the players probabilities
			if (player1.winPercent > player2.winPercent)
			{
				player1.computedWinProbability += adjustment;
				player2.computedWinProbability += adjustment * -1;
			}
			else
			{
				player1.computedWinProbability += adjustment * -1;
				player2.computedWinProbability += adjustment;
			}
		}
		if (player1.computedWinProbability >= 100)
		{
			player1.computedWinProbability = 99;
		}
		if (player2.computedWinProbability >= 100)
		{
			player2.computedWinProbability = 99;
		}
		if (player1.computedWinProbability <= 0)
		{
			player1.computedWinProbability = 1;
		}
		if (player2.computedWinProbability <= 1)
		{
			player2.computedWinProbability = 1;
		}
		thisProjectedFightResult.projectedWinner = player1.computedWinProbability > player2.computedWinProbability ? player1.fighterName : player2.fighterName;
		thisProjectedFightResult.shouldBet = app.shouldBet(thisProjectedFightResult);
		thisProjectedFightResult.suggestedBetPercent = app.calculateBetAmount(thisProjectedFightResult);
		thisProjectedFightResult.projectedWinnerPlayer = thisProjectedFightResult.projectedWinner == player1.fighterName ? 1 : 2;
		thisProjectedFightResult.isDream = player1.computedWinProbability > 80 || player1.computedWinProbability < 20 ? true : false;
	}
	catch (e)
	{
		app.dumpError(e);
	}
	return thisProjectedFightResult;
}
//The ELO system has a built in formula for finding the win/loss odds for a player
//based on their rating difference from their opponent. This is an implimentation for that formula

app.calculateEloWinOddsPercent = function (ratingDifference)
{
	var P = parseFloat(eval(ratingDifference)) / 400.0;
	P = 1.0 + Math.pow(10.0, -P);
	P = 1.0 / P;
	P = Math.round(P * 1000.0) / 1000.0;
	return P;
}

//look at two fighters history and see if they have fought before. Return an array of fightRecord objects
//for each previous match.
app.findPreviousMatch = function (thisProjectedFightResult)
{
	var oldMatches = new Array();
	try
	{
		for (fightRecord in thisProjectedFightResult.fighters[0].careerMatches)
		{
			var fight = thisProjectedFightResult.fighters[0].careerMatches[fightRecord];
			if ((fight.winner == thisProjectedFightResult.fighter1Name && fight.loser == thisProjectedFightResult.fighter2Name) ||
				(fight.winner == thisProjectedFightResult.fighter2Name && fight.loser == thisProjectedFightResult.fighter1Name))
			{
				oldMatches.push(fight)
			}
		}
	}
	catch (e)
	{
		app.dumpError(e);
	}
	return oldMatches;
}



app.buildFightRecordId = function (fightRecord)
{
	var fightIdString = fightRecord.winner + '-' + fightRecord.loser + '-' + fightRecord.date;
	var recordId = 'x_' + crypto.createHash('md5').update(fightIdString).digest("hex");
	return app.simplifyName(recordId);
}

app.simplifyName = function (str)
{
	if (str != null)
	{
		return str.trim().toLowerCase().replace(/[^A-Z0-9]+/ig, "");
	}
	else
	{
		return '';
	}
}

app.getEditDistance = function (a, b)
{

	if (a.length == 0) return b.length;
	if (b.length == 0) return a.length;

	var matrix = [];

	// increment along the first column of each row
	var i;
	for (i = 0; i <= b.length; i++)
	{
		matrix[i] = [i];
	}

	// increment each column in the first row
	var j;
	for (j = 0; j <= a.length; j++)
	{
		matrix[0][j] = j;
	}

	// Fill in the rest of the matrix
	for (i = 1; i <= b.length; i++)
	{
		for (j = 1; j <= a.length; j++)
		{
			if (b.charAt(i - 1) == a.charAt(j - 1))
			{
				matrix[i][j] = matrix[i - 1][j - 1];
			}
			else
			{
				matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
					Math.min(matrix[i][j - 1] + 1, // insertion
						matrix[i - 1][j] + 1)); // deletion
			}
		}
	}

	return matrix[b.length][a.length];
}

app.dumpError = function (err)
{
	if (typeof err === 'object')
	{
		if (err.message)
		{
			console.log('\nMessage: ' + err.message)
		}
		if (err.stack)
		{
			console.log('\nStacktrace:')
			console.log('====================')
			console.log(err.stack);
		}
	}
	else
	{
		console.log('dumpError :: argument is not an object');
	}

	if (request.connection.remoteAddress != null)
	{
		app.sendResult(request, response, err);
	}
}

app.getFighterTotals = function (urlPath, filePath, callback)
{
	try
	{
		console.log('Sending Get Request');
		var options = {
			host: 'www.saltybet.com',
			port: 80,
			path: urlPath,
			method: 'GET',
			headers:
			{
				'Cookie': '__cfduid=d60ebbe908f81e1cd3e39a53c6209e8bf1377539514991; PHPSESSID=ed4jfsakihj8br5u1mcu0iefk5; fl=en-us; __utma=254390282.1277351826.1377539515.1379291252.1379305671.107; __utmb=254390282.10.10.1379305671; __utmc=254390282; __utmz=254390282.1377794654.12.6.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); _ga=GA1.2.1277351826.1377539515'
			}
		};

		var req = http.get(options, function (res)
		{
			var pageData = "";
			res.setEncoding('utf8');
			res.on('data', function (chunk)
			{
				pageData += chunk;
			});
		});

		req.on('response', function (response)
		{
			var body = '';
			response.on('data', function (chunk)
			{
				body += chunk;
			});
			response.on('end', function ()
			{
				fs.writeFile(filePath, body, function (err)

				{
					if (err)
					{
						console.log(err);
					}
					else
					{
						callback(true);
					}
				});
			});
		});
		req.end();
	}
	catch (e)
	{
		app.dumpError(e);
	}
}
//**************************************************************** INIT ************************************************************

app.unitTests = function ()
{
	var thisCareer = new app.fightCareer();
	thisCareer.fighterLabel = 'Bob Jones The Pimp!';
	thisCareer.fighterName = app.simplifyName(thisCareer.fighterLabel);
	var fight1 = new app.fightRecord();
	fight1.date = '1234567';
	fight1.winner = 'someDude';
	fight1.loser = 'some other dude';
	fight1.id = app.buildFightRecordId(fight1);
	console.log(thisCareer.addMatch(fight1));
	console.log(thisCareer.addMatch(fight1));

}


app.importBetHistory = function (callback)
{
	try
	{
		console.log('Importing data from bet history');
		app.getFighterTotals('/stats?playerstats=1', 'totals.htm', function () {});
		app.getFighterTotals('/stats?mystats=1', 'bets\\bets.htm', function ()
		{

			app.parseBetHistoryTable(null, function (result)
			{
				if (result.length > 0)
				{


					try
					{
						console.log('Pushing data into Firebase');
						fs.writeFile("public\\betTableJson.txt", JSON.stringify(result));
						saltyData.set(JSON.parse(JSON.stringify(result)));

					}
					catch (e)
					{
						app.dumpError(e);
					}
				}
				else
				{
					console.log('No data received from web service call. Probably expired cookie.');
				}
				betHistoryImportStatus = 'done';
				callback(result);
			});
		});
	}
	catch (e)
	{
		app.dumpError(e);
	}
}

app.getCurrentFighterData(function (result)
{
	try
	{
		console.log('Fighter data fetched for ' + Object.keys(result).length + ' fighters');

		app.readNamesFromFile(function (fighters)
		{
			app.currentFighter1 = app.simplifyName(fighters.fighter1);
			app.currentFighter2 = app.simplifyName(fighters.fighter2);
		});
	}
	catch (ex)
	{
		app.dumpError(ex);
	}
});