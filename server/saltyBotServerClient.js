/************* SALTYBOT SERVER COMPONENT By Kenji776 **************
Description: Javascript utility for making smarter bets on SaltyBet 
using basic historical analysis of the data and projected odds. Requires
user to be Salty illuminati and logged in. Must be run from the main page of Saltybet
by pasting the code into a javascript console (f12 in chrome)

Author: Daniel Llewellyn (Kenji776)

Date: 9/1/2013

Saltybet is run via twitch which already has jQuery and jQuery ui included
so no need to inject it ourself and since it's a bookmarklet we don't need ot wait 
for onready.
**************************************************/
var fighterSourceURL = 'http:/127.0.0.1/getFighters?callback=?';

document.addEventListener("DOMSubtreeModified", function ()
{
	if (event.target.id == "betstatus")
	{
		var divText= $('#'+event.target.id).text().toLowerCase().trim();
		console.log(divText);
		if(divText != null)
		{
                        console.log('Divtext is not null')
			if(divText.indexOf('bets are open') > -1)
			{
				console.log('Bets are open. Placing Webservice call in 8 seconds');
				setTimeout(getFighterNamesFromWebserviceClientServerFunction,8000);					
			}
		}
	}
}, true);


//makes callout to node.js powered webservice which returns the names of the current fighters. Should only ever be
//invoked while the place gets screen in being displayed since it causes a screenshot to happen and the tool the extracts
//the names uses coordinate positioning to find the names. Since the bet screen has the names in different places than the fight
//screen calling this during the fight would not work.
function getFighterNamesFromWebserviceClientServerFunction()
{
        console.log('Getting names from webservice');
	// Assign handlers immediately after making the request,
	// and remember the jqxhr object for this request
	var jqxhr = $.getJSON( fighterSourceURL, null, function(data){
		console.log('Fetched fighter names from webservice call');
		
		console.log(data);
	});
} 