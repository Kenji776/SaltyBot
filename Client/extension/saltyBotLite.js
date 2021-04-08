//constants Don't Touch!
var saltyBot = new Object(); //namespaced object where all objects/properties are held
saltyBot.p1NameId = 'p1name';
saltyBot.p2NameId = 'p2name';


//option defaults
saltyBot.bigWinAmount = 10000; //when a win equal to or exceeding this value happens, the saltyBot.winSound media file is played.
saltyBot.saltyBucks = 0;       //The current total amount of saltyBot.saltyBucks the player has
saltyBot.winSound = 'http://outflux.net/sounds/exclamations/ooh-yeah.wav';
saltyBot.initSound = 'http://outflux.net/sounds/exclamations/ooh-yeah.wav';
saltyBot.bailoutAmount = 700; 
saltyBot.getFighterDelay = 10; //waits 10 seconds after bets open to fetch fighter data to give API time to calculate.
saltyBot.getSaltyBuckInterval = 1000;
saltyBot.currentFightData = new Object;
//automatic betting modes and variables

saltyBot.autoBetEnabled = true;
saltyBot.allInMode = false;              //if true, bot will always bet everything until saltyBot.allInModeMax is hit. Not including money set aside for seed
saltyBot.allInModeMax = 30000;          //the amount at which saltyBot.allInMode is disabled and regular betting logic is resumed
saltyBot.dreamMode = true;              //if true intentionally bet on underdog in hopes of an upset until saltyBot.dreamModeMax is hit
saltyBot.dreamModeMax = 30000;          //the amount at which saltyBot.dreamMode is disabled and bot will return to betting on the projected winner
saltyBot.seedMoneyPercent = .10;        //Percent of money not to bet once the startSeedMoneyPoolat threshold has been met to avoid losing it all on an upset bet
saltyBot.betPercent = .50;

//runs once to construct UI

saltyBot.loadJQuery =function(callback)
{
    try
    {
		console.log('Load jQuery called');
		
        if(typeof jQuery == "undefined" || typeof jQuery.ui == "undefined")
        {
			console.log('One or more jQuery libraries are not loading. Loading now...');
            var maxLoadAttempts = 10;
            var jQueryLoadAttempts = 0;
            //We want to use jQuery as well as the UI elements, so first lets load the stylesheet by injecting it into the dom.
            var head= document.getElementsByTagName('head')[0];
            var v_css  = document.createElement('link');
            v_css.rel = 'stylesheet'
            v_css.type = 'text/css';
            v_css.href = 'http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.16/themes/redmond/jquery-ui.css';
            head.appendChild(v_css);

            //Okay, now we need the core jQuery library, lets fetch that and inject it into the dom as well
			if(jQuery == "undefined")
			{
				console.log('jQuery core not loaded. Injecting now');
				var script= document.createElement('script');
				script.type= 'text/javascript';
				script.src= 'https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js';
				head.appendChild(script);
            }     
			else
			{
				console.log('Jquery core already loaded. Not reloading');
			}			
            checkjQueryLoaded = setInterval(function()
            {             
                if(typeof jQuery != "undefined")
                {
					console.log('Loading jQuery UI library');
                    //Okay, now we need the core jQuery UI library, lets fetch that and inject it into the dom as well
                    var script= document.createElement('script');
                    script.type= 'text/javascript';
                    script.src= 'https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.16/jquery-ui.js';
                    head.appendChild(script);
                    window.clearInterval(checkjQueryLoaded);
                }
                else if(maxLoadAttempts < jQueryLoadAttempts)
                {
                    window.clearInterval(checkjQueryLoaded);
                }
                jQueryLoadAttempts++;
            },300);
            
            jQueryLoadAttempts = 0;        
        
            checkLoaded = setInterval(function()
            {             
                if(typeof jQuery != "undefined" && typeof jQuery.ui != "undefined")
                {
                    window.clearInterval(checkLoaded);
                    callback(true);
                }
                else if(maxLoadAttempts < jQueryLoadAttempts)
                {
                    window.clearInterval(checkLoaded);
                    callback(false);
                }
                jQueryLoadAttempts++;
            },500);
        }
		else
		{
			callback(true);
		}
    }
    catch(exception)
    {
        callback(false);
    }
}


setInterval(saltyBot.getSaltyBucks,saltyBot.getSaltyBuckInterval);
saltyBot.init = function()
{	
	saltyBot.injectStyle();
	
	saltyBot.p1Name = $('#'+saltyBot.p1NameId);
	saltyBot.p2Name = $('#'+saltyBot.p2NameId);
	
	saltyBot.p1Stats = $('<span id="p1Stats"></span>').insertAfter(saltyBot.p1Name);
	saltyBot.p2Stats = $('<span id="p2Stats"></span>').insertAfter(saltyBot.p2Name);
	
	$(saltyBot.p1Stats).next().remove();
	$(saltyBot.p2Stats).next().remove();
	
	$('.right').css('text-align','right');
	$('.betcard').css('height','110px');
	//create the dialog the user interacts with
	saltyBot.createInputDialog();
	
	
	$('label').css('margin-top:', '10px;');
	//create dialog for interacting with Saltybot
	$( "#fighterNames" ).dialog({
	  autoOpen: false,
	  height: 450,
	  width: 475,
	  modal: false,
	  autoOpen: false,
	  position: ['left', 'top'],
	  buttons: {
		/*
		"Get Match": function() {
			saltyBot.getRemoteData('http://xerointeractive.com/fight',function(result){
				saltyBot.processFightData(result);
			})	
		},	
		*/		  
		"Get Odds": function() {
			saltyBot.getSpecificFight($( "#player1Name" ).val(),$( "#player2Name" ).val(),function(result){
				saltyBot.processFightData(result)	
			});
		},
		"Place Bet": function() {
			saltyBot.placeBet($('#suggestedBetAmount').val(),$("#betOnSelect").val());		
		}	
	  }
	});
	$('.ui-dialog').css('font-size:', '62.5%');
	$('#autoBetEnabledCheckbox').click(function(){
		saltyBot.autoBetEnabled =  $(this).is(':checked') ? true : false;
		if(saltyBot.autoBetEnabled)
		{
			$('#betTimerDiv').show();
		}
		else
		{
			$('#betTimerDiv').hide();
		}
		saltyBot.getSaltyBucks(saltyBot.currentFightData);
	});	

	$('#dreamModeEnabledCheckbox').click(function(){
		saltyBot.dreamMode = $(this).is(':checked') ? true : false;
	});	

	$('#allInModeEnabledCheckbox').click(function(){
		saltyBot.allInMode = $(this).is(':checked') ? true : false;
		if(saltyBot.allInMode)
		{
			$('#betPercentAmountSlider').slider( "disable");
			$('#suggestedBetAmount').prop( "disabled", true );
		}
		else
		{
			$('#betPercentAmountSlider').slider( "enable");
			$('#suggestedBetAmount').prop( "disabled", false );	
					
		}
		saltyBot.calculateBetAmount();
	});		
	
	
	saltyBot.getFighterNames(function(result){
		var fighters = new Array();
		for(fighter in result)
		{
			var thisFighter=new Object();
			thisFighter.label = result[fighter].fighterLabel;
			thisFighter.value = result[fighter].fighterName;
			fighters.push(thisFighter);
		}


				
		$( "#player1Name" ).autocomplete({
		  source: fighters,
		  minLength: 2,
		  appendTo: "#fighterNames"
		}).css('z-index',1000).keyup(function(){
			player1Name =  saltyBot.simplifyName($(this).val());
			$('.player1Name').html($(this).val());						
		});
	
		$( "#player2Name" ).autocomplete({
		  source: fighters,
		  minLength: 2,
		  appendTo: "#fighterNames"	  
		}).css('z-index',1000).keyup(function(){
			player2Name =  saltyBot.simplifyName($(this).val().toLowerCase().replace(/[^A-Z0-9]+/ig, "_"));
			$('.player2Name').html(this).val();	
		});			

	});

	$( "#betPercentAmountSlider" ).slider({
	  min: 0,
	  max: 100,
	  value: saltyBot.betPercent*100,
	  slide: function( event, ui ) { 
		$("#amountSliderPercentLabel").html( 'Bet Percent Of Total: ' + ui.value + '%' );
		saltyBot.betPercent = ui.value/100;
		saltyBot.calculateBetAmount();
	  }
	});
	$("#amountSliderPercentLabel").html( 'Bet Percent Of Total: ' + saltyBot.betPercent*100 + '%' );
	
	$('#seedMoneySliderPercentSlider').slider({
	  min: 0,
	  max: 100,
	  value: saltyBot.seedMoneyPercent*100,
	  slide: function( event, ui ) { 
		$("#seedMoneySliderPercentLabel").html( 'Seed Percent: ' + ui.value + '%' );
		saltyBot.seedMoneyPercent = ui.value/100;
		saltyBot.calculateBetAmount();
	  }		
	});
	$("#seedMoneySliderPercentLabel").html( 'Seed Percent: ' + saltyBot.seedMoneyPercent*100 + '%' );
		
	document.addEventListener("DOMSubtreeModified", function ()
	{
		if (event.target.id == "betstatus")
		{
			var statusText= $('#'+event.target.id).text().trim();

			if(statusText == 'Bets are OPEN!')
			{
				saltyBot.getFighterData();						
			}
			else if(statusText == 'Bets are locked until the next match.')
			{
				saltyBot.setFighterStatusInfo(saltyBot.currentFightData);
			}
			else if(statusText.toLowerCase().indexOf('payouts') > -1)
			{
				saltyBot.getSaltyBucks();
				$(saltyBot.p1Stats).html(null);
				$(saltyBot.p2Stats).html(null);
			}

		}
	}, true);

	$(document).keydown(function(e){
    if(e.ctrlKey || e.metaKey)
		{
			if (String.fromCharCode(e.charCode||e.keyCode)=="S")
			{
				if($("#fighterNames").dialog( "isOpen" )===true)
				{

					$('#fighterNames').dialog("close");
				}
				else
				{
					$('#fighterNames').dialog("open");
				}
				return false;
			}
		}
	});
	
	saltyBot.getFighterData();
				
	$('#prevFightWarning').hide();
	$('#knownDupeWarning').hide();
	$('#fighterNames').dialog("open");
	saltyBot.getSaltyBucks();
}

saltyBot.injectStyle = function()
{
  var fileref=document.createElement("link")
  fileref.setAttribute("rel", "stylesheet")
  fileref.setAttribute("type", "text/css")
  fileref.setAttribute("href", 'http://ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/themes/black-tie/jquery-ui.css');
  document.getElementsByTagName("head")[0].appendChild(fileref);
}
saltyBot.getRemoteData = function(source,callback){
    var xhr = new XMLHttpRequest();
    
    xhr.open('GET', source);
    
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    
    xhr.onreadystatechange = function(){
        if (xhr.readyState == 4){
            if (xhr.status == 200){
                callback(JSON.parse(xhr.responseText));
            }else{
            }
            
        }
    };
    
    xhr.send();
}

saltyBot.getFighterData = function()
{
	//read the names from the text boxes. If they are not player 1 and player 2 that means saltybet is being awesome and giving us the names
	//and we can feed those right into a request. Otherwise we have to wait a few seconds to try and extract the names via OCR again. Lame
	if($(saltyBot.p1Name).text() != 'Player 1' && $(saltyBot.p2Name).text() != 'Player 2')
	{
		$('#player1Name').val($(saltyBot.p1Name).text());
		$('#player2Name').val($(saltyBot.p2Name).text());
		saltyBot.getSpecificFight($( "#player1Name" ).val(),$( "#player2Name" ).val(),function(result){
			saltyBot.processFightData(result)	
		});			
	}
	else
	{
		setTimeout(function(){
			saltyBot.getRemoteData('http://xerointeractive.com/fight',function(result){
				saltyBot.processFightData(result);
			})
		},saltyBot.getFighterDelay*1000);		
	}
}

saltyBot.processFightData = function(fightData)
{
		saltyBot.currentFightData = fightData;
		$( "#player1Name" ).val(fightData.fighters[0].fighterLabel);
		$( "#player2Name" ).val(fightData.fighters[1].fighterLabel);	
		
		player1Name = saltyBot.simplifyName(fightData.fighter1);
		player2Name = saltyBot.simplifyName(fightData.fighter2);
		
		if(!saltyBot.dreamMode)
		{
			$('#betOnSelect').val(fightData.projectedWinnerPlayer); 
		}
		else if(fightData.isDream)
		{
			var dreamWinner = fightData.projectedWinnerPlayer == 1 ? 2 : 1;
			$('#betOnSelect').val(dreamWinner); 
		}
		if(!saltyBot.allInMode)
		{
			//$('#betPercentAmountSlider').slider("value",fightData.suggestedBetPercent);
		}
		saltyBot.getSaltyBucks();
		saltyBot.createStatTable(fightData);
		saltyBot.calculateBetAmount();
		saltyBot.placeAutoBet(fightData);
		saltyBot.setFighterStatusInfo(fightData);
		saltyBot.highlightWinnerFightCard(fightData);
} 

saltyBot.getSpecificFight = function(fighter1,fighter2,callback)
{	
	if(fighter1 != 'Player1' && fighter2 != 'Player2')
	{
		saltyBot.getRemoteData('http://xerointeractive.com/matchup?fighter1='+saltyBot.simplifyName(fighter1)+'&fighter2='+saltyBot.simplifyName(fighter2),function(result){
			callback(result);
		});
	}
} 


saltyBot.calculateBetAmount = function()
{
	var betAmount = 0;
	if(saltyBot.allInMode && saltyBot.saltyBucks < saltyBot.allInModeMax)
	{
		$( "#betPercentAmountSlider" ).slider("value",100);
		$("#amountSliderPercentLabel").html( 'Bet Percent Of Total: 100%' );
		$('#suggestedBetAmount').val(saltyBot.saltyBucks);
		betAmount = saltyBot.saltyBucks			
	}
	else
	{
		$("#amountSliderPercentLabel").html( 'Bet Percent Of Total: ' + (saltyBot.betPercent*100).toFixed(0) + '%' );
		betAmount = Math.ceil(saltyBot.saltyBucks * saltyBot.betPercent)	
	}
	if(saltyBot.saltyBucks <=betAmount)
	{
		betAmount = saltyBot.saltyBucks;	
	}

	betAmount = betAmount - (saltyBot.saltyBucks * saltyBot.seedMoneyPercent).toFixed(0);

	$('#suggestedBetAmount').val(betAmount);
	return Math.abs(betAmount);
}
saltyBot.getFighterNames = function(callback)
{
	saltyBot.getRemoteData('http://xerointeractive.com/fighters',function(result){
		callback(result);
	});	
} 

saltyBot.getSaltyBucks = function()
{
	var oldBucks = saltyBot.saltyBucks;
	saltyBot.saltyBucks = parseInt($('#balance').html(),10);	
	
	if(saltyBot.saltyBucks - oldBucks > saltyBot.bigWinAmount)
	{
		saltyBot.playSound('win',saltyBot.winSound);
	}
	
	//toggle all in mode based on max. Basically if the checkbox is checked that means the user wants to use all in mode as long as
	//their total salty bucks is under the threshold. If they have more, then don't use all in mode. We never want to change the state 
	//of the checkbox itself because that is how we know if the user wants it on or off.
	if(saltyBot.saltyBucks >= saltyBot.allInModeMax)
	{
		saltyBot.allInMode = false;
		//$('#allInModeEnabledCheckbox').prop('checked',false);	
	}
	else if(saltyBot.saltyBucks <  saltyBot.allInModeMax && $('#allInModeEnabledCheckbox').is(':checked'))
	{
		saltyBot.allInMode = true;	
	}

	//toggle dream mode based on max. Basically if the checkbox is checked that means the user wants to use dream mode as long as
	//their total salty bucks is under the threshold. If they have more, then don't use dream mode. We never want to change the state 
	//of the checkbox itself because that is how we know if the user wants it on or off.	
	if(saltyBot.saltyBucks >= saltyBot.dreamModeMax)
	{
		saltyBot.dreamModeMax = false;	
		//$('#allInModeEnabledCheckbox').prop('checked',false);	
	}
	else if(saltyBot.saltyBucks < saltyBot.dreamModeMax && $('#dreamInModeEnabledCheckbox').is(':checked'))
	{
		saltyBot.dreamModeMax = true;	
	}

	
	return saltyBot.saltyBucks;
}


saltyBot.placeAutoBet = function(fightData){
	var playerNumTobetOn = fightData.fighters[0].fighterName == fightData.projectedWinner ? 1 : 2;
	
	if(saltyBot.autoBetEnabled && fightData.shouldBet.shouldBet)
	{		
		var autoBetAmount = saltyBot.calculateBetAmount();		
				
		$('#statusDiv').html('Autobetting $'+autoBetAmount + ' on player ' + playerNumTobetOn);
		saltyBot.placeBet(autoBetAmount,playerNumTobetOn);
	}
	else if(saltyBot.autoBetEnabled)
	{
		$('#statusDiv').html('Placing small bet ' + fightData.shouldBet.reasonCode);
		var autoBetAmount = saltyBot.roundBetToHumanLookingNumber(saltyBot.saltyBucks * 0.05);
		saltyBot.placeBet(autoBetAmount,playerNumTobetOn);
		
	}
	return;
}



saltyBot.roundBetToHumanLookingNumber = function(amount)
{
	//how this works is we divide the original amount by a factor of 10. Then we round down from there, then multiply by the round
	//factor to get close to the original amount. Some examples
	/*
		original amount: 982
		length: 3
		round factor: 100
		982 / 100 =  9.82
		Round down = 9
		multiple by round factor =900
		
		original amount: 1849
		length: 4
		round factor: 100
		1849 / 100 = 18.49
		round down = 18
		multiple by round factor = 1800
	
	*/
	var roundFactor = 10;
	var betLength = amount.length;
	switch(betLength)
	{
	case 3:
	  roundFactor = 100;
	  break;
	case 4:
	  roundFactor = 100;
	  break;
	case 5:
	  roundFactor = 1000;	
	case 6:
	  roundFactor = 10000;	    
	default:
	  roundFactor = 10;
	}
	
	var returnAmt = Math.floor(amount / roundFactor) * roundFactor;
	if(returnAmt <= 0)
	{
		returnAmt = 5;
	}
	return returnAmt;
}

//populates the wager box and clicks the bet button. Also clears autoBet timer and resets it.
saltyBot.placeBet = function(amount,player)
{
	$('#statusDiv').html('Betting '+amount+ ' on player ' + player);
	betOnPlayerNum = player;
	$('#wager').val(amount);
	$('input[name="player'+player+'"]').click();
	
	betPlacedThisRound = true;
}

//takes a name of a fighter and turns it into something we can reliably ID them by removing 
//spaces, special chars, trimming spaces and converting to lower case.
saltyBot.simplifyName = function(str)
{
	if(str !=null)
	{
		return str.trim().toLowerCase().replace(/[^A-Z0-9]+/ig, "");	
	}
	else
	{
		return '';	
	}
}

saltyBot.setFighterStatusInfo = function(fightResult)
{
	$(saltyBot.p1Name).html(fightResult.fighters[0].fighterLabel + ' ('+fightResult.fighters[0].computedWinProbability+'%)');
	$(saltyBot.p2Name).html(fightResult.fighters[1].fighterLabel + ' ('+fightResult.fighters[1].computedWinProbability+'%)' );

	var p1PreviousFightInfo = '';
	var p2PreviousFightInfo = '';
	if(fightResult.previousMatches.length > 0)
	{
		var fightResults = new Object();
		fightResults[fightResult.fighters[0].fighterName]= new Object();
		fightResults[fightResult.fighters[1].fighterName]= new Object();
		fightResults[fightResult.fighters[0].fighterName].wins = 0;
		fightResults[fightResult.fighters[0].fighterName].losses = 0;
		fightResults[fightResult.fighters[1].fighterName].wins = 0;
		fightResults[fightResult.fighters[1].fighterName].losses = 0;
		for(var i = 0; i < fightResult.previousMatches.length; i++)
		{
			fightResults[fightResult.previousMatches[i].winner].wins++;
			fightResults[fightResult.previousMatches[i].loser].losses++;
		}
		
		p1PreviousFightInfo = fightResult.fighters[0].fighterLabel+ ' is ' + fightResults[fightResult.fighters[0].fighterName].wins + ' - ' + fightResults[fightResult.fighters[0].fighterName].losses + ' against ' + fightResult.fighters[1].fighterLabel;
		p2PreviousFightInfo = fightResult.fighters[1].fighterLabel+ ' is ' + fightResults[fightResult.fighters[1].fighterName].wins + ' - ' + fightResults[fightResult.fighters[1].fighterName].losses + ' against ' + fightResult.fighters[0].fighterLabel;
	}
		
	var p1Stats = '<br/>Wins: ' + fightResult.fighters[0].wins + ' Losses: ' + fightResult.fighters[0].losses + '<br/>Win Percent: ' + fightResult.fighters[0].winPercent + '% ELO: ' + fightResult.fighters[0].eloScore;
	if(fightResult.fighters[0].knownDuplicate)
	{
		p1Stats += '</br><b>Character is a known duplicate. Betting this round not suggested</b>';	
	}
	if(p1PreviousFightInfo.length > 0)
	{
		p1Stats += '</br>'+p1PreviousFightInfo;	
	}
	
	
	var p2Stats = '<br/>Wins: ' + fightResult.fighters[1].wins + ' Losses: ' + fightResult.fighters[1].losses + '<br/>Win Percent: ' + fightResult.fighters[1].winPercent + '% ELO: ' + fightResult.fighters[1].eloScore;
	if(fightResult.fighters[1].knownDuplicate)
	{
		p2Stats += '</br><b>Character is a known duplicate. Betting this round not suggested</b>';	
	}
	if(p2PreviousFightInfo.length > 0)
	{
		p2Stats += '</br>'+p2PreviousFightInfo;	
	}	
	
	$(saltyBot.p1Stats).html(p1Stats);	
	$(saltyBot.p2Stats).html(p2Stats);
}

saltyBot.highlightWinnerFightCard = function(fightResult)
{
	if(fightResult.projectedWinnerPlayer == 1)
	{
		$('.redborder').effect( "highlight",  {color:"#FFFF00"}, 3000 );		
	}
	if(fightResult.projectedWinnerPlayer == 2)
	{
		$('.blueborder').effect( "highlight",  {color:"#FFFF00"}, 3000 );		
	}
}

saltyBot.createInputDialog = function()
{
	if($('#fighterNames').length == 0){
		var html = '<div id="fighterNames" title="Saltybot by Kenji776 (ctrl+s to open/close window)">';
		html += '<table width="98%"><tr><td><label for="player1Name">Player One</label> <input type="text" id="player1Name"></td>';
		html += '<td><label for="player2Name">Player Two</label> <input type="text" id="player2Name"></td></tr>';
		html += '<tr><td colspan="2"><span id="amountSliderPercentLabel">Bet Percent Of Total:</span><div id="betPercentAmountSlider" style="width:"93%"></div></p></td></tr>';	
		html += '<tr><td><label for="suggestedBetAmount">How Much To Bet</label> <input type="text" id="suggestedBetAmount"></td>';
		html += '<td><label for="betOnSelect">On Player</label><select id="betOnSelect"><option value="1">Player 1</option><option value="2">Player 2</option></select></td></tr>';
		
		html += '<tr><td colspan="2"><span id="seedMoneySliderPercentLabel">Seed Percent:</span></label><div id="seedMoneySliderPercentSlider" style="width:"93%"></div></p></td></tr>';	
		
		html += '</table>';
				
		//html += '<div id="statsTable"></div>';
		html += '<div id="prevFightWarning"><p><span class="ui-icon ui-icon-alert" style="float: left; margin: 0 7px 20px 0;"></span><span id="prevFightWarningText"></span></p></div>';
		html += '<div id="knownDupeWarning"><p><span class="ui-icon ui-icon-alert" style="float: left; margin: 0 7px 20px 0;"></span><span id="knownDupeWarningText"></span></p></div>';
		html += '<div id="options" style="position: absolute; bottom: 0; left: 0;font-size:11px; width:270px;">';
		html += '<input type="checkbox" id="autoBetEnabledCheckbox" checked="checked"><label for="autoBetEnabledCheckbox" style="display:inline">Use AutoBet</label>';
		html += '<input type="checkbox" id="allInModeEnabledCheckbox"><label for="allInModeEnabledCheckbox" style="display:inline">All In Mode</label>';
		html += '<input type="checkbox" id="dreamModeEnabledCheckbox"><label for="dreamInModeEnabledCheckbox" style="display:inline">Dream Mode</label>';
		html += '<br/></div>';
		html += '<span id="betTimerDiv" ></span>';
		html += '<div id="statusDiv" style="position: absolute; bottom: 0; right: 0;font-size:11px;"></div>';
		html += '</div>';
		
		$('body').append(html);
	}
}
saltyBot.createStatTable = function(fightResult)
{

	html = '<table cellspacing="2" cellpadding="2" border="1"><thead><tr><th>Stat</th><th>'+fightResult.fighters[0].fighterLabel+'</th><th>'+fightResult.fighters[1].fighterLabel+'</th>';
	html +='<tr><td>Wins</td><td>'+fightResult.fighters[0].wins+'</td><td>'+fightResult.fighters[1].wins+'</td></tr>';
	html +='<tr><td>Losses</td><td>'+fightResult.fighters[0].losses+'</td><td>'+fightResult.fighters[1].losses+'</td></tr>';
	html +='<tr><td>Win %</td><td>'+fightResult.fighters[0].winPercent+'%</td><td>'+fightResult.fighters[1].winPercent+'%</td></tr>';
	html +='<tr><td>ELO Score</td><td>'+fightResult.fighters[0].eloScore+'</td><td>'+fightResult.fighters[1].eloScore+'</td></tr>';
	html +='<tr><td>Should Bet?</td><td colspan="2">'+fightResult.shouldBet.shouldBet + ' ';
	
	if(!fightResult.shouldBet.shouldBet)
	{
		html +='Because ' +fightResult.shouldBet.reasonCode; 
	}
	html +='</td></tr>';
	html +='<tr><td>Suggested Bet</td><td colspan="2">'+fightResult.suggestedBetPercent+'% ($'+saltyBot.calculateBetAmount()+')</td></tr>';
	html +='<tr><td>Win Probability</td><td>'+fightResult.fighters[0].computedWinProbability+'%</td><td>'+fightResult.fighters[1].computedWinProbability+'%</td></tr>';	
	html +='<tr><td>Projected Winner</td><td colspan="2">'+fightResult.projectedWinner+'</td></tr>';
	html += '</tbody></table>';	

	if(fightResult.previousMatches.length > 0)
	{
		var fightResults = new Object();
		fightResults[fightResult.fighters[0].fighterName]= new Object();
		fightResults[fightResult.fighters[1].fighterName]= new Object();
		fightResults[fightResult.fighters[0].fighterName].wins = 0;
		fightResults[fightResult.fighters[0].fighterName].losses = 0;
		fightResults[fightResult.fighters[1].fighterName].wins = 0;
		fightResults[fightResult.fighters[1].fighterName].losses = 0;
		for(var i = 0; i < fightResult.previousMatches.length; i++)
		{
			fightResults[fightResult.previousMatches[i].winner].wins++;
			fightResults[fightResult.previousMatches[i].loser].losses++;
		}
		
		$('#prevFightWarningText').html('<b>This matchup has happened before!</b><br>'+fightResult.fighters[0].fighterLabel+ ' is ' + fightResults[fightResult.fighters[0].fighterName].wins + ' - ' + fightResults[fightResult.fighters[0].fighterName].losses + ' against ' + fightResult.fighters[1].fighterLabel);
		$('#prevFightWarning').show().effect( "highlight",  {color:"#FFFF00"}, 3000 );		
	}
	else
	{
		$('#prevFightWarning').hide();
	}
	if(fightResult.fighters[0].knownDuplicate || fightResult.fighters[1].knownDuplicate)
	{
		$('#knownDupeWarningText').html('<b>At least one of the characters in this match is a known duplicate therefore accurate data cannot be guarenteed. Betting is not advised</b>');
		$('#knownDupeWarning').show().effect( "highlight",  {color:"#FFFF00"}, 3000 );	
	}
	else
	{
		$('#knownDupeWarning').hide();
	}
	$('#statsTable').html(html);	
}


saltyBot.playSound = function(id,src)
{
		if($('#'+id).length == 0)
		{
			html = '<audio class = "audio-player" src = "'+src+'" id="'+id+'"></audio>';
			$('body').append(html);
		}
		$('#'+id)[0].volume=1.0;
		$('#'+id)[0].play();
}

saltyBot.loadJQuery(function(loadSuccess){
    if(loadSuccess)
    {
		console.log('jQuery loaded!');
        saltyBot.init();
    }
    else
    {
        console.log('Couldn\'t load jQuery :(');    
    }
});


